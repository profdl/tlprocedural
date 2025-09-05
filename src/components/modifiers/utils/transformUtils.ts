import type { TLShape, Editor } from 'tldraw'
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
  count: number,
  editor?: Editor
): Position {
  // Get shape dimensions for center calculations
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)
  
  // Convert percentage offsets to pixel values based on shape width
  const pixelOffsetX = (offsetX / 100) * shapeWidth
  const pixelOffsetY = (offsetY / 100) * shapeHeight
  
  // Calculate rotation in radians for this clone
  const rotationRadians = degreesToRadians(rotation * index)
  
  // Calculate the offset from the original center
  const offsetFromCenterX = pixelOffsetX * index
  const offsetFromCenterY = pixelOffsetY * index
  
  // Calculate scale using linear interpolation from original (1.0) to final scale
  const progress = count > 1 ? index / (count - 1) : 0
  const interpolatedScale = 1 + (scaleStep - 1) * progress
  
  // Use TLDraw's transform system if editor is available
  if (editor) {
    return calculateLinearPositionWithTLDrawTransforms(
      originalShape,
      offsetFromCenterX,
      offsetFromCenterY,
      rotationRadians,
      interpolatedScale,
      editor
    )
  }
  
  // Fallback to manual calculation for backwards compatibility
  const originalCenterX = originalShape.x + shapeWidth / 2
  const originalCenterY = originalShape.y + shapeHeight / 2
  
  // Apply rotation to the offset around the center
  const cos = Math.cos(rotationRadians)
  const sin = Math.sin(rotationRadians)
  
  const rotatedOffsetX = offsetFromCenterX * cos - offsetFromCenterY * sin
  const rotatedOffsetY = offsetFromCenterX * sin + offsetFromCenterY * cos
  
  // Calculate the final center position after rotation
  const finalCenterX = originalCenterX + rotatedOffsetX
  const finalCenterY = originalCenterY + rotatedOffsetY
  
  // Convert back to top-left coordinates with TLDraw rotation compensation
  // TLDraw rotates around top-left, so we need to compensate to achieve center rotation
  // Reuse the cos/sin values calculated above
  
  // Calculate compensation for TLDraw's top-left rotation
  const rotationCompensationX = (shapeWidth / 2) * (cos - 1) - (shapeHeight / 2) * sin
  const rotationCompensationY = (shapeWidth / 2) * sin + (shapeHeight / 2) * (cos - 1)
  
  const finalX = finalCenterX - shapeWidth / 2 - rotationCompensationX
  const finalY = finalCenterY - shapeHeight / 2 - rotationCompensationY
  
  logShapeOperation('calculateLinearPosition', originalShape.id, {
    index,
    originalCenter: { x: originalCenterX, y: originalCenterY },
    offsetFromCenter: { x: offsetFromCenterX, y: offsetFromCenterY },
    rotationDegrees: rotation * index,
    rotationRadians,
    rotatedOffset: { x: rotatedOffsetX, y: rotatedOffsetY },
    finalPosition: { x: finalX, y: finalY },
    shapeDimensions: { width: shapeWidth, height: shapeHeight }
  })
  
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
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)
  
  // Calculate center position
  const centerPosX = originalShape.x + shapeWidth / 2 + centerX
  const centerPosY = originalShape.y + shapeHeight / 2 + centerY
  
  const totalAngle = endAngle - startAngle
  const angleStep = totalAngle / (count - 1)
  const angle = degreesToRadians(startAngle + (angleStep * (index - 1)))
  
  // Calculate position on circle
  const circleX = centerPosX + Math.cos(angle) * radius
  const circleY = centerPosY + Math.sin(angle) * radius
  
  let baseRotation = 0
  if (pointToCenter) {
    // For align to tangent, use the angle perpendicular to the radius (tangent direction)
    baseRotation = angle + Math.PI / 2
  }
  
  const rotateAllRadians = degreesToRadians(rotateAll || 0)
  const rotateEachRadians = degreesToRadians((rotateEach || 0) * index)
  const totalRotation = baseRotation + rotateAllRadians + rotateEachRadians
  
  // Convert back to top-left coordinates with TLDraw rotation compensation
  // TLDraw rotates around top-left, so we need to compensate to achieve center rotation
  const cosTotal = Math.cos(totalRotation)
  const sinTotal = Math.sin(totalRotation)
  
  // Calculate compensation for TLDraw's top-left rotation
  const rotationCompensationX = (shapeWidth / 2) * (cosTotal - 1) - (shapeHeight / 2) * sinTotal
  const rotationCompensationY = (shapeWidth / 2) * sinTotal + (shapeHeight / 2) * (cosTotal - 1)
  
  const x = circleX - shapeWidth / 2 - rotationCompensationX
  const y = circleY - shapeHeight / 2 - rotationCompensationY
  
  // Use TLDraw's transform system if editor is available
  if (editor) {
    return calculateCircularPositionWithTLDrawTransforms(
      originalShape,
      x,
      y,
      totalRotation,
      editor
    )
  }
  
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
  spacingY: number,
  editor?: Editor
): Position {
  const x = originalShape.x + offsetX + (col * spacingX)
  const y = originalShape.y + offsetY + (row * spacingY)
  
  // Use TLDraw's transform system if editor is available
  if (editor) {
    return calculateGridPositionWithTLDrawTransforms(
      originalShape,
      x,
      y,
      editor
    )
  }
  
  return {
    x,
    y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  }
}

/**
 * TLDraw transform-based helper functions
 */

function calculateLinearPositionWithTLDrawTransforms(
  originalShape: TLShape,
  offsetX: number,
  offsetY: number,
  rotation: number,
  scale: number,
  editor: Editor
): Position {
  // Get shape page bounds for proper coordinate handling
  const pageBounds = editor.getShapePageBounds(originalShape.id)
  if (!pageBounds) {
    // Fallback if bounds not available
    return {
      x: originalShape.x + offsetX,
      y: originalShape.y + offsetY,
      rotation,
      scaleX: scale,
      scaleY: scale
    }
  }
  
  // Use the page bounds center for more accurate positioning
  const centerX = pageBounds.center.x
  const centerY = pageBounds.center.y
  
  // Apply rotation around the center
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const rotatedOffsetX = offsetX * cos - offsetY * sin
  const rotatedOffsetY = offsetX * sin + offsetY * cos
  
  // Calculate final center position
  const finalCenterX = centerX + rotatedOffsetX
  const finalCenterY = centerY + rotatedOffsetY
  
  // Convert back to top-left coordinates with TLDraw rotation compensation
  // TLDraw rotates around top-left, so we need to compensate to achieve center rotation
  const shapeWidth = pageBounds.width
  const shapeHeight = pageBounds.height
  
  // Calculate compensation for TLDraw's top-left rotation
  const rotationCompensationX = (shapeWidth / 2) * (cos - 1) - (shapeHeight / 2) * sin
  const rotationCompensationY = (shapeWidth / 2) * sin + (shapeHeight / 2) * (cos - 1)
  
  const finalX = finalCenterX - shapeWidth / 2 - rotationCompensationX
  const finalY = finalCenterY - shapeHeight / 2 - rotationCompensationY
  
  return {
    x: finalX,
    y: finalY,
    rotation,
    scaleX: scale,
    scaleY: scale
  }
}

function calculateCircularPositionWithTLDrawTransforms(
  _originalShape: TLShape,
  x: number,
  y: number,
  rotation: number,
  _editor: Editor
): Position {
  // For circular positioning, we already have the final coordinates calculated
  // TLDraw's transform system will handle the rotation properly when the shape is created
  return {
    x,
    y,
    rotation,
    scaleX: 1,
    scaleY: 1
  }
}

function calculateGridPositionWithTLDrawTransforms(
  _originalShape: TLShape,
  x: number,
  y: number,
  _editor: Editor
): Position {
  // Grid positioning is straightforward - just return the calculated coordinates
  return {
    x,
    y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1
  }
}

/**
 * Enhanced position calculation with proper coordinate space handling
 */
export function calculatePositionInPageSpace(
  shape: TLShape,
  offset: { x: number; y: number },
  editor: Editor
): { x: number; y: number } {
  const pageBounds = editor.getShapePageBounds(shape.id)
  if (!pageBounds) {
    return { x: shape.x + offset.x, y: shape.y + offset.y }
  }
  
  return {
    x: pageBounds.minX + offset.x,
    y: pageBounds.minY + offset.y
  }
}

/**
 * Convert local shape coordinates to page coordinates
 */
export function localToPageSpace(
  shape: TLShape,
  localPoint: { x: number; y: number },
  editor: Editor
): { x: number; y: number } {
  const pageBounds = editor.getShapePageBounds(shape.id)
  if (!pageBounds) {
    return { x: shape.x + localPoint.x, y: shape.y + localPoint.y }
  }
  
  return {
    x: pageBounds.minX + localPoint.x,
    y: pageBounds.minY + localPoint.y
  }
}

/**
 * Get shape center in page coordinates
 */
export function getShapeCenterInPageSpace(
  shape: TLShape,
  editor: Editor
): { x: number; y: number } {
  const pageBounds = editor.getShapePageBounds(shape.id)
  if (!pageBounds) {
    const { width, height } = getShapeDimensions(shape)
    return { x: shape.x + width / 2, y: shape.y + height / 2 }
  }
  
  return { x: pageBounds.center.x, y: pageBounds.center.y }
}