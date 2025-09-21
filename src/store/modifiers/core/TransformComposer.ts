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
    // Grouping metadata for unified composition
    groupId?: string  // Identifies which group this instance belongs to from previous modifiers
    generationLevel?: number  // Track which modifier generation created this instance
    fromUnifiedGroup?: boolean  // Whether this came from a unified composition
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
        isOriginal: true,
        generationLevel: 0,
        groupId: 'original'
      }
    }]

    // Process each enabled modifier in sequence
    const enabledModifiers = modifiers
      .filter(m => m.enabled)
      .sort((a, b) => a.order - b.order)

    for (let i = 0; i < enabledModifiers.length; i++) {
      const modifier = enabledModifiers[i]
      virtualInstances = this.applyModifier(
        virtualInstances,
        modifier,
        shape,
        groupContext,
        editor,
        i + 1 // generation level
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
    _groupContext?: GroupContext,
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    switch (modifier.type) {
      case 'linear-array':
        return this.applyLinearArray(instances, modifier.props as LinearArraySettings, originalShape, editor, generationLevel)
      case 'circular-array':
        return this.applyCircularArray(instances, modifier.props as CircularArraySettings, originalShape, editor, generationLevel)
      case 'grid-array':
        return this.applyGridArray(instances, modifier.props as GridArraySettings, originalShape, editor, generationLevel)
      case 'mirror':
        return this.applyMirror(instances, modifier.props as MirrorSettings, originalShape, editor, generationLevel)
      case 'boolean':
        return this.applyBoolean(instances, modifier.props as BooleanSettings, originalShape)
    }
  }

  /**
   * Calculate collective bounds from a group of virtual instances for unified composition
   */
  private static calculateCollectiveBounds(
    instances: VirtualInstance[],
    originalShape: TLShape,
    _editor?: Editor  // eslint-disable-line @typescript-eslint/no-unused-vars
  ): { center: { x: number; y: number }; bounds: { width: number; height: number } } {
    const shapeBounds = this.getShapeBounds(originalShape)

    if (instances.length === 0) {
      return {
        center: { x: originalShape.x + shapeBounds.width / 2, y: originalShape.y + shapeBounds.height / 2 },
        bounds: shapeBounds
      }
    }

    // Calculate bounds from all instances
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    instances.forEach(instance => {
      const { x, y } = instance.transform.point()
      const instanceMinX = x
      const instanceMaxX = x + shapeBounds.width
      const instanceMinY = y
      const instanceMaxY = y + shapeBounds.height

      minX = Math.min(minX, instanceMinX)
      maxX = Math.max(maxX, instanceMaxX)
      minY = Math.min(minY, instanceMinY)
      maxY = Math.max(maxY, instanceMaxY)
    })

    const width = maxX - minX
    const height = maxY - minY
    const centerX = minX + width / 2
    const centerY = minY + height / 2

    return {
      center: { x: centerX, y: centerY },
      bounds: { width, height }
    }
  }

  /**
   * Detect if instances represent multiple groups that should be treated as one unified entity
   */
  private static shouldUseUnifiedComposition(instances: VirtualInstance[]): boolean {
    // If we have multiple instances that are ALL from previous modifiers (no original),
    // they should be treated as a unified group
    const hasOriginal = instances.some(inst => inst.metadata.modifierType === 'original')
    const nonOriginalInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

    // Use unified composition if:
    // 1. We have multiple instances AND no original (output from previous modifier)
    // 2. OR we have multiple non-original instances with original (mixed case)
    if (!hasOriginal && instances.length > 1) {
      // All instances are from previous modifiers - treat as unified
      return true
    }

    if (hasOriginal && nonOriginalInstances.length > 1) {
      // Mixed case - multiple instances from previous modifier plus original
      return true
    }

    return false
  }

  /**
   * Linear array using matrix composition
   */
  private static applyLinearArray(
    instances: VirtualInstance[],
    settings: LinearArraySettings,
    originalShape: TLShape,
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    const { count, offsetX, offsetY, rotationIncrement, rotateAll, scaleStep } = settings

    const newInstances: VirtualInstance[] = []

    // Check if we should use unified composition (treating all instances as one group)
    const useUnified = this.shouldUseUnifiedComposition(instances)

    if (useUnified) {
      // Unified composition: treat all existing instances as a single entity
      const { center: collectiveCenter, bounds: collectiveBounds } = this.calculateCollectiveBounds(instances, originalShape, editor)

      // Calculate pixel offsets based on collective bounds
      const pixelOffsetX = (offsetX / 100) * collectiveBounds.width
      const pixelOffsetY = (offsetY / 100) * collectiveBounds.height

      // Get source rotation from the original shape
      const sourceRotation = originalShape.rotation || 0

      // Generate a unique group ID for this generation
      const groupId = `linear-array-gen${generationLevel}-${Date.now()}`

      // Create copies of the entire group
      for (let i = 0; i < count; i++) {
        // Calculate offset from collective center
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

        // For each copy, create instances for all input instances
        instances.forEach((instance, instanceIndex) => {
          if (instance.metadata.modifierType === 'original') return // Skip original when in unified mode

          const { x: instanceX, y: instanceY } = instance.transform.point()
          const existingTransform = instance.transform

          // Extract transforms from metadata first (where previous modifiers store them), fall back to matrix
          const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
          const existingScale = {
            scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
            scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
          }

          // Calculate offset from collective center to instance position
          const relativeX = instanceX - collectiveCenter.x
          const relativeY = instanceY - collectiveCenter.y

          // New position = collective center + group offset + relative position
          const newX = collectiveCenter.x + rotatedOffsetX + relativeX
          const newY = collectiveCenter.y + rotatedOffsetY + relativeY

          // In unified mode, preserve internal group rotations (rigid body)
          // Don't apply additional rotations to individual shapes within the group
          // Only rotateAll affects the entire group uniformly
          const uniformRotation = (rotateAll * Math.PI) / 180
          let totalRotation = currentRotation + uniformRotation

          // If source shape is rotated, offsets are rotated
          // So shapes must rotate with them to maintain rigid body
          if (sourceRotation !== 0) {
            totalRotation += sourceRotation
          }

          // Calculate scale accumulation
          const progress = count > 1 ? i / (count - 1) : 0
          const newScale = 1 + ((scaleStep / 100) - 1) * progress
          const accumulatedScaleX = existingScale.scaleX * newScale
          const accumulatedScaleY = existingScale.scaleY * newScale

          const composedTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(accumulatedScaleX, accumulatedScaleY)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: composedTransform,
            metadata: {
              modifierType: 'linear-array',
              index: newInstances.length,
              sourceIndex: instanceIndex,
              arrayIndex: i,
              linearArrayIndex: i,
              targetRotation: totalRotation,
              generationLevel,
              groupId,
              fromUnifiedGroup: true,
              // Preserve existing metadata and accumulate scale
              targetScaleX: accumulatedScaleX,
              targetScaleY: accumulatedScaleY
            }
          })
        })
      }
    } else {
      // Original behavior: multiply each instance (but only create clones, not preserve original)
      const shapeBounds = this.getShapeBounds(originalShape)
      const pixelOffsetX = (offsetX / 100) * shapeBounds.width
      const pixelOffsetY = (offsetY / 100) * shapeBounds.height

      // Get original shape center for orbital rotation calculations
      let originalShapeCenter
      if (editor) {
        const visualBounds = editor.getShapePageBounds(originalShape.id)
        if (visualBounds) {
          originalShapeCenter = {
            x: visualBounds.x + visualBounds.width / 2,
            y: visualBounds.y + visualBounds.height / 2
          }
        } else {
          originalShapeCenter = {
            x: originalShape.x + shapeBounds.width / 2,
            y: originalShape.y + shapeBounds.height / 2
          }
        }
      } else {
        originalShapeCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }

      const sourceRotation = originalShape.rotation || 0

      for (const instance of instances) {
        // Extract existing transform components for accumulation
        const existingTransform = instance.transform

        // Extract transforms from metadata first (where previous modifiers store them), fall back to matrix
        const baseRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
        const existingScale = {
          scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
          scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
        }

        for (let i = 0; i < count; i++) {
          // Calculate offset from center in local coordinate space
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

          const newX = originalShapeCenter.x + rotatedOffsetX - shapeBounds.width / 2
          const newY = originalShapeCenter.y + rotatedOffsetY - shapeBounds.height / 2

          const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
          const uniformRotation = (rotateAll * Math.PI) / 180
          const totalRotation = baseRotation + incrementalRotation + uniformRotation

          const progress = count > 1 ? i / (count - 1) : 0
          const newScale = 1 + ((scaleStep / 100) - 1) * progress
          // Accumulate scale with existing scale
          const accumulatedScaleX = existingScale.scaleX * newScale
          const accumulatedScaleY = existingScale.scaleY * newScale

          // Create new transform that multiplies with existing transform
          const newTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(accumulatedScaleX, accumulatedScaleY)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: newTransform,
            metadata: {
              modifierType: 'linear-array',
              index: newInstances.length,
              sourceIndex: instances.indexOf(instance),
              arrayIndex: i,
              linearArrayIndex: i,
              targetRotation: totalRotation,
              generationLevel,
              groupId: instance.metadata.groupId || 'original',
              // Preserve and accumulate existing metadata
              targetScaleX: accumulatedScaleX,
              targetScaleY: accumulatedScaleY
            }
          })
        }
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
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToTangent } = settings
    const newInstances: VirtualInstance[] = []

    // Check if we should use unified composition (treating all instances as one group)
    const useUnified = this.shouldUseUnifiedComposition(instances)

    const processingId = `CA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log(`[CircularArray] ${processingId} Processing ${instances.length} instances, useUnified: ${useUnified}`, {
      instances: instances.map(i => ({
        type: i.metadata.modifierType,
        sourceId: i.sourceShapeId,
        groupId: i.metadata.groupId,
        index: i.metadata.index
      })),
      processingId
    })

    if (useUnified) {
      // Unified composition: treat all existing instances as a single entity
      const { center: collectiveCenter } = this.calculateCollectiveBounds(instances, originalShape, editor)

      // Get source rotation from the original shape
      const sourceRotation = originalShape.rotation || 0

      // Calculate circle center (offset from collective center)
      const circleCenter = {
        x: collectiveCenter.x + (centerX || 0),
        y: collectiveCenter.y + (centerY || 0)
      }

      // Generate a unique group ID for this generation
      const groupId = `circular-array-gen${generationLevel}-${Date.now()}`

      // Create circular copies of the entire group
      for (let i = 0; i < count; i++) {
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

        // Filter out original instances for unified composition
        const groupInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

        // For each instance in the group, create it at this circular position
        groupInstances.forEach((instance, instanceIndex) => {
          const { x: instanceX, y: instanceY } = instance.transform.point()
          const existingTransform = instance.transform

          // Extract transforms from metadata first (where Linear Array stores them), fall back to matrix
          const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
          const existingScale = {
            scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
            scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
          }

          // Calculate offset from collective center to instance position
          const relativeX = instanceX - collectiveCenter.x
          const relativeY = instanceY - collectiveCenter.y

          // Apply group-level rotation to preserve rigid body transformation
          // The group should orbit as a single entity with internal relationships preserved
          let rotatedRelativeX = relativeX
          let rotatedRelativeY = relativeY

          // Calculate group orbit rotation angle (how the group is oriented as it orbits)
          let groupOrbitAngle = 0
          if (alignToTangent) {
            // Orient the group to be tangent to the circle
            groupOrbitAngle = angle + Math.PI / 2
          }
          if (rotateAll) {
            // Additional rotation for all groups
            groupOrbitAngle += (rotateAll * Math.PI / 180)
          }

          // Apply the orbit rotation to the group's relative positions
          // This rotates the entire group formation around each circular position
          if (groupOrbitAngle !== 0) {
            const cos = Math.cos(groupOrbitAngle)
            const sin = Math.sin(groupOrbitAngle)
            rotatedRelativeX = relativeX * cos - relativeY * sin
            rotatedRelativeY = relativeX * sin + relativeY * cos
          }

          // New position = circle center + circular offset + (rotated) relative position
          const newX = circleCenter.x + rotatedOffsetX + rotatedRelativeX
          const newY = circleCenter.y + rotatedOffsetY + rotatedRelativeY

          // Apply rigid body rotation: individual shapes must rotate with the group
          // Add the group orbit angle to maintain orientation relative to the group
          let totalRotation = currentRotation + groupOrbitAngle

          // If source shape is rotated, circular positions are rotated
          // So shapes must rotate with them to maintain rigid body
          if (sourceRotation !== 0) {
            totalRotation += sourceRotation
          }

          // rotateEach additionally rotates individual shapes within the group
          if (rotateEach) {
            totalRotation += (rotateEach * i * Math.PI / 180)
          }

          // Preserve existing scale (circular array doesn't add scale by default)
          const composedTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(existingScale.scaleX, existingScale.scaleY)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: composedTransform,
            metadata: {
              modifierType: 'circular-array',
              index: newInstances.length,
              sourceIndex: instanceIndex,
              arrayIndex: i,
              circularArrayIndex: i,
              targetRotation: totalRotation,
              generationLevel,
              groupId,
              fromUnifiedGroup: true,
              // Preserve existing metadata transforms
              targetScaleX: existingScale.scaleX,
              targetScaleY: existingScale.scaleY,
              // Add processing ID for debugging
              processingId
            }
          })
        })
      }
    } else {
      // Original behavior: multiply each instance
      const shapeBounds = this.getShapeBounds(originalShape)

      // Get original shape center for orbital rotation calculations
      let originalShapeCenter
      if (editor) {
        const visualBounds = editor.getShapePageBounds(originalShape.id)
        if (visualBounds) {
          originalShapeCenter = {
            x: visualBounds.x + visualBounds.width / 2,
            y: visualBounds.y + visualBounds.height / 2
          }
        } else {
          originalShapeCenter = {
            x: originalShape.x + shapeBounds.width / 2,
            y: originalShape.y + shapeBounds.height / 2
          }
        }
      } else {
        originalShapeCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }

      const sourceRotation = originalShape.rotation || 0

      // Calculate circle center (offset from shape center)
      const circleCenter = {
        x: originalShapeCenter.x + (centerX || 0),
        y: originalShapeCenter.y + (centerY || 0)
      }

      for (const instance of instances) {
        // Extract existing transform components for accumulation
        const existingTransform = instance.transform

        // Extract transforms from metadata first (where previous modifiers store them), fall back to matrix
        const baseRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
        const existingScale = {
          scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
          scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
        }

        for (let i = 0; i < count; i++) {
          const currentRotation = baseRotation

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

          const newX = circleCenter.x + rotatedOffsetX - shapeBounds.width / 2
          const newY = circleCenter.y + rotatedOffsetY - shapeBounds.height / 2

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

          // Preserve existing scale
          const composedTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(existingScale.scaleX, existingScale.scaleY)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: composedTransform,
            metadata: {
              modifierType: 'circular-array',
              index: newInstances.length,
              sourceIndex: instances.indexOf(instance),
              arrayIndex: i,
              circularArrayIndex: i,
              targetRotation: totalRotation,
              generationLevel,
              groupId: instance.metadata.groupId || 'original',
              // Preserve existing scale
              targetScaleX: existingScale.scaleX,
              targetScaleY: existingScale.scaleY
            }
          })
        }
      }
    }

    console.log(`[CircularArray] ${processingId} Completed: Created ${newInstances.length} instances (unified: ${useUnified})`)
    return newInstances
  }

  /**
   * Grid array using matrix composition (following Linear Array pattern)
   */
  private static applyGridArray(
    instances: VirtualInstance[],
    settings: GridArraySettings,
    originalShape: TLShape,
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    const { rows, columns, spacingX, spacingY, rotateEach, rotateAll, rotateEachRow, rotateEachColumn, scaleStep, rowScaleStep, columnScaleStep } = settings
    const newInstances: VirtualInstance[] = []

    // Check if we should use unified composition (treating all instances as one group)
    const useUnified = this.shouldUseUnifiedComposition(instances)

    // If using unified composition, calculate collective bounds
    const { center: collectiveCenter, bounds: collectiveBounds } = useUnified
      ? this.calculateCollectiveBounds(instances, originalShape, editor)
      : { center: { x: 0, y: 0 }, bounds: { width: 100, height: 100 } }

    // Get shape dimensions for percentage-based spacing
    const shapeBounds = this.getShapeBounds(originalShape)
    const referenceWidth = useUnified ? collectiveBounds.width : shapeBounds.width
    const referenceHeight = useUnified ? collectiveBounds.height : shapeBounds.height
    const pixelSpacingX = (spacingX / 100) * referenceWidth
    const pixelSpacingY = (spacingY / 100) * referenceHeight

    // Get original shape center for orbital rotation calculations
    let originalShapeCenter
    if (useUnified) {
      originalShapeCenter = collectiveCenter
    } else {
      // Original behavior
      if (editor) {
        const visualBounds = editor.getShapePageBounds(originalShape.id)
        if (visualBounds) {
          originalShapeCenter = {
            x: visualBounds.x + visualBounds.width / 2,
            y: visualBounds.y + visualBounds.height / 2
          }
        } else {
          originalShapeCenter = {
            x: originalShape.x + shapeBounds.width / 2,
            y: originalShape.y + shapeBounds.height / 2
          }
        }
      } else {
        originalShapeCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }
    }

    // Get source rotation from the original shape
    const sourceRotation = originalShape.rotation || 0

    // Calculate grid starting position so first clone (0,0) aligns with source shape
    const gridStartX = originalShapeCenter.x
    const gridStartY = originalShapeCenter.y

    // Generate a unique group ID for this generation
    const groupId = `grid-array-gen${generationLevel}-${Date.now()}`

    // Handle unified composition differently - grid loops on outside, instances on inside
    if (useUnified) {
      // Filter out original for unified composition
      const groupInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

      // Outer loops: Grid positions (each position gets a copy of the entire group)
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const linearIndex = row * columns + col

          // Calculate grid position for this group
          const gridOffsetX = col * pixelSpacingX
          const gridOffsetY = row * pixelSpacingY

          // Apply source rotation to grid offset if needed
          let rotatedOffsetX = gridOffsetX
          let rotatedOffsetY = gridOffsetY

          if (sourceRotation !== 0) {
            const cos = Math.cos(sourceRotation)
            const sin = Math.sin(sourceRotation)
            rotatedOffsetX = gridOffsetX * cos - gridOffsetY * sin
            rotatedOffsetY = gridOffsetX * sin + gridOffsetY * cos
          }

          // Calculate GROUP-LEVEL rotation for this grid position
          // This rotation applies to the entire group as a rigid body
          const uniformRotation = (rotateAll * Math.PI) / 180
          const incrementalRotation = (rotateEach * linearIndex * Math.PI) / 180
          const rowRotation = (rotateEachRow * row * Math.PI) / 180
          const columnRotation = (rotateEachColumn * col * Math.PI) / 180

          const groupRotationAdjustment = uniformRotation + incrementalRotation +
                                         rowRotation + columnRotation + sourceRotation

          // Calculate GROUP-LEVEL scale for this grid position
          const totalItems = rows * columns
          const linearProgress = totalItems > 1 ? linearIndex / (totalItems - 1) : 0
          const rowProgress = rows > 1 ? row / (rows - 1) : 0
          const columnProgress = columns > 1 ? col / (columns - 1) : 0

          const linearScale = 1 + ((scaleStep / 100) - 1) * linearProgress
          const rowScale = 1 + ((rowScaleStep / 100) - 1) * rowProgress
          const columnScale = 1 + ((columnScaleStep / 100) - 1) * columnProgress
          const groupScale = linearScale * rowScale * columnScale

          // Inner loop: Create each instance in the group at this grid position
          groupInstances.forEach((instance, instanceIndex) => {
            const existingTransform = instance.transform

            // Extract transforms from metadata first, fall back to matrix
            const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
            const existingScale = {
              scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
              scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
            }

            // Calculate instance position relative to group center
            const { x: instanceX, y: instanceY } = instance.transform.point()
            const relativeX = instanceX - collectiveCenter.x
            const relativeY = instanceY - collectiveCenter.y

            // Apply orbital rotation to relative positions (like Circular Array)
            // This creates orbital motion of the group formation around the grid position
            let rotatedRelativeX = relativeX
            let rotatedRelativeY = relativeY

            if (groupRotationAdjustment !== 0) {
              const cos = Math.cos(groupRotationAdjustment)
              const sin = Math.sin(groupRotationAdjustment)
              rotatedRelativeX = relativeX * cos - relativeY * sin
              rotatedRelativeY = relativeX * sin + relativeY * cos
            }

            // Position at grid location with orbital rotation applied
            const newX = gridStartX + rotatedOffsetX + rotatedRelativeX
            const newY = gridStartY + rotatedOffsetY + rotatedRelativeY

            // Apply GROUP orbital rotation to maintain shape orientation (same as relative position rotation)
            const totalRotation = currentRotation + groupRotationAdjustment

            // Apply GROUP scale (accumulated with existing)
            const accumulatedScaleX = existingScale.scaleX * groupScale
            const accumulatedScaleY = existingScale.scaleY * groupScale

            // Create transform with position and accumulated scale
            const composedTransform = Mat.Compose(
              Mat.Translate(newX, newY),
              Mat.Scale(accumulatedScaleX, accumulatedScaleY)
            )

            newInstances.push({
              sourceShapeId: instance.sourceShapeId,
              transform: composedTransform,
              metadata: {
                modifierType: 'grid-array',
                index: newInstances.length,
                sourceIndex: instanceIndex,
                arrayIndex: linearIndex,
                gridArrayIndex: linearIndex,
                gridPosition: { row, col },
                targetRotation: totalRotation,
                targetScaleX: accumulatedScaleX,
                targetScaleY: accumulatedScaleY,
                generationLevel,
                groupId,
                fromUnifiedGroup: useUnified
              }
            })
          })
        }
      }
    } else {
      // Non-unified mode: Original behavior - process each instance individually
      const processInstances = instances

      for (const instance of processInstances) {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < columns; col++) {
            // Extract existing transform components
            const existingTransform = instance.transform
            const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
            const existingScale = {
              scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
              scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
            }

            // Calculate grid position
            const gridOffsetX = col * pixelSpacingX
            const gridOffsetY = row * pixelSpacingY

            // Apply rotation to grid offset if source is rotated
            let rotatedOffsetX = gridOffsetX
            let rotatedOffsetY = gridOffsetY

            if (sourceRotation !== 0) {
              const cos = Math.cos(sourceRotation)
              const sin = Math.sin(sourceRotation)
              rotatedOffsetX = gridOffsetX * cos - gridOffsetY * sin
              rotatedOffsetY = gridOffsetX * sin + gridOffsetY * cos
            }

            // Position at grid location
            const newX = gridStartX + rotatedOffsetX - shapeBounds.width / 2
            const newY = gridStartY + rotatedOffsetY - shapeBounds.height / 2

            // Calculate new rotation
            const linearIndex = row * columns + col
            const incrementalRotation = (rotateEach * linearIndex * Math.PI) / 180
            const rowRotation = (rotateEachRow * row * Math.PI) / 180
            const columnRotation = (rotateEachColumn * col * Math.PI) / 180
            const uniformRotation = (rotateAll * Math.PI) / 180
            const totalRotation = currentRotation + incrementalRotation + rowRotation + columnRotation + uniformRotation

            // Calculate scale
            const totalItems = rows * columns
            const linearProgress = totalItems > 1 ? linearIndex / (totalItems - 1) : 0
            const rowProgress = rows > 1 ? row / (rows - 1) : 0
            const columnProgress = columns > 1 ? col / (columns - 1) : 0

            const linearScale = 1 + ((scaleStep / 100) - 1) * linearProgress
            const rowScale = 1 + ((rowScaleStep / 100) - 1) * rowProgress
            const columnScale = 1 + ((columnScaleStep / 100) - 1) * columnProgress
            const newScale = linearScale * rowScale * columnScale

            const accumulatedScaleX = existingScale.scaleX * newScale
            const accumulatedScaleY = existingScale.scaleY * newScale

            // Create transform
            const composedTransform = Mat.Compose(
              Mat.Translate(newX, newY),
              Mat.Scale(accumulatedScaleX, accumulatedScaleY)
            )

            newInstances.push({
              sourceShapeId: instance.sourceShapeId,
              transform: composedTransform,
              metadata: {
                modifierType: 'grid-array',
                index: newInstances.length,
                sourceIndex: processInstances.indexOf(instance),
                arrayIndex: linearIndex,
                gridArrayIndex: linearIndex,
                gridPosition: { row, col },
                targetRotation: totalRotation,
                targetScaleX: accumulatedScaleX,
                targetScaleY: accumulatedScaleY,
                generationLevel,
                groupId,
                fromUnifiedGroup: false
              }
            })
          }
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
    originalShape: TLShape,
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    const { axis, offset } = settings

    if (axis !== 'x' && axis !== 'y') {
      return instances
    }

    const newInstances: VirtualInstance[] = []

    // Check if we should use unified composition
    const useUnified = this.shouldUseUnifiedComposition(instances)

    // Get reference center and bounds
    let referenceCenter: { x: number; y: number }
    if (useUnified) {
      const { center } = this.calculateCollectiveBounds(instances, originalShape, editor)
      referenceCenter = center
    } else {
      // Original behavior
      const shapeBounds = this.getShapeBounds(originalShape)
      if (editor) {
        const visualBounds = editor.getShapePageBounds(originalShape.id)
        if (visualBounds) {
          referenceCenter = {
            x: visualBounds.x + visualBounds.width / 2,
            y: visualBounds.y + visualBounds.height / 2
          }
        } else {
          referenceCenter = {
            x: originalShape.x + shapeBounds.width / 2,
            y: originalShape.y + shapeBounds.height / 2
          }
        }
      } else {
        referenceCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }
    }

    // Generate group ID
    const groupId = `mirror-gen${generationLevel}-${Date.now()}`

    // Filter instances if using unified composition, otherwise preserve all (including originals)
    const processInstances = useUnified
      ? instances.filter(inst => inst.metadata.modifierType !== 'original')
      : instances

    // If not unified and there are modified instances, preserve them first
    if (!useUnified && instances.length > 1) {
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

    // Then create mirrored copies of processed instances
    processInstances.forEach(instance => {
      const currentRotation = instance.transform.rotation()

      // Calculate mirror position
      let newX: number, newY: number

      if (useUnified) {
        // For unified composition, mirror relative to collective center
        const { x: instanceX, y: instanceY } = instance.transform.point()
        if (axis === 'x') {
          newX = referenceCenter.x + offset + (referenceCenter.x - instanceX)
          newY = instanceY
        } else {
          newX = instanceX
          newY = referenceCenter.y + offset + (referenceCenter.y - instanceY)
        }
      } else {
        // Original behavior
        const shapeBounds = this.getShapeBounds(originalShape)
        if (axis === 'x') {
          newX = referenceCenter.x + offset - shapeBounds.width / 2
          newY = referenceCenter.y - shapeBounds.height / 2
        } else {
          newX = referenceCenter.x - shapeBounds.width / 2
          newY = referenceCenter.y + offset - shapeBounds.height / 2
        }
      }

      // Calculate rotation for the mirrored clone
      // In unified mode, preserve the rotation to maintain rigid group
      // In normal mode, invert for traditional mirror behavior
      const targetRotation = useUnified ? currentRotation : -currentRotation

      const composedTransform = Mat.Translate(newX, newY)

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
          sourceIndex: processInstances.indexOf(instance),
          targetRotation: targetRotation,
          arrayIndex: 0,
          generationLevel,
          groupId,
          fromUnifiedGroup: useUnified,
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