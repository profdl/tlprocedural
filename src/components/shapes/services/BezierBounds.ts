import { type BezierPoint, type BezierShape } from '../BezierShape'
import { BezierMath } from './BezierMath'

/**
 * Bounds calculation and normalization service for Bezier shapes
 * Centralizes all bounds-related operations to eliminate duplicate code
 */
export class BezierBounds {
  
  /**
   * Calculate accurate bounding box for bezier path using bezier-js
   * Consolidates bounds calculation logic from multiple files
   */
  static getAccurateBounds(points: BezierPoint[], isClosed: boolean = false) {
    if (points.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    }
    
    if (points.length === 1) {
      const point = points[0]
      // Include control points in single-point bounds calculation
      const allPoints = [{ x: point.x, y: point.y }]
      if (point.cp1) allPoints.push(point.cp1)
      if (point.cp2) allPoints.push(point.cp2)
      
      const xs = allPoints.map(p => p.x)
      const ys = allPoints.map(p => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xs)
      const maxY = Math.max(...ys)
      
      return { minX, minY, maxX, maxY }
    }
    
    // Calculate bounds using bezier.js for accurate curve bounds
    const segments = BezierMath.getAllSegments(points, isClosed)
    
    if (segments.length === 0) {
      // Fallback to basic point bounds
      const xs = points.map(p => p.x)
      const ys = points.map(p => p.y)
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
      }
    }
    
