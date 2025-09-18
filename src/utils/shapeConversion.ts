import type { TLShape, VecLike, Editor } from 'tldraw'
import type { PathData } from '../types/pathTypes'
import type { BezierShape, BezierPoint } from '../components/shapes/BezierShape'
import { calculatePathBounds } from './pathExtractors'

/**
 * Utility functions for converting shapes when they need to support complex paths
 */

export interface ConvertToPathResult {
  shouldConvert: boolean
  convertedShape?: TLShape
}

/**
 * Determines if a shape should be converted to a path-capable shape type
 * and returns the converted shape if needed
 */
export function convertShapeForPathModification(
  shape: TLShape,
  pathData: PathData
): ConvertToPathResult {
  
  // For shapes that can already store path data, no conversion needed
  const shapeSupportsPathStorage = canStorePathData(shape.type)
  if (shapeSupportsPathStorage) {
    return { shouldConvert: false }
  }
  
  // For complex path modifications, convert simple shapes to Bezier
  if (shouldConvertToBezier(pathData)) {
    const convertedShape = convertToBezierShape(shape, pathData)
    if (convertedShape) {
      return { shouldConvert: true, convertedShape }
    }
  }
  
  return { shouldConvert: false }
}

/**
 * Check if a shape type can store path data natively
 * NOTE: For noise/path modifiers, we want to force conversion to Bezier
 * even for shapes that can technically store path data, because
 * path-modified polygons lose transform controls.
 */
function canStorePathData(shapeType: string): boolean {
  // Only Bezier shapes truly support complex path data with full transform controls
  return shapeType === 'bezier'
}

/**
 * Determine if path data is complex enough to require Bezier conversion
 */
function shouldConvertToBezier(pathData: PathData): boolean {
  if (pathData.type === 'points') {
    const points = pathData.data as VecLike[]

    console.log('🔍 Checking if should convert to Bezier:', {
      pointCount: points.length,
      willConvert: true // Always convert for path modifications
    })

    // Always convert path-modified shapes to Bezier for proper transform controls
    // Previously we only converted if points.length > 10, but this caused issues
    // with transform controls on noise-modified polygons
    return true
  }

  // Always convert bezier and SVG paths that can't be stored in simple shapes
  return pathData.type === 'bezier' || pathData.type === 'svg'
}

/**
 * Convert a shape to a Bezier shape that can handle complex path data
 */
function convertToBezierShape(
  originalShape: TLShape,
  pathData: PathData
): BezierShape | null {
  
  if (pathData.type !== 'points') {
    console.warn('Can only convert points-based path data to Bezier shape')
    return null
  }
  
  const points = pathData.data as VecLike[]
  if (points.length === 0) return null
  
  // Calculate bounds for the bezier shape
  const bounds = pathData.bounds || calculatePathBounds(points)
  
  // Convert VecLike points to BezierPoints (without control points initially)
  const bezierPoints: BezierPoint[] = points.map(p => ({
    x: p.x,
    y: p.y
    // Control points could be added here for smoother curves if needed
  }))
  
  // Create new Bezier shape with converted path data
  const bezierShape: BezierShape = {
    ...originalShape,
    id: originalShape.id, // Keep same ID to replace original
    type: 'bezier',
    props: {
      w: bounds.w,
      h: bounds.h,
      color: (originalShape.props as Record<string, unknown>).color as string || '#000000',
      strokeWidth: (originalShape.props as Record<string, unknown>).strokeWidth as number || 2,
      fill: (originalShape.props as Record<string, unknown>).fill as boolean || false,
      points: bezierPoints,
      isClosed: true, // Most shapes we convert are closed
      editMode: false // CRITICAL: Ensure editMode is false to enable transform controls
    },
    meta: {
      ...originalShape.meta,
      convertedFromType: originalShape.type,
      pathModified: true,
      originalBounds: {
        w: (originalShape.props as Record<string, unknown>).w as number,
        h: (originalShape.props as Record<string, unknown>).h as number
      }
    }
  } as BezierShape

  // Debug: Log the conversion to help diagnose transform control issues
  console.log('🔄 Shape converted for noise modifier:', {
    originalType: originalShape.type,
    newType: 'bezier',
    editMode: bezierShape.props.editMode,
    bounds: bounds,
    pointCount: bezierPoints.length
  })
  
  return bezierShape
}

/**
 * Check if a shape was converted from another type
 */
export function isConvertedShape(shape: TLShape): boolean {
  return !!shape.meta?.convertedFromType
}

/**
 * Get the original shape type before conversion
 */
export function getOriginalShapeType(shape: TLShape): string | null {
  return (shape.meta?.convertedFromType as string) || null
}

/**
 * Create a conversion operation for the editor
 */
export function createShapeConversionOperation(
  originalShape: TLShape,
  convertedShape: TLShape,
  editor: Editor
): () => void {
  return () => {
    editor.run(() => {
      // Delete the original shape and create the converted one
      editor.deleteShapes([originalShape.id])
      editor.createShapes([convertedShape])
    }, { history: 'record' })
  }
}

/**
 * Enhanced path-to-shape conversion that handles complex paths
 */
export function enhancedPathToShape(
  pathData: PathData,
  originalShape: TLShape
): Partial<TLShape> | TLShape | null {
  
  const conversionResult = convertShapeForPathModification(originalShape, pathData)
  
  if (conversionResult.shouldConvert && conversionResult.convertedShape) {
    // Return the fully converted shape
    return conversionResult.convertedShape
  }
  
  // Fallback to existing conversion logic (handled by pathExtractors)
  return null
}