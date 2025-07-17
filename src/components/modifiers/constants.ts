// Modifier type constants
export const MODIFIER_TYPES = {
  LINEAR_ARRAY: 'linear-array',
  CIRCULAR_ARRAY: 'circular-array',
  GRID_ARRAY: 'grid-array',
  MIRROR: 'mirror'
} as const

export type ModifierType = typeof MODIFIER_TYPES[keyof typeof MODIFIER_TYPES]

// Default settings for each modifier type
export const DEFAULT_SETTINGS = {
  [MODIFIER_TYPES.LINEAR_ARRAY]: {
    count: 3,
    offsetX: 100,
    offsetY: 0,
    rotation: 0,
    spacing: 1,
    scaleStep: 1
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
    pointToCenter: false
  },
  [MODIFIER_TYPES.GRID_ARRAY]: {
    rows: 3,
    columns: 3,
    spacingX: 100,
    spacingY: 100,
    offsetX: 0,
    offsetY: 0
  },
  [MODIFIER_TYPES.MIRROR]: {
    axis: 'x' as const,
    offset: 0,
    mergeThreshold: 10
  }
} as const

// Input constraints
export const INPUT_CONSTRAINTS = {
  count: { min: 2, max: 50, step: 1 },
  offsetX: { min: -500, max: 500, step: 1 },
  offsetY: { min: -500, max: 500, step: 1 },
  rotation: { min: -360, max: 360, step: 1 },
  spacing: { min: 0.1, max: 5, step: 0.1, precision: 1 },
  scaleStep: { min: 0.1, max: 3, step: 0.1, precision: 1 },
  radius: { min: 10, max: 1000, step: 1 },
  startAngle: { min: 0, max: 360, step: 1 },
  endAngle: { min: 0, max: 360, step: 1 },
  centerX: { min: -500, max: 500, step: 1 },
  centerY: { min: -500, max: 500, step: 1 },
  rotateEach: { min: -360, max: 360, step: 1 },
  rotateAll: { min: -360, max: 360, step: 1 },
  rows: { min: 1, max: 20, step: 1 },
  columns: { min: 1, max: 20, step: 1 },
  spacingX: { min: 10, max: 500, step: 1 },
  spacingY: { min: 10, max: 500, step: 1 },
  offset: { min: -200, max: 200, step: 1 },
  mergeThreshold: { min: 0, max: 50, step: 1 }
} as const

// Modifier type display names
export const MODIFIER_DISPLAY_NAMES = {
  [MODIFIER_TYPES.LINEAR_ARRAY]: 'Linear Array',
  [MODIFIER_TYPES.CIRCULAR_ARRAY]: 'Circular Array',
  [MODIFIER_TYPES.GRID_ARRAY]: 'Grid Array',
  [MODIFIER_TYPES.MIRROR]: 'Mirror'
} as const

// Mirror axis options
export const MIRROR_AXIS_OPTIONS = [
  { value: 'x', label: 'Horizontal (X)' },
  { value: 'y', label: 'Vertical (Y)' },
  { value: 'diagonal', label: 'Diagonal' }
] as const 