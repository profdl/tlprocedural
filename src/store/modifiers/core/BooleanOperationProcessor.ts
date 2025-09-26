import { Mat, type TLShape, type TLShapeId } from 'tldraw'
import type { BooleanSettings } from '../../../types/modifiers'
import type { VirtualInstance, VirtualModifierState } from './TransformComposer'
import { GeometryConverter } from '../utils/GeometryConverter'
import type { BezierShape } from '../../../components/shapes/BezierShape'
import type { CompoundShape, ChildShapeData } from '../../../components/shapes/CompoundShape'

/**
 * Dedicated processor for Boolean operations on shapes
 * Extracted from TransformComposer to improve maintainability while preserving
 * all critical caching, deferred execution, and geometry processing logic
 */
export class BooleanOperationProcessor {
  // Cache for boolean operation results
  private static booleanCache = new Map<string, import('../utils/GeometryConverter').PolygonCoordinates>()

  // Temporary storage for virtual instances that need to be processed for boolean operations
  private static virtualInstanceStorage = new Map<string, VirtualInstance[]>()

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
   * Boolean modifier using deferred execution for optimal performance
   * Stores boolean intent without computing geometry until materialization
   * CRITICAL: Preserves all caching, storage, and CompoundShape handling logic
   */
  static applyBoolean(
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
   * Materialize boolean operations with deferred execution
   * Only computes boolean geometry when absolutely necessary
   * CRITICAL: Preserves all caching, collective bounds, and geometry processing logic
   */
  static materializeBooleanDeferred(
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
    const sharedStyle = this.computeSharedStyle(tempShapes)

    const styleSourceProps = styleSourceShape?.props as { color?: string; fillColor?: string } | undefined

    console.log('🎨 Style inheritance for Boolean operation:', {
      operation: deferredBoolean.operation,
      availableShapes: tempShapes.length,
      selectedStyleSource: styleSourceShape ? {
        id: styleSourceShape.id,
        type: styleSourceShape.type,
        color: styleSourceProps?.color,
        fillColor: styleSourceProps?.fillColor
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
      styleSourceShape,
      sharedStyle
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
   * CRITICAL: Preserves storage-based instance retrieval and CompoundShape handling
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
   * CRITICAL: Preserves compound shape special handling and scaling calculations
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
   * Determine shared style attributes across all input shapes.
   * Only returns properties when every shape agrees on the value.
   */
  private static computeSharedStyle(shapes: TLShape[]): Partial<{
    color: string
    fillColor: string
    fill: boolean
    strokeWidth: number
  }> {
    if (shapes.length === 0) {
      return {}
    }

    const firstStyle = GeometryConverter.extractShapeProperties(shapes[0])
    let sharedColor: string | undefined = firstStyle.color
    let sharedFillColor: string | undefined = firstStyle.fillColor
    let sharedFill: boolean | undefined = firstStyle.fill
    let sharedStrokeWidth: number | undefined = firstStyle.strokeWidth

    for (let i = 1; i < shapes.length; i++) {
      const style = GeometryConverter.extractShapeProperties(shapes[i])

      if (sharedColor !== undefined && style.color !== sharedColor) {
        sharedColor = undefined
      }
      if (sharedFillColor !== undefined && style.fillColor !== sharedFillColor) {
        sharedFillColor = undefined
      }
      if (sharedFill !== undefined && style.fill !== sharedFill) {
        sharedFill = undefined
      }
      if (sharedStrokeWidth !== undefined && style.strokeWidth !== sharedStrokeWidth) {
        sharedStrokeWidth = undefined
      }

      if (!sharedColor && !sharedFillColor && sharedFill === undefined && sharedStrokeWidth === undefined) {
        break
      }
    }

    const result: Partial<{ color: string; fillColor: string; fill: boolean; strokeWidth: number }> = {}

    if (sharedColor !== undefined) {
      result.color = sharedColor
    }
    if (sharedFillColor !== undefined) {
      result.fillColor = sharedFillColor
    }
    if (sharedFill !== undefined) {
      result.fill = sharedFill
    }
    if (sharedStrokeWidth !== undefined) {
      result.strokeWidth = sharedStrokeWidth
    }

    return result
  }

  /**
   * Materialize virtual instances temporarily for geometry extraction
   * Extracts full transforms including scale for accurate boolean operations
   * Now includes collective bounds calculation for position context
   * Uses center-based scaling consistent with array modifiers
   * CRITICAL: Preserves compound shape handling and center-based scaling
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

        const childType = instance.metadata.childType as TLShape['type'] | undefined
        const childProps = instance.metadata.childProps as (Record<string, unknown> & { w?: number; h?: number }) | undefined

        if (!childType || !childProps) {
          throw new Error('Compound child metadata missing type or props')
        }

        return {
          id: `temp-compound-child-${index}` as TLShapeId,
          type: childType,
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
   * Check for boolean results in materialization process
   * Used by materializeWithCache to detect when boolean processing is needed
   */
  static hasBooleanResults(virtualInstances: VirtualInstance[]): boolean {
    return virtualInstances.some(inst => inst.metadata.deferredBoolean)
  }

  /**
   * Find boolean result instance for processing
   * Used by materializeWithCache to get the boolean result to process
   */
  static findBooleanResult(virtualInstances: VirtualInstance[]): VirtualInstance | undefined {
    return virtualInstances.find(inst => inst.metadata.deferredBoolean)
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
