// Modifier type constants
export const MODIFIER_TYPES = {
  LINEAR_ARRAY: 'linear-array',
  CIRCULAR_ARRAY: 'circular-array',
  GRID_ARRAY: 'grid-array',
  MIRROR: 'mirror',
  L_SYSTEM: 'lsystem',
  SUBDIVIDE: 'subdivide',
  NOISE_OFFSET: 'noise-offset',
  SMOOTH: 'smooth',
  SIMPLIFY: 'simplify'
} as const

export type ModifierType = typeof MODIFIER_TYPES[keyof typeof MODIFIER_TYPES]

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
    spacingX: 100,
    spacingY: 100,
    offsetX: 0,
    offsetY: 0
  },
  [MODIFIER_TYPES.MIRROR]: {
    axis: 'x' as const,
    offset: 0,
    mergeThreshold: 10
  },
  [MODIFIER_TYPES.L_SYSTEM]: {
    axiom: 'F',
    rules: { 'F': 'F+F−F−F+F' },
    iterations: 6,
    angle: 20,
    stepPercent: 100,
    lengthDecay: 1.0,
    scalePerIteration: 1.0
  },
  [MODIFIER_TYPES.SUBDIVIDE]: {
    iterations: 1,
    factor: 0.5,
    smooth: false
  },
  [MODIFIER_TYPES.NOISE_OFFSET]: {
    amplitude: 10,
    frequency: 0.1,
    octaves: 3,
    seed: 123,
    direction: 'both' as const
  },
  [MODIFIER_TYPES.SMOOTH]: {
    iterations: 1,
    factor: 0.5,
    preserveCorners: true,
    cornerThreshold: 90
  },
  [MODIFIER_TYPES.SIMPLIFY]: {
    tolerance: 5,
    preserveCorners: true,
    minPoints: 3
  }
} as const

// Input constraints
export const INPUT_CONSTRAINTS = {
  count: { min: 2, max: 50, step: 1 },
  offsetX: { min: -200, max: 200, step: 1 },
  offsetY: { min: -200, max: 200, step: 1 },
  rotation: { min: -30, max: 30, step: 1 },
  scaleStep: { min: 1, max: 200, step: 1, precision: 0 },
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
  [MODIFIER_TYPES.MIRROR]: 'Mirror',
  [MODIFIER_TYPES.L_SYSTEM]: 'L-System',
  [MODIFIER_TYPES.SUBDIVIDE]: 'Subdivide',
  [MODIFIER_TYPES.NOISE_OFFSET]: 'Noise Offset',
  [MODIFIER_TYPES.SMOOTH]: 'Smooth',
  [MODIFIER_TYPES.SIMPLIFY]: 'Simplify'
} as const

// L-System presets (examples)
export const L_SYSTEM_PRESETS = [
  {
    id: 'binary-tree',
    label: 'Binary Tree',
    settings: {
      axiom: 'F',
      rules: { F: 'F[+F]F[-F]F' },
      iterations: 6,
      angle: 25,
      stepPercent: 100,
      lengthDecay: 0.75,
      scalePerIteration: 1.0,
    }
  },
  {
    id: 'bushy-tree',
    label: 'Bushy Tree',
    settings: {
      axiom: 'F',
      rules: { F: 'FF-[-F+F+F]+[+F-F-F]' },
      iterations: 4,
      angle: 22.5,
      stepPercent: 100,
      lengthDecay: 0.7,
      scalePerIteration: 1.0,
      branches: [-35, -10, 10, 35],
      angleJitter: 5,
      lengthJitter: 0.15,
      branchProbability: 0.9,
      continueTrunk: true,
    }
  },
  {
    id: 'wide-canopy',
    label: 'Wide Canopy',
    settings: {
      axiom: 'F',
      rules: { F: 'F[+F]F[+F]F' },
      iterations: 5,
      angle: 35,
      stepPercent: 100,
      lengthDecay: 0.8,
      scalePerIteration: 1.0,
      branches: [-45, -20, 0, 20, 45],
      angleJitter: 8,
      lengthJitter: 0.2,
      branchProbability: 0.85,
      continueTrunk: false,
    }
  },
  {
    id: 'symmetric-20deg',
    label: 'Symmetric 20°',
    settings: {
      axiom: 'F',
      rules: { F: 'F[+F]F[-F]F' },
      iterations: 6,
      angle: 20,
      stepPercent: 100,
      lengthDecay: 1.0,
      scalePerIteration: 1.0,
      branches: [-20, 0, 20],
      angleJitter: 0,
      lengthJitter: 0,
      branchProbability: 1,
      continueTrunk: true,
    }
  },
  {
    id: 'natural-sparse',
    label: 'Natural Sparse',
    settings: {
      axiom: 'F',
      rules: { F: 'F[+F]F[-F]F' },
      iterations: 7,
      angle: 18,
      stepPercent: 100,
      lengthDecay: 0.85,
      scalePerIteration: 0.95,
      branches: [-30, -12, 5, 22, 40],
      angleJitter: 10,
      lengthJitter: 0.25,
      branchProbability: 0.7,
      continueTrunk: true,
    }
  },
] as const

// Mirror axis options
export const MIRROR_AXIS_OPTIONS = [
  { value: 'x', label: 'Horizontal (X)' },
  { value: 'y', label: 'Vertical (Y)' },
  { value: 'diagonal', label: 'Diagonal' }
] as const 