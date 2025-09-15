import type { VecLike } from 'tldraw'
import type { SmoothSettings } from '../../../types/pathTypes'
import type { 
  PathData, 
  PathModificationResult, 
  PointsPathData, 
  BezierPathData 
} from '../../../types/pathTypes'
import type { BezierPoint } from '../../../components/shapes/BezierShape'
import { PathModifier } from '../core/PathModifier'

/**
 * Smooth path modifier
 * Applies smoothing algorithms to reduce sharp corners and noise
 */
export const SmoothProcessor = new class extends PathModifier<SmoothSettings> {
  
  protected modifyPath(
    pathData: PathData,
    settings: SmoothSettings
  ): PathModificationResult {
    
    if (!this.validatePathData(pathData) || !this.validateSettings(settings)) {
      return { pathData, boundsChanged: false }
    }

    const { iterations, factor, preserveCorners, cornerThreshold } = settings
    
    try {
      let modifiedPath = this.clonePathData(pathData)
      
      // Apply smoothing iterations
      for (let i = 0; i < iterations; i++) {
        modifiedPath = this.smoothPathOnce(modifiedPath, factor, preserveCorners, cornerThreshold)
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

  // Apply one smoothing pass
  private smoothPathOnce(
    pathData: PathData, 
    factor: number, 
    preserveCorners: boolean, 
    cornerThreshold: number
  ): PathData {
    switch (pathData.type) {
      case 'points':
        return this.smoothPoints(pathData as PointsPathData, factor, preserveCorners, cornerThreshold)
      case 'bezier':
        return this.smoothBezier(pathData as BezierPathData, factor)
      case 'svg':
        return pathData
      default:
        return pathData
    }
  }

  // Smooth points path using weighted averaging
  private smoothPoints(
    pathData: PointsPathData, 
    factor: number, 
    preserveCorners: boolean, 
    cornerThreshold: number
  ): PointsPathData {
    const points = pathData.data
    if (points.length < 3) return pathData
    
    const smoothedPoints: VecLike[] = []
    
    for (let i = 0; i < points.length; i++) {
      const current = points[i]
      
      // Check if we should preserve this corner
      if (preserveCorners && this.isCorner(points, i, cornerThreshold, pathData.isClosed)) {
        smoothedPoints.push(current)
        continue
      }
      
      // Get neighboring points for smoothing
      const { prev, next } = this.getNeighbors(points, i, pathData.isClosed)
      
      if (prev && next) {
        // Weighted average smoothing
        const smoothed = {
          x: current.x * (1 - factor) + (prev.x + next.x) * factor / 2,
          y: current.y * (1 - factor) + (prev.y + next.y) * factor / 2
        }
        smoothedPoints.push(smoothed)
      } else {
        // Keep endpoints unchanged for open paths
        smoothedPoints.push(current)
      }
    }
    
    return {
      ...pathData,
      data: smoothedPoints
    }
  }

  // Smooth bezier path by adjusting control points
  private smoothBezier(pathData: BezierPathData, factor: number): BezierPathData {
    const points = pathData.data
    if (points.length < 3) return pathData
    
    const smoothedPoints: BezierPoint[] = []
    
    for (let i = 0; i < points.length; i++) {
      const current = points[i]
      const { prev, next } = this.getBezierNeighbors(points, i, pathData.isClosed)
      
      // Smooth the main point
      const smoothedPoint: BezierPoint = { ...current }
      
      if (prev && next) {
        smoothedPoint.x = current.x * (1 - factor) + (prev.x + next.x) * factor / 2
        smoothedPoint.y = current.y * (1 - factor) + (prev.y + next.y) * factor / 2
      }
      
      // Smooth control points if they exist
      if (current.cp1 && prev) {
        smoothedPoint.cp1 = {
          x: current.cp1.x * (1 - factor * 0.5) + prev.x * factor * 0.5,
          y: current.cp1.y * (1 - factor * 0.5) + prev.y * factor * 0.5
        }
      }
      
      if (current.cp2 && next) {
        smoothedPoint.cp2 = {
          x: current.cp2.x * (1 - factor * 0.5) + next.x * factor * 0.5,
          y: current.cp2.y * (1 - factor * 0.5) + next.y * factor * 0.5
        }
      }
      
      smoothedPoints.push(smoothedPoint)
    }
    
    return {
      ...pathData,
      data: smoothedPoints
    }
  }

  // Check if a point is a corner (sharp angle)
  private isCorner(
    points: VecLike[], 
    index: number, 
    threshold: number, 
    isClosed: boolean
  ): boolean {
    const { prev, next } = this.getNeighbors(points, index, isClosed)
    if (!prev || !next) return true // Endpoints are always preserved
    
    const current = points[index]
    
    // Calculate vectors
    const v1 = { x: prev.x - current.x, y: prev.y - current.y }
    const v2 = { x: next.x - current.x, y: next.y - current.y }
    
    // Calculate angle between vectors
    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
    
    if (mag1 === 0 || mag2 === 0) return true
    
    const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))))
    const angleDegrees = (angle * 180) / Math.PI
    
    // If angle is sharp (less than threshold), it's a corner
    return angleDegrees < threshold
  }

  // Get neighboring points for smoothing
  private getNeighbors(
    points: VecLike[], 
    index: number, 
    isClosed: boolean
  ): { prev: VecLike | null; next: VecLike | null } {
    const count = points.length
    
    let prev: VecLike | null = null
    let next: VecLike | null = null
    
    if (index > 0) {
      prev = points[index - 1]
    } else if (isClosed) {
      prev = points[count - 1]
    }
    
    if (index < count - 1) {
      next = points[index + 1]
    } else if (isClosed) {
      next = points[0]
    }
    
    return { prev, next }
  }

  // Get neighboring bezier points
  private getBezierNeighbors(
    points: BezierPoint[], 
    index: number, 
    isClosed: boolean
  ): { prev: BezierPoint | null; next: BezierPoint | null } {
    const count = points.length
    
    let prev: BezierPoint | null = null
    let next: BezierPoint | null = null
    
    if (index > 0) {
      prev = points[index - 1]
    } else if (isClosed) {
      prev = points[count - 1]
    }
    
    if (index < count - 1) {
      next = points[index + 1]
    } else if (isClosed) {
      next = points[0]
    }
    
    return { prev, next }
  }

  protected validateSettings(settings: SmoothSettings): boolean {
    if (!super.validateSettings(settings)) return false
    
    const { iterations, factor, preserveCorners, cornerThreshold } = settings
    
    if (typeof iterations !== 'number' || iterations < 1 || iterations > 10) {
      return false
    }
    
    if (typeof factor !== 'number' || factor < 0 || factor > 1) {
      return false
    }
    
    if (typeof preserveCorners !== 'boolean') {
      return false
    }
    
    if (typeof cornerThreshold !== 'number' || cornerThreshold < 0 || cornerThreshold > 180) {
      return false
    }
    
    return true
  }
}