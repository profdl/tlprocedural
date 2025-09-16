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
 * Get the visual center of a shape, accounting for rotation
 * This is critical for properly positioning clones of rotated shapes
 */
export function getShapeVisualCenter(shape: TLShape, editor?: Editor): { x: number; y: number } {
  const shapeRotation = shape.rotation || 0

  if (editor && shapeRotation !== 0) {
    // For rotated shapes, use the actual visual center from bounds
    const bounds = editor.getShapePageBounds(shape.id)
    if (bounds) {
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
      }
    }
  }

  // For non-rotated shapes or when no editor available, calculate from shape dimensions
  const { width, height } = getShapeDimensions(shape)
  return {
    x: shape.x + width / 2,
    y: shape.y + height / 2
  }
}

/**
 * Get the top-left position for a shape with given center coordinates
 * Accounts for rotation by using visual bounds when available
 */
export function getTopLeftFromCenter(shape: TLShape, centerX: number, centerY: number): { x: number; y: number } {
  const { width, height } = getShapeDimensions(shape)
  return {
    x: centerX - width / 2,
    y: centerY - height / 2
  }
}

/**
 * Apply rotation to shapes using TLDraw's center-based rotation method
 * This ensures consistent rotation behavior matching the UI
 */
export function applyRotationToShapes(editor: Editor, shapeIds: string[], rotation: number): void {
  if (rotation !== 0 && shapeIds.length > 0) {
    editor.rotateShapesBy(shapeIds as import('tldraw').TLShapeId[], rotation)
  }
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

/**
 * Calculate orbital rotation around a center point
 * Used when source shape rotation should cause clones to orbit around the source center
 */
export function calculateOrbitalPosition(
  originalPosition: { x: number; y: number },
  centerPoint: { x: number; y: number },
  sourceRotation: number
): { x: number; y: number } {
  // Calculate offset from center
  const offsetX = originalPosition.x - centerPoint.x
  const offsetY = originalPosition.y - centerPoint.y

  // Apply rotation transform around center
  const cos = Math.cos(sourceRotation)
  const sin = Math.sin(sourceRotation)

  const rotatedOffsetX = offsetX * cos - offsetY * sin
  const rotatedOffsetY = offsetX * sin + offsetY * cos

  return {
    x: centerPoint.x + rotatedOffsetX,
    y: centerPoint.y + rotatedOffsetY
  }
}

export function calculateLinearPosition(
  originalShape: TLShape,
  index: number,
  offsetX: number,
  offsetY: number,
  rotationIncrement: number,
  rotateAll: number,
  scaleStep: number,
  count: number,
  editor?: Editor
): Position {
  // Get shape dimensions
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(originalShape)

  // Convert percentage offsets to pixel values based on shape width
  const pixelOffsetX = (offsetX / 100) * shapeWidth
  const pixelOffsetY = (offsetY / 100) * shapeHeight

  // Use shared utility to get visual center
  const { x: centerX, y: centerY } = getShapeVisualCenter(originalShape, editor)

  // Calculate base position with linear offset
  let cloneCenterX = centerX + (pixelOffsetX * index)
  let cloneCenterY = centerY + (pixelOffsetY * index)

  // If source shape is rotated, apply orbital rotation around source center
  const sourceRotation = originalShape.rotation || 0
  if (sourceRotation !== 0) {
    const basePosition = { x: cloneCenterX, y: cloneCenterY }
    const orbitalPosition = calculateOrbitalPosition(basePosition, { x: centerX, y: centerY }, sourceRotation)
    cloneCenterX = orbitalPosition.x
    cloneCenterY = orbitalPosition.y
  }

  // Convert back to top-left position for the clone
  const { x: finalX, y: finalY } = getTopLeftFromCenter(originalShape, cloneCenterX, cloneCenterY)

  // Calculate incremental rotation for this index
  const incrementalRotation = degreesToRadians(rotationIncrement * index)

  // Calculate uniform rotation applied to all clones
  const uniformRotation = degreesToRadians(rotateAll)

  // Total rotation is incremental + uniform
  const totalRotation = incrementalRotation + uniformRotation

  // Calculate scale using linear interpolation
  const progress = count > 1 ? index / (count - 1) : 0
  // Convert percentage scaleStep to decimal (50% -> 0.5, 100% -> 1.0)
  const scaleStepDecimal = scaleStep / 100
  const interpolatedScale = 1 + (scaleStepDecimal - 1) * progress

  return {
    x: finalX,
    y: finalY,
    rotation: totalRotation,
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
  // For full circles (360 degrees), distribute evenly without overlap
  // For partial arcs, use the original logic to include both endpoints
  const isFullCircle = Math.abs(totalAngle) >= 360
  const angleStep = count > 1 ? (isFullCircle ? totalAngle / count : totalAngle / (count - 1)) : 0
  const angle = degreesToRadians(startAngle + (angleStep * index))

  // Use shared utility to get the base position accounting for rotation
  const { x: shapeVisualCenterX, y: shapeVisualCenterY } = getShapeVisualCenter(originalShape, editor)
  const { x: baseX, y: baseY } = getTopLeftFromCenter(originalShape, shapeVisualCenterX, shapeVisualCenterY)

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
  // Use shared utility to get the base position accounting for rotation
  const { x: shapeVisualCenterX, y: shapeVisualCenterY } = getShapeVisualCenter(originalShape, editor)
  const { x: baseX, y: baseY } = getTopLeftFromCenter(originalShape, shapeVisualCenterX, shapeVisualCenterY)

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


