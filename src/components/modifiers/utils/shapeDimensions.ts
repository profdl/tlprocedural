import type { TLShape } from 'tldraw'

/**
 * Get the dimensions of a shape
 */
export function getShapeDimensions(shape: TLShape): { width: number; height: number } {
  const defaultDimensions = { width: 100, height: 100 }
  
  if ('w' in shape.props && 'h' in shape.props) {
    return {
      width: shape.props.w as number,
      height: shape.props.h as number
    }
  }
  
  return defaultDimensions
}

/**
 * Set the dimensions of a shape
 */
export function setShapeDimensions(
  shape: TLShape, 
  width: number, 
  height: number
): TLShape {
  if ('w' in shape.props && 'h' in shape.props) {
    return {
      ...shape,
      props: {
        ...shape.props,
        w: width,
        h: height
      }
    }
  }
  
  return shape
}

/**
 * Get the bounds of a shape
 */
export function getShapeBounds(shape: TLShape) {
  if ('w' in shape.props && 'h' in shape.props) {
    const w = shape.props.w as number
    const h = shape.props.h as number
    return {
      minX: shape.x,
      maxX: shape.x + w,
      minY: shape.y,
      maxY: shape.y + h
    }
  }
  
  // Fallback for shapes without w/h props
  return {
    minX: shape.x,
    maxX: shape.x + 100, // Default width
    minY: shape.y,
    maxY: shape.y + 100  // Default height
  }
} 