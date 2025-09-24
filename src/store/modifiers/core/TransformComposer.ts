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
import type { CompoundShape, ChildShapeData } from '../../../components/shapes/CompoundShape'
import { ArrayModifierProcessor } from './ArrayModifierProcessor'

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
        return this.applyBoolean(instances, modifier.props as BooleanSettings, originalShape)
    }
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

    // Handle CompoundShape for multi-shape boolean operations
    if (originalShape.type === 'compound' && settings.isMultiShape) {
      const compoundShape = originalShape as CompoundShape
      console.log('🔧 Processing multi-shape boolean operation on compound:', {
        operation: settings.operation,
        childShapeCount: compoundShape.props.childShapes.length
      })

      // Extract child shapes from compound and create virtual instances for each
      const childInstances: VirtualInstance[] = compoundShape.props.childShapes.map((child: ChildShapeData, index: number) => ({
        sourceShapeId: child.id,
        transform: Mat.Compose(
          // Use absolute position: compound position + relative offset
          Mat.Translate(originalShape.x + child.relativeX, originalShape.y + child.relativeY)
          // Note: Rotation removed here to avoid double application - CompoundShape handles rotation in SVG transform
        ),
        metadata: {
          modifierType: 'compound-child',
          index,
          virtualId: `${child.id}-compound-child-${index}`,
          booleanGroupId,
          booleanRole: 'source' as const,
          booleanPending: true,
          childType: child.type,
          childProps: child.props,
          childRotation: child.relativeRotation // Store rotation for CompoundShape to use
        }
      }))

      // Store child instances for materialization
      this.virtualInstanceStorage.set(storageKey, childInstances)

      // Create result instance for the boolean operation
      const resultInstance: VirtualInstance = {
        sourceShapeId: originalShape.id,
        transform: Mat.Identity(), // Position computed during materialization
        metadata: {
          modifierType: 'boolean-result',
          index: 0,
          virtualId: `${originalShape.id}-boolean-result-${booleanGroupId}`,
          booleanGroupId,
          booleanRole: 'result',
          isMultiShapeBooleanResult: true,
          deferredBoolean: {
            inputInstanceIds: childInstances.map(i => i.metadata.virtualId!),
            operation: settings.operation,
            computeOnMaterialize: true,
            cacheKey: this.computeBooleanCacheKey(childInstances, settings.operation, originalShape),
            storageKey: storageKey
          }
        }
      }

      console.log('✅ Multi-shape boolean setup complete:', {
        childInstancesCount: childInstances.length,
        operation: settings.operation,
        resultInstanceId: resultInstance.metadata.virtualId
      })

      return [resultInstance]
    }

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
          cacheKey: this.computeBooleanCacheKey(markedInstances, settings.operation, originalShape),
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
   * Includes source shape position to invalidate cache when source moves
   */
  private static computeBooleanCacheKey(
    instances: VirtualInstance[],
    operation: string,
    originalShape: TLShape
  ): string {
    const transformHashes = instances.map(instance =>
      `${instance.transform.toString()}-${instance.sourceShapeId}`
    ).join('|')

    // Include source shape position and dimensions in cache key
    // This ensures cache invalidation when source shape moves
    const sourceShapeHash = `src:${originalShape.x},${originalShape.y},${originalShape.rotation || 0}`
    const sourceProps = originalShape.props as { w?: number; h?: number }
    const sourceDimensions = `${sourceProps.w || 100}x${sourceProps.h || 100}`

    return `${operation}:${transformHashes}:${sourceShapeHash}:${sourceDimensions}`
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

    // Get the source virtual instances that need to be processed first
    // We need this for collective bounds calculation even when using cached geometry
    const sourceInstances = this.getSourceInstancesFromMetadata(virtualState, deferredBoolean.inputInstanceIds)

    console.log('💫 Source instances retrieved:', {
      count: sourceInstances.length,
      positions: sourceInstances.map(i => i.transform.point())
    })

    if (sourceInstances.length === 0) {
      console.error('❌ No source instances found for boolean operation')
      return { create: [], update: [], delete: [] }
    }

    // Materialize instances for geometry operations (used for both bounds and shape creation)
    const { collectiveBounds, shapes: tempShapes } = this.materializeInstancesForGeometry(sourceInstances, virtualState.originalShape)

    // Check cache for geometry computation (expensive operation)
    const cacheKey = deferredBoolean.cacheKey!
    let mergedPolygon = this.booleanCache.get(cacheKey)

    if (!mergedPolygon) {
      // Need to perform geometry computation

      console.log('🏗️ Temporary shapes for geometry:', {
        count: tempShapes.length,
        shapes: tempShapes.map(s => ({ x: s.x, y: s.y, rotation: s.rotation })),
        collectiveBounds
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
      console.log('♻️ Using cached boolean result with fresh collective bounds')
    }

    // Select style source shape based on Boolean operation type and shape characteristics
    const styleSourceShape = GeometryConverter.selectStyleSourceShape(tempShapes, deferredBoolean.operation)

    console.log('🎨 Style inheritance for Boolean operation:', {
      operation: deferredBoolean.operation,
      availableShapes: tempShapes.length,
      selectedStyleSource: styleSourceShape ? {
        id: styleSourceShape.id,
        type: styleSourceShape.type,
        color: (styleSourceShape.props as any).color,
        fillColor: (styleSourceShape.props as any).fillColor
      } : 'none'
    })

    // Convert polygon to bezier shape for proper rendering of merged geometry
    // Pass collective bounds to preserve position alignment with linear array results
    const bezierShapeData = GeometryConverter.polygonToBezierShape(
      mergedPolygon,
      virtualState.originalShape,
      virtualState.editor,
      {
        collectiveBounds,
        shouldPreserveCollectivePosition: true
      },
      styleSourceShape
    )

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
      w: (booleanResultShape.props as Record<string, unknown>).w,
      h: (booleanResultShape.props as Record<string, unknown>).h,
      operation: deferredBoolean.operation,
      bezierPointsCount: Array.isArray((booleanResultShape.props as Record<string, unknown>).points)
        ? ((booleanResultShape.props as Record<string, unknown>).points as unknown[]).length
        : 0,
      isClosed: (booleanResultShape.props as Record<string, unknown>).isClosed,
      fill: (booleanResultShape.props as Record<string, unknown>).fill,
      usedCollectiveBounds: {
        center: { x: collectiveBounds.centerX, y: collectiveBounds.centerY },
        dimensions: { width: collectiveBounds.width, height: collectiveBounds.height }
      }
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
          inputInstanceIds,
          hasCompoundChildren: storedInstances.some(i => i.metadata.modifierType === 'compound-child')
        })

        // Check if we're dealing with compound shape children that need special handling
        if (storedInstances.some(i => i.metadata.modifierType === 'compound-child')) {
          console.log('🔧 Processing compound shape children for boolean operation')

          // Return the compound child instances - they already have proper transforms and metadata
          return storedInstances
        }

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
   * Calculate collective bounds from virtual instances for boolean operations
   * Returns bounds in page coordinates that include all instances
   */
  private static calculateCollectiveBoundsFromInstances(
    instances: VirtualInstance[],
    originalShape: TLShape
  ): { centerX: number; centerY: number; width: number; height: number; minX: number; maxX: number; minY: number; maxY: number } {
    const shapeBounds = this.getShapeBounds(originalShape)

    if (instances.length === 0) {
      return {
        centerX: originalShape.x + shapeBounds.width / 2,
        centerY: originalShape.y + shapeBounds.height / 2,
        width: shapeBounds.width,
        height: shapeBounds.height,
        minX: originalShape.x,
        maxX: originalShape.x + shapeBounds.width,
        minY: originalShape.y,
        maxY: originalShape.y + shapeBounds.height
      }
    }

    // Calculate bounds from all virtual instances, accounting for scale
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    instances.forEach(instance => {
      const { x, y } = instance.transform.point()

      // Get scale from metadata (more accurate) or transform
      const scaleX = (instance.metadata.targetScaleX as number) ?? instance.transform.decomposed().scaleX
      const scaleY = (instance.metadata.targetScaleY as number) ?? instance.transform.decomposed().scaleY

      // For compound children, get dimensions from child props
      let width = shapeBounds.width
      let height = shapeBounds.height

      if (instance.metadata.modifierType === 'compound-child') {
        const childProps = instance.metadata.childProps as Record<string, unknown> & { w?: number; h?: number }
        width = childProps.w || 100
        height = childProps.h || 100
      }

      // Calculate scaled dimensions using the correct width/height
      const scaledWidth = width * scaleX
      const scaledHeight = height * scaleY

      const instanceMinX = x
      const instanceMaxX = x + scaledWidth
      const instanceMinY = y
      const instanceMaxY = y + scaledHeight

      minX = Math.min(minX, instanceMinX)
      maxX = Math.max(maxX, instanceMaxX)
      minY = Math.min(minY, instanceMinY)
      maxY = Math.max(maxY, instanceMaxY)
    })

    const width = maxX - minX
    const height = maxY - minY
    const centerX = minX + width / 2
    const centerY = minY + height / 2

    console.log('📊 Calculated collective bounds from virtual instances:', {
      instanceCount: instances.length,
      bounds: { minX, maxX, minY, maxY },
      dimensions: { width, height },
      center: { centerX, centerY }
    })

    return { centerX, centerY, width, height, minX, maxX, minY, maxY }
  }

  /**
   * Materialize virtual instances temporarily for geometry extraction
   * Extracts full transforms including scale for accurate boolean operations
   * Now includes collective bounds calculation for position context
   * Uses center-based scaling consistent with array modifiers
   */
  private static materializeInstancesForGeometry(
    instances: VirtualInstance[],
    originalShape: TLShape
  ): { shapes: TLShape[]; collectiveBounds: { centerX: number; centerY: number; width: number; height: number; minX: number; maxX: number; minY: number; maxY: number } } {
    // Calculate collective bounds first
    const collectiveBounds = this.calculateCollectiveBoundsFromInstances(instances, originalShape)

    // Create temporary shapes with center-based scaling
    const shapes = instances.map((instance, index) => {
      const { x, y, scaleX, scaleY } = instance.transform.decomposed()
      const rotation = instance.metadata.targetRotation ?? instance.transform.rotation()

      // Handle compound child instances specially
      if (instance.metadata.modifierType === 'compound-child') {
        console.log(`🔧 Processing compound child ${index}:`, {
          childType: instance.metadata.childType,
          position: { x, y },
          rotation: typeof rotation === 'number' ? rotation : 0
        })

        // Create shape from child metadata
        const childProps = instance.metadata.childProps as Record<string, unknown> & { w?: number; h?: number }
        return {
          id: `temp-compound-child-${index}` as TLShapeId,
          type: instance.metadata.childType as any,
          x,
          y,
          rotation: typeof rotation === 'number' ? rotation : 0,
          isLocked: false,
          opacity: 1,
          parentId: originalShape.parentId,
          index: originalShape.index,
          typeName: 'shape' as const,
          props: childProps,
          meta: {
            isTemporaryForGeometry: true,
            originalChildId: instance.sourceShapeId
          }
        }
      }

      // Extract scale from metadata first (more accurate), fall back to transform decomposition
      const targetScaleX = (instance.metadata.targetScaleX as number) ?? scaleX
      const targetScaleY = (instance.metadata.targetScaleY as number) ?? scaleY

      // Get original shape dimensions
      const originalProps = originalShape.props as Record<string, unknown> & { w?: number; h?: number }
      const originalW = originalProps.w || 100
      const originalH = originalProps.h || 100

      // For center-based scaling, we need to adjust position to account for scale
      // When scaling from center, the position needs to shift to maintain center position
      const scaledW = originalW * targetScaleX
      const scaledH = originalH * targetScaleY

      // Calculate center-based position adjustment
      // The shape grows from its center, so we need to move the top-left position
      const centerAdjustmentX = (scaledW - originalW) / 2
      const centerAdjustmentY = (scaledH - originalH) / 2

      // Adjust position for center-based scaling
      const adjustedX = x - centerAdjustmentX
      const adjustedY = y - centerAdjustmentY

      console.log(`🔧 Materializing instance ${index} (center-based):`, {
        originalPosition: { x, y },
        adjustedPosition: { x: adjustedX, y: adjustedY },
        rotation: typeof rotation === 'number' ? rotation : 0,
        scale: { scaleX: targetScaleX, scaleY: targetScaleY },
        scaledDimensions: { w: scaledW, h: scaledH },
        centerAdjustment: { x: centerAdjustmentX, y: centerAdjustmentY }
      })

      return {
        ...originalShape,
        id: `temp-${index}` as TLShapeId,
        x: adjustedX,
        y: adjustedY,
        rotation: typeof rotation === 'number' ? rotation : 0,
        props: {
          ...originalProps,
          w: scaledW,
          h: scaledH
        },
        meta: {
          ...originalShape.meta,
          isTemporary: true,
          appliedScaleX: targetScaleX,
          appliedScaleY: targetScaleY,
          centerBasedScaling: true
        }
      } as TLShape
    })

    return { shapes, collectiveBounds }
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