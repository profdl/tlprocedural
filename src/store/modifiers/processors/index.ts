// Legacy array processors have been replaced by TransformComposer
// for O(n) performance instead of O(n²) complexity

// Only L-System and path modifiers remain as individual processors
// until they can be migrated to the matrix system
export { LSystemProcessor } from './lSystemProcessor'

// Path modifiers
export { SubdivideProcessor } from './SubdivideProcessor'
export { NoiseOffsetProcessor } from './NoiseOffsetProcessor'
export { SmoothProcessor } from './SmoothProcessor'
export { SimplifyProcessor } from './SimplifyProcessor'

export type { ModifierProcessor } from '../../../types/modifiers' 