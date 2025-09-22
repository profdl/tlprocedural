import type { BezierShape, BezierPoint } from '../shapes/BezierShape'
import type { CustomTrayItem } from '../hooks/useCustomShapes'

/**
 * Converts a bezier shape to SVG path data for use in thumbnails and recreation
 */
export function bezierPointsToPath(points: BezierPoint[], isClosed: boolean): string {
  if (points.length === 0) return ''

  const commands: string[] = []
  const firstPoint = points[0]
  commands.push(`M ${firstPoint.x} ${firstPoint.y}`)

  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1]
    const currPoint = points[i]

    if (prevPoint.cp2 && currPoint.cp1) {
      // Cubic Bézier curve
      commands.push(`C ${prevPoint.cp2.x} ${prevPoint.cp2.y} ${currPoint.cp1.x} ${currPoint.cp1.y} ${currPoint.x} ${currPoint.y}`)
    } else if (prevPoint.cp2) {
      // Quadratic Bézier curve (using only outgoing control point)
      commands.push(`Q ${prevPoint.cp2.x} ${prevPoint.cp2.y} ${currPoint.x} ${currPoint.y}`)
    } else if (currPoint.cp1) {
      // Quadratic Bézier curve (using only incoming control point)
      commands.push(`Q ${currPoint.cp1.x} ${currPoint.cp1.y} ${currPoint.x} ${currPoint.y}`)
    } else {
      // Straight line
      commands.push(`L ${currPoint.x} ${currPoint.y}`)
    }
  }

  if (isClosed && points.length > 2) {
    // Close the path with appropriate curve if needed
    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]

    if (lastPoint.cp2 && firstPoint.cp1) {
      commands.push(`C ${lastPoint.cp2.x} ${lastPoint.cp2.y} ${firstPoint.cp1.x} ${firstPoint.cp1.y} ${firstPoint.x} ${firstPoint.y}`)
    }
    commands.push('Z')
  }

  return commands.join(' ')
}

/**
 * Calculates the bounds of a bezier curve
 */
export function calculateBezierBounds(points: BezierPoint[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y

  // Check all anchor points
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)

    // Also check control points
    if (point.cp1) {
      minX = Math.min(minX, point.cp1.x)
      minY = Math.min(minY, point.cp1.y)
      maxX = Math.max(maxX, point.cp1.x)
      maxY = Math.max(maxY, point.cp1.y)
    }
    if (point.cp2) {
      minX = Math.min(minX, point.cp2.x)
      minY = Math.min(minY, point.cp2.y)
      maxX = Math.max(maxX, point.cp2.x)
      maxY = Math.max(maxY, point.cp2.y)
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Normalizes bezier points to start from origin (0,0) for consistent custom shape creation
 */
export function normalizeBezierPoints(points: BezierPoint[]): { normalizedPoints: BezierPoint[]; offset: { x: number; y: number } } {
  if (points.length === 0) {
    return { normalizedPoints: [], offset: { x: 0, y: 0 } }
  }

  const bounds = calculateBezierBounds(points)
  const offset = { x: bounds.minX, y: bounds.minY }

  const normalizedPoints = points.map(point => ({
    x: point.x - offset.x,
    y: point.y - offset.y,
    cp1: point.cp1 ? { x: point.cp1.x - offset.x, y: point.cp1.y - offset.y } : undefined,
    cp2: point.cp2 ? { x: point.cp2.x - offset.x, y: point.cp2.y - offset.y } : undefined
  }))

  return { normalizedPoints, offset }
}

/**
 * Generates a compact SVG for use as a thumbnail icon
 * Uses standard 24x24 viewBox to match other Lucide icons for consistent stroke thickness
 */
export function generateBezierThumbnailSvg(points: BezierPoint[], isClosed: boolean, size: number = 16): string {
  const { normalizedPoints } = normalizeBezierPoints(points)
  const bounds = calculateBezierBounds(normalizedPoints)

  if (bounds.width === 0 || bounds.height === 0) {
    // Fallback for degenerate shapes - use standard 24x24 viewBox
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/></svg>`
  }

  // Scale and center the bezier path to fit within a 24x24 viewBox (with padding)
  const padding = 2
  const targetSize = 24 - (padding * 2) // 20x20 drawing area within 24x24 viewBox

  // Calculate scale factors to fit the shape in the target area
  const scaleX = bounds.width > 0 ? targetSize / bounds.width : 1
  const scaleY = bounds.height > 0 ? targetSize / bounds.height : 1
  const scale = Math.min(scaleX, scaleY) // Use uniform scaling to preserve aspect ratio

  // Calculate centering offsets
  const scaledWidth = bounds.width * scale
  const scaledHeight = bounds.height * scale
  const offsetX = padding + (targetSize - scaledWidth) / 2
  const offsetY = padding + (targetSize - scaledHeight) / 2

  // Transform the points to fit the 24x24 viewBox
  const transformedPoints = normalizedPoints.map(point => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
    cp1: point.cp1 ? {
      x: point.cp1.x * scale + offsetX,
      y: point.cp1.y * scale + offsetY
    } : undefined,
    cp2: point.cp2 ? {
      x: point.cp2.x * scale + offsetX,
      y: point.cp2.y * scale + offsetY
    } : undefined
  }))

  const pathData = bezierPointsToPath(transformedPoints, isClosed)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${pathData}"/></svg>`
}

/**
 * Converts a bezier shape to a custom tray item
 */
export function bezierShapeToCustomTrayItem(
  shape: BezierShape,
  label?: string
): Omit<CustomTrayItem, 'id' | 'createdAt'> {
  const { points, isClosed, color, fillColor, strokeWidth, fill } = shape.props
  const { normalizedPoints } = normalizeBezierPoints(points)
  const bounds = calculateBezierBounds(normalizedPoints)

  // Generate a default label if none provided
  const defaultLabel = `Custom Bezier ${points.length} pts`

  return {
    label: label || defaultLabel,
    iconSvg: generateBezierThumbnailSvg(points, isClosed),
    shapeType: 'bezier',
    defaultProps: {
      w: Math.max(bounds.width, 50), // Minimum size for usability
      h: Math.max(bounds.height, 50),
      points: normalizedPoints,
      isClosed,
      color,
      fillColor,
      strokeWidth,
      fill,
      editMode: false,
      selectedPointIndices: [],
      hoverPoint: undefined,
      hoverSegmentIndex: undefined
    },
    version: 1,
    lastModified: Date.now()
  }
}