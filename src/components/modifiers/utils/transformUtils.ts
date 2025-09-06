import type { TLShape, Editor } from 'tldraw'
import { createShapeId } from 'tldraw'
import { getShapeDimensions } from './shapeDimensions'

/**
 * Clone utilities
 */
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

/**
 * Transform utilities
 */
export function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

export function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI
}

/**
 * Position calculation utilities
 */
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
  scaleStep: number,
  count: number,
  _editor?: Editor
): Position {
  // Get shape dimensions
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)
  
  // Convert percentage offsets to pixel values based on shape width
  const pixelOffsetX = (offsetX / 100) * shapeWidth
  const pixelOffsetY = (offsetY / 100) * shapeHeight
  
  // Calculate position directly - no coordinate system conversion needed
  // TLDraw will handle the rotation around the shape's center automatically
  const finalX = originalShape.x + (pixelOffsetX * index)
  const finalY = originalShape.y + (pixelOffsetY * index)
  
  // Calculate rotation for this index
  const rotationRadians = degreesToRadians(rotation * index)
  
  // Calculate scale using linear interpolation
  const progress = count > 1 ? index / (count - 1) : 0
  const interpolatedScale = 1 + (scaleStep - 1) * progress
  
  return {
    x: finalX,
    y: finalY,
    rotation: rotationRadians,
    scaleX: interpolatedScale,
    scaleY: interpolatedScale
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
  pointToCenter: boolean,
  count: number,
  _editor?: Editor
): Position {
  // Calculate angle for this position on the circle
  const totalAngle = endAngle - startAngle
  const angleStep = count > 1 ? totalAngle / (count - 1) : 0
  const angle = degreesToRadians(startAngle + (angleStep * index))
  
  // Calculate offset from original position - no center calculations
  const offsetX = centerX + Math.cos(angle) * radius
  const offsetY = centerY + Math.sin(angle) * radius
  
  // Apply offset directly to original shape position
  const finalX = originalShape.x + offsetX
  const finalY = originalShape.y + offsetY
  
  // Calculate rotation
  let baseRotation = 0
  if (pointToCenter) {
    // For align to tangent, use the angle perpendicular to the radius
    baseRotation = angle + Math.PI / 2
  }
  
  const rotateAllRadians = degreesToRadians(rotateAll || 0)
  const rotateEachRadians = degreesToRadians((rotateEach || 0) * index)
  const totalRotation = baseRotation + rotateAllRadians + rotateEachRadians
  
  return {
    x: finalX,
    y: finalY,
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
  spacingY: number,
  _editor?: Editor
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