    // Use bezier-js bbox method for precise curve bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    for (const segment of segments) {
      const bbox = segment.bbox()
      minX = Math.min(minX, bbox.x.min)
      minY = Math.min(minY, bbox.y.min)
      maxX = Math.max(maxX, bbox.x.max)
      maxY = Math.max(maxY, bbox.y.max)
    }
    
    return { minX, minY, maxX, maxY }
  }

  /**
   * Normalize points to a bounding box and return updated shape with new bounds
   * Consolidates shape bounds recalculation logic
   */
  static recalculateShapeBounds(
    shape: BezierShape, 
    newPoints: BezierPoint[]
  ): BezierShape {
    const bounds = this.getAccurateBounds(newPoints, shape.props.isClosed)
    
    const w = Math.max(1, bounds.maxX - bounds.minX)
    const h = Math.max(1, bounds.maxY - bounds.minY)

    // Normalize points to new bounds
    const normalizedPoints = newPoints.map(p => ({
      x: p.x - bounds.minX,
      y: p.y - bounds.minY,
      cp1: p.cp1 ? { 
        x: p.cp1.x - bounds.minX, 
        y: p.cp1.y - bounds.minY 
      } : undefined,
      cp2: p.cp2 ? { 
        x: p.cp2.x - bounds.minX, 
        y: p.cp2.y - bounds.minY 
      } : undefined,
    }))

    return {
      ...shape,
      x: shape.x + bounds.minX,
      y: shape.y + bounds.minY,
      props: {
        ...shape.props,
        w,
        h,
        points: normalizedPoints,
      }
    }
  }

  /**
   * Get bounds for editing mode - returns actual curve bounds for proper hit detection
   */
  static getEditModeBounds(shape: BezierShape) {
    const bounds = this.getAccurateBounds(shape.props.points, shape.props.isClosed)
    return {
      x: 0,
      y: 0,
      w: Math.max(1, bounds.maxX - bounds.minX),
      h: Math.max(1, bounds.maxY - bounds.minY),
    }
  }

  /**
   * Get bounds for normal mode - uses stored width and height
   */
  static getNormalModeBounds(shape: BezierShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  /**
   * Calculate bounds for creation mode with single point
   * Includes padding and handles control point positioning
   */
  static getSinglePointBounds(
    point: BezierPoint, 
    padding: number = 50
  ): {
    bounds: { x: number; y: number; w: number; h: number }
    normalizedPoints: BezierPoint[]
  } {
    // Calculate bounds including any control points from the point
    const allPoints = [{ x: point.x, y: point.y }]
    if (point.cp1) allPoints.push(point.cp1)
    if (point.cp2) allPoints.push(point.cp2)
    
    const xs = allPoints.map(p => p.x)
    const ys = allPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    
    // Use actual bounds for single point to prevent jumping
    const actualMinX = minX - padding
    const actualMinY = minY - padding
    const w = Math.max(1, maxX - minX + padding * 2)
    const h = Math.max(1, maxY - minY + padding * 2)
    
    const normalizedPoints = [{
      x: point.x - actualMinX,
      y: point.y - actualMinY,
      cp1: point.cp1 ? { 
        x: point.cp1.x - actualMinX, 
        y: point.cp1.y - actualMinY 
      } : undefined,
      cp2: point.cp2 ? { 
        x: point.cp2.x - actualMinX, 
        y: point.cp2.y - actualMinY 
      } : undefined,
    }]

    return {
      bounds: { x: actualMinX, y: actualMinY, w, h },
      normalizedPoints
    }
  }

  /**
   * Calculate bounds for creation mode with multiple points
   * Uses stable origin positioning to prevent shifting during creation
   */
  static getMultiPointBounds(
    points: BezierPoint[],
    stableOrigin?: { x: number; y: number }
  ): {
    bounds: { x: number; y: number; w: number; h: number }
    normalizedPoints: BezierPoint[]
  } {
    const origin = stableOrigin || { x: points[0].x, y: points[0].y }
    
    const allPoints = points.flatMap(p => [
      { x: p.x, y: p.y },
      ...(p.cp1 ? [p.cp1] : []),
      ...(p.cp2 ? [p.cp2] : [])
    ])
    
    const xs = allPoints.map(p => p.x)
    const ys = allPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    
    const leftExtent = origin.x - minX
    const rightExtent = maxX - origin.x
    const topExtent = origin.y - minY
    const bottomExtent = maxY - origin.y
    
    const actualMinX = origin.x - Math.max(leftExtent, rightExtent) - 10
    const actualMinY = origin.y - Math.max(topExtent, bottomExtent) - 10
    const actualMaxX = origin.x + Math.max(leftExtent, rightExtent) + 10
    const actualMaxY = origin.y + Math.max(topExtent, bottomExtent) + 10
    
    const w = Math.max(1, actualMaxX - actualMinX)
    const h = Math.max(1, actualMaxY - actualMinY)
    
    const normalizedPoints = points.map(p => ({
      x: p.x - actualMinX,
      y: p.y - actualMinY,
      cp1: p.cp1 ? { 
        x: p.cp1.x - actualMinX, 
        y: p.cp1.y - actualMinY 
      } : undefined,
      cp2: p.cp2 ? { 
        x: p.cp2.x - actualMinX, 
        y: p.cp2.y - actualMinY 
      } : undefined,
    }))

    return {
      bounds: { x: actualMinX, y: actualMinY, w, h },
      normalizedPoints
    }
  }

  /**
   * Get shape center point calculated from actual bounds
   */
  static getShapeCenter(shape: BezierShape): { x: number; y: number } {
    let bounds: { x: number; y: number; w: number; h: number }
    
    if (shape.props.editMode) {
      bounds = this.getEditModeBounds(shape)
    } else {
      bounds = this.getNormalModeBounds(shape)
    }
    
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
    }
  }

  /**
   * Convert shape points to outline points for TLDraw
   */
  static getOutlinePoints(shape: BezierShape): { x: number; y: number }[] {
    return shape.props.points.map(p => ({ x: p.x, y: p.y }))
  }

  /**
   * Check if bounds have changed between two point arrays
   */
  static haveBoundsChanged(
    prevPoints: BezierPoint[], 
    nextPoints: BezierPoint[], 
    isClosed: boolean,
    threshold: number = 0.01
  ): boolean {
    const prevBounds = this.getAccurateBounds(prevPoints, isClosed)
    const nextBounds = this.getAccurateBounds(nextPoints, isClosed)
    
    const widthChanged = Math.abs(
      (prevBounds.maxX - prevBounds.minX) - (nextBounds.maxX - nextBounds.minX)
    ) > threshold
    
    const heightChanged = Math.abs(
      (prevBounds.maxY - prevBounds.minY) - (nextBounds.maxY - nextBounds.minY)
    ) > threshold
    
    const positionChanged = 
      Math.abs(prevBounds.minX - nextBounds.minX) > threshold ||
      Math.abs(prevBounds.minY - nextBounds.minY) > threshold
    
    return widthChanged || heightChanged || positionChanged
  }
}