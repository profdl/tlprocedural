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
  editor?: Editor
): Position {
  // Get shape dimensions
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)
  
  // Convert percentage offsets to pixel values based on shape width
  const pixelOffsetX = (offsetX / 100) * shapeWidth
  const pixelOffsetY = (offsetY / 100) * shapeHeight
  
  // When the shape is rotated, we need to calculate from the visual center
  // not the top-left corner which moves when rotated
  const shapeRotation = originalShape.rotation || 0
  
  if (editor && shapeRotation !== 0) {
    // Get the shape's center in page space (accounting for rotation)
    const bounds = editor.getShapePageBounds(originalShape.id)
    if (bounds) {
      // Calculate from the center of the rotated shape
      const centerX = bounds.x + bounds.width / 2
      const centerY = bounds.y + bounds.height / 2
      
      // Apply offset from center, then convert back to top-left for the clone
      const cloneCenterX = centerX + (pixelOffsetX * index)
      const cloneCenterY = centerY + (pixelOffsetY * index)
      
      // Convert back to top-left position for the clone
      const finalX = cloneCenterX - shapeWidth / 2
      const finalY = cloneCenterY - shapeHeight / 2
      
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
  }
  
  // Fallback to original calculation if no rotation or no editor
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
  editor?: Editor
): Position {
  // Calculate angle for this position on the circle
  const totalAngle = endAngle - startAngle
  const angleStep = count > 1 ? totalAngle / (count - 1) : 0
  const angle = degreesToRadians(startAngle + (angleStep * index))
  
  // Get shape dimensions for center calculations
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)
  const shapeRotation = originalShape.rotation || 0
  
  let baseX = originalShape.x
  let baseY = originalShape.y
  
  // When the shape is rotated, calculate from its visual center
  if (editor && shapeRotation !== 0) {
    const bounds = editor.getShapePageBounds(originalShape.id)
    if (bounds) {
      // Use the center of the rotated shape as base
      const shapeCenterX = bounds.x + bounds.width / 2
      const shapeCenterY = bounds.y + bounds.height / 2
      // Convert back to top-left for positioning
      baseX = shapeCenterX - shapeWidth / 2
      baseY = shapeCenterY - shapeHeight / 2
    }
  }
  
  // Calculate offset from base position
  const offsetX = centerX + Math.cos(angle) * radius
  const offsetY = centerY + Math.sin(angle) * radius
  
  // Apply offset to base position
  const finalX = baseX + offsetX
  const finalY = baseY + offsetY
  
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
  editor?: Editor
): Position {
  const shapeRotation = originalShape.rotation || 0
  let baseX = originalShape.x
  let baseY = originalShape.y
  
  // When the shape is rotated, calculate from its visual center
  if (editor && shapeRotation !== 0) {
    const bounds = editor.getShapePageBounds(originalShape.id)
    if (bounds) {
      const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)
      // Use the center of the rotated shape as base
      const shapeCenterX = bounds.x + bounds.width / 2
      const shapeCenterY = bounds.y + bounds.height / 2
      // Convert back to top-left for positioning
      baseX = shapeCenterX - shapeWidth / 2
      baseY = shapeCenterY - shapeHeight / 2
    }
  }
  
  const x = baseX + offsetX + (col * spacingX)
  const y = baseY + offsetY + (row * spacingY)
  
  return {
    x,
    y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  }
}


