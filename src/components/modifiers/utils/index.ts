// Shape dimension utilities
export {
  getShapeDimensions,
  setShapeDimensions,
  getShapeBounds
} from './shapeDimensions'

// Group utilities
export {
  calculateGroupBounds,
  findTopLevelGroup,
  getGroupPageBounds,
  getGroupChildShapes
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
  calculatePositionInPageSpace,
  localToPageSpace,
  getShapeCenterInPageSpace,
  type Position
} from './transformUtils'

// Debug utilities
export {
  logShapeOperation
} from './debugUtils' 