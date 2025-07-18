import { type TLShape, createShapeId } from 'tldraw'

// Shape dimension utilities
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

// Comprehensive scaling utility for different shape types
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

// Clone utilities
export function generateCloneId(): string {
  return createShapeId()
}

export function isArrayClone(shape: TLShape): boolean {
  return !!(shape.meta?.isArrayClone)
}

export function getOriginalShapeId(shape: TLShape): string | null {
  const originalId = shape.meta?.originalShapeId
  return typeof originalId === 'string' ? originalId : null
}

// Transform utilities
export function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

export function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI
}

// Position calculation utilities
export interface Position {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export function calculateLinearPosition(
  originalShape: TLShape,
  index: number,
  offsetX: number,
  offsetY: number,
  rotation: number,
  spacing: number,
  scaleStep: number
): Position {
  // Get shape dimensions for center calculations
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)
  
  // Calculate the center of the original shape
  const originalCenterX = originalShape.x + shapeWidth / 2
  const originalCenterY = originalShape.y + shapeHeight / 2
  
  // Apply spacing as a multiplier to the offset
  const spacedOffsetX = offsetX * spacing
  const spacedOffsetY = offsetY * spacing
  
  // Calculate rotation in radians for this clone
  const rotationRadians = degreesToRadians(rotation * index)
  
  // Calculate the offset from the original center
  const offsetFromCenterX = spacedOffsetX * index
  const offsetFromCenterY = spacedOffsetY * index
  
  // Apply rotation to the offset around the center
  const cos = Math.cos(rotationRadians)
  const sin = Math.sin(rotationRadians)
  
  const rotatedOffsetX = offsetFromCenterX * cos - offsetFromCenterY * sin
  const rotatedOffsetY = offsetFromCenterX * sin + offsetFromCenterY * cos
  
  // Calculate the final center position after rotation
  const finalCenterX = originalCenterX + rotatedOffsetX
  const finalCenterY = originalCenterY + rotatedOffsetY
  
  // IMPORTANT: Compensate for tldraw's rotation behavior
  // tldraw rotates around the top-left corner, so we need to adjust the position
  // to make it appear as if it's rotating around the center
  
  // Calculate how much the center moves when rotating around top-left
  const centerOffsetX = (shapeWidth / 2) * (cos - 1) - (shapeHeight / 2) * sin
  const centerOffsetY = (shapeWidth / 2) * sin + (shapeHeight / 2) * (cos - 1)
  
  // Adjust the final position to compensate for tldraw's rotation behavior
  const compensatedX = finalCenterX - shapeWidth / 2 - centerOffsetX
  const compensatedY = finalCenterY - shapeHeight / 2 - centerOffsetY
  
  const scaleX = 1 + (scaleStep - 1) * index
  const scaleY = 1 + (scaleStep - 1) * index
  
  // Debug logging for center-based rotation with compensation
  logShapeOperation('calculateLinearPosition', originalShape.id, {
    index,
    originalCenter: { x: originalCenterX, y: originalCenterY },
    offsetFromCenter: { x: offsetFromCenterX, y: offsetFromCenterY },
    rotationDegrees: rotation * index,
    rotationRadians,
    rotatedOffset: { x: rotatedOffsetX, y: rotatedOffsetY },
    finalCenter: { x: finalCenterX, y: finalCenterY },
    centerOffset: { x: centerOffsetX, y: centerOffsetY },
    finalPosition: { x: compensatedX, y: compensatedY },
    shapeDimensions: { width: shapeWidth, height: shapeHeight }
  })
  
  return {
    x: compensatedX,
    y: compensatedY,
    rotation: rotationRadians,
    scaleX,
    scaleY
  }
}

export function calculateCircularPosition(
  originalShape: TLShape,
  index: number,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  rotateEach: number,
  rotateAll: number,
  pointToCenter: boolean
): Position {
  const centerPosX = originalShape.x + centerX
  const centerPosY = originalShape.y + centerY
  
  const totalAngle = endAngle - startAngle
  const angleStep = totalAngle / (index - 1)
  const angle = degreesToRadians(startAngle + (angleStep * (index - 1)))
  
  const x = centerPosX + Math.cos(angle) * radius
  const y = centerPosY + Math.sin(angle) * radius
  
  let baseRotation = 0
  if (pointToCenter) {
    const angleFromCenter = Math.atan2(y - centerPosY, x - centerPosX)
    baseRotation = angleFromCenter + Math.PI
  }
  
  const rotateAllRadians = degreesToRadians(rotateAll || 0)
  const rotateEachRadians = degreesToRadians((rotateEach || 0) * index)
  const totalRotation = baseRotation + rotateAllRadians + rotateEachRadians
  
  return {
    x,
    y,
    rotation: totalRotation,
    scaleX: 1,
    scaleY: 1
  }
}

export function calculateGridPosition(
  originalShape: TLShape,
  row: number,
  col: number,
  offsetX: number,
  offsetY: number,
  spacingX: number,
  spacingY: number
): Position {
  const x = originalShape.x + offsetX + (col * spacingX)
  const y = originalShape.y + offsetY + (row * spacingY)
  
  return {
    x,
    y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  }
}

// Debug logging utility
export function logShapeOperation(
  operation: string,
  shapeId: string,
  details: Record<string, unknown>
): void {
  // In a browser environment, we can check if we're in development mode
  // by looking for a global variable or using a different approach
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`[${operation}] Shape ${shapeId}:`, details)
  }
} 