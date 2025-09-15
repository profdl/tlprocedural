import type { Editor, VecLike } from 'tldraw'
import type { SubdivideSettings } from '../../../types/pathTypes'
import type { 
  PathData, 
  PathModificationResult, 
  PointsPathData, 
  BezierPathData 
} from '../../../types/pathTypes'
import type { BezierPoint } from '../../../components/shapes/BezierShape'
import { PathModifier } from '../core/PathModifier'

/**
 * Subdivide path modifier
 * Adds points along path segments for smoother curves and increased detail
 */
export const SubdivideProcessor = new class extends PathModifier<SubdivideSettings> {
  
  protected modifyPath(
    pathData: PathData,
    settings: SubdivideSettings,
    _shapeIndex: number,
    _editor?: Editor
  ): PathModificationResult {
    
    if (!this.validatePathData(pathData) || !this.validateSettings(settings)) {
      return { pathData, boundsChanged: false }
    }

    const { iterations, factor, smooth } = settings
    
    try {
      let modifiedPath = this.clonePathData(pathData)
      
      // Apply subdivisions iteratively
      for (let i = 0; i < iterations; i++) {
        modifiedPath = this.subdivideOnce(modifiedPath, factor)
        
        if (smooth) {
          modifiedPath = this.smoothPath(modifiedPath)
        }
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

  // Perform one iteration of subdivision
  private subdivideOnce(pathData: PathData, factor: number): PathData {
    switch (pathData.type) {
      case 'points':
        return this.subdividePoints(pathData as PointsPathData, factor)
      case 'bezier':
        return this.subdivideBezier(pathData as BezierPathData, factor)
      case 'svg':
        // For SVG paths, we'd need to parse and convert - skip for now
        return pathData
      default:
        return pathData
    }
  }

  // Subdivide points path
  private subdividePoints(pathData: PointsPathData, factor: number): PointsPathData {
    const points = pathData.data
    if (points.length < 2) return pathData
    
    const newPoints: VecLike[] = []
    
    for (let i = 0; i < points.length; i++) {
      const current = points[i]
      newPoints.push(current)
      
      // Add subdivided point between current and next
      // (or between last and first for closed paths)
      const nextIndex = i + 1
      const hasNext = nextIndex < points.length
      const shouldAddSubdivision = hasNext || pathData.isClosed
      
      if (shouldAddSubdivision) {
        const next = hasNext ? points[nextIndex] : points[0]
        
        // Linear interpolation at the given factor
        const subdivided = this.interpolatePoints(current, next, factor)
        newPoints.push(subdivided)
      }
    }
    
    return {
      ...pathData,
      data: newPoints
    }
  }

  // Subdivide bezier path
  private subdivideBezier(pathData: BezierPathData, factor: number): BezierPathData {
    const points = pathData.data
    if (points.length < 2) return pathData
    
    const newPoints: BezierPoint[] = []
    
    for (let i = 0; i < points.length; i++) {
      const current = points[i]
      newPoints.push({ ...current })
      
      const nextIndex = i + 1
      const hasNext = nextIndex < points.length
      const shouldAddSubdivision = hasNext || pathData.isClosed
      
      if (shouldAddSubdivision) {
        const next = hasNext ? points[nextIndex] : points[0]
        
        // For bezier points, we need to handle control points
        const subdivided = this.subdivideBezierSegment(current, next, factor)
        newPoints.push(subdivided)
      }
    }
    
    return {
      ...pathData,
      data: newPoints
    }
  }

  // Subdivide a single bezier segment
  private subdivideBezierSegment(
    p1: BezierPoint, 
    p2: BezierPoint, 
    factor: number
  ): BezierPoint {
    // Simple linear interpolation for now
    // For true bezier subdivision, we'd need De Casteljau's algorithm
    const subdivided: BezierPoint = {
      x: p1.x + (p2.x - p1.x) * factor,
      y: p1.y + (p2.y - p1.y) * factor
    }
    
    // Interpolate control points if they exist
    if (p1.cp2 && p2.cp1) {
      subdivided.cp1 = {
        x: p1.cp2.x + (p2.cp1.x - p1.cp2.x) * factor,
        y: p1.cp2.y + (p2.cp1.y - p1.cp2.y) * factor
      }
    }
    
    return subdivided
  }

  // Apply smoothing to a path
  private smoothPath(pathData: PathData): PathData {
    if (pathData.type !== 'points') {
      return pathData // Only smooth points paths for now
    }
    
    const pointsData = pathData as PointsPathData
    const points = pointsData.data
    
    if (points.length < 3) return pathData
    
    const smoothedPoints: VecLike[] = []
    
    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === points.length - 1) {
        // Keep first and last points unchanged (unless closed)
        if (!pathData.isClosed) {
          smoothedPoints.push(points[i])
          continue
        }
      }
      
      // Get neighboring points
      const prev = points[i === 0 ? points.length - 1 : i - 1]
      const current = points[i]
      const next = points[i === points.length - 1 ? 0 : i + 1]
      
      // Simple smoothing: average of neighbors weighted toward current point
      const smoothed = {
        x: (prev.x + 2 * current.x + next.x) / 4,
        y: (prev.y + 2 * current.y + next.y) / 4
      }
      
      smoothedPoints.push(smoothed)
    }
    
    return {
      ...pathData,
      data: smoothedPoints
    }
  }

  // Utility functions
  private interpolatePoints(p1: VecLike, p2: VecLike, factor: number): VecLike {
    return {
      x: p1.x + (p2.x - p1.x) * factor,
      y: p1.y + (p2.y - p1.y) * factor
    }
  }

  protected validateSettings(settings: SubdivideSettings): boolean {
    if (!super.validateSettings(settings)) return false
    
    const { iterations, factor, smooth } = settings
    
    if (typeof iterations !== 'number' || iterations < 0 || iterations > 10) {
      return false
    }
    
    if (typeof factor !== 'number' || factor <= 0 || factor >= 1) {
      return false
    }
    
    if (typeof smooth !== 'boolean') {
      return false
    }
    
    return true
  }
}