import { Mat, type TLShape, type TLShapeId } from 'tldraw'
import type {
  TLModifier,
  LinearArraySettings,
  CircularArraySettings,
  GridArraySettings,
  MirrorSettings,
  GroupContext
} from '../../../types/modifiers'

/**
 * Virtual instance represents a transform without creating actual TLShape
 * This lightweight structure dramatically reduces memory usage
 */
export interface VirtualInstance {
  sourceShapeId: string
  transform: Mat
  metadata: {
    modifierType: string
    index: number
    sourceIndex?: number
    arrayIndex?: number
    [key: string]: unknown
  }
}

/**
 * Optimized modifier state using virtual instances
 */
export interface VirtualModifierState {
  originalShape: TLShape
  virtualInstances: VirtualInstance[]
  baseTransform: Mat
  metadata?: Record<string, unknown>
}

/**
 * Matrix-based transform composer for efficient modifier processing
 * Composes transforms mathematically instead of creating intermediate shapes
 */
export class TransformComposer {
  /**
   * Process modifiers using matrix composition for O(n) complexity
   * instead of O(n²) instance multiplication
   */
  static processModifiers(
    shape: TLShape,
    modifiers: TLModifier[],
    groupContext?: GroupContext
  ): VirtualModifierState {
    // Start with identity transform for the original shape
    const baseTransform = Mat.Identity()

    // Initialize with single virtual instance representing original
    let virtualInstances: VirtualInstance[] = [{
      sourceShapeId: shape.id,
      transform: Mat.Translate(shape.x, shape.y).multiply(
        Mat.Rotate(shape.rotation || 0)
      ),
      metadata: {
        modifierType: 'original',
        index: 0,
        isOriginal: true
      }
    }]

    // Process each enabled modifier in sequence
    const enabledModifiers = modifiers
      .filter(m => m.enabled)
      .sort((a, b) => a.order - b.order)

    for (const modifier of enabledModifiers) {
      virtualInstances = this.applyModifier(
        virtualInstances,
        modifier,
        shape,
        groupContext
      )
    }

    return {
      originalShape: shape,
      virtualInstances,
      baseTransform,
      metadata: { processedModifiers: enabledModifiers.length }
    }
  }

  /**
   * Apply a single modifier to virtual instances using matrix composition
   */
  private static applyModifier(
    instances: VirtualInstance[],
    modifier: TLModifier,
    originalShape: TLShape,
    _groupContext?: GroupContext
  ): VirtualInstance[] {
    switch (modifier.type) {
      case 'linear-array':
        return this.applyLinearArray(instances, modifier.props as LinearArraySettings, originalShape)
      case 'circular-array':
        return this.applyCircularArray(instances, modifier.props as CircularArraySettings, originalShape)
      case 'grid-array':
        return this.applyGridArray(instances, modifier.props as GridArraySettings, originalShape)
      case 'mirror':
        return this.applyMirror(instances, modifier.props as MirrorSettings, originalShape)
      default:
        console.warn(`Matrix composer not yet implemented for: ${modifier.type}`)
        return instances
    }
  }

  /**
   * Linear array using matrix composition
   */
  private static applyLinearArray(
    instances: VirtualInstance[],
    settings: LinearArraySettings,
    originalShape: TLShape
  ): VirtualInstance[] {
    const { count, offsetX, offsetY, rotationIncrement, rotateAll, scaleStep } = settings

    const newInstances: VirtualInstance[] = []

    // Get shape dimensions for percentage-based offsets
    const shapeBounds = this.getShapeBounds(originalShape)
    const pixelOffsetX = (offsetX / 100) * shapeBounds.width
    const pixelOffsetY = (offsetY / 100) * shapeBounds.height

    for (const instance of instances) {
      for (let i = 0; i < count; i++) {
        // Get the current position from the instance transform
        const currentPos = instance.transform.point()
        const currentRotation = instance.transform.rotation()

        // Calculate new position by adding offsets
        // Start from offset position (i+1) so first clone is offset from original
        const newX = currentPos.x + (pixelOffsetX * (i + 1))
        const newY = currentPos.y + (pixelOffsetY * (i + 1))

        // Calculate new rotation
        const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
        const uniformRotation = (rotateAll * Math.PI) / 180
        const totalRotation = currentRotation + incrementalRotation + uniformRotation

        // Calculate scale
        const progress = count > 1 ? i / (count - 1) : 0
        const scale = 1 + ((scaleStep / 100) - 1) * progress

        // Create new transform with calculated position and rotation
        const composedTransform = Mat.Compose(
          Mat.Translate(newX, newY),
          Mat.Rotate(totalRotation),
          Mat.Scale(scale, scale)
        )

        newInstances.push({
          sourceShapeId: instance.sourceShapeId,
          transform: composedTransform,
          metadata: {
            modifierType: 'linear-array',
            index: newInstances.length,
            sourceIndex: instances.indexOf(instance),
            arrayIndex: i,
            linearArrayIndex: i
          }
        })
      }
    }

    return newInstances
  }

  /**
   * Circular array using matrix composition
   */
  private static applyCircularArray(
    instances: VirtualInstance[],
    settings: CircularArraySettings,
    _originalShape: TLShape
  ): VirtualInstance[] {
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToTangent } = settings
    const newInstances: VirtualInstance[] = []

    for (const instance of instances) {
      for (let i = 0; i < count; i++) {
        // Calculate angle for this position
        const totalAngle = endAngle - startAngle
        const isFullCircle = Math.abs(totalAngle) >= 360
        const angleStep = count > 1 ? (isFullCircle ? totalAngle / count : totalAngle / (count - 1)) : 0
        const angle = (startAngle + angleStep * i) * Math.PI / 180

        // Circular position as matrix
        const circularX = (centerX || 0) + Math.cos(angle) * radius
        const circularY = (centerY || 0) + Math.sin(angle) * radius
        const positionMatrix = Mat.Translate(circularX, circularY)

        // Rotation composition
        let rotationAngle = 0
        if (alignToTangent) {
          rotationAngle += angle + Math.PI / 2
        }
        if (rotateAll) {
          rotationAngle += (rotateAll * Math.PI / 180)
        }
        if (rotateEach) {
          rotationAngle += (rotateEach * i * Math.PI / 180)
        }
        const rotationMatrix = Mat.Rotate(rotationAngle)

        // Compose transforms
        const composedTransform = Mat.Compose(
          positionMatrix,
          rotationMatrix,
          instance.transform
        )

        newInstances.push({
          sourceShapeId: instance.sourceShapeId,
          transform: composedTransform,
          metadata: {
            modifierType: 'circular-array',
            index: newInstances.length,
            sourceIndex: instances.indexOf(instance),
            arrayIndex: i,
            circularArrayIndex: i
          }
        })
      }
    }

    return newInstances
  }

  /**
   * Grid array using matrix composition
   */
  private static applyGridArray(
    instances: VirtualInstance[],
    settings: GridArraySettings,
    _originalShape: TLShape
  ): VirtualInstance[] {
    const { rows, columns, spacingX, spacingY, offsetX, offsetY } = settings
    const newInstances: VirtualInstance[] = []

    for (const instance of instances) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          // Grid position as matrix
          const gridX = (offsetX || 0) + (col * spacingX)
          const gridY = (offsetY || 0) + (row * spacingY)
          const positionMatrix = Mat.Translate(gridX, gridY)

          // Compose with source transform
          const composedTransform = Mat.Compose(
            positionMatrix,
            instance.transform
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: composedTransform,
            metadata: {
              modifierType: 'grid-array',
              index: newInstances.length,
              sourceIndex: instances.indexOf(instance),
              arrayIndex: row * columns + col,
              gridArrayIndex: row * columns + col,
              gridPosition: { row, col }
            }
          })
        }
      }
    }

    return newInstances
  }

  /**
   * Mirror modifier using matrix composition
   */
  private static applyMirror(
    instances: VirtualInstance[],
    settings: MirrorSettings,
    _originalShape: TLShape
  ): VirtualInstance[] {
    const { axis, offset } = settings

    if (axis !== 'x' && axis !== 'y') {
      return instances
    }

    const newInstances: VirtualInstance[] = []

    // Detect if we're processing instances from previous modifiers
    const hasModifiedInstances = instances.length > 1 ||
      instances.some(inst => inst.metadata.modifierType !== 'original')

    // If there are instances from previous modifiers, preserve them
    if (hasModifiedInstances) {
      instances.forEach(instance => {
        newInstances.push({
          sourceShapeId: instance.sourceShapeId,
          transform: instance.transform,
          metadata: {
            ...instance.metadata,
            index: newInstances.length
          }
        })
      })
    }

    // Then create mirrored copies of ALL instances
    instances.forEach(instance => {
      // Extract position from transform matrix
      const position = instance.transform.point()

      // Create mirror transformation matrix
      let mirrorMatrix: Mat

      if (axis === 'x') {
        // Mirror across vertical line at x = offset
        // This is equivalent to: translate(-offset, 0) * scale(-1, 1) * translate(offset, 0)
        mirrorMatrix = Mat.Compose(
          Mat.Translate(offset * 2 - position.x, position.y),
          Mat.Scale(-1, 1),
          instance.transform.rotation() !== 0 ? Mat.Rotate(-instance.transform.rotation() * 2) : Mat.Identity()
        )
      } else {
        // Mirror across horizontal line at y = offset
        // This is equivalent to: translate(0, -offset) * scale(1, -1) * translate(0, offset)
        mirrorMatrix = Mat.Compose(
          Mat.Translate(position.x, offset * 2 - position.y),
          Mat.Scale(1, -1),
          instance.transform.rotation() !== 0 ? Mat.Rotate(-instance.transform.rotation() * 2) : Mat.Identity()
        )
      }

      // Compose with the original transform to get final mirrored position
      const composedTransform = mirrorMatrix

      newInstances.push({
        sourceShapeId: instance.sourceShapeId,
        transform: composedTransform,
        metadata: {
          ...instance.metadata,
          modifierType: 'mirror',
          index: newInstances.length,
          isMirrored: true,
          mirrorAxis: axis,
          mirrorOffset: offset,
          sourceIndex: instances.indexOf(instance),
          // Store flip metadata for shape rendering
          isFlippedX: axis === 'x',
          isFlippedY: axis === 'y'
        }
      })
    })

    return newInstances
  }


  /**
   * Helper to get shape bounds for percentage calculations
   */
  private static getShapeBounds(shape: TLShape): { width: number; height: number } {
    // Handle different shape types
    if ('w' in shape.props && 'h' in shape.props) {
      return {
        width: shape.props.w as number,
        height: shape.props.h as number
      }
    }

    // Default fallback
    return { width: 100, height: 100 }
  }

  /**
   * Convert virtual instances to actual TLShapes when needed
   * This is the "materialization" step that creates real shapes
   */
  static materializeInstances(
    virtualState: VirtualModifierState,
    createId: () => TLShapeId
  ): TLShape[] {
    const { originalShape, virtualInstances } = virtualState

    // Filter out the original instance - we only want clones
    const cloneInstances = virtualInstances.filter(instance =>
      instance.metadata.modifierType !== 'original'
    )

    return cloneInstances.map((instance, index) => {
      // Extract position and rotation from matrix
      const { x, y } = instance.transform.point()
      const rotation = instance.transform.rotation()

      // Create shape with composed transform and unique index
      return {
        ...originalShape,
        id: createId(),
        index: undefined, // Let TLDraw auto-assign unique index
        x,
        y,
        rotation,
        meta: {
          ...originalShape.meta,
          ...instance.metadata,
          stackProcessed: true,
          originalShapeId: originalShape.id
        }
      } as TLShape
    })
  }

  /**
   * Optimized materialization that reuses existing shape IDs where possible
   * This reduces thrashing in TLDraw's store
   */
  static materializeWithCache(
    virtualState: VirtualModifierState,
    existingShapes: Map<number, TLShape>,
    createId: () => TLShapeId
  ): { create: TLShape[], update: Partial<TLShape>[], delete: TLShapeId[] } {
    const { originalShape, virtualInstances } = virtualState
    const used = new Set<TLShapeId>()
    const create: TLShape[] = []
    const update: Partial<TLShape>[] = []

    // Filter out the original instance - we only want clones
    const cloneInstances = virtualInstances.filter(instance =>
      instance.metadata.modifierType !== 'original'
    )

    // console.log(`[TransformComposer.materializeWithCache] Original has ${virtualInstances.length} virtual instances, filtered to ${cloneInstances.length} clone instances`)

    cloneInstances.forEach((instance, index) => {
      const existing = existingShapes.get(index)
      const { x, y } = instance.transform.point()
      const rotation = instance.transform.rotation()

      if (existing) {
        // Update existing shape
        used.add(existing.id)
        update.push({
          id: existing.id,
          type: existing.type,
          x,
          y,
          rotation,
          meta: {
            ...originalShape.meta,
            ...instance.metadata,
            stackProcessed: true,
            originalShapeId: originalShape.id
          }
        })
      } else {
        // Create new shape with unique index
        create.push({
          ...originalShape,
          id: createId(),
          index: undefined, // Let TLDraw auto-assign unique index
          x,
          y,
          rotation,
          meta: {
            ...originalShape.meta,
            ...instance.metadata,
            stackProcessed: true,
            originalShapeId: originalShape.id
          }
        } as TLShape)
      }
    })

    // Find shapes to delete
    const deleteIds = Array.from(existingShapes.values())
      .filter(s => !used.has(s.id))
      .map(s => s.id)

    // console.log(`[TransformComposer.materializeWithCache] Returning: create=${create.length}, update=${update.length}, delete=${deleteIds.length}`)

    return { create, update, delete: deleteIds }
  }
}