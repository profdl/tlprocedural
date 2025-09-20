import { type TLShape } from 'tldraw'
import polygonClipping from 'polygon-clipping'
import type { BezierPoint } from '../../../components/shapes/BezierShape'

// polygon-clipping library types
export type Pair = [number, number]
export type Ring = Pair[]
export type Polygon = Ring[]
export type MultiPolygon = Polygon[]
export type PolygonCoordinates = MultiPolygon

/**
 * Converts TLDraw shapes to polygon coordinates for boolean operations
 * Uses lazy conversion to minimize computation overhead
 */
export class GeometryConverter {
  private static cache = new Map<string, PolygonCoordinates>()

  /**
   * Convert TLShape to polygon coordinates
   * Returns coordinates compatible with polygon-clipping library
   */
  static shapeToPolygon(shape: TLShape): PolygonCoordinates {
    const cacheKey = this.getCacheKey(shape)

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    let polygon: PolygonCoordinates

    switch (shape.type) {
      case 'geo':
        polygon = this.geoShapeToPolygon(shape)
        break
      case 'draw':
        polygon = this.drawShapeToPolygon(shape)
        break
      case 'polygon':
        polygon = this.polygonShapeToPolygon(shape)
        break
      case 'circle':
        polygon = this.circleShapeToPolygon(shape)
        break
      case 'triangle':
        polygon = this.triangleShapeToPolygon(shape)
        break
      default:
        // Fallback: use bounding box for unsupported shapes
        polygon = this.boundingBoxToPolygon(shape)
    }

    this.cache.set(cacheKey, polygon)
    return polygon
  }

  /**
   * Perform boolean operation on multiple shapes
   */
  static performBooleanOperation(
    shapes: TLShape[],
    operation: 'union' | 'subtract' | 'intersect' | 'exclude'
  ): PolygonCoordinates {
    if (shapes.length === 0) return []
    if (shapes.length === 1) return this.shapeToPolygon(shapes[0])

    let result = this.shapeToPolygon(shapes[0])

    for (let i = 1; i < shapes.length; i++) {
      const nextPolygon = this.shapeToPolygon(shapes[i])

      switch (operation) {
        case 'union':
          result = polygonClipping.union(result, nextPolygon)
          break
        case 'subtract':
          result = polygonClipping.difference(result, nextPolygon)
          break
        case 'intersect':
          result = polygonClipping.intersection(result, nextPolygon)
          break
        case 'exclude':
          result = polygonClipping.xor(result, nextPolygon)
          break
      }
    }

    return result
  }

  /**
   * Convert polygon coordinates back to shape properties
   */
  /**
   * Convert polygon coordinates to bezier shape properties
   * Returns a complete bezier shape definition that can render the merged polygon
   */
  static polygonToBezierShape(polygon: PolygonCoordinates, originalShape: TLShape): {
    type: 'bezier'
    x: number
    y: number
    w: number
    h: number
    props: {
      w: number
      h: number
      color: string
      fillColor: string
      strokeWidth: number
      fill: boolean
      points: BezierPoint[]
      isClosed: boolean
    }
  } {
    console.log('🔧 Converting polygon to bezier shape:', {
      polygonLength: polygon.length,
      originalShapeId: originalShape.id,
      originalShape: originalShape.type
    })

    if (polygon.length === 0) {
      console.log('⚠️ Empty polygon, creating minimal bezier shape')
      const extractedProps = this.extractShapeProperties(originalShape)

      return {
        type: 'bezier',
        x: originalShape.x,
        y: originalShape.y,
        w: 100,
        h: 100,
        props: {
          w: 100,
          h: 100,
          color: extractedProps.color,
          fillColor: extractedProps.color,
          strokeWidth: extractedProps.strokeWidth,
          fill: true,
          points: [],
          isClosed: true
        }
      }
    }

    // Get the first polygon (main shape) - ignore holes for now
    const firstPolygon = polygon[0]
    if (!firstPolygon || firstPolygon.length === 0) {
      console.log('⚠️ No first polygon found')
      return this.polygonToBezierShape([], originalShape)
    }

    // Get the outer ring (first ring is always outer boundary)
    const outerRing = firstPolygon[0]
    if (!outerRing || outerRing.length < 3) {
      console.log('⚠️ Invalid outer ring')
      return this.polygonToBezierShape([], originalShape)
    }

    // Calculate bounding box
    const xs = outerRing.map(p => p[0])
    const ys = outerRing.map(p => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    console.log('📐 Polygon bounding box calculated:', {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
      ringPoints: outerRing.length
    })

    // Convert polygon points to bezier points (relative to shape origin)
    const bezierPoints: BezierPoint[] = outerRing.slice(0, -1).map(([x, y]) => ({
      x: x - minX,
      y: y - minY
      // No control points - straight lines between vertices
    }))

    console.log('🎯 Created bezier points:', {
      pointsCount: bezierPoints.length,
      firstPoint: bezierPoints[0],
      lastPoint: bezierPoints[bezierPoints.length - 1]
    })

    // Extract color and stroke properties from different shape types
    const extractedProps = this.extractShapeProperties(originalShape)

    const result = {
      type: 'bezier' as const,
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      props: {
        w: maxX - minX,
        h: maxY - minY,
        color: extractedProps.color,
        fillColor: extractedProps.color,
        strokeWidth: extractedProps.strokeWidth,
        fill: true,
        points: bezierPoints,
        isClosed: true
      }
    }

    console.log('✨ Created bezier shape:', {
      type: result.type,
      position: { x: result.x, y: result.y },
      dimensions: { w: result.w, h: result.h },
      pointsCount: result.props.points.length,
      isClosed: result.props.isClosed,
      fill: result.props.fill
    })

    return result
  }

  static polygonToShapeProps(polygon: PolygonCoordinates, originalShape: TLShape): Record<string, unknown> {
    console.log('🔧 Converting polygon to shape props:', {
      polygonLength: polygon.length,
      originalShapeId: originalShape.id,
      originalPosition: { x: originalShape.x, y: originalShape.y }
    })

    if (polygon.length === 0) {
      console.log('⚠️ Empty polygon, returning original props')
      return originalShape.props as Record<string, unknown>
    }

    // Get first polygon, first ring (outer boundary)
    const firstPolygon = polygon[0]
    if (!firstPolygon || firstPolygon.length === 0) {
      console.log('⚠️ No first polygon, returning original props')
      return originalShape.props as Record<string, unknown>
    }

    const ring = firstPolygon[0]
    if (!ring || ring.length === 0) {
      console.log('⚠️ No ring data, returning original props')
      return originalShape.props as Record<string, unknown>
    }

    // Calculate bounding box
    const xs = ring.map(p => p[0])
    const ys = ring.map(p => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    console.log('📐 Polygon bounding box calculated:', {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
      ringPoints: ring.length
    })

    // For complex polygons, store as path data
    const points = ring.map(([x, y]) => ({ x: x - minX, y: y - minY }))

    const result = {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      props: {
        ...originalShape.props,
        w: maxX - minX,
        h: maxY - minY
      },
      points, // Custom shapes can use this
      renderAsPath: true, // Flag for custom rendering
    }

    console.log('✨ Converted shape properties:', result)
    return result
  }

  /**
   * Generate cache key for shape
   */
  private static getCacheKey(shape: TLShape): string {
    return `${shape.id}-${shape.x}-${shape.y}-${shape.rotation}-${JSON.stringify(shape.props)}`
  }

  /**
   * Convert geo shape (rectangle, ellipse) to polygon
   */
  private static geoShapeToPolygon(shape: TLShape): PolygonCoordinates {
    const props = shape.props as { w?: number; h?: number; geo?: string }
    const { w = 100, h = 100, geo = 'rectangle' } = props
    const { x, y, rotation = 0 } = shape

    let points: Pair[]

    if (geo === 'rectangle') {
      points = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y] // Close the polygon
      ]
    } else if (geo === 'ellipse') {
      // Approximate ellipse with polygon
      points = this.ellipseToPoints(x, y, w, h, 32)
    } else {
      // Fallback to rectangle for other geo types
      points = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y]
      ]
    }

    // Apply rotation if needed
    if (rotation !== 0) {
      const centerX = x + w / 2
      const centerY = y + h / 2
      points = points.map(([px, py]) => this.rotatePoint(px, py, centerX, centerY, rotation))
    }

    return [[points]]  // MultiPolygon format: [polygon[ring[point]]]
  }

  /**
   * Convert custom polygon shape to polygon coordinates
   */
  private static polygonShapeToPolygon(shape: TLShape): PolygonCoordinates {
    const props = shape.props as { points?: { x: number; y: number }[]; w?: number; h?: number; sides?: number }
    const { points, w = 100, h = 100 } = props
    const { x, y, rotation = 0 } = shape

    if (points && Array.isArray(points)) {
      // Use existing points
      let polygonPoints: Pair[] = points.map((p: { x: number; y: number }) => [x + p.x, y + p.y] as Pair)
      polygonPoints.push(polygonPoints[0]) // Close polygon

      if (rotation !== 0) {
        const centerX = x + w / 2
        const centerY = y + h / 2
        polygonPoints = polygonPoints.map(([px, py]) => this.rotatePoint(px, py, centerX, centerY, rotation))
      }

      return [[polygonPoints]]
    }

    // Fallback to regular polygon
    const sides = props.sides || 6
    return [[this.regularPolygonPoints(x, y, w, h, sides, rotation)]]
  }

  /**
   * Convert circle shape to polygon
   */
  private static circleShapeToPolygon(shape: TLShape): PolygonCoordinates {
    const props = shape.props as { r?: number }
    const { r = 50 } = props
    const { x, y } = shape

    return [[this.ellipseToPoints(x - r, y - r, r * 2, r * 2, 32)]]
  }

  /**
   * Convert triangle shape to polygon
   */
  private static triangleShapeToPolygon(shape: TLShape): PolygonCoordinates {
    const props = shape.props as { w?: number; h?: number }
    const { w = 100, h = 100 } = props
    const { x, y, rotation = 0 } = shape

    let points: Pair[] = [
      [x + w / 2, y],      // Top
      [x + w, y + h],      // Bottom right
      [x, y + h],          // Bottom left
      [x + w / 2, y]       // Close polygon
    ]

    if (rotation !== 0) {
      const centerX = x + w / 2
      const centerY = y + h / 2
      points = points.map(([px, py]) => this.rotatePoint(px, py, centerX, centerY, rotation))
    }

    return [[points]]
  }

  /**
   * Convert draw shape to polygon (approximate from path)
   */
  private static drawShapeToPolygon(shape: TLShape): PolygonCoordinates {
    // For draw shapes, we'll use the bounding box as a simplification
    // This could be enhanced to trace the actual drawn path
    return this.boundingBoxToPolygon(shape)
  }

  /**
   * Fallback: convert shape bounding box to polygon
   */
  private static boundingBoxToPolygon(shape: TLShape): PolygonCoordinates {
    const props = shape.props as { w?: number; h?: number }
    const w = props.w || 100
    const h = props.h || 100
    const { x, y } = shape

    return [[[
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y]
    ]]]
  }

  /**
   * Generate points for regular polygon
   */
  private static regularPolygonPoints(
    x: number,
    y: number,
    w: number,
    h: number,
    sides: number,
    rotation: number = 0
  ): Pair[] {
    const centerX = x + w / 2
    const centerY = y + h / 2
    const radiusX = w / 2
    const radiusY = h / 2
    const points: Pair[] = []

    for (let i = 0; i <= sides; i++) { // Include extra point to close polygon
      const angle = (i / sides) * 2 * Math.PI + rotation
      const px = centerX + radiusX * Math.cos(angle)
      const py = centerY + radiusY * Math.sin(angle)
      points.push([px, py])
    }

    return points
  }

  /**
   * Generate points for ellipse approximation
   */
  private static ellipseToPoints(x: number, y: number, w: number, h: number, segments: number): Pair[] {
    const centerX = x + w / 2
    const centerY = y + h / 2
    const radiusX = w / 2
    const radiusY = h / 2
    const points: Pair[] = []

    for (let i = 0; i <= segments; i++) { // Include extra point to close polygon
      const angle = (i / segments) * 2 * Math.PI
      const px = centerX + radiusX * Math.cos(angle)
      const py = centerY + radiusY * Math.sin(angle)
      points.push([px, py])
    }

    return points
  }

  /**
   * Rotate point around center
   */
  private static rotatePoint(
    x: number,
    y: number,
    centerX: number,
    centerY: number,
    rotation: number
  ): Pair {
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const dx = x - centerX
    const dy = y - centerY

    return [
      centerX + dx * cos - dy * sin,
      centerY + dx * sin + dy * cos
    ]
  }

  /**
   * Extract color and stroke properties from different shape types
   */
  private static extractShapeProperties(shape: TLShape): { color: string; strokeWidth: number } {
    const props = shape.props as any

    // Default values
    let color = '#000000'
    let strokeWidth = 2

    // Handle different shape types
    switch (shape.type) {
      case 'geo':
        color = props.color || '#000000'
        strokeWidth = props.size || 2
        break
      case 'draw':
      case 'custom-draw':
        color = props.color || '#000000'
        strokeWidth = props.strokeWidth || 2
        break
      case 'bezier':
        color = props.color || '#000000'
        strokeWidth = props.strokeWidth || 2
        break
      case 'arrow':
        color = props.color || '#000000'
        strokeWidth = props.size || 2
        break
      default:
        // Try to extract common properties
        color = props.color || props.fill || '#000000'
        strokeWidth = props.strokeWidth || props.size || props.thickness || 2
    }

    console.log('🎨 Extracted shape properties:', {
      originalType: shape.type,
      extractedColor: color,
      extractedStrokeWidth: strokeWidth
    })

    return { color, strokeWidth }
  }

  /**
   * Clear cache for performance
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache size for monitoring
   */
  static getCacheSize(): number {
    return this.cache.size
  }
}