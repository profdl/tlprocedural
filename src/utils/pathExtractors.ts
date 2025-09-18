import type { TLShape, Editor, VecLike } from 'tldraw'
import type { 
  PathData, 
  SvgPathData, 
  PointsPathData, 
  BezierPathData 
} from '../types/pathTypes'
import type { BezierPoint, BezierShape } from '../components/shapes/BezierShape'
import type { PolygonShape } from '../components/shapes/PolygonShape'
import type { SineWaveShape } from '../components/shapes/SineWaveShape'
import type { LineShape } from '../components/shapes/LineShape'
import type { DrawShape } from '../components/shapes/DrawShape'
import type { CustomArrowShape } from '../components/shapes/ArrowShape'
import { SHAPE_PATH_CAPABILITIES, canProcessShapeAsPaths } from '../types/pathTypes'

/**
 * Shape-to-path conversion utilities
 */

// Main converter function
export function shapeToPath(shape: TLShape, editor?: Editor): PathData | null {
  if (!canProcessShapeAsPaths(shape.type)) {
    return null
  }

  const capability = SHAPE_PATH_CAPABILITIES[shape.type]
  if (!capability) return null

  try {
    switch (shape.type) {
      // Custom shapes
      case 'polygon':
        return extractPolygonPath(shape as PolygonShape)
      case 'bezier':
        return extractBezierPath(shape as BezierShape)
      case 'sine-wave':
        return extractSineWavePath(shape as SineWaveShape)
      case 'triangle':
        return extractTrianglePath(shape)
      case 'circle':
        return extractCirclePath(shape)
      
      // TLDraw built-in shapes
      case 'draw':
        return extractDrawPath(shape, editor)
      case 'line':
        return extractLinePath(shape, editor)
      case 'arrow':
        return extractArrowPath(shape, editor)
      case 'geo':
        return extractGeoPath(shape, editor)

      // Custom line-based shapes
      case 'custom-line':
        return extractCustomLinePath(shape)
      case 'custom-draw':
        return extractCustomDrawPath(shape)
      case 'custom-arrow':
        return extractCustomArrowPath(shape)
      
      default:
        console.warn(`No path extractor for shape type: ${shape.type}`)
        return null
    }
  } catch (error) {
    console.error(`Error extracting path from ${shape.type} shape:`, error)
    return null
  }
}

// Convert path data back to shape updates
export function pathToShapeUpdates(
  pathData: PathData, 
  originalShape: TLShape
): Partial<TLShape> | null {
  if (!canProcessShapeAsPaths(originalShape.type)) {
    return null
  }

  try {
    switch (originalShape.type) {
      case 'polygon':
        return pathToPolygon(pathData, originalShape as PolygonShape)
      case 'bezier':
        return pathToBezier(pathData, originalShape as BezierShape)
      case 'sine-wave':
        return pathToSineWave(pathData, originalShape as SineWaveShape)
      case 'triangle':
        return pathToTriangle(pathData, originalShape)
      case 'circle':
        return pathToCircle(pathData, originalShape)
      case 'custom-line':
        return pathToCustomLine(pathData, originalShape)
      case 'custom-draw':
        return pathToCustomDraw(pathData, originalShape)
      case 'custom-arrow':
        return pathToCustomArrow(pathData, originalShape)

      default:
        console.warn(`No path-to-shape converter for type: ${originalShape.type}`)
        return null
    }
  } catch (error) {
    console.error(`Error converting path to ${originalShape.type} shape:`, error)
    return null
  }
}

// Custom shape extractors
function extractPolygonPath(shape: PolygonShape): PointsPathData | null {
  const props = shape.props as PolygonShape['props'] & {
    points?: VecLike[];
    renderAsPath?: boolean;
  }

  // If polygon has been modified and has path points, use those
  if (props.renderAsPath && props.points && props.points.length >= 3) {
    return {
      type: 'points',
      data: [...props.points], // Clone the points
      isClosed: true,
      bounds: calculatePathBounds(props.points)
    }
  }

  // Otherwise extract original polygon geometry
  const { w, h, sides } = props
  const centerX = w / 2
  const centerY = h / 2
  const radiusX = w / 2
  const radiusY = h / 2

  const points: VecLike[] = []

  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
    const x = centerX + radiusX * Math.cos(angle)
    const y = centerY + radiusY * Math.sin(angle)
    points.push({ x, y })
  }

  return {
    type: 'points',
    data: points,
    isClosed: true,
    bounds: { x: 0, y: 0, w, h }
  }
}

function extractBezierPath(shape: BezierShape): BezierPathData {
  return {
    type: 'bezier',
    data: shape.props.points,
    isClosed: shape.props.isClosed,
    bounds: { x: 0, y: 0, w: shape.props.w, h: shape.props.h }
  }
}

function extractSineWavePath(shape: SineWaveShape): PointsPathData {
  const { w, h, frequency, phase } = shape.props
  const amplitude = Math.max(1, h / 2)
  const steps = Math.max(50, w)
  
  const points: VecLike[] = []
  
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w
    const radians = (phase * Math.PI / 180) + (x * frequency * 2 * Math.PI / w)
    const y = amplitude + amplitude * Math.sin(radians)
    points.push({ x, y })
  }
  
  return {
    type: 'points',
    data: points,
    isClosed: false,
    bounds: { x: 0, y: 0, w, h }
  }
}

function extractTrianglePath(shape: TLShape): PointsPathData | null {
  const props = shape.props as {
    w?: number;
    h?: number;
    points?: VecLike[];
    renderAsPath?: boolean
  }

  // If triangle has been modified and has path points, use those
  if (props.renderAsPath && props.points && props.points.length >= 3) {
    return {
      type: 'points',
      data: [...props.points], // Clone the points
      isClosed: true,
      bounds: calculatePathBounds(props.points)
    }
  }

  // Otherwise extract original triangle geometry
  const w = props.w || 100
  const h = props.h || 100

  const points: VecLike[] = [
    { x: w / 2, y: 0 },     // Top
    { x: 0, y: h },         // Bottom left
    { x: w, y: h }          // Bottom right
  ]

  return {
    type: 'points',
    data: points,
    isClosed: true,
    bounds: { x: 0, y: 0, w, h }
  }
}

function extractCirclePath(shape: TLShape): PointsPathData | null {
  const props = shape.props as {
    w?: number;
    h?: number;
    points?: VecLike[];
    renderAsPath?: boolean
  }

  // If circle has been modified and has path points, use those
  if (props.renderAsPath && props.points && props.points.length >= 3) {
    return {
      type: 'points',
      data: [...props.points], // Clone the points
      isClosed: true,
      bounds: calculatePathBounds(props.points)
    }
  }

  // Otherwise extract original circle geometry
  const w = props.w || 100
  const h = props.h || 100
  const centerX = w / 2
  const centerY = h / 2
  const radiusX = w / 2
  const radiusY = h / 2

  // Create circle as point array (approximation)
  const segments = 64 // Smooth circle
  const points: VecLike[] = []

  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments
    const x = centerX + radiusX * Math.cos(angle)
    const y = centerY + radiusY * Math.sin(angle)
    points.push({ x, y })
  }

  return {
    type: 'points',
    data: points,
    isClosed: true,
    bounds: { x: 0, y: 0, w, h }
  }
}

// Type definitions for TLDraw shape segments
interface DrawShapeSegment {
  points?: Array<{ x: number; y: number; z?: number }>
}

interface DrawShapeProps {
  segments?: DrawShapeSegment[]
}

// TLDraw built-in shape extractors (simplified)
function extractDrawPath(shape: TLShape, editor?: Editor): PointsPathData | null {
  // TLDraw draw shapes already have point data
  const segments = (shape.props as DrawShapeProps).segments
  if (!segments) return null

  const points: VecLike[] = []
  segments.forEach((segment: DrawShapeSegment) => {
    if (segment.points && Array.isArray(segment.points)) {
      segment.points.forEach((point: { x: number; y: number; z?: number }) => {
        points.push({ x: point.x, y: point.y })
      })
    }
  })
  
  return {
    type: 'points',
    data: points,
    isClosed: false,
    bounds: editor ? 
      editor.getShapePageBounds(shape.id) || { x: 0, y: 0, w: 100, h: 100 } :
      { x: 0, y: 0, w: 100, h: 100 }
  }
}

function extractLinePath(shape: TLShape, editor?: Editor): PointsPathData | null {
  const points = (shape.props as { points?: VecLike[] }).points
  if (!points || !Array.isArray(points)) return null
  
  return {
    type: 'points',
    data: points.map((p: VecLike) => ({ x: p.x, y: p.y })),
    isClosed: false,
    bounds: editor ? 
      editor.getShapePageBounds(shape.id) || { x: 0, y: 0, w: 100, h: 100 } :
      { x: 0, y: 0, w: 100, h: 100 }
  }
}

function extractArrowPath(shape: TLShape, editor?: Editor): PointsPathData | null {
  // Simplified arrow path extraction
  const start = (shape.props as { start?: VecLike }).start
  const end = (shape.props as { end?: VecLike }).end
  
  if (!start || !end) return null
  
  return {
    type: 'points',
    data: [
      { x: start.x, y: start.y },
      { x: end.x, y: end.y }
    ],
    isClosed: false,
    bounds: editor ? 
      editor.getShapePageBounds(shape.id) || { x: 0, y: 0, w: 100, h: 100 } :
      { x: 0, y: 0, w: 100, h: 100 }
  }
}

function extractGeoPath(_shape: TLShape, editor?: Editor): SvgPathData | null {
  // For geo shapes, we'd need to use TLDraw's geometry system
  // This is a placeholder for now
  if (editor) {
    // Convert geometry to SVG path - this would need more implementation
    return {
      type: 'svg',
      data: '', // Placeholder
      isClosed: true,
      bounds: { x: 0, y: 0, w: 100, h: 100 }
    }
  }
  return null
}

// Path-to-shape converters
function pathToPolygon(pathData: PathData, shape: PolygonShape): Partial<PolygonShape> | null {
  if (pathData.type !== 'points') return null
  
  const points = pathData.data as VecLike[]
  if (points.length === 0) return null
  
  // For polygon, we need to maintain the sides count
  // This is a simplified approach - could be enhanced to detect optimal sides
  return {
    props: {
      ...shape.props,
      sides: points.length
    }
  }
}

function pathToBezier(pathData: PathData, shape: BezierShape): Partial<BezierShape> | null {
  if (pathData.type === 'bezier') {
    return {
      props: {
        ...shape.props,
        points: pathData.data as BezierPoint[]
      }
    }
  } else if (pathData.type === 'points') {
    // Convert points to bezier points (without control points)
    const points = pathData.data as VecLike[]
    const bezierPoints: BezierPoint[] = points.map(p => ({ x: p.x, y: p.y }))
    
    return {
      props: {
        ...shape.props,
        points: bezierPoints
      }
    }
  }
  
  return null
}

function pathToSineWave(pathData: PathData, shape: SineWaveShape): Partial<SineWaveShape> | null {
  // For sine wave, path modification might change amplitude or frequency
  // This is simplified - could analyze the path to extract wave parameters
  if (pathData.bounds) {
    return {
      props: {
        ...shape.props,
        w: pathData.bounds.w,
        h: pathData.bounds.h,
        amplitude: pathData.bounds.h / 2
      }
    }
  }
  
  return null
}

function pathToTriangle(pathData: PathData, shape: TLShape): Partial<TLShape> | null {
  if (pathData.type === 'points') {
    const points = pathData.data as VecLike[]
    if (points.length === 0) return null

    // Calculate bounds from the modified points
    const bounds = pathData.bounds || calculatePathBounds(points)

    return {
      props: {
        ...shape.props,
        w: bounds.w,
        h: bounds.h,
        points: points, // Store the modified path points
        renderAsPath: true // Flag to render as path
      },
      meta: {
        ...shape.meta,
        pathModified: true,
        originalBounds: {
          w: (shape.props as { w?: number }).w || 0,
          h: (shape.props as { h?: number }).h || 0
        }
      }
    }
  } else if (pathData.bounds) {
    // Fallback for other path types
    return {
      props: {
        ...shape.props,
        w: pathData.bounds.w,
        h: pathData.bounds.h
      }
    }
  }
  
  return null
}

function pathToCircle(pathData: PathData, shape: TLShape): Partial<TLShape> | null {
  if (pathData.type === 'points') {
    const points = pathData.data as VecLike[]
    if (points.length === 0) return null

    // Calculate bounds from the modified points
    const bounds = pathData.bounds || calculatePathBounds(points)

    return {
      props: {
        ...shape.props,
        w: bounds.w,
        h: bounds.h,
        points: points, // Store the modified path points
        renderAsPath: true // Flag to render as path
      },
      meta: {
        ...shape.meta,
        pathModified: true,
        originalBounds: {
          w: (shape.props as { w?: number }).w || 0,
          h: (shape.props as { h?: number }).h || 0
        }
      }
    }
  } else if (pathData.bounds) {
    // Fallback for other path types
    return {
      props: {
        ...shape.props,
        w: pathData.bounds.w,
        h: pathData.bounds.h
      }
    }
  }
  
  return null
}

// Utility functions
export function calculatePathBounds(points: VecLike[]): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 }
  }
  
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y
  
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  }
}

export function pathDataToBounds(pathData: PathData): { x: number; y: number; w: number; h: number } {
  if (pathData.bounds) {
    return pathData.bounds
  }

  if (pathData.type === 'points') {
    return calculatePathBounds(pathData.data as VecLike[])
  } else if (pathData.type === 'bezier') {
    const bezierPoints = pathData.data as BezierPoint[]
    const points = bezierPoints.map(bp => ({ x: bp.x, y: bp.y }))
    return calculatePathBounds(points)
  }

  return { x: 0, y: 0, w: 0, h: 0 }
}

// Custom shape extractors
function extractCustomLinePath(shape: TLShape): PointsPathData | null {
  const props = shape.props as LineShape['props'] & {
    points?: VecLike[];
    renderAsPath?: boolean;
  }

  // If line has been modified and has path points, use those
  if (props.renderAsPath && props.points && props.points.length >= 2) {
    return {
      type: 'points',
      data: [...props.points],
      isClosed: false,
      bounds: calculatePathBounds(props.points)
    }
  }

  // Extract original line geometry
  const { startX, startY, endX, endY } = props
  const points: VecLike[] = [
    { x: startX, y: startY },
    { x: endX, y: endY }
  ]

  return {
    type: 'points',
    data: points,
    isClosed: false,
    bounds: calculatePathBounds(points)
  }
}

function extractCustomDrawPath(shape: TLShape): PointsPathData | null {
  const props = shape.props as DrawShape['props'] & {
    points?: VecLike[];
    renderAsPath?: boolean;
  }

  // If draw shape has been modified and has path points, use those
  if (props.renderAsPath && props.points && props.points.length >= 2) {
    return {
      type: 'points',
      data: [...props.points],
      isClosed: props.isClosed,
      bounds: calculatePathBounds(props.points)
    }
  }

  // Extract original draw path from segments
  const points: VecLike[] = []

  for (const segment of props.segments) {
    points.push({ x: segment.x, y: segment.y })
  }

  if (points.length === 0) {
    return null
  }

  return {
    type: 'points',
    data: points,
    isClosed: props.isClosed,
    bounds: calculatePathBounds(points)
  }
}

function extractCustomArrowPath(shape: TLShape): PointsPathData | null {
  const props = shape.props as CustomArrowShape['props'] & {
    points?: VecLike[];
    renderAsPath?: boolean;
  }

  // If arrow has been modified and has path points, use those
  if (props.renderAsPath && props.points && props.points.length >= 2) {
    return {
      type: 'points',
      data: [...props.points],
      isClosed: false,
      bounds: calculatePathBounds(props.points)
    }
  }

  // Extract original arrow geometry (simplified as line for now)
  const { w, h } = props
  const points: VecLike[] = [
    { x: 0, y: h / 2 },        // Start point (left)
    { x: w * 0.8, y: h / 2 },  // Body end
    { x: w * 0.8, y: 0 },      // Arrow top
    { x: w, y: h / 2 },        // Arrow tip
    { x: w * 0.8, y: h },      // Arrow bottom
    { x: w * 0.8, y: h / 2 },  // Back to body
  ]

  return {
    type: 'points',
    data: points,
    isClosed: false,
    bounds: { x: 0, y: 0, w, h }
  }
}

// Custom shape path-to-shape converters
function pathToCustomLine(pathData: PathData, shape: TLShape): Partial<TLShape> | null {
  if (pathData.type === 'points') {
    const points = pathData.data as VecLike[]
    if (points.length === 0) return null

    // For custom line, store the modified points and set render flag
    const bounds = pathData.bounds || calculatePathBounds(points)

    return {
      props: {
        ...shape.props,
        w: bounds.w,
        h: bounds.h,
        points: points,
        renderAsPath: true
      },
      meta: {
        ...shape.meta,
        pathModified: true,
        originalBounds: {
          w: (shape.props as { w?: number }).w || 0,
          h: (shape.props as { h?: number }).h || 0
        }
      }
    }
  }

  return null
}

function pathToCustomDraw(pathData: PathData, shape: TLShape): Partial<TLShape> | null {
  if (pathData.type === 'points') {
    const points = pathData.data as VecLike[]
    if (points.length === 0) return null

    // For custom draw, store the modified points and set render flag
    const bounds = pathData.bounds || calculatePathBounds(points)

    return {
      props: {
        ...shape.props,
        w: bounds.w,
        h: bounds.h,
        points: points,
        renderAsPath: true
      },
      meta: {
        ...shape.meta,
        pathModified: true,
        originalBounds: {
          w: (shape.props as { w?: number }).w || 0,
          h: (shape.props as { h?: number }).h || 0
        }
      }
    }
  }

  return null
}

function pathToCustomArrow(pathData: PathData, shape: TLShape): Partial<TLShape> | null {
  if (pathData.type === 'points') {
    const points = pathData.data as VecLike[]
    if (points.length === 0) return null

    // For custom arrow, store the modified points and set render flag
    const bounds = pathData.bounds || calculatePathBounds(points)

    return {
      props: {
        ...shape.props,
        w: bounds.w,
        h: bounds.h,
        points: points,
        renderAsPath: true
      },
      meta: {
        ...shape.meta,
        pathModified: true,
        originalBounds: {
          w: (shape.props as { w?: number }).w || 0,
          h: (shape.props as { h?: number }).h || 0
        }
      }
    }
  }

  return null
}