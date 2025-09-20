import { createShapeId, type TLShape, type TLShapeId } from 'tldraw'
import { TransformComposer, type VirtualModifierState, type VirtualInstance } from './TransformComposer'

/**
 * Creates initial VirtualModifierState from a TLShape
 * Uses the new efficient virtual instance system
 */
export function createInitialVirtualState(shape: TLShape): VirtualModifierState {
  return TransformComposer.processModifiers(shape, [])
}

/**
 * Converts VirtualModifierState to TLShape array for rendering
 * This materializes the virtual instances into actual shapes
 */
export function extractShapesFromState(state: VirtualModifierState): TLShape[] {
  // Check if we have boolean operations that need special handling
  const hasBooleanOperations = state.virtualInstances.some(
    inst => inst.metadata.deferredBoolean
  )

  if (hasBooleanOperations) {
    console.log('🔍 Boolean operations detected in extractShapesFromState, using materializeWithCache')
    // For boolean operations, use the cache-aware materialization
    let idCounter = 0
    const createId = (): TLShapeId => createShapeId(`clone-${state.originalShape.id}-${idCounter++}`)

    const result = TransformComposer.materializeWithCache(state, new Map(), createId)
    return result.create // Return only the created shapes
  }

  // Generate unique IDs for each shape
  let idCounter = 0
  const createId = (): TLShapeId => createShapeId(`clone-${state.originalShape.id}-${idCounter++}`)

  return TransformComposer.materializeInstances(state, createId)
}

/**
 * Helper to extract shapes with caching for better performance
 * Uses the optimized materialization with cache from TransformComposer
 */
export function extractShapesWithCache(
  state: VirtualModifierState,
  existingShapes: Map<number, TLShape>
): { create: TLShape[], update: Partial<TLShape>[], delete: TLShapeId[] } {
  // Generate unique IDs for new shapes
  let idCounter = existingShapes.size
  const createId = (): TLShapeId => createShapeId(`clone-${state.originalShape.id}-${idCounter++}`)

  return TransformComposer.materializeWithCache(state, existingShapes, createId)
}

/**
 * Validates a VirtualModifierState object
 * Ensures the state is valid for processing
 */
export function validateVirtualState(state: VirtualModifierState): void {
  if (!state.originalShape) {
    throw new Error('VirtualModifierState must have an originalShape')
  }

  if (!Array.isArray(state.virtualInstances)) {
    throw new Error('VirtualModifierState instances must be an array')
  }

  if (state.virtualInstances.length === 0) {
    throw new Error('VirtualModifierState must have at least one instance')
  }

  // Validate each virtual instance
  state.virtualInstances.forEach((instance: VirtualInstance, index: number) => {
    if (!instance.sourceShapeId) {
      throw new Error(`Virtual instance ${index} must have a sourceShapeId`)
    }

    if (!instance.transform) {
      throw new Error(`Virtual instance ${index} must have a transform matrix`)
    }

    if (!instance.metadata) {
      throw new Error(`Virtual instance ${index} must have metadata`)
    }
  })
} 