import type { TLShape, Editor } from 'tldraw'
import type { CustomTrayItem } from '../hooks/useCustomShapes'
import type { BezierShape } from '../shapes/BezierShape'
import type { PolygonShape } from '../shapes/PolygonShape'
import { bezierPointsToPath } from './bezierToCustomShape'

/**
 * Converts multiple selected shapes into a single custom tray item
 */
export function combineShapesToCustom(
  shapes: TLShape[],
  editor: Editor,
  label?: string
): Omit<CustomTrayItem, 'id' | 'createdAt'> {
  if (shapes.length === 0) {
    throw new Error('No shapes provided for custom shape creation')
  }

  // Calculate combined bounds of all shapes
  const combinedBounds = calculateCombinedBounds(shapes, editor)

  // Generate unified SVG representation
  const iconSvg = generateMultiShapeThumbnail(shapes, editor, combinedBounds)

  // Generate a default label if none provided
  const shapeTypes = [...new Set(shapes.map(s => s.type))]
  const defaultLabel = shapes.length === 1
    ? `Custom ${shapes[0].type}`
    : `Custom ${shapes.length} shapes (${shapeTypes.join(', ')})`

  return {
    label: label || defaultLabel,
    iconSvg,
    shapeType: 'multi-shape',
    defaultProps: {
      w: Math.max(combinedBounds.width, 50), // Minimum size for usability
      h: Math.max(combinedBounds.height, 50),
      shapes: shapes.map(shape => {
        const shapeWithoutId = { ...shape }
        delete (shapeWithoutId as { id?: TLShape['id'] }).id

        return {
          ...shapeWithoutId,
          x: shape.x - combinedBounds.x,
          y: shape.y - combinedBounds.y
        }
      }),
      originalBounds: combinedBounds,
      color: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 1,
      fill: false
    },
    version: 1,
    lastModified: Date.now()
  }
}

/**
 * Calculates the combined bounding box of multiple shapes
 */
export function calculateCombinedBounds(shapes: TLShape[], editor: Editor) {
  if (shapes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const shape of shapes) {
    const bounds = editor.getShapePageBounds(shape.id)
    if (bounds) {
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Generates a unified SVG thumbnail for multiple shapes
 * Uses standard 24x24 viewBox to match other Lucide icons
 */
export function generateMultiShapeThumbnail(
  shapes: TLShape[],
  editor: Editor,
  bounds: { x: number; y: number; width: number; height: number },
  size: number = 16
): string {
  if (shapes.length === 0 || bounds.width === 0 || bounds.height === 0) {
    // Fallback for degenerate shapes - use standard 24x24 viewBox
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/></svg>`
  }

  // Scale and center the shapes to fit within a 24x24 viewBox (with padding)
  const padding = 2
  const targetSize = 24 - (padding * 2) // 20x20 drawing area within 24x24 viewBox

  // Calculate scale factors to fit all shapes in the target area
  const scaleX = bounds.width > 0 ? targetSize / bounds.width : 1
  const scaleY = bounds.height > 0 ? targetSize / bounds.height : 1
  const scale = Math.min(scaleX, scaleY) // Use uniform scaling to preserve aspect ratio

  // Calculate centering offsets
  const scaledWidth = bounds.width * scale
  const scaledHeight = bounds.height * scale
  const offsetX = padding + (targetSize - scaledWidth) / 2
  const offsetY = padding + (targetSize - scaledHeight) / 2

  // Convert each shape to SVG path and apply transforms
  const shapePaths = shapes.map(shape => {
    const shapeBounds = editor.getShapePageBounds(shape.id)
    if (!shapeBounds) return ''

    // Calculate relative position within the combined bounds
    const relativeX = (shapeBounds.x - bounds.x) * scale + offsetX
    const relativeY = (shapeBounds.y - bounds.y) * scale + offsetY
    const shapeWidth = shapeBounds.width * scale
    const shapeHeight = shapeBounds.height * scale

    const pathData = convertShapeToPath(shape, shapeWidth, shapeHeight)

    if (pathData) {
      return `<g transform="translate(${relativeX}, ${relativeY})">${pathData}</g>`
    }

    return ''
  }).filter(Boolean)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapePaths.join('')}</svg>`
}

/**
 * Converts any shape type to SVG path data for thumbnail generation
 */
export function convertShapeToPath(shape: TLShape, width: number, height: number): string {
  switch (shape.type) {
    case 'bezier':
      return convertBezierToPath(shape as BezierShape, width, height)

    case 'triangle':
      return convertTriangleToPath(width, height)

    case 'circle':
      return convertCircleToPath(width, height)

    case 'polygon':
      return convertPolygonToPath(shape, width, height)

    case 'sine-wave':
      return convertSineWaveToPath(width, height)

    default:
      // Fallback: draw a rectangle for unknown shapes
      return `<rect width="${width}" height="${height}" fill="none" stroke="currentColor"/>`
  }
}

/**
 * Convert bezier shape to SVG path
 */
function convertBezierToPath(shape: BezierShape, width: number, height: number): string {
  const { points, isClosed } = shape.props
  if (points.length === 0) return ''

  // Scale points to fit the target size
  const originalBounds = calculateBezierBounds(points)
  if (originalBounds.width === 0 || originalBounds.height === 0) return ''

  const scaleX = width / originalBounds.width
  const scaleY = height / originalBounds.height

  const scaledPoints = points.map(point => ({
    x: (point.x - originalBounds.minX) * scaleX,
    y: (point.y - originalBounds.minY) * scaleY,
    cp1: point.cp1 ? {
      x: (point.cp1.x - originalBounds.minX) * scaleX,
      y: (point.cp1.y - originalBounds.minY) * scaleY
    } : undefined,
    cp2: point.cp2 ? {
      x: (point.cp2.x - originalBounds.minX) * scaleX,
      y: (point.cp2.y - originalBounds.minY) * scaleY
    } : undefined
  }))

  const pathData = bezierPointsToPath(scaledPoints, isClosed)
  return `<path d="${pathData}"/>`
}

/**
 * Convert triangle to SVG path
 */
function convertTriangleToPath(width: number, height: number): string {
  const pathData = `M ${width / 2} 0 L ${width} ${height} L 0 ${height} Z`
  return `<path d="${pathData}"/>`
}

/**
 * Convert circle to SVG circle element
 */
function convertCircleToPath(width: number, height: number): string {
  const radius = Math.min(width, height) / 2
  const cx = width / 2
  const cy = height / 2
  return `<circle cx="${cx}" cy="${cy}" r="${radius}"/>`
}

/**
 * Convert polygon to SVG path
 */
function convertPolygonToPath(shape: TLShape, width: number, height: number): string {
  const polygon = shape as PolygonShape
  const sides = typeof polygon.props?.sides === 'number' ? polygon.props.sides : 6
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2

  const points: string[] = []
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2 // Start from top
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    points.push(`${x} ${y}`)
  }

  const pathData = `M ${points.join(' L ')} Z`
  return `<path d="${pathData}"/>`
}

/**
 * Convert sine wave to SVG path
 */
function convertSineWaveToPath(width: number, height: number): string {
  const amplitude = height / 4
  const centerY = height / 2
  const steps = 20

  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width
    const y = centerY + amplitude * Math.sin((i / steps) * 4 * Math.PI) // 2 complete waves
    if (i === 0) {
      points.push(`M ${x} ${y}`)
    } else {
      points.push(`L ${x} ${y}`)
    }
  }

  const pathData = points.join(' ')
  return `<path d="${pathData}"/>`
}

/**
 * Calculate bounds of bezier points (helper function)
 */
function calculateBezierBounds(points: BezierPoint[]) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)

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
