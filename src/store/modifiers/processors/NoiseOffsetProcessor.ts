import type { Editor, VecLike } from 'tldraw'
import type { NoiseOffsetSettings } from '../../../types/pathTypes'
import type { 
  PathData, 
  PathModificationResult, 
  PointsPathData, 
  BezierPathData 
} from '../../../types/pathTypes'
import type { BezierPoint } from '../../../components/shapes/BezierShape'
import { PathModifier } from '../core/PathModifier'

/**
 * Noise/Offset path modifier
 * Displaces path points using noise for organic variations
 */
export const NoiseOffsetProcessor = new class extends PathModifier<NoiseOffsetSettings> {
  
  protected modifyPath(
    pathData: PathData,
    settings: NoiseOffsetSettings,
    _shapeIndex: number,
    _editor?: Editor
  ): PathModificationResult {
    
    if (!this.validatePathData(pathData) || !this.validateSettings(settings)) {
      return { pathData, boundsChanged: false }
    }

    const { amplitude, frequency, octaves, seed } = settings
    
    try {
      let modifiedPath = this.clonePathData(pathData)
      
      // Calculate normalized bounds for consistent noise generation
      const bounds = pathData.bounds || this.calculatePathBounds(pathData)
      const normalizeCoord = (x: number, y: number) => ({
        x: bounds.w > 0 ? (x - bounds.x) / bounds.w : 0,
        y: bounds.h > 0 ? (y - bounds.y) / bounds.h : 0
      })
      
      // Apply noise displacement based on path type
      switch (modifiedPath.type) {
        case 'points':
          modifiedPath = this.applyNoiseToPoints(
            modifiedPath as PointsPathData, 
            amplitude, 
            frequency, 
            octaves, 
            seed, 
            settings.direction,
            normalizeCoord
          )
          break
        case 'bezier':
          modifiedPath = this.applyNoiseToBezier(
            modifiedPath as BezierPathData, 
            amplitude, 
            frequency, 
            octaves, 
            seed, 
            settings.direction,
            normalizeCoord
          )
          break
        case 'svg':
          console.warn('SVG path noise not implemented yet')
          break
      }
      
      // Update bounds
      const updatedPath = this.updatePathBounds(modifiedPath)
      
      return {
        pathData: updatedPath,
        boundsChanged: true,
        newBounds: updatedPath.bounds
      }
      
    } catch (error) {
      console.error('Error in NoiseOffsetProcessor:', error)
      return { pathData, boundsChanged: false }
    }
  }

  // Apply noise to points path
  private applyNoiseToPoints(
    pathData: PointsPathData, 
    amplitude: number,
    frequency: number,
    octaves: number,
    seed: number,
    direction: 'both' | 'normal' | 'tangent',
    normalizeCoord: (x: number, y: number) => { x: number, y: number }
  ): PointsPathData {
    
    const points = pathData.data
    if (points.length < 2) return pathData
    
    const noisedPoints: VecLike[] = []
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      
      // Generate noise value based on normalized position and seed
      const normalizedPoint = normalizeCoord(point.x, point.y)
      const noiseValue = this.generateNoise(
        normalizedPoint.x * frequency, 
        normalizedPoint.y * frequency, 
        octaves, 
        seed + i
      )
      
      // Calculate displacement direction
      let displacementVecLiketor: VecLike
      
      switch (direction) {
        case 'normal':
          displacementVecLiketor = this.calculateNormal(points, i, pathData.isClosed)
          break
        case 'tangent':
          displacementVecLiketor = this.calculateTangent(points, i, pathData.isClosed)
          break
        case 'both':
        default: {
          // Random direction based on noise
          const angle = noiseValue * Math.PI * 2
          displacementVecLiketor = {
            x: Math.cos(angle),
            y: Math.sin(angle)
          }
          break
        }
      }
      
      // Apply displacement
      const displacement = amplitude * noiseValue
      const noisedPoint: VecLike = {
        x: point.x + displacementVecLiketor.x * displacement,
        y: point.y + displacementVecLiketor.y * displacement
      }
      
      noisedPoints.push(noisedPoint)
    }
    
    return {
      ...pathData,
      data: noisedPoints
    }
  }

  // Apply noise to bezier path
  private applyNoiseToBezier(
    pathData: BezierPathData, 
    amplitude: number,
    frequency: number,
    octaves: number,
    seed: number,
    _direction: 'both' | 'normal' | 'tangent',
    normalizeCoord: (x: number, y: number) => { x: number, y: number }
  ): BezierPathData {
    
    const points = pathData.data
    if (points.length < 2) return pathData
    
    const noisedPoints: BezierPoint[] = []
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      
      // Generate noise for main point using normalized coordinates
      const normalizedPoint = normalizeCoord(point.x, point.y)
      const noiseValue = this.generateNoise(
        normalizedPoint.x * frequency, 
        normalizedPoint.y * frequency, 
        octaves, 
        seed + i
      )
      
      // Calculate displacement (simplified for bezier)
      const angle = noiseValue * Math.PI * 2
      const displacementVecLiketor = {
        x: Math.cos(angle),
        y: Math.sin(angle)
      }
      
      const displacement = amplitude * noiseValue
      
      // Apply displacement to main point
      const noisedPoint: BezierPoint = {
        x: point.x + displacementVecLiketor.x * displacement,
        y: point.y + displacementVecLiketor.y * displacement
      }
      
      // Apply smaller displacement to control points
      if (point.cp1) {
        const normalizedCp1 = normalizeCoord(point.cp1.x, point.cp1.y)
        const cp1Noise = this.generateNoise(
          normalizedCp1.x * frequency, 
          normalizedCp1.y * frequency, 
          octaves, 
          seed + i + 1000
        )
        const cp1Displacement = amplitude * cp1Noise * 0.3 // Smaller displacement for control points
        
        noisedPoint.cp1 = {
          x: point.cp1.x + displacementVecLiketor.x * cp1Displacement,
          y: point.cp1.y + displacementVecLiketor.y * cp1Displacement
        }
      }
      
      if (point.cp2) {
        const normalizedCp2 = normalizeCoord(point.cp2.x, point.cp2.y)
        const cp2Noise = this.generateNoise(
          normalizedCp2.x * frequency, 
          normalizedCp2.y * frequency, 
          octaves, 
          seed + i + 2000
        )
        const cp2Displacement = amplitude * cp2Noise * 0.3
        
        noisedPoint.cp2 = {
          x: point.cp2.x + displacementVecLiketor.x * cp2Displacement,
          y: point.cp2.y + displacementVecLiketor.y * cp2Displacement
        }
      }
      
      noisedPoints.push(noisedPoint)
    }
    
    return {
      ...pathData,
      data: noisedPoints
    }
  }

  // Calculate normal vector at a point
  private calculateNormal(points: VecLike[], index: number, isClosed: boolean): VecLike {
    const tangent = this.calculateTangent(points, index, isClosed)
    
    // Normal is perpendicular to tangent (rotate 90 degrees)
    return {
      x: -tangent.y,
      y: tangent.x
    }
  }

  // Calculate tangent vector at a point
  private calculateTangent(points: VecLike[], index: number, isClosed: boolean): VecLike {
    const pointCount = points.length
    
    if (pointCount < 2) {
      return { x: 1, y: 0 } // Default direction
    }
    
    let tangent: VecLike
    
    if (index === 0) {
      // First point
      if (isClosed) {
        const prev = points[pointCount - 1]
        const next = points[1]
        tangent = {
          x: next.x - prev.x,
          y: next.y - prev.y
        }
      } else {
        const current = points[0]
        const next = points[1]
        tangent = {
          x: next.x - current.x,
          y: next.y - current.y
        }
      }
    } else if (index === pointCount - 1) {
      // Last point
      if (isClosed) {
        const prev = points[pointCount - 2]
        const next = points[0]
        tangent = {
          x: next.x - prev.x,
          y: next.y - prev.y
        }
      } else {
        const prev = points[pointCount - 2]
        const current = points[pointCount - 1]
        tangent = {
          x: current.x - prev.x,
          y: current.y - prev.y
        }
      }
    } else {
      // Middle point
      const prev = points[index - 1]
      const next = points[index + 1]
      tangent = {
        x: next.x - prev.x,
        y: next.y - prev.y
      }
    }
    
    // Normalize tangent
    const length = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
    if (length > 0) {
      tangent.x /= length
      tangent.y /= length
    } else {
      tangent = { x: 1, y: 0 }
    }
    
    return tangent
  }

  // Simple noise function (simplified Perlin-like noise)
  private generateNoise(x: number, y: number, octaves: number, seed: number): number {
    let value = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0
    
    for (let i = 0; i < octaves; i++) {
      value += this.simpleNoise(x * frequency + seed, y * frequency + seed) * amplitude
      maxValue += amplitude
      amplitude *= 0.5
      frequency *= 2
    }
    
    return value / maxValue
  }

  // Simple noise implementation
  private simpleNoise(x: number, y: number): number {
    // Simple hash-based noise
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123
    return (n - Math.floor(n)) * 2 - 1 // Return value between -1 and 1
  }

  // Calculate bounds for a path (used for normalization)
  private calculatePathBounds(pathData: PathData): { x: number, y: number, w: number, h: number } {
    if (pathData.type === 'points') {
      const points = pathData.data as VecLike[]
      if (points.length === 0) return { x: 0, y: 0, w: 100, h: 100 }
      
      let minX = points[0].x, maxX = points[0].x
      let minY = points[0].y, maxY = points[0].y
      
      for (const point of points) {
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
        minY = Math.min(minY, point.y)
        maxY = Math.max(maxY, point.y)
      }
      
      return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX), // Ensure non-zero width
        h: Math.max(1, maxY - minY)  // Ensure non-zero height
      }
    } else if (pathData.type === 'bezier') {
      const points = pathData.data as BezierPoint[]
      if (points.length === 0) return { x: 0, y: 0, w: 100, h: 100 }
      
      let minX = points[0].x, maxX = points[0].x
      let minY = points[0].y, maxY = points[0].y
      
      for (const point of points) {
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
        minY = Math.min(minY, point.y)
        maxY = Math.max(maxY, point.y)
        
        // Also consider control points
        if (point.cp1) {
          minX = Math.min(minX, point.cp1.x)
          maxX = Math.max(maxX, point.cp1.x)
          minY = Math.min(minY, point.cp1.y)
          maxY = Math.max(maxY, point.cp1.y)
        }
        if (point.cp2) {
          minX = Math.min(minX, point.cp2.x)
          maxX = Math.max(maxX, point.cp2.x)
          minY = Math.min(minY, point.cp2.y)
          maxY = Math.max(maxY, point.cp2.y)
        }
      }
      
      return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY)
      }
    }
    
    // Fallback for unknown types
    return { x: 0, y: 0, w: 100, h: 100 }
  }

  protected validateSettings(settings: NoiseOffsetSettings): boolean {
    if (!super.validateSettings(settings)) return false
    
    const { amplitude, frequency, octaves, seed, direction } = settings
    
    if (typeof amplitude !== 'number' || amplitude < 0) {
      console.warn('Invalid amplitude for noise offset:', amplitude)
      return false
    }
    
    if (typeof frequency !== 'number' || frequency <= 0) {
      console.warn('Invalid frequency for noise offset:', frequency)
      return false
    }
    
    if (typeof octaves !== 'number' || octaves < 1 || octaves > 8) {
      console.warn('Invalid octaves for noise offset (1-8):', octaves)
      return false
    }
    
    if (typeof seed !== 'number') {
      console.warn('Invalid seed for noise offset:', seed)
      return false
    }
    
    if (!['both', 'normal', 'tangent'].includes(direction)) {
      console.warn('Invalid direction for noise offset:', direction)
      return false
    }
    
    return true
  }
}