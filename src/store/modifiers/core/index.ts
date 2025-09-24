export { TransformComposer } from './TransformComposer'
export type { VirtualInstance, VirtualModifierState } from './TransformComposer'
export {
  createInitialVirtualState,
  extractShapesFromState,
  extractShapesWithCache,
  validateVirtualState
} from './ShapeStateManager'
export { ArrayModifierProcessor } from './ArrayModifierProcessor'
export { BooleanOperationProcessor } from './BooleanOperationProcessor'
export { ModifierContext } from './ModifierContext'
export {
  ModifierError,
  ModifierProcessingError,
  BooleanOperationError,
  MaterializationError,
  RecoveryStrategy,
  ModifierErrorHandler,
  ModifierPerformanceMonitor
} from './ModifierError'

export type { Transform } from '../../../types/modifiers' 