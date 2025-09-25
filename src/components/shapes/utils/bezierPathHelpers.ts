import type { BezierPoint } from '../BezierShape'
import { BezierBounds } from '../services/BezierBounds'

/**
 * Convert BezierPoint array to SVG path data.
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
      commands.push(`C ${prevPoint.cp2.x} ${prevPoint.cp2.y} ${currPoint.cp1.x} ${currPoint.cp1.y} ${currPoint.x} ${currPoint.y}`)
    } else if (prevPoint.cp2) {
      commands.push(`Q ${prevPoint.cp2.x} ${prevPoint.cp2.y} ${currPoint.x} ${currPoint.y}`)
    } else if (currPoint.cp1) {
      commands.push(`Q ${currPoint.cp1.x} ${currPoint.cp1.y} ${currPoint.x} ${currPoint.y}`)
    } else {
      commands.push(`L ${currPoint.x} ${currPoint.y}`)
    }
  }

  if (isClosed && points.length > 2) {
    const lastPoint = points[points.length - 1]
    const first = points[0]

    if (lastPoint.cp2 && first.cp1) {
      commands.push(`C ${lastPoint.cp2.x} ${lastPoint.cp2.y} ${first.cp1.x} ${first.cp1.y} ${first.x} ${first.y}`)
    }
    commands.push('Z')
  }

  return commands.join(' ')
}

/**
 * Calculate accurate bounds for Bezier points.
 */
export function getBezierPointBounds(points: BezierPoint[], isClosed: boolean) {
  return BezierBounds.getAccurateBounds(points, isClosed)
}

/**
 * Normalize bezier points to start at origin while preserving control points.
 */
export function normalizeBezierPoints(points: BezierPoint[]) {
  if (points.length === 0) {
    return { normalizedPoints: [], offset: { x: 0, y: 0 } }
  }

  const bounds = BezierBounds.getAccurateBounds(points, false)
  const offset = { x: bounds.minX, y: bounds.minY }

  const normalizedPoints = points.map(point => ({
    x: point.x - offset.x,
    y: point.y - offset.y,
    cp1: point.cp1 ? { x: point.cp1.x - offset.x, y: point.cp1.y - offset.y } : undefined,
    cp2: point.cp2 ? { x: point.cp2.x - offset.x, y: point.cp2.y - offset.y } : undefined
  }))

  return { normalizedPoints, offset }
}
