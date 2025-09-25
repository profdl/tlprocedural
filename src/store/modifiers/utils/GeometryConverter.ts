import { type TLShape, type Editor } from 'tldraw'
import polygonClipping from 'polygon-clipping'
import type { BezierPoint } from '../../../components/shapes/BezierShape'

const ENABLE_GEOMETRY_DEBUG = false
const geometryDebugLog = (...args: unknown[]) => {
  if (ENABLE_GEOMETRY_DEBUG) {
    console.log(...args)
  }
}

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
      case 'bezier':
        polygon = this.bezierShapeToPolygon(shape)
        break
      default:
        // Fallback: use bounding box for unsupported shapes
        polygon = this.boundingBoxToPolygon(shape)
    }

    this.cache.set(cacheKey, polygon)
    return polygon
  }

  /**
   * Select which shape's style to inherit from in Boolean operations
   * Different operations have different style inheritance priorities
   */
  static selectStyleSourceShape(
    shapes: TLShape[],
    operation: 'union' | 'subtract' | 'intersect' | 'exclude'
  ): TLShape | undefined {
    if (shapes.length === 0) return undefined
    if (shapes.length === 1) return shapes[0]

    switch (operation) {
      case 'union':
        // For union, use the largest shape's style (most prominent visual result)
        return shapes.reduce((largest, current) => {
          const largestArea = this.calculateShapeArea(largest)
          const currentArea = this.calculateShapeArea(current)
          return currentArea > largestArea ? current : largest
        })

      case 'subtract':
        // For subtraction, use the first shape's style (the shape being subtracted from)
        return shapes[0]

      case 'intersect':
        // For intersection, use the first shape's style (conventional choice)
        return shapes[0]

      case 'exclude':
        // For exclusion, use the largest remaining shape's style
        return shapes.reduce((largest, current) => {
          const largestArea = this.calculateShapeArea(largest)
          const currentArea = this.calculateShapeArea(current)
          return currentArea > largestArea ? current : largest
        })

      default:
        // Fallback to first shape
        return shapes[0]
    }
  }

  /**
   * Calculate approximate area of a shape for style inheritance priority
   */
  private static calculateShapeArea(shape: TLShape): number {
    const props = shape.props as { w?: number; h?: number; r?: number }

    // Simple area calculation based on shape type
    switch (shape.type) {
      case 'geo':
      case 'triangle':
      case 'polygon':
        return (props.w || 100) * (props.h || 100)
      case 'circle': {
        const radius = props.r || 50
        return Math.PI * radius * radius
      }
      default:
        return (props.w || 100) * (props.h || 100)
    }
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
   * Preserves visual alignment with original shape position or collective bounds context
   */
  static polygonToBezierShape(
    polygon: PolygonCoordinates,
    originalShape: TLShape,
    editor?: Editor,
    positionContext?: {
      collectiveBounds?: { centerX: number; centerY: number; width: number; height: number }
      shouldPreserveCollectivePosition?: boolean
    },
    styleSourceShape?: TLShape
  ): {
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
    geometryDebugLog('🔧 Converting polygon to bezier shape:', {
      polygonLength: polygon.length,
      originalShapeId: originalShape.id,
      originalShape: originalShape.type,
      originalPosition: { x: originalShape.x, y: originalShape.y }
    })

    if (polygon.length === 0) {
      geometryDebugLog('⚠️ Empty polygon, creating minimal bezier shape')
      const styleSource = styleSourceShape || originalShape
      const extractedProps = this.extractShapeProperties(styleSource)

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
          fillColor: extractedProps.fillColor,
          strokeWidth: extractedProps.strokeWidth,
          fill: extractedProps.fill,
          points: [],
          isClosed: true
        }
      }
    }

    // Get the first polygon (main shape) - ignore holes for now
    const firstPolygon = polygon[0]
    if (!firstPolygon || firstPolygon.length === 0) {
      geometryDebugLog('⚠️ No first polygon found')
      return this.polygonToBezierShape([], originalShape)
    }

    // Get the outer ring (first ring is always outer boundary)
    const outerRing = firstPolygon[0]
    if (!outerRing || outerRing.length < 3) {
      geometryDebugLog('⚠️ Invalid outer ring')
      return this.polygonToBezierShape([], originalShape)
    }

    // Calculate polygon bounding box (in page coordinates)
    const xs = outerRing.map(p => p[0])
    const ys = outerRing.map(p => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    // Calculate reference center for position preservation
    // Use collective bounds when available (for boolean operations on linear arrays)
    // Otherwise use original shape center
    let referenceCenterX: number
    let referenceCenterY: number

    if (positionContext?.collectiveBounds && positionContext?.shouldPreserveCollectivePosition) {
      // Use collective bounds center for boolean operations on modifier results
      referenceCenterX = positionContext.collectiveBounds.centerX
      referenceCenterY = positionContext.collectiveBounds.centerY
      geometryDebugLog('📍 Using collective bounds center for positioning:', {
        referenceCenterX,
        referenceCenterY,
        collectiveBounds: positionContext.collectiveBounds
      })
    } else if (editor) {
      // Use visual bounds when editor is available (accounts for rotation)
      const visualBounds = editor.getShapePageBounds(originalShape.id)
      if (visualBounds) {
        referenceCenterX = visualBounds.x + visualBounds.width / 2
        referenceCenterY = visualBounds.y + visualBounds.height / 2
      } else {
        // Fallback to geometric calculation
        const originalProps = originalShape.props as { w?: number; h?: number }
        const originalW = originalProps.w || 100
        const originalH = originalProps.h || 100
        referenceCenterX = originalShape.x + originalW / 2
        referenceCenterY = originalShape.y + originalH / 2
      }
    } else {
      // No editor available, use geometric calculation
      const originalProps = originalShape.props as { w?: number; h?: number }
      const originalW = originalProps.w || 100
      const originalH = originalProps.h || 100
      referenceCenterX = originalShape.x + originalW / 2
      referenceCenterY = originalShape.y + originalH / 2
    }

    // Calculate polygon center
    const polygonCenterX = (minX + maxX) / 2
    const polygonCenterY = (minY + maxY) / 2
    const polygonW = maxX - minX
    const polygonH = maxY - minY

    // Calculate position offset to maintain visual alignment
    // Place the polygon center at the reference center (original or collective)
    const targetX = referenceCenterX - polygonW / 2
    const targetY = referenceCenterY - polygonH / 2

    geometryDebugLog('📐 Position calculation:', {
      polygon: { minX, maxX, minY, maxY, centerX: polygonCenterX, centerY: polygonCenterY },
      positionMethod: positionContext?.shouldPreserveCollectivePosition
        ? 'collective bounds'
        : (editor ? 'visual bounds' : 'geometric calculation'),
      original: { x: originalShape.x, y: originalShape.y },
      reference: { x: referenceCenterX, y: referenceCenterY },
      target: { x: targetX, y: targetY },
      offset: { x: targetX - minX, y: targetY - minY }
    })

    // Convert polygon points to bezier points (relative to target position)
    const bezierPoints: BezierPoint[] = outerRing.slice(0, -1).map(([x, y]) => ({
      x: x - targetX,
      y: y - targetY
      // No control points - straight lines between vertices
    }))

    geometryDebugLog('🎯 Created bezier points:', {
      pointsCount: bezierPoints.length,
      firstPoint: bezierPoints[0],
      lastPoint: bezierPoints[bezierPoints.length - 1]
    })

    // Extract complete style properties from specified shape (or fallback to original)
    const styleSource = styleSourceShape || originalShape
    const extractedProps = this.extractShapeProperties(styleSource)

    const result = {
      type: 'bezier' as const,
      x: targetX,
      y: targetY,
      w: polygonW,
      h: polygonH,
      props: {
        w: polygonW,
        h: polygonH,
        color: extractedProps.color,
        fillColor: extractedProps.fillColor,
        strokeWidth: extractedProps.strokeWidth,
        fill: extractedProps.fill,
        points: bezierPoints,
        isClosed: true
      }
    }

    geometryDebugLog('✨ Created bezier shape with preserved position:', {
      type: result.type,
      position: { x: result.x, y: result.y },
      dimensions: { w: result.w, h: result.h },
      pointsCount: result.props.points.length,
      positionOffset: { x: result.x - minX, y: result.y - minY }
    })

    return result
  }

  static polygonToShapeProps(polygon: PolygonCoordinates, originalShape: TLShape): Record<string, unknown> {
    geometryDebugLog('🔧 Converting polygon to shape props:', {
      polygonLength: polygon.length,
      originalShapeId: originalShape.id,
      originalPosition: { x: originalShape.x, y: originalShape.y }
    })

    if (polygon.length === 0) {
      geometryDebugLog('⚠️ Empty polygon, returning original props')
      return originalShape.props as Record<string, unknown>
    }

    // Get first polygon, first ring (outer boundary)
    const firstPolygon = polygon[0]
    if (!firstPolygon || firstPolygon.length === 0) {
      geometryDebugLog('⚠️ No first polygon, returning original props')
      return originalShape.props as Record<string, unknown>
    }

    const ring = firstPolygon[0]
    if (!ring || ring.length === 0) {
      geometryDebugLog('⚠️ No ring data, returning original props')
      return originalShape.props as Record<string, unknown>
    }

    // Calculate bounding box
    const xs = ring.map(p => p[0])
    const ys = ring.map(p => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    geometryDebugLog('📐 Polygon bounding box calculated:', {
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

    geometryDebugLog('✨ Converted shape properties:', result)
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
   * Convert bezier shape to polygon using bezier points
   */
  private static bezierShapeToPolygon(shape: TLShape): PolygonCoordinates {
    const props = shape.props as { points?: BezierPoint[]; w?: number; h?: number; isClosed?: boolean }
    const { points, w = 100, h = 100, isClosed = true } = props
    const { x, y, rotation = 0 } = shape

    if (points && Array.isArray(points) && points.length > 0) {
      // Convert bezier points to polygon points
      let polygonPoints: Pair[] = points.map((p: BezierPoint) => [x + p.x, y + p.y] as Pair)

      // Close the polygon if needed
      if (isClosed && polygonPoints.length > 2) {
        // Only close if not already closed
        const first = polygonPoints[0]
        const last = polygonPoints[polygonPoints.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          polygonPoints.push(first)
        }
      }

      // Apply rotation if needed
      if (rotation !== 0) {
        const centerX = x + w / 2
        const centerY = y + h / 2
        polygonPoints = polygonPoints.map(([px, py]) => this.rotatePoint(px, py, centerX, centerY, rotation))
      }

      return [[polygonPoints]]
    }

    // Fallback to bounding box if no points
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
   * Extract complete style properties from shapes for inheritance in Boolean operations
   */
  private static extractShapeProperties(shape: TLShape): {
    color: string;
    strokeWidth: number;
    fill: boolean;
    fillColor: string;
    dash: string;
    size: number;
  } {
    const props = shape.props as Record<string, unknown>

    // Default values - use TLDraw's standard defaults
    let color = '#000000'
    let strokeWidth = 2
    let fill = true
    let fillColor = '#ffffff'
    let dash = 'solid'
    let size = 2

    // Handle different shape types with complete style extraction
    switch (shape.type) {
      case 'geo':
        color = (props.color as string) || '#000000'
        strokeWidth = (props.size as number) || 2
        size = (props.size as number) || 2
        fill = (props.fill as string) !== 'none'
        fillColor = fill ? (props.color as string) || '#000000' : '#ffffff'
        dash = (props.dash as string) || 'solid'
        break
      case 'draw':
      case 'custom-draw':
        color = (props.color as string) || '#000000'
        strokeWidth = (props.strokeWidth as number) || 2
        size = (props.strokeWidth as number) || 2
        fill = (props.fill as boolean) || false
        fillColor = (props.fillColor as string) || (props.color as string) || '#000000'
        dash = (props.dash as string) || 'solid'
        break
      case 'bezier':
        color = (props.color as string) || '#000000'
        strokeWidth = (props.strokeWidth as number) || 2
        size = (props.strokeWidth as number) || 2
        fill = (props.fill as boolean) !== false // default to true for bezier
        fillColor = (props.fillColor as string) || (props.color as string) || '#000000'
        dash = (props.dash as string) || 'solid'
        break
      case 'arrow':
        color = (props.color as string) || '#000000'
        strokeWidth = (props.size as number) || 2
        size = (props.size as number) || 2
        fill = (props.fill as string) !== 'none'
        fillColor = fill ? (props.color as string) || '#000000' : '#ffffff'
        dash = (props.dash as string) || 'solid'
        break
      case 'triangle':
      case 'circle':
      case 'polygon':
        // Custom shapes - extract full style properties
        color = (props.color as string) || '#000000'
        strokeWidth = (props.strokeWidth as number) || 2
        size = (props.strokeWidth as number) || 2
        fill = (props.fill as boolean) !== false
        fillColor = (props.fillColor as string) || (props.color as string) || '#000000'
        dash = (props.dash as string) || 'solid'
        break
      default:
        // Try to extract common properties from unknown shape types
        color = (props.color as string) || '#000000'
        strokeWidth = (props.strokeWidth as number) || (props.size as number) || (props.thickness as number) || 2
        size = (props.size as number) || (props.strokeWidth as number) || 2
        fill = (props.fill as boolean) !== false
        fillColor = (props.fillColor as string) || (props.fill as string) || (props.color as string) || '#000000'
        dash = (props.dash as string) || 'solid'
    }

    geometryDebugLog('🎨 Extracted complete shape style properties:', {
      originalType: shape.type,
      extractedColor: color,
      extractedStrokeWidth: strokeWidth,
      extractedFill: fill,
      extractedFillColor: fillColor,
      extractedDash: dash,
      extractedSize: size
    })

    return { color, strokeWidth, fill, fillColor, dash, size }
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
