// Shape dimension utilities
export {
  getShapeDimensions,
  setShapeDimensions,
  getShapeBounds
} from './shapeDimensions'

// Group utilities
export {
  calculateGroupBounds,
  findTopLevelGroup
} from './groupUtils'

// Shape scaling utilities
export {
  applyShapeScaling
} from './shapeScaling'

// Transform utilities
export {
  generateCloneId,
  isArrayClone,
  getOriginalShapeId,
  degreesToRadians,
  radiansToDegrees,
  calculateLinearPosition,
  calculateCircularPosition,
  calculateGridPosition,
  type Position
} from './transformUtils'

// Debug utilities
export {
  logShapeOperation
} from './debugUtils' 