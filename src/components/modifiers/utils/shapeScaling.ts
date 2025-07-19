import type { TLShape } from 'tldraw'
import { logShapeOperation } from './debugUtils'

/**
 * Comprehensive scaling utility for different shape types
 */
export function applyShapeScaling(
  shape: TLShape,
  scaleX: number,
  scaleY: number
): TLShape {
  // Ensure we don't create negative dimensions
  const safeScaleX = Math.max(0.1, scaleX) // Minimum 0.1 to avoid zero/negative
  const safeScaleY = Math.max(0.1, scaleY) // Minimum 0.1 to avoid zero/negative
  
  // For shapes with w/h properties (most common)
  if ('w' in shape.props && 'h' in shape.props) {
    const originalW = shape.props.w as number
    const originalH = shape.props.h as number
    
    // Ensure we don't create negative or zero dimensions
    const newW = Math.max(1, originalW * safeScaleX)
    const newH = Math.max(1, originalH * safeScaleY)
    
    return {
      ...shape,
      props: {
        ...shape.props,
        w: newW,
        h: newH
      }
    }
  }
  
  // For draw shapes (TLDrawShape) - they have segments that need scaling
  if (shape.type === 'draw' && 'segments' in shape.props) {
    const segments = shape.props.segments as Array<{ points?: Array<{ x: number; y: number }> }>
    if (segments && segments.length > 0) {
      const scaledSegments = segments.map(segment => ({
        ...segment,
        points: segment.points?.map((point: { x: number; y: number }) => ({
          x: point.x * scaleX,
          y: point.y * scaleY
        }))
      }))
      
      return {
        ...shape,
        props: {
          ...shape.props,
          segments: scaledSegments
        }
      }
    }
  }
  
  // For text shapes - scale the font size
  if (shape.type === 'text' && 'fontSize' in shape.props) {
    return {
      ...shape,
      props: {
        ...shape.props,
        fontSize: (shape.props.fontSize as number) * Math.max(scaleX, scaleY)
      }
    }
  }
  
  // For arrow shapes - scale the stroke width
  if (shape.type === 'arrow' && 'strokeWidth' in shape.props) {
    return {
      ...shape,
      props: {
        ...shape.props,
        strokeWidth: (shape.props.strokeWidth as number) * Math.max(scaleX, scaleY)
      }
    }
  }
  
  // For shapes with a scale property
  if ('scale' in shape.props) {
    return {
      ...shape,
      props: {
        ...shape.props,
        scale: (shape.props.scale as number) * Math.max(scaleX, scaleY)
      }
    }
  }
  
  // For shapes with size property (like geo shapes)
  if ('size' in shape.props) {
    const sizeMap: Record<string, string> = {
      's': 'm',
      'm': 'l', 
      'l': 'xl',
      'xl': 'xl'
    }
    
    const currentSize = shape.props.size as string
    const newSize = sizeMap[currentSize] || currentSize
    
    return {
      ...shape,
      props: {
        ...shape.props,
        size: newSize
      }
    }
  }
  
  // If no specific scaling method is found, return the shape unchanged
  logShapeOperation('Scaling', shape.id, {
    type: shape.type,
    scaleX,
    scaleY,
    message: 'No specific scaling method found for this shape type'
  })
  
  return shape
} 