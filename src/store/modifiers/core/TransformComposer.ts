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
import { ArrayModifierProcessor } from './ArrayModifierProcessor'
import { BooleanOperationProcessor } from './BooleanOperationProcessor'

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
  editor?: Editor
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
      metadata: { processedModifiers: enabledModifiers.length },
      editor
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
        return ArrayModifierProcessor.applyLinearArray(instances, modifier.props as LinearArraySettings, originalShape, editor, generationLevel)
      case 'circular-array':
        return ArrayModifierProcessor.applyCircularArray(instances, modifier.props as CircularArraySettings, originalShape, editor, generationLevel)
      case 'grid-array':
        return ArrayModifierProcessor.applyGridArray(instances, modifier.props as GridArraySettings, originalShape, editor, generationLevel)
      case 'mirror':
        return ArrayModifierProcessor.applyMirror(instances, modifier.props as MirrorSettings, originalShape, editor, generationLevel)
      case 'boolean':
        return BooleanOperationProcessor.applyBoolean(instances, modifier.props as BooleanSettings, originalShape)
    }
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
    if (BooleanOperationProcessor.hasBooleanResults(virtualInstances)) {
      const booleanResult = BooleanOperationProcessor.findBooleanResult(virtualInstances)

      if (booleanResult) {
        console.log('🔍 Found boolean result in materializeWithCache:', {
          operation: booleanResult.metadata.deferredBoolean?.operation,
          storageKey: booleanResult.metadata.deferredBoolean?.storageKey
        })

        // Only materialize the boolean result, not the source instances
        return BooleanOperationProcessor.materializeBooleanDeferred(
          booleanResult,
          virtualState,
          existingShapes,
          createId
        )
      }
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
   * Clear boolean cache for memory management
   */
  static clearBooleanCache(): void {
    BooleanOperationProcessor.clearBooleanCache()
  }

  /**
   * Clear virtual instance storage for memory management
   */
  static clearVirtualInstanceStorage(): void {
    BooleanOperationProcessor.clearVirtualInstanceStorage()
  }
}