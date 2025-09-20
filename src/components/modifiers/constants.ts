// Modifier type constants
export const MODIFIER_TYPES = {
  LINEAR_ARRAY: 'linear-array',
  CIRCULAR_ARRAY: 'circular-array',
  GRID_ARRAY: 'grid-array',
  MIRROR: 'mirror',
  BOOLEAN: 'boolean'
} as const

// ModifierType is defined in ../../../types/modifiers.ts

// Default settings for each modifier type
export const DEFAULT_SETTINGS = {
  [MODIFIER_TYPES.LINEAR_ARRAY]: {
    count: 19,
    offsetX: 10, // 10% = shape width
    offsetY: 0,  // 0% = no vertical offset
    rotation: -2,
    scaleStep: 50 // 50% scale step per iteration
  },
  [MODIFIER_TYPES.CIRCULAR_ARRAY]: {
    count: 8,
    radius: 100,
    startAngle: 0,
    endAngle: 360,
    centerX: 0,
    centerY: 0,
    rotateEach: 0,
    rotateAll: 0,
    alignToTangent: false
  },
  [MODIFIER_TYPES.GRID_ARRAY]: {
    rows: 3,
    columns: 3,
    spacingX: 120, // 120% = 1.2x shape width spacing
    spacingY: 120, // 120% = 1.2x shape height spacing
    rotateEach: 0,
    rotateAll: 0,
    rotateEachRow: 0,
    rotateEachColumn: 0,
    scaleStep: 100, // 100% = no scaling by default
    rowScaleStep: 100, // 100% = no row scaling by default
    columnScaleStep: 100 // 100% = no column scaling by default
  },
  [MODIFIER_TYPES.MIRROR]: {
    axis: 'x' as const,
    offset: 0
  },
  [MODIFIER_TYPES.BOOLEAN]: {
    operation: 'union' as const
  }
} as const

// Input constraints
export const INPUT_CONSTRAINTS = {
  count: { min: 2, max: 50, step: 1 },
  offsetX: { min: -200, max: 200, step: 1 },
  offsetY: { min: -200, max: 200, step: 1 },
  rotation: { min: -30, max: 30, step: 1 },
  rotationIncrement: { min: -30, max: 30, step: 1 },
  scaleStep: { min: 1, max: 200, step: 1, precision: 0 },
  radius: { min: 10, max: 1000, step: 1 },
  startAngle: { min: 0, max: 360, step: 1 },
  endAngle: { min: 0, max: 360, step: 1 },
  centerX: { min: -500, max: 500, step: 1 },
  centerY: { min: -500, max: 500, step: 1 },
  rotateEach: { min: -360, max: 360, step: 1 },
  rotateAll: { min: -180, max: 180, step: 1 },
  rows: { min: 1, max: 20, step: 1 },
  columns: { min: 1, max: 20, step: 1 },
  spacingX: { min: 50, max: 500, step: 10 },
  spacingY: { min: 50, max: 500, step: 10 },
  offset: { min: -200, max: 200, step: 1 }
} as const

// Modifier type display names
export const MODIFIER_DISPLAY_NAMES = {
  [MODIFIER_TYPES.LINEAR_ARRAY]: 'Linear Array',
  [MODIFIER_TYPES.CIRCULAR_ARRAY]: 'Circular Array',
  [MODIFIER_TYPES.GRID_ARRAY]: 'Grid Array',
  [MODIFIER_TYPES.MIRROR]: 'Mirror',
  [MODIFIER_TYPES.BOOLEAN]: 'Boolean'
} as const

// Mirror axis options
export const MIRROR_AXIS_OPTIONS = [
  { value: 'x', label: 'Horizontal (X)' },
  { value: 'y', label: 'Vertical (Y)' },
  { value: 'diagonal', label: 'Diagonal' }
] as const

// Boolean operation options
export const BOOLEAN_OPERATION_OPTIONS = [
  { value: 'union', label: 'Union (Merge)' },
  { value: 'subtract', label: 'Subtract (Cut)' },
  { value: 'intersect', label: 'Intersect (Common)' },
  { value: 'exclude', label: 'Exclude (XOR)' }
] as const 