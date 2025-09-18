import type { VecLike } from 'tldraw'
import type { BezierPoint } from '../components/shapes/BezierShape'

/**
 * Path data types for modifier system
 */

// Different ways to represent path data
export type PathDataType = 'svg' | 'points' | 'bezier'

// Universal path data interface
export interface PathData {
  type: PathDataType
  data: string | VecLike[] | BezierPoint[]
  isClosed: boolean
  bounds?: {
    x: number
    y: number
    w: number
    h: number
  }
}

// Specific path data types
export interface SvgPathData extends PathData {
  type: 'svg'
  data: string
}

export interface PointsPathData extends PathData {
  type: 'points'
  data: VecLike[]
}

export interface BezierPathData extends PathData {
  type: 'bezier'
  data: BezierPoint[]
}

// Path modification result
export interface PathModificationResult {
  pathData: PathData
  boundsChanged: boolean
  newBounds?: {
    x: number
    y: number
    w: number
    h: number
  }
}

// Path modifier settings interfaces
export interface SubdivideSettings {
  iterations: number // Number of subdivision iterations
  factor: number // How much to subdivide (0.5 = midpoint)
  smooth: boolean // Apply smoothing after subdivision
}

export interface NoiseOffsetSettings {
  amplitude: number // Maximum displacement distance
  frequency: number // Noise frequency/scale  
  octaves: number // Number of noise octaves
  seed: number // Random seed for reproducibility
  direction: 'both' | 'normal' | 'tangent' // Displacement direction
}

export interface SmoothSettings {
  iterations: number // Number of smoothing passes
  factor: number // Smoothing factor (0-1)
  preserveCorners: boolean // Keep sharp corners
  cornerThreshold: number // Angle threshold for corners (degrees)
}

export interface SimplifySettings {
  tolerance: number // Douglas-Peucker tolerance
  preserveCorners: boolean
  minPoints: number // Minimum points to keep
}

// Utility types
export type PathModifierType = 'subdivide' | 'noise-offset' | 'smooth' | 'simplify'

export type PathModifierSettings = 
  | SubdivideSettings 
  | NoiseOffsetSettings 
  | SmoothSettings 
  | SimplifySettings

// Shape compatibility for path operations
export interface ShapePathCapability {
  canExtractPath: boolean
  pathType: PathDataType
  hasNativeSupport: boolean // Whether shape already works with paths
  requiresConversion: boolean // Whether we need to convert to different type
}

// Map of shape types to their path capabilities
export const SHAPE_PATH_CAPABILITIES: Record<string, ShapePathCapability> = {
  // TLDraw built-in shapes
  'draw': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'line': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'arrow': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'geo': {
    canExtractPath: true,
    pathType: 'svg',
    hasNativeSupport: false,
    requiresConversion: true
  },

  // Custom shapes
  'polygon': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'bezier': {
    canExtractPath: true,
    pathType: 'bezier',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'sine-wave': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'circle': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: false,
    requiresConversion: true
  },
  'triangle': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'custom-line': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'custom-draw': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  'custom-arrow': {
    canExtractPath: true,
    pathType: 'points',
    hasNativeSupport: true,
    requiresConversion: false
  },
  
  // Shapes that can't be processed as paths
  'text': {
    canExtractPath: false,
    pathType: 'points',
    hasNativeSupport: false,
    requiresConversion: false
  },
  'image': {
    canExtractPath: false,
    pathType: 'points',
    hasNativeSupport: false,
    requiresConversion: false
  },
  'embed': {
    canExtractPath: false,
    pathType: 'points',
    hasNativeSupport: false,
    requiresConversion: false
  }
}

// Helper functions
export function canProcessShapeAsPaths(shapeType: string): boolean {
  return SHAPE_PATH_CAPABILITIES[shapeType]?.canExtractPath ?? false
}

export function getShapePathType(shapeType: string): PathDataType | null {
  const capability = SHAPE_PATH_CAPABILITIES[shapeType]
  return capability?.canExtractPath ? capability.pathType : null
}

export function requiresPathConversion(shapeType: string): boolean {
  return SHAPE_PATH_CAPABILITIES[shapeType]?.requiresConversion ?? false
}