import type { TLShape } from 'tldraw'
import { createShapeId } from 'tldraw'
import { getShapeDimensions } from './shapeDimensions'
import { logShapeOperation } from './debugUtils'

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
  count: number
): Position {
  // Get shape dimensions for center calculations
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)
  
  // Calculate the center of the original shape
  const originalCenterX = originalShape.x + shapeWidth / 2
  const originalCenterY = originalShape.y + shapeHeight / 2
  
  // Convert percentage offsets to pixel values based on shape width
  const pixelOffsetX = (offsetX / 100) * shapeWidth
  const pixelOffsetY = (offsetY / 100) * shapeHeight
  
  // Calculate rotation in radians for this clone
  const rotationRadians = degreesToRadians(rotation * index)
  
  // Calculate the offset from the original center
  const offsetFromCenterX = pixelOffsetX * index
  const offsetFromCenterY = pixelOffsetY * index
  
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
  
  // Calculate scale using linear interpolation from original (1.0) to final scale
  const progress = index / (count - 1) // 0 for first clone, 1 for last clone
  const interpolatedScale = 1 + (scaleStep - 1) * progress
  const scaleX = interpolatedScale
  const scaleY = interpolatedScale
  
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