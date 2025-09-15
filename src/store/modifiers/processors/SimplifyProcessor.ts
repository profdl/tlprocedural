import type { VecLike } from 'tldraw'
import type { SimplifySettings } from '../../../types/pathTypes'
import type { 
  PathData, 
  PathModificationResult, 
  PointsPathData, 
  BezierPathData 
} from '../../../types/pathTypes'
import type { BezierPoint } from '../../../components/shapes/BezierShape'
import { PathModifier } from '../core/PathModifier'

/**
 * Simplify path modifier
 * Reduces the number of points in a path using Douglas-Peucker algorithm
 */
export const SimplifyProcessor = new class extends PathModifier<SimplifySettings> {
  
  protected modifyPath(
    pathData: PathData,
    settings: SimplifySettings
  ): PathModificationResult {
    
    if (!this.validatePathData(pathData) || !this.validateSettings(settings)) {
      return { pathData, boundsChanged: false }
    }

    const { tolerance, preserveCorners, minPoints } = settings
    
    try {
      let modifiedPath = this.clonePathData(pathData)
      
      // Apply simplification based on path type
      switch (modifiedPath.type) {
        case 'points':
          modifiedPath = this.simplifyPoints(modifiedPath as PointsPathData, tolerance, preserveCorners, minPoints)
          break
        case 'bezier':
          modifiedPath = this.simplifyBezier(modifiedPath as BezierPathData, tolerance, minPoints)
          break
        case 'svg':
          break
      }
      
      // Update bounds
      const updatedPath = this.updatePathBounds(modifiedPath)
      
      return {
        pathData: updatedPath,
        boundsChanged: true,
        newBounds: updatedPath.bounds
      }
      
    } catch {
      return { pathData, boundsChanged: false }
    }
  }

  // Simplify points using Douglas-Peucker algorithm
  private simplifyPoints(
    pathData: PointsPathData, 
    tolerance: number, 
    preserveCorners: boolean, 
    minPoints: number
  ): PointsPathData {
    const points = pathData.data
    if (points.length <= minPoints) return pathData
    
    let simplifiedPoints: VecLike[]
    
    if (pathData.isClosed) {
      // For closed paths, we need to handle the wraparound
      simplifiedPoints = this.douglasPeuckerClosed(points, tolerance)
    } else {
      // For open paths, use standard Douglas-Peucker
      simplifiedPoints = this.douglasPeucker(points, tolerance)
    }
    
    // Ensure we don't go below minimum points
    if (simplifiedPoints.length < minPoints) {
      // If we simplified too much, return original or a less simplified version
      return pathData
    }
    
    // If preserveCorners is enabled, add back important corners
    if (preserveCorners) {
      simplifiedPoints = this.preserveImportantCorners(points, simplifiedPoints, tolerance)
    }
    
    return {
      ...pathData,
      data: simplifiedPoints
    }
  }

  // Simplify bezier path by removing redundant points and control points
  private simplifyBezier(
    pathData: BezierPathData, 
    tolerance: number, 
    minPoints: number
  ): BezierPathData {
    const points = pathData.data
    if (points.length <= minPoints) return pathData
    
    // Convert to simple points for Douglas-Peucker
    const simplePoints: VecLike[] = points.map(p => ({ x: p.x, y: p.y }))
    
    let simplifiedPoints: VecLike[]
    if (pathData.isClosed) {
      simplifiedPoints = this.douglasPeuckerClosed(simplePoints, tolerance)
    } else {
      simplifiedPoints = this.douglasPeucker(simplePoints, tolerance)
    }
    
    if (simplifiedPoints.length < minPoints) {
      return pathData
    }
    
    // Convert back to bezier points, removing control points for simplified segments
    const simplifiedBezier: BezierPoint[] = simplifiedPoints.map(point => {
      // Find the original bezier point that corresponds to this simplified point
      const originalPoint = points.find(p => 
        Math.abs(p.x - point.x) < 0.1 && Math.abs(p.y - point.y) < 0.1
      )
      
      if (originalPoint) {
        return { ...originalPoint }
      } else {
        // This is a new point from simplification, no control points
        return { x: point.x, y: point.y }
      }
    })
    
    return {
      ...pathData,
      data: simplifiedBezier
    }
  }

  // Douglas-Peucker algorithm for open paths
  private douglasPeucker(points: VecLike[], tolerance: number): VecLike[] {
    if (points.length <= 2) return points
    
    // Find the point with maximum distance from the line segment
    let maxDistance = 0
    let maxIndex = 0
    const start = points[0]
    const end = points[points.length - 1]
    
    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(points[i], start, end)
      if (distance > maxDistance) {
        maxDistance = distance
        maxIndex = i
      }
    }
    
    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      // Recursive call for first part
      const firstPart = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance)
      // Recursive call for second part  
      const secondPart = this.douglasPeucker(points.slice(maxIndex), tolerance)
      
      // Combine results, avoiding duplicate middle point
      return [...firstPart.slice(0, -1), ...secondPart]
    } else {
      // All points between start and end can be discarded
      return [start, end]
    }
  }

  // Douglas-Peucker algorithm adapted for closed paths
  private douglasPeuckerClosed(points: VecLike[], tolerance: number): VecLike[] {
    if (points.length <= 3) return points
    
    // For closed paths, we need to find the best starting point
    // Find the point that creates the largest triangle with its neighbors
    let maxArea = 0
    let startIndex = 0
    
    for (let i = 0; i < points.length; i++) {
      const prev = points[i === 0 ? points.length - 1 : i - 1]
      const current = points[i]
      const next = points[(i + 1) % points.length]
      
      const area = this.triangleArea(prev, current, next)
      if (area > maxArea) {
        maxArea = area
        startIndex = i
      }
    }
    
    // Rearrange points to start from the best starting point
    const reorderedPoints = [
      ...points.slice(startIndex),
      ...points.slice(0, startIndex),
      points[startIndex] // Close the loop
    ]
    
    // Apply Douglas-Peucker to the reordered points
    const simplified = this.douglasPeucker(reorderedPoints, tolerance)
    
    // Remove the duplicate closing point and reorder back
    const result = simplified.slice(0, -1)
    
    // Reorder back to original starting point
    if (startIndex > 0) {
      const originalStart = points.length - startIndex
      return [...result.slice(originalStart), ...result.slice(0, originalStart)]
    }
    
    return result
  }

  // Preserve important corners that might have been simplified away
  private preserveImportantCorners(
    originalPoints: VecLike[], 
    simplifiedPoints: VecLike[], 
    tolerance: number
  ): VecLike[] {
    // This is a simplified implementation
    // In practice, you might want more sophisticated corner detection
    const result = [...simplifiedPoints]
    
    // Find sharp corners in the original path that aren't in the simplified version
    for (let i = 1; i < originalPoints.length - 1; i++) {
      const point = originalPoints[i]
      const isCorner = this.isSharpCorner(originalPoints, i, 60) // 60 degree threshold
      
      if (isCorner) {
        // Check if this corner is already preserved
        const isPreserved = simplifiedPoints.some(sp => 
          Math.abs(sp.x - point.x) < tolerance && Math.abs(sp.y - point.y) < tolerance
        )
        
        if (!isPreserved) {
          // Insert this corner into the simplified path at the appropriate position
          result.push(point)
        }
      }
    }
    
    // Sort by position along the path (this is simplified)
    return result
  }

  // Calculate perpendicular distance from point to line segment
  private perpendicularDistance(point: VecLike, lineStart: VecLike, lineEnd: VecLike): number {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y
    
    if (dx === 0 && dy === 0) {
      // Line segment is actually a point
      return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2)
    }
    
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy)
    
    let closestPoint: VecLike
    if (t < 0) {
      closestPoint = lineStart
    } else if (t > 1) {
      closestPoint = lineEnd
    } else {
      closestPoint = {
        x: lineStart.x + t * dx,
        y: lineStart.y + t * dy
      }
    }
    
    return Math.sqrt((point.x - closestPoint.x) ** 2 + (point.y - closestPoint.y) ** 2)
  }

  // Calculate triangle area (for closed path optimization)
  private triangleArea(p1: VecLike, p2: VecLike, p3: VecLike): number {
    return Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2)
  }

  // Check if a point forms a sharp corner
  private isSharpCorner(points: VecLike[], index: number, threshold: number): boolean {
    if (index === 0 || index === points.length - 1) return false
    
    const prev = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    
    // Calculate vectors
    const v1 = { x: prev.x - current.x, y: prev.y - current.y }
    const v2 = { x: next.x - current.x, y: next.y - current.y }
    
    // Calculate angle
    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
    
    if (mag1 === 0 || mag2 === 0) return false
    
    const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))))
    const angleDegrees = (angle * 180) / Math.PI
    
    return angleDegrees < threshold
  }

  protected validateSettings(settings: SimplifySettings): boolean {
    if (!super.validateSettings(settings)) return false
    
    const { tolerance, preserveCorners, minPoints } = settings
    
    if (typeof tolerance !== 'number' || tolerance < 0) {
      return false
    }
    
    if (typeof preserveCorners !== 'boolean') {
      return false
    }
    
    if (typeof minPoints !== 'number' || minPoints < 2) {
      return false
    }
    
    return true
  }
}