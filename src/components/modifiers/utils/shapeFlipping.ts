import type { TLShape } from 'tldraw'
import { logShapeOperation } from './debugUtils'

/**
 * Simple shape flipping utility that only transforms shape data
 * Position will be handled by the MirrorProcessor
 */
export function flipShape(
  shape: TLShape,
  flipX: boolean,
  flipY: boolean
): TLShape {
  if (!flipX && !flipY) {
    return shape // No flipping needed
  }

  logShapeOperation('Shape Flipping', shape.id, {
    shapeType: shape.type,
    flipX,
    flipY,
    originalProps: shape.props
  })

  // For text shapes, flip the text alignment
  if (shape.type === 'text' && flipX && 'align' in shape.props) {
    let newAlign = shape.props.align as string
    if (newAlign === 'start') newAlign = 'end'
    else if (newAlign === 'end') newAlign = 'start'
    
    return {
      ...shape,
      props: {
        ...shape.props,
        align: newAlign
      }
    }
  }

  // For draw shapes - flip the points
  if (shape.type === 'draw' && 'segments' in shape.props) {
    const segments = shape.props.segments as Array<{ points?: Array<{ x: number; y: number }> }>
    
    if (segments && segments.length > 0) {
      // Calculate bounds of the draw shape
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      
      segments.forEach(segment => {
        segment.points?.forEach(point => {
          minX = Math.min(minX, point.x)
          minY = Math.min(minY, point.y)
          maxX = Math.max(maxX, point.x)
          maxY = Math.max(maxY, point.y)
        })
      })

      const width = maxX - minX
      const height = maxY - minY

      // Flip the points
      const flippedSegments = segments.map(segment => ({
        ...segment,
        points: segment.points?.map(point => ({
          x: flipX ? width - (point.x - minX) + minX : point.x,
          y: flipY ? height - (point.y - minY) + minY : point.y
        }))
      }))

      return {
        ...shape,
        props: {
          ...shape.props,
          segments: flippedSegments
        }
      }
    }
  }

  // For arrow shapes - flip the start/end points
  if (shape.type === 'arrow' && 'start' in shape.props && 'end' in shape.props) {
    const start = shape.props.start as { x: number; y: number }
    const end = shape.props.end as { x: number; y: number }

    if (start && end) {
      // Calculate bounds
      const minX = Math.min(start.x, end.x)
      const minY = Math.min(start.y, end.y)
      const maxX = Math.max(start.x, end.x)
      const maxY = Math.max(start.y, end.y)
      const width = maxX - minX
      const height = maxY - minY

      // Flip the points
      const newStart = {
        x: flipX ? width - (start.x - minX) + minX : start.x,
        y: flipY ? height - (start.y - minY) + minY : start.y
      }

      const newEnd = {
        x: flipX ? width - (end.x - minX) + minX : end.x,
        y: flipY ? height - (end.y - minY) + minY : end.y
      }

      return {
        ...shape,
        props: {
          ...shape.props,
          start: newStart,
          end: newEnd
        }
      }
    }
  }

  // For other shapes (geo, rect, etc.), return unchanged
  // The visual flipping will be handled by position/rotation in MirrorProcessor
  return shape
}

/**
 * Calculate the position adjustment needed when flipping a shape
 * (kept for compatibility but not used in current implementation)
 */
export function calculateFlipPositionAdjustment(
  shape: TLShape,
  flipX: boolean,
  flipY: boolean
): { x: number; y: number } {
  let adjustX = 0
  let adjustY = 0

  if ('w' in shape.props && 'h' in shape.props) {
    const width = shape.props.w as number
    const height = shape.props.h as number

    if (flipX) {
      adjustX = -width
    }

    if (flipY) {
      adjustY = -height
    }
  }

  return { x: adjustX, y: adjustY }
} 