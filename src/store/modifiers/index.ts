// Core functionality
export { ModifierStack } from './core/ModifierStack'
export {
  createInitialShapeState,
  extractShapesFromState,
  validateShapeState,
  cloneShapeState
} from './core/ShapeStateManager'

// Processors
export {
  LinearArrayProcessor,
  CircularArrayProcessor,
  GridArrayProcessor,
  MirrorProcessor
} from './processors'

// Types
export type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  GroupContext
} from '../../types/modifiers' 