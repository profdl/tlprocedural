export { ModifierStack } from './ModifierStack'
export { TransformComposer } from './TransformComposer'
export type { VirtualInstance, VirtualModifierState } from './TransformComposer'
export {
  createInitialVirtualState,
  extractShapesFromState,
  extractShapesWithCache,
  validateVirtualState
} from './ShapeStateManager'
export { PathModifier, isPathModifierType } from './PathModifier'

export type { Transform } from '../../../types/modifiers' 