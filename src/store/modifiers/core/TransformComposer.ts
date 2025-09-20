import { Mat, type TLShape, type TLShapeId, Editor } from 'tldraw'
import type {
  TLModifier,
  LinearArraySettings,
  CircularArraySettings,
  GridArraySettings,
  MirrorSettings,
  BooleanSettings,
  GroupContext
} from '../../../types/modifiers'
import { GeometryConverter } from '../utils/GeometryConverter'
import type { BezierShape } from '../../../components/shapes/BezierShape'

// Removed calculateOrbitalPosition - functionality now inline in array processors

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
    // Boolean operation metadata for deferred execution
    virtualId?: string  // Unique identifier for this virtual instance
    booleanGroupId?: string  // Groups instances for boolean operation
    booleanRole?: 'source' | 'operand' | 'result'
    booleanPending?: boolean  // Marks instances waiting for boolean operation
    deferredBoolean?: {
      inputInstanceIds: string[]  // References to virtual instances
      operation: 'union' | 'subtract' | 'intersect' | 'exclude'
      computeOnMaterialize: boolean
      cacheKey?: string  // For optimization
      storageKey?: string  // Key to retrieve stored instances from static storage
    }
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
  // Cache for boolean operation results
  private static booleanCache = new Map<string, import('../utils/GeometryConverter').PolygonCoordinates>()

  // Temporary storage for virtual instances that need to be processed for boolean operations
  private static virtualInstanceStorage = new Map<string, VirtualInstance[]>()
  /**
   * Process modifiers using matrix composition for O(n) complexity
   * instead of O(n²) instance multiplication
   */
  static processModifiers(
    shape: TLShape,
    modifiers: TLModifier[],
    groupContext?: GroupContext,
    editor?: Editor
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
        groupContext,
        editor
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
    _groupContext?: GroupContext,  // eslint-disable-line @typescript-eslint/no-unused-vars
    editor?: Editor
  ): VirtualInstance[] {
    switch (modifier.type) {
      case 'linear-array':
        return this.applyLinearArray(instances, modifier.props as LinearArraySettings, originalShape, editor)
      case 'circular-array':
        return this.applyCircularArray(instances, modifier.props as CircularArraySettings, originalShape, editor)
      case 'grid-array':
        return this.applyGridArray(instances, modifier.props as GridArraySettings, originalShape, editor)
      case 'mirror':
        return this.applyMirror(instances, modifier.props as MirrorSettings, originalShape)
      case 'boolean':
        return this.applyBoolean(instances, modifier.props as BooleanSettings, originalShape)
    }
  }

  /**
   * Linear array using matrix composition
   */
  private static applyLinearArray(
    instances: VirtualInstance[],
    settings: LinearArraySettings,
    originalShape: TLShape,
    editor?: Editor
  ): VirtualInstance[] {
    const { count, offsetX, offsetY, rotationIncrement, rotateAll, scaleStep } = settings

    const newInstances: VirtualInstance[] = []

    // Get shape dimensions for percentage-based offsets
    const shapeBounds = this.getShapeBounds(originalShape)
    const pixelOffsetX = (offsetX / 100) * shapeBounds.width
    const pixelOffsetY = (offsetY / 100) * shapeBounds.height

    // Get original shape center for orbital rotation calculations
    let originalShapeCenter

    // Always use visual bounds when editor is available for consistent center
    if (editor) {
      const visualBounds = editor.getShapePageBounds(originalShape.id)
      if (visualBounds) {
        originalShapeCenter = {
          x: visualBounds.x + visualBounds.width / 2,
          y: visualBounds.y + visualBounds.height / 2
        }
      } else {
        // Fallback if visual bounds not available
        originalShapeCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }
    } else {
      // Fallback when editor not available
      originalShapeCenter = {
        x: originalShape.x + shapeBounds.width / 2,
        y: originalShape.y + shapeBounds.height / 2
      }
    }

    // Get source rotation from the original shape
    const sourceRotation = originalShape.rotation || 0

    for (const instance of instances) {
      for (let i = 0; i < count; i++) {
        // Get the current rotation from the instance transform
        const currentRotation = instance.transform.rotation()

        // Calculate offset from center in local coordinate space
        // First clone (i=0) has no offset, subsequent clones are progressively offset
        const centerOffsetX = pixelOffsetX * i
        const centerOffsetY = pixelOffsetY * i

        // Apply rotation to the offset vector if shape is rotated
        let rotatedOffsetX = centerOffsetX
        let rotatedOffsetY = centerOffsetY

        if (sourceRotation !== 0) {
          const cos = Math.cos(sourceRotation)
          const sin = Math.sin(sourceRotation)
          rotatedOffsetX = centerOffsetX * cos - centerOffsetY * sin
          rotatedOffsetY = centerOffsetX * sin + centerOffsetY * cos
        }

        // Position clone at center + rotated offset, then convert to top-left position
        let newX = originalShapeCenter.x + rotatedOffsetX - shapeBounds.width / 2
        let newY = originalShapeCenter.y + rotatedOffsetY - shapeBounds.height / 2

        // Calculate new rotation (will be applied via rotateShapesBy for center-based rotation)
        const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
        const uniformRotation = (rotateAll * Math.PI) / 180
        const totalRotation = currentRotation + incrementalRotation + uniformRotation


        // Calculate scale
        const progress = count > 1 ? i / (count - 1) : 0
        const scale = 1 + ((scaleStep / 100) - 1) * progress

        // Create transform with position and scale only
        // Rotation will be stored separately and applied via rotateShapesBy
        const composedTransform = Mat.Compose(
          Mat.Translate(newX, newY),
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
            linearArrayIndex: i,
            targetRotation: totalRotation  // Store rotation separately for center-based application
          }
        })
      }
    }

    return newInstances
  }

  /**
   * Circular array using matrix composition (following Linear Array pattern)
   */
  private static applyCircularArray(
    instances: VirtualInstance[],
    settings: CircularArraySettings,
    originalShape: TLShape,
    editor?: Editor
  ): VirtualInstance[] {
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToTangent } = settings
    const newInstances: VirtualInstance[] = []

    // Get shape dimensions for reference
    const shapeBounds = this.getShapeBounds(originalShape)

    // Get original shape center for orbital rotation calculations
    let originalShapeCenter

    // Always use visual bounds when editor is available for consistent center
    if (editor) {
      const visualBounds = editor.getShapePageBounds(originalShape.id)
      if (visualBounds) {
        originalShapeCenter = {
          x: visualBounds.x + visualBounds.width / 2,
          y: visualBounds.y + visualBounds.height / 2
        }
      } else {
        // Fallback if visual bounds not available
        originalShapeCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }
    } else {
      // Fallback when editor not available
      originalShapeCenter = {
        x: originalShape.x + shapeBounds.width / 2,
        y: originalShape.y + shapeBounds.height / 2
      }
    }

    // Get source rotation from the original shape
    const sourceRotation = originalShape.rotation || 0

    // Calculate circle center (offset from shape center)
    const circleCenter = {
      x: originalShapeCenter.x + (centerX || 0),
      y: originalShapeCenter.y + (centerY || 0)
    }

    for (const instance of instances) {
      for (let i = 0; i < count; i++) {
        // Get the current rotation from the instance transform
        const currentRotation = instance.transform.rotation()

        // Calculate angle for this position
        const totalAngle = endAngle - startAngle
        const isFullCircle = Math.abs(totalAngle) >= 360
        const angleStep = count > 1 ? (isFullCircle ? totalAngle / count : totalAngle / (count - 1)) : 0
        const angle = (startAngle + angleStep * i) * Math.PI / 180

        // Calculate circular position relative to circle center
        const circularOffsetX = Math.cos(angle) * radius
        const circularOffsetY = Math.sin(angle) * radius

        // Apply source rotation to the circular offset if shape is rotated
        let rotatedOffsetX = circularOffsetX
        let rotatedOffsetY = circularOffsetY

        if (sourceRotation !== 0) {
          const cos = Math.cos(sourceRotation)
          const sin = Math.sin(sourceRotation)
          rotatedOffsetX = circularOffsetX * cos - circularOffsetY * sin
          rotatedOffsetY = circularOffsetX * sin + circularOffsetY * cos
        }

        // Position clone at circular position, then convert to top-left position
        const newX = circleCenter.x + rotatedOffsetX - shapeBounds.width / 2
        const newY = circleCenter.y + rotatedOffsetY - shapeBounds.height / 2

        // Calculate new rotation (will be applied via rotateShapesBy for center-based rotation)
        let totalRotation = currentRotation

        if (alignToTangent) {
          totalRotation += angle + Math.PI / 2
        }
        if (rotateAll) {
          totalRotation += (rotateAll * Math.PI / 180)
        }
        if (rotateEach) {
          totalRotation += (rotateEach * i * Math.PI / 180)
        }

        // Create transform with position only
        // Rotation will be stored separately and applied via rotateShapesBy
        const composedTransform = Mat.Translate(newX, newY)

        newInstances.push({
          sourceShapeId: instance.sourceShapeId,
          transform: composedTransform,
          metadata: {
            modifierType: 'circular-array',
            index: newInstances.length,
            sourceIndex: instances.indexOf(instance),
            arrayIndex: i,
            circularArrayIndex: i,
            targetRotation: totalRotation  // Store rotation separately for center-based application
          }
        })
      }
    }

    return newInstances
  }

  /**
   * Grid array using matrix composition (following Linear Array pattern)
   */
  private static applyGridArray(
    instances: VirtualInstance[],
    settings: GridArraySettings,
    originalShape: TLShape,
    editor?: Editor
  ): VirtualInstance[] {
    const { rows, columns, spacingX, spacingY, rotateEach, rotateAll, rotateEachRow, rotateEachColumn, scaleStep, rowScaleStep, columnScaleStep } = settings
    const newInstances: VirtualInstance[] = []

    // Get shape dimensions for percentage-based spacing
    const shapeBounds = this.getShapeBounds(originalShape)
    const pixelSpacingX = (spacingX / 100) * shapeBounds.width
    const pixelSpacingY = (spacingY / 100) * shapeBounds.height

    // Get original shape center for orbital rotation calculations
    let originalShapeCenter

    // Always use visual bounds when editor is available for consistent center
    if (editor) {
      const visualBounds = editor.getShapePageBounds(originalShape.id)
      if (visualBounds) {
        originalShapeCenter = {
          x: visualBounds.x + visualBounds.width / 2,
          y: visualBounds.y + visualBounds.height / 2
        }
      } else {
        // Fallback if visual bounds not available
        originalShapeCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }
    } else {
      // Fallback when editor not available
      originalShapeCenter = {
        x: originalShape.x + shapeBounds.width / 2,
        y: originalShape.y + shapeBounds.height / 2
      }
    }

    // Get source rotation from the original shape
    const sourceRotation = originalShape.rotation || 0

    // Calculate grid starting position so first clone (0,0) aligns with source shape
    const gridStartX = originalShapeCenter.x
    const gridStartY = originalShapeCenter.y

    for (const instance of instances) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          // Get the current rotation from the instance transform
          const currentRotation = instance.transform.rotation()

          // Calculate grid position relative to center
          const gridOffsetX = col * pixelSpacingX
          const gridOffsetY = row * pixelSpacingY

          // Apply rotation to the grid offset vector if shape is rotated
          let rotatedOffsetX = gridOffsetX
          let rotatedOffsetY = gridOffsetY

          if (sourceRotation !== 0) {
            const cos = Math.cos(sourceRotation)
            const sin = Math.sin(sourceRotation)
            rotatedOffsetX = gridOffsetX * cos - gridOffsetY * sin
            rotatedOffsetY = gridOffsetX * sin + gridOffsetY * cos
          }

          // Position clone at grid position, then convert to top-left position
          let newX = gridStartX + rotatedOffsetX - shapeBounds.width / 2
          let newY = gridStartY + rotatedOffsetY - shapeBounds.height / 2

          // Calculate new rotation (will be applied via rotateShapesBy for center-based rotation)
          const linearIndex = row * columns + col
          const incrementalRotation = (rotateEach * linearIndex * Math.PI) / 180
          const rowRotation = (rotateEachRow * row * Math.PI) / 180
          const columnRotation = (rotateEachColumn * col * Math.PI) / 180
          const uniformRotation = (rotateAll * Math.PI) / 180
          const totalRotation = currentRotation + incrementalRotation + rowRotation + columnRotation + uniformRotation

          // Calculate scale with separate row and column progression
          const totalItems = rows * columns
          const linearProgress = totalItems > 1 ? linearIndex / (totalItems - 1) : 0
          const rowProgress = rows > 1 ? row / (rows - 1) : 0
          const columnProgress = columns > 1 ? col / (columns - 1) : 0

          // Combine all scale factors
          const linearScale = 1 + ((scaleStep / 100) - 1) * linearProgress
          const rowScale = 1 + ((rowScaleStep / 100) - 1) * rowProgress
          const columnScale = 1 + ((columnScaleStep / 100) - 1) * columnProgress
          const scale = linearScale * rowScale * columnScale

          // Create transform with position and scale only
          // Rotation will be stored separately and applied via rotateShapesBy
          const composedTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(scale, scale)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: composedTransform,
            metadata: {
              modifierType: 'grid-array',
              index: newInstances.length,
              sourceIndex: instances.indexOf(instance),
              arrayIndex: linearIndex,
              gridArrayIndex: linearIndex,
              gridPosition: { row, col },
              targetRotation: totalRotation  // Store rotation separately for center-based application
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
    _originalShape: TLShape  // eslint-disable-line @typescript-eslint/no-unused-vars
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
   * Boolean modifier using deferred execution for optimal performance
   * Stores boolean intent without computing geometry until materialization
   */
  private static applyBoolean(
    instances: VirtualInstance[],
    settings: BooleanSettings,
    originalShape: TLShape
  ): VirtualInstance[] {
    const booleanGroupId = this.generateBooleanGroupId()
    const storageKey = `${booleanGroupId}-instances`

    // Mark all input instances with boolean metadata for deferred processing
    const markedInstances = instances.map((instance) => ({
      ...instance,
      metadata: {
        ...instance.metadata,
        virtualId: instance.metadata.virtualId || `${instance.sourceShapeId}-${instance.metadata.index}`,
        booleanGroupId,
        booleanRole: 'source' as const,
        booleanPending: true
      }
    }))

    // Store instances in static storage for later retrieval
    this.virtualInstanceStorage.set(storageKey, markedInstances)

    // Create single virtual "result" instance with deferred computation
    const resultInstance: VirtualInstance = {
      sourceShapeId: originalShape.id,
      transform: Mat.Identity(), // Position computed during materialization
      metadata: {
        modifierType: 'boolean-result',
        index: 0,
        virtualId: `${originalShape.id}-boolean-result-${booleanGroupId}`,
        booleanGroupId,
        booleanRole: 'result',
        deferredBoolean: {
          inputInstanceIds: markedInstances.map(i => i.metadata.virtualId!),
          operation: settings.operation,
          computeOnMaterialize: true,
          cacheKey: this.computeBooleanCacheKey(markedInstances, settings.operation),
          storageKey: storageKey
        }
      }
    }

    console.log('🔧 Boolean modifier applied:', {
      operation: settings.operation,
      inputInstancesCount: instances.length,
      markedInstancesCount: markedInstances.length,
      booleanGroupId,
      storageKey,
      instancePositions: markedInstances.map(i => ({
        index: i.metadata.index,
        position: i.transform.point(),
        modifierType: i.metadata.modifierType
      }))
    })

    // Return only the result instance - original instances are preserved in static storage
    // This maintains the virtual instance performance optimization
    return [resultInstance]
  }

  /**
   * Generate unique boolean group ID
   */
  private static generateBooleanGroupId(): string {
    return `boolean-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Compute cache key for boolean operations
   */
  private static computeBooleanCacheKey(
    instances: VirtualInstance[],
    operation: string
  ): string {
    const transformHashes = instances.map(instance =>
      `${instance.transform.toString()}-${instance.sourceShapeId}`
    ).join('|')
    return `${operation}:${transformHashes}`
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

    return cloneInstances.map((instance) => {
      // Extract position and scale from matrix using decomposed method
      const decomposed = instance.transform.decomposed()
      const { x, y, scaleX, scaleY } = decomposed
      // Store targetRotation from metadata for later center-based application
      const targetRotation = instance.metadata.targetRotation ?? instance.transform.rotation()

      // Create shape with composed transform and unique index
      // ALWAYS set rotation to 0 here - rotation will be applied via rotateShapesBy
      // Store scale in metadata instead of applying to props - will be applied via resizeShape
      return {
        ...originalShape,
        id: createId(),
        x,
        y,
        rotation: 0, // Always 0 - rotation applied via center-based method
        props: originalShape.props, // Keep original props, scaling applied via resizeShape
        meta: {
          ...originalShape.meta,
          ...instance.metadata,
          stackProcessed: true,
          originalShapeId: originalShape.id,
          targetRotation: targetRotation as number, // Store for center-based application
          targetScaleX: scaleX, // Store scale for center-based application via resizeShape
          targetScaleY: scaleY
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

    // Check for deferred boolean operations
    const booleanResults = virtualInstances.filter(
      inst => inst.metadata.deferredBoolean
    )

    if (booleanResults.length > 0) {
      console.log('🔍 Found boolean result in materializeWithCache:', {
        booleanResultsCount: booleanResults.length,
        operation: booleanResults[0]?.metadata.deferredBoolean?.operation,
        storageKey: booleanResults[0]?.metadata.deferredBoolean?.storageKey
      })

      // Only materialize the boolean result, not the source instances
      return this.materializeBooleanDeferred(
        booleanResults[0],
        virtualState,
        existingShapes,
        createId
      )
    }

    // Regular materialization for non-boolean modifiers
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
      // Extract position and scale from matrix using decomposed method
      const decomposed = instance.transform.decomposed()
      const { x, y, scaleX, scaleY } = decomposed
      // Store targetRotation from metadata for later center-based application
      const targetRotation = instance.metadata.targetRotation ?? instance.transform.rotation()

      if (existing) {
        // Update existing shape
        used.add(existing.id)
        update.push({
          id: existing.id,
          type: existing.type,
          x,
          y,
          rotation: 0, // Always 0 - rotation applied via center-based method
          props: originalShape.props, // Keep original props, scaling applied via resizeShape
          meta: {
            ...originalShape.meta,
            ...instance.metadata,
            stackProcessed: true,
            originalShapeId: originalShape.id,
            targetRotation: targetRotation as number, // Store for center-based application
            targetScaleX: scaleX, // Store scale for center-based application via resizeShape
            targetScaleY: scaleY
          }
        })
      } else {
        // Create new shape with unique index
        create.push({
          ...originalShape,
          id: createId(),
          x,
          y,
          rotation: 0, // Always 0 - rotation applied via center-based method
          props: originalShape.props, // Keep original props, scaling applied via resizeShape
          meta: {
            ...originalShape.meta,
            ...instance.metadata,
            stackProcessed: true,
            originalShapeId: originalShape.id,
            targetRotation: targetRotation as number, // Store for center-based application
            targetScaleX: scaleX, // Store scale for center-based application via resizeShape
            targetScaleY: scaleY
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

  /**
   * Materialize boolean operations with deferred execution
   * Only computes boolean geometry when absolutely necessary
   */
  private static materializeBooleanDeferred(
    resultInstance: VirtualInstance,
    virtualState: VirtualModifierState,
    existingShapes: Map<number, TLShape>,
    createId: () => TLShapeId
  ): { create: TLShape[], update: Partial<TLShape>[], delete: TLShapeId[] } {
    const { deferredBoolean } = resultInstance.metadata

    if (!deferredBoolean) {
      throw new Error('materializeBooleanDeferred called without deferred boolean metadata')
    }

    console.log('🔧 Starting boolean materialization:', {
      operation: deferredBoolean.operation,
      inputInstanceIds: deferredBoolean.inputInstanceIds,
      hasStorageKey: !!deferredBoolean.storageKey
    })

    // Check cache first
    const cacheKey = deferredBoolean.cacheKey!
    let mergedPolygon = this.booleanCache.get(cacheKey)

    if (!mergedPolygon) {
      // Get the source virtual instances that need to be processed
      const sourceInstances = this.getSourceInstancesFromMetadata(virtualState, deferredBoolean.inputInstanceIds)

      console.log('💫 Source instances retrieved:', {
        count: sourceInstances.length,
        positions: sourceInstances.map(i => i.transform.point())
      })

      if (sourceInstances.length === 0) {
        console.error('❌ No source instances found for boolean operation')
        return { create: [], update: [], delete: [] }
      }

      // Temporarily materialize shapes for geometry extraction (in memory only)
      const tempShapes = this.materializeInstancesForGeometry(sourceInstances, virtualState.originalShape)

      console.log('🏗️ Temporary shapes for geometry:', {
        count: tempShapes.length,
        shapes: tempShapes.map(s => ({ x: s.x, y: s.y, rotation: s.rotation }))
      })

      // Perform boolean operation
      mergedPolygon = GeometryConverter.performBooleanOperation(
        tempShapes,
        deferredBoolean.operation
      )

      console.log('🔗 Boolean operation result:', {
        operation: deferredBoolean.operation,
        resultPolygonLength: mergedPolygon.length
      })

      // Cache the result for future use
      this.booleanCache.set(cacheKey, mergedPolygon)
    } else {
      console.log('♻️ Using cached boolean result')
    }

    // Convert polygon to bezier shape for proper rendering of merged geometry
    const bezierShapeData = GeometryConverter.polygonToBezierShape(mergedPolygon, virtualState.originalShape)

    console.log('📐 Bezier shape data:', bezierShapeData)

    // Create the final boolean result shape as a bezier shape
    const booleanResultShape: BezierShape = {
      id: createId(),
      type: 'bezier',
      x: bezierShapeData.x,
      y: bezierShapeData.y,
      rotation: 0,
      isLocked: false,
      opacity: 1,
      props: bezierShapeData.props,
      meta: {
        ...virtualState.originalShape.meta,
        isBooleanResult: true,
        booleanOperation: deferredBoolean.operation,
        stackProcessed: true,
        originalShapeId: virtualState.originalShape.id
      },
      parentId: virtualState.originalShape.parentId,
      index: virtualState.originalShape.index,
      typeName: 'shape' as const
    }

    console.log('✨ Final boolean result shape:', {
      id: booleanResultShape.id,
      type: booleanResultShape.type,
      x: booleanResultShape.x,
      y: booleanResultShape.y,
      w: (booleanResultShape.props as any).w,
      h: (booleanResultShape.props as any).h,
      operation: deferredBoolean.operation,
      bezierPointsCount: (booleanResultShape.props as any).points?.length,
      isClosed: (booleanResultShape.props as any).isClosed,
      fill: (booleanResultShape.props as any).fill
    })

    // Delete all existing shapes and replace with the boolean result
    const deleteIds = Array.from(existingShapes.values()).map(s => s.id)

    return {
      create: [booleanResultShape as TLShape],
      update: [],
      delete: deleteIds
    }
  }

  /**
   * Reconstruct source instances from metadata for boolean processing
   */
  private static getSourceInstancesFromMetadata(
    virtualState: VirtualModifierState,
    inputInstanceIds: string[]
  ): VirtualInstance[] {
    // First, try to get stored instances from the static storage
    const booleanResult = virtualState.virtualInstances.find(
      inst => inst.metadata.deferredBoolean
    )

    if (booleanResult?.metadata.deferredBoolean?.storageKey) {
      const storageKey = booleanResult.metadata.deferredBoolean.storageKey
      const storedInstances = this.virtualInstanceStorage.get(storageKey)

      if (storedInstances) {
        console.log('📦 Using stored instances from static storage:', {
          storageKey,
          storedCount: storedInstances.length,
          inputInstanceIds
        })
        return storedInstances
      }
    }

    // Fallback: filter from existing virtual instances
    console.log('⚠️ Fallback: Filtering from existing virtual instances')
    const sourceInstances = virtualState.virtualInstances.filter(instance =>
      instance.metadata.modifierType !== 'boolean-result' &&
      instance.metadata.modifierType !== 'original' &&
      (inputInstanceIds.length === 0 || inputInstanceIds.includes(instance.metadata.virtualId || ''))
    )

    console.log('🔍 Source instances found:', {
      sourceCount: sourceInstances.length,
      instances: sourceInstances.map(i => ({
        modifierType: i.metadata.modifierType,
        index: i.metadata.index,
        position: i.transform.point()
      }))
    })

    return sourceInstances
  }

  /**
   * Materialize virtual instances temporarily for geometry extraction
   */
  private static materializeInstancesForGeometry(
    instances: VirtualInstance[],
    originalShape: TLShape
  ): TLShape[] {
    return instances.map((instance, index) => {
      const { x, y } = instance.transform.point()
      const rotation = instance.metadata.targetRotation ?? instance.transform.rotation()

      return {
        ...originalShape,
        id: `temp-${index}` as TLShapeId,
        x,
        y,
        rotation: typeof rotation === 'number' ? rotation : 0,
        meta: {
          ...originalShape.meta,
          isTemporary: true
        }
      } as TLShape
    })
  }

  /**
   * Clear boolean cache for memory management
   */
  static clearBooleanCache(): void {
    this.booleanCache.clear()
  }

  /**
   * Clear virtual instance storage for memory management
   */
  static clearVirtualInstanceStorage(): void {
    this.virtualInstanceStorage.clear()
  }
}