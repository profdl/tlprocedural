import { Bezier } from 'bezier-js'
import { type BezierPoint } from '../BezierShape'
import { BEZIER_HANDLES } from '../utils/bezierConstants'

/**
 * Enhanced Bezier mathematics service leveraging bezier-js library
 * Centralizes all curve calculations with consistent bezier.js usage
 */
export class BezierMath {
  
  /**
   * Convert a segment between two BezierPoints to a bezier-js Bezier object
   */
  static segmentToBezier(p1: BezierPoint, p2: BezierPoint): Bezier {
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
  static bezierToSegmentControlPoints(bezier: Bezier): {
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
   * Calculate point on Bezier curve at parameter t using bezier.js
   * Replaces manual cubic/quadratic calculations
   */
  static getPointOnSegment(
    p1: BezierPoint, 
    p2: BezierPoint, 
    t: number
  ): { x: number; y: number } {
    const bezier = this.segmentToBezier(p1, p2)
    const point = bezier.get(t)
    return { x: point.x, y: point.y }
  }

  /**
   * Calculate derivative (tangent) at parameter t using bezier.js
   */
  static getDerivativeAtT(
    p1: BezierPoint, 
    p2: BezierPoint, 
    t: number
  ): { x: number; y: number } {
    const bezier = this.segmentToBezier(p1, p2)
    const derivative = bezier.derivative(t)
    return { x: derivative.x, y: derivative.y }
  }

  /**
   * Get normalized tangent vector at parameter t
   */
  static getNormalizedTangentAtT(
    p1: BezierPoint, 
    p2: BezierPoint, 
    t: number
  ): { x: number; y: number } {
    const derivative = this.getDerivativeAtT(p1, p2, t)
    return this.normalizeVector(derivative)
  }

  /**
   * Find the closest point on a bezier curve to a given point
   * Returns the t value and the actual point on the curve
   */
  static getClosestPointOnSegment(
    p1: BezierPoint, 
    p2: BezierPoint, 
    targetPoint: { x: number; y: number }
  ): { t: number; point: { x: number; y: number }; distance: number } {
    const bezier = this.segmentToBezier(p1, p2)
    const projected = bezier.project(targetPoint)
    
    return {
      t: projected.t || 0,
      point: { x: projected.x || 0, y: projected.y || 0 },
      distance: projected.d || 0
    }
  }

  /**
   * Split a bezier segment at a given t value using bezier.js
   * Returns the control points for the two resulting segments with improved handle calculation
   */
  static splitSegmentAtT(
    p1: BezierPoint,
    p2: BezierPoint, 
    t: number
  ): {
    leftSegment: { p1: BezierPoint; p2: BezierPoint }
    rightSegment: { p1: BezierPoint; p2: BezierPoint }
    splitPoint: BezierPoint
  } {
    const bezier = this.segmentToBezier(p1, p2)
    const { left, right } = bezier.split(t)
    
    // Get the split point and its derivative (tangent)
    const splitPoint = bezier.get(t)
    const derivative = bezier.derivative(t)
    
    // Calculate handle length based on curve properties
    // Use 1/3 of the distance to neighboring control points for smooth continuity
    const segmentLength = bezier.length()
    const baseHandleLength = segmentLength * BEZIER_HANDLES.SEGMENT_HANDLE_LENGTH
    
    // Normalize the derivative to get the tangent direction
    const normalizedTangent = this.normalizeVector(derivative)
    
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
    const leftCP = this.bezierToSegmentControlPoints(left)
    const rightCP = this.bezierToSegmentControlPoints(right)
    
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
        cp1,
        cp2
      }
    }
  }

  /**
   * Get all segments from a BezierPoint array as bezier-js objects
   */
  static getAllSegments(points: BezierPoint[], isClosed: boolean = false): Bezier[] {
    const segments: Bezier[] = []
    
    for (let i = 0; i < points.length - 1; i++) {
      segments.push(this.segmentToBezier(points[i], points[i + 1]))
    }
    
    // Add closing segment if path is closed
    if (isClosed && points.length > 2) {
      segments.push(this.segmentToBezier(points[points.length - 1], points[0]))
    }
    
    return segments
  }

  /**
   * Calculate segment length using bezier.js
   */
  static getSegmentLength(p1: BezierPoint, p2: BezierPoint): number {
    const bezier = this.segmentToBezier(p1, p2)
    return bezier.length()
  }

  /**
   * Calculate total path length
   */
  static getTotalPathLength(points: BezierPoint[], isClosed: boolean = false): number {
    const segments = this.getAllSegments(points, isClosed)
    return segments.reduce((total, segment) => total + segment.length(), 0)
  }

  /**
   * Sample a bezier segment into evenly spaced points based on length.
   */
  static sampleSegmentPoints(
    p1: BezierPoint,
    p2: BezierPoint,
    options?: {
      maxSegmentLength?: number
      minSamples?: number
      includeStart?: boolean
      includeEnd?: boolean
    }
  ): Array<{ x: number; y: number }> {
    const {
      maxSegmentLength = 8,
      minSamples = 2,
      includeStart = false,
      includeEnd = false
    } = options || {}

    const bezier = this.segmentToBezier(p1, p2)
    const length = bezier.length()
    const sampleCount = Math.max(minSamples, Math.ceil(length / maxSegmentLength))
    const step = 1 / sampleCount

    const sampled: Array<{ x: number; y: number }> = []

    for (let i = 0; i <= sampleCount; i++) {
      const isStart = i === 0
      const isEnd = i === sampleCount

      if ((!includeStart && isStart) || (!includeEnd && isEnd)) {
        continue
      }

      const t = i * step
      const point = bezier.get(t)
      sampled.push({ x: point.x, y: point.y })
    }

    return sampled
  }

  /**
   * Sample an entire bezier path into polygonal points.
   */
  static samplePathPoints(
    points: BezierPoint[],
    isClosed: boolean,
    options?: {
      maxSegmentLength?: number
      minSamples?: number
    }
  ): Array<{ x: number; y: number }> {
    if (points.length === 0) return []

    const sampled: Array<{ x: number; y: number }> = []

    const segmentOptions = {
      maxSegmentLength: options?.maxSegmentLength,
      minSamples: options?.minSamples
    }

    // Always include the first anchor point
    sampled.push({ x: points[0].x, y: points[0].y })

    for (let i = 0; i < points.length - 1; i++) {
      const segmentPoints = this.sampleSegmentPoints(points[i], points[i + 1], {
        ...segmentOptions,
        includeStart: false,
        includeEnd: false
      })
      sampled.push(...segmentPoints, { x: points[i + 1].x, y: points[i + 1].y })
    }

    if (isClosed && points.length > 2) {
      const closingSegmentSamples = this.sampleSegmentPoints(points[points.length - 1], points[0], {
        ...segmentOptions,
        includeStart: false,
        includeEnd: false
      })
      sampled.push(...closingSegmentSamples)

      const first = sampled[0]
      const last = sampled[sampled.length - 1]
      if (last.x !== first.x || last.y !== first.y) {
        sampled.push({ ...first })
      }
    }

    return sampled
  }

  // === Vector Utilities ===

  /**
   * Calculate distance between two points using efficient method
   */
  static getDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Normalize a vector to unit length
   */
  static normalizeVector(vector: { x: number; y: number }): { x: number; y: number } {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y)
    if (length === 0) {
      return { x: 1, y: 0 } // Fallback direction
    }
    return { 
      x: vector.x / length, 
      y: vector.y / length 
    }
  }

  /**
   * Get vector length/magnitude
   */
  static getVectorLength(vector: { x: number; y: number }): number {
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y)
  }

  /**
   * Create control points for smooth curves between neighboring points
   */
  static createSmoothControlPoints(
    prevPoint: BezierPoint | null,
    currentPoint: BezierPoint,
    nextPoint: BezierPoint | null,
    tension: number = BEZIER_HANDLES.CONTROL_POINT_SCALE
  ): { cp1?: { x: number; y: number }; cp2?: { x: number; y: number } } {
    const controlOffset = BEZIER_HANDLES.DEFAULT_CONTROL_OFFSET * tension

    if (prevPoint && nextPoint) {
      // Point has both neighbors - create symmetric control points
      const direction = {
        x: nextPoint.x - prevPoint.x,
        y: nextPoint.y - prevPoint.y
      }
      
      const normalizedDirection = this.normalizeVector(direction)
      
      return {
        cp1: {
          x: currentPoint.x - normalizedDirection.x * controlOffset,
          y: currentPoint.y - normalizedDirection.y * controlOffset
        },
        cp2: {
          x: currentPoint.x + normalizedDirection.x * controlOffset,
          y: currentPoint.y + normalizedDirection.y * controlOffset
        }
      }
    } else if (prevPoint) {
      // Only has previous neighbor
      const direction = {
        x: currentPoint.x - prevPoint.x,
        y: currentPoint.y - prevPoint.y
      }
      const normalizedDirection = this.normalizeVector(direction)
      
      return {
        cp1: {
          x: currentPoint.x - normalizedDirection.x * controlOffset,
          y: currentPoint.y - normalizedDirection.y * controlOffset
        },
        cp2: {
          x: currentPoint.x + normalizedDirection.x * controlOffset,
          y: currentPoint.y + normalizedDirection.y * controlOffset
        }
      }
    } else if (nextPoint) {
      // Only has next neighbor
      const direction = {
        x: nextPoint.x - currentPoint.x,
        y: nextPoint.y - currentPoint.y
      }
      const normalizedDirection = this.normalizeVector(direction)
      
      return {
        cp1: {
          x: currentPoint.x - normalizedDirection.x * controlOffset,
          y: currentPoint.y - normalizedDirection.y * controlOffset
        },
        cp2: {
          x: currentPoint.x + normalizedDirection.x * controlOffset,
          y: currentPoint.y + normalizedDirection.y * controlOffset
        }
      }
    }
    
    // Fallback - horizontal control points
    return {
      cp1: { x: currentPoint.x - controlOffset, y: currentPoint.y },
      cp2: { x: currentPoint.x + controlOffset, y: currentPoint.y }
    }
  }

  /**
   * Constrain angle to 45-degree increments for Shift+drag
   */
  static constrainAngle(offset: { x: number; y: number }): { x: number; y: number } {
    const angle = Math.atan2(offset.y, offset.x)
    const constrainedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
    const magnitude = this.getVectorLength(offset)
    
    return {
      x: Math.cos(constrainedAngle) * magnitude,
      y: Math.sin(constrainedAngle) * magnitude
    }
  }
}
