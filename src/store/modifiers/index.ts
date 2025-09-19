// Core functionality - New efficient matrix-based system
export { TransformComposer } from './core/TransformComposer'
export type { VirtualInstance, VirtualModifierState } from './core/TransformComposer'
export {
  createInitialVirtualState,
  extractShapesFromState,
  extractShapesWithCache,
  validateVirtualState
} from './core/ShapeStateManager'

// Types
export type {
  Transform,
  GroupContext
} from '../../types/modifiers'

// Note: Legacy processor exports removed
// All processing is now handled by TransformComposer for O(n) performance 