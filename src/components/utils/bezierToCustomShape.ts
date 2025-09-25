import type { BezierPoint, BezierShape } from '../shapes/BezierShape'
import type { CustomTrayItem } from '../hooks/useCustomShapes'
import { BezierBounds } from '../shapes/services/BezierBounds'
import {
  bezierPointsToPath,
  normalizeBezierPoints as normalizeBezierPointsInternal
} from '../shapes/utils/bezierPathHelpers'

/**
 * Generates a compact SVG for use as a thumbnail icon
 * Uses standard 24x24 viewBox to match other Lucide icons for consistent stroke thickness
 */
export function generateBezierThumbnailSvg(points: BezierPoint[], isClosed: boolean, size: number = 16): string {
  const { normalizedPoints } = normalizeBezierPointsInternal(points)
  const bounds = BezierBounds.getAccurateBounds(normalizedPoints, isClosed)

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
  const { normalizedPoints } = normalizeBezierPointsInternal(points)

  // Use accurate bounds calculation that matches the system used in editing
  const accurateBounds = BezierBounds.getAccurateBounds(normalizedPoints, isClosed)
  const w = Math.max(1, accurateBounds.maxX - accurateBounds.minX)
  const h = Math.max(1, accurateBounds.maxY - accurateBounds.minY)

  // Generate a default label if none provided
  const defaultLabel = `Custom Bezier ${points.length} pts`

  return {
    label: label || defaultLabel,
    iconSvg: generateBezierThumbnailSvg(points, isClosed),
    shapeType: 'bezier',
    defaultProps: {
      w: Math.max(w, 50), // Minimum size for usability
      h: Math.max(h, 50),
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

export const normalizeBezierPoints = normalizeBezierPointsInternal
export { bezierPointsToPath }
