import { Bezier } from 'bezier-js'
import { type BezierPoint, type BezierShape } from '../BezierShape'
import { BEZIER_HANDLES, BEZIER_THRESHOLDS, bezierLog } from './bezierConstants'

/**
 * Utility functions for converting between our BezierPoint format and bezier-js Bezier objects
 */

/**
 * Convert a segment between two BezierPoints to a bezier-js Bezier object
 */
export function segmentToBezier(p1: BezierPoint, p2: BezierPoint): Bezier {
  // Determine the type of curve based on available control points
  if (p1.cp2 && p2.cp1) {
    // Cubic Bézier curve (4 control points)
    return new Bezier(
      p1.x, p1.y,           // Start point
      p1.cp2.x, p1.cp2.y,   // First control point
      p2.cp1.x, p2.cp1.y,   // Second control point  
      p2.x, p2.y            // End point
    )
  } else if (p1.cp2) {
    // Quadratic Bézier curve using outgoing control point
    return new Bezier(
      p1.x, p1.y,           // Start point
      p1.cp2.x, p1.cp2.y,   // Control point
      p2.x, p2.y            // End point
    )
  } else if (p2.cp1) {
    // Quadratic Bézier curve using incoming control point
    return new Bezier(
      p1.x, p1.y,           // Start point
      p2.cp1.x, p2.cp1.y,   // Control point
      p2.x, p2.y            // End point
    )
  } else {
    // Linear segment - create a degenerate bezier that acts as a line
    return new Bezier(
      p1.x, p1.y,           // Start point
      p1.x, p1.y,           // Control point same as start
      p2.x, p2.y            // End point
    )
  }
}

/**
 * Convert bezier-js Bezier object back to our BezierPoint format
 * Returns the control points that should be applied to p1 and p2
 */
export function bezierToSegmentControlPoints(bezier: Bezier): {
  p1cp2?: { x: number; y: number }
  p2cp1?: { x: number; y: number }
} {
  const points = bezier.points

  if (points.length === 4) {
    // Cubic curve - extract both control points
    return {
      p1cp2: { x: points[1].x, y: points[1].y },
      p2cp1: { x: points[2].x, y: points[2].y }
    }
  } else if (points.length === 3) {
    // Quadratic curve - single control point
    // We'll assign it as outgoing from p1
    return {
      p1cp2: { x: points[1].x, y: points[1].y }
    }
  } else {
    // Linear segment - no control points
    return {}
  }
}

/**
 * Find the closest point on a bezier curve to a given point
 * Returns the t value and the actual point on the curve
 */
export function getClosestPointOnSegment(
  p1: BezierPoint, 
  p2: BezierPoint, 
  targetPoint: { x: number; y: number }
): { t: number; point: { x: number; y: number }; distance: number } {
  const bezier = segmentToBezier(p1, p2)
  const projected = bezier.project(targetPoint)
  
  return {
    t: projected.t,
    point: { x: projected.x, y: projected.y },
    distance: projected.d
  }
}

/**
 * Split a bezier segment at a given t value
 * Returns the control points for the two resulting segments with improved handle calculation
 */
export function splitSegmentAtT(
  p1: BezierPoint,
  p2: BezierPoint, 
  t: number
): {
  leftSegment: { p1: BezierPoint; p2: BezierPoint }
  rightSegment: { p1: BezierPoint; p2: BezierPoint }
  splitPoint: BezierPoint
} {
  const bezier = segmentToBezier(p1, p2)
  const { left, right } = bezier.split(t)
  
  // Get the split point and its derivative (tangent)
  const splitPoint = bezier.get(t)
  const derivative = bezier.derivative(t)
  
  // Calculate handle length based on curve properties
  // Use 1/3 of the distance to neighboring control points for smooth continuity
  const segmentLength = bezier.length()
  const baseHandleLength = segmentLength * BEZIER_HANDLES.SEGMENT_HANDLE_LENGTH // Percentage of segment length for balanced handles
  
  // Normalize the derivative to get the tangent direction
  const tangentLength = Math.sqrt(derivative.x * derivative.x + derivative.y * derivative.y)
  const normalizedTangent = tangentLength > 0 
    ? { x: derivative.x / tangentLength, y: derivative.y / tangentLength }
    : { x: 1, y: 0 } // Fallback direction
  
  // Calculate control points based on tangent direction and appropriate lengths
  const cp1 = {
    x: splitPoint.x - normalizedTangent.x * baseHandleLength,
    y: splitPoint.y - normalizedTangent.y * baseHandleLength
  }
  
  const cp2 = {
    x: splitPoint.x + normalizedTangent.x * baseHandleLength,
    y: splitPoint.y + normalizedTangent.y * baseHandleLength
  }
  
  // Convert split curves back to our format for the segments
  const leftCP = bezierToSegmentControlPoints(left)
  const rightCP = bezierToSegmentControlPoints(right)
  
  return {
    leftSegment: {
      p1: { 
        ...p1,
        cp2: leftCP.p1cp2
      },
      p2: {
        x: splitPoint.x,
        y: splitPoint.y,
        cp1: leftCP.p2cp1
      }
    },
    rightSegment: {
      p1: {
        x: splitPoint.x,
        y: splitPoint.y,
        cp2: rightCP.p1cp2
      },
      p2: {
        ...p2,
        cp1: rightCP.p2cp1
      }
    },
    splitPoint: {
      x: splitPoint.x,
      y: splitPoint.y,
      cp1: cp1, // Use our calculated control points for preview
      cp2: cp2
    }
  }
}

/**
 * Get all segments from a BezierPoint array as bezier-js objects
 */
export function getAllSegments(points: BezierPoint[], isClosed: boolean = false): Bezier[] {
  const segments: Bezier[] = []
  
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(segmentToBezier(points[i], points[i + 1]))
  }
  
  // Add closing segment if path is closed
  if (isClosed && points.length > 2) {
    segments.push(segmentToBezier(points[points.length - 1], points[0]))
  }
  
  return segments
}

/**
 * Calculate accurate bounding box for bezier path using bezier-js
 */
export function getAccurateBounds(points: BezierPoint[], isClosed: boolean = false) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  }
  
  if (points.length === 1) {
    return { 
      minX: points[0].x, 
      minY: points[0].y, 
      maxX: points[0].x, 
      maxY: points[0].y 
    }
  }
  
  const segments = getAllSegments(points, isClosed)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  segments.forEach(segment => {
    const bbox = segment.bbox()
    minX = Math.min(minX, bbox.x.min)
    minY = Math.min(minY, bbox.y.min)
    maxX = Math.max(maxX, bbox.x.max)
    maxY = Math.max(maxY, bbox.y.max)
  })
  
  return { minX, minY, maxX, maxY }
}

/**
 * Point selection utilities - shared between BezierShape and BezierEditing
 */

/**
 * Find anchor point at given local coordinates
 * @param points Array of bezier points to search
 * @param localPoint Point in shape's local coordinate space
 * @param zoomLevel Current editor zoom level for threshold scaling
 * @returns Index of anchor point or -1 if none found
 */
export function getAnchorPointAt(
  points: BezierPoint[], 
  localPoint: { x: number; y: number }, 
  zoomLevel: number
): number {
  const threshold = BEZIER_THRESHOLDS.ANCHOR_POINT / zoomLevel
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const distance = Math.sqrt(
      Math.pow(localPoint.x - point.x, 2) + 
      Math.pow(localPoint.y - point.y, 2)
    )
    
    if (distance < threshold) {
      return i
    }
  }
  
  return -1
}

/**
 * Find control point at given local coordinates
 * @param points Array of bezier points to search
 * @param localPoint Point in shape's local coordinate space
 * @param zoomLevel Current editor zoom level for threshold scaling
 * @returns Control point info or null if none found
 */
export function getControlPointAt(
  points: BezierPoint[], 
  localPoint: { x: number; y: number }, 
  zoomLevel: number
): { pointIndex: number; type: 'cp1' | 'cp2' } | null {
  const threshold = BEZIER_THRESHOLDS.CONTROL_POINT / zoomLevel
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    
    // Check cp1
    if (point.cp1) {
      const distance = Math.sqrt(
        Math.pow(localPoint.x - point.cp1.x, 2) + 
        Math.pow(localPoint.y - point.cp1.y, 2)
      )
      if (distance < threshold) {
        return { pointIndex: i, type: 'cp1' }
      }
    }
    
    // Check cp2
    if (point.cp2) {
      const distance = Math.sqrt(
        Math.pow(localPoint.x - point.cp2.x, 2) + 
        Math.pow(localPoint.y - point.cp2.y, 2)
      )
      if (distance < threshold) {
        return { pointIndex: i, type: 'cp2' }
      }
    }
  }
  
  return null
}

/**
 * Find segment at given position for point insertion
 * @param points Array of bezier points 
 * @param localPoint Point in shape's local coordinate space
 * @param zoomLevel Current editor zoom level for threshold scaling
 * @param isClosed Whether the path is closed
 * @returns Segment info or null if none found
 */
export function getSegmentAtPosition(
  points: BezierPoint[], 
  localPoint: { x: number; y: number }, 
  zoomLevel: number,
  isClosed: boolean = false
): { segmentIndex: number; t: number } | null {
  const threshold = BEZIER_THRESHOLDS.SEGMENT_CLICK / zoomLevel
  const anchorThreshold = BEZIER_THRESHOLDS.SEGMENT_ANCHOR_EXCLUSION / zoomLevel

  // First check if we're too close to an existing anchor point
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const distance = Math.sqrt(
      Math.pow(localPoint.x - point.x, 2) + 
      Math.pow(localPoint.y - point.y, 2)
    )
    
    if (distance < anchorThreshold) {
      return null // Too close to existing anchor point
    }
  }

  // Check each segment using precise bezier curve distance
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    
    const result = getClosestPointOnSegment(p1, p2, localPoint)
    
    if (result.distance < threshold) {
      return { segmentIndex: i, t: result.t }
    }
  }

  // Check closing segment if the path is closed
  if (isClosed && points.length > 2) {
    const p1 = points[points.length - 1]
    const p2 = points[0]
    const result = getClosestPointOnSegment(p1, p2, localPoint)
    
    if (result.distance < threshold) {
      return { segmentIndex: points.length - 1, t: result.t }
    }
  }

  return null
}

/**
 * Calculate new selection indices based on point selection interaction
 * @param currentSelected Currently selected point indices
 * @param pointIndex Index of clicked point
 * @param shiftKey Whether shift key was held during click
 * @returns New selection indices array
 */
export function calculateNewSelection(
  currentSelected: number[], 
  pointIndex: number, 
  shiftKey: boolean
): number[] {
  let newSelected: number[]

  if (shiftKey) {
    // Shift-click: toggle selection
    if (currentSelected.includes(pointIndex)) {
      // Remove from selection
      newSelected = currentSelected.filter(i => i !== pointIndex)
      bezierLog('Selection', 'Removed point', pointIndex, 'from selection. New selection:', newSelected)
    } else {
      // Add to selection
      newSelected = [...currentSelected, pointIndex]
      bezierLog('Selection', 'Added point', pointIndex, 'to selection. New selection:', newSelected)
    }
  } else {
    // Regular click: select only this point
    newSelected = [pointIndex]
    bezierLog('Selection', 'Single-selected point', pointIndex)
  }

  return newSelected
}

/**
 * Create updated BezierShape with new point selection
 * @param shape Current shape
 * @param newSelectedIndices New selection indices
 * @returns Updated shape object for editor.updateShape()
 */
export function updateShapeSelection(
  shape: BezierShape, 
  newSelectedIndices: number[]
): Partial<BezierShape> {
  return {
    id: shape.id,
    type: 'bezier' as const,
    props: {
      ...shape.props,
      selectedPointIndices: newSelectedIndices
    }
  }
}

/**
 * Handle complete point selection interaction
 * @param shape Current shape
 * @param pointIndex Index of clicked point
 * @param shiftKey Whether shift was held
 * @returns Updated shape object for editor.updateShape()
 */
export function handlePointSelection(
  shape: BezierShape, 
  pointIndex: number, 
  shiftKey: boolean
): Partial<BezierShape> {
  const currentSelected = shape.props.selectedPointIndices || []
  const newSelected = calculateNewSelection(currentSelected, pointIndex, shiftKey)
  
  bezierLog('Selection', 'Updating shape with selectedPointIndices:', newSelected)
  return updateShapeSelection(shape, newSelected)
}