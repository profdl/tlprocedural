import type { TLShape, Editor } from 'tldraw'
import { getShapeBounds } from './shapeDimensions'

/**
 * Calculate the bounds of a group of shapes
 */
export function calculateGroupBounds(shapes: TLShape[]) {
  if (shapes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 }
  
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  
  shapes.forEach(shape => {
    const bounds = getShapeBounds(shape)
    minX = Math.min(minX, bounds.minX)
    maxX = Math.max(maxX, bounds.maxX)
    minY = Math.min(minY, bounds.minY)
    maxY = Math.max(maxY, bounds.maxY)
  })
  
  const width = maxX - minX
  const height = maxY - minY
  const centerX = minX + width / 2
  const centerY = minY + height / 2
  
  return { minX, maxX, minY, maxY, width, height, centerX, centerY }
}

/**
 * Find the top-level group that contains a shape
 */
export function findTopLevelGroup(shape: TLShape, editor: Editor): TLShape | null {
  let currentShape = shape
  let topGroup: TLShape | null = null
  
  while (currentShape.parentId) {
    const parent = editor.getShape(currentShape.parentId)
    if (parent && parent.type === 'group') {
      topGroup = parent
    }
    if (!parent) break
    currentShape = parent
  }
  
  return topGroup
}

/**
 * Calculate group bounds using TLDraw's built-in page bounds API
 */
export function calculateGroupBoundsWithTLDraw(shapes: TLShape[], editor: Editor) {
  const shapeIds = shapes.map(shape => shape.id)
  
  // Get page bounds for all shapes at once
  const allBounds = shapeIds.map(id => {
    const bounds = editor.getShapePageBounds(id)
    return bounds
  }).filter(Boolean)
  
  if (allBounds.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 }
  }
  
  // Calculate combined bounds
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  
  allBounds.forEach(bounds => {
    if (bounds) {
      minX = Math.min(minX, bounds.minX)
      maxX = Math.max(maxX, bounds.maxX)
      minY = Math.min(minY, bounds.minY)
      maxY = Math.max(maxY, bounds.maxY)
    }
  })
  
  const width = maxX - minX
  const height = maxY - minY
  const centerX = minX + width / 2
  const centerY = minY + height / 2
  
  return { minX, maxX, minY, maxY, width, height, centerX, centerY }
}

/**
 * Get the page bounds for a group shape using TLDraw's API
 */
export function getGroupPageBounds(groupShape: TLShape, editor: Editor) {
  const bounds = editor.getShapePageBounds(groupShape.id)
  if (!bounds) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 }
  }
  
  return {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: bounds.maxY,
    width: bounds.width,
    height: bounds.height,
    centerX: bounds.center.x,
    centerY: bounds.center.y
  }
}

/**
 * Get all child shapes of a group using TLDraw's API
 */
export function getGroupChildShapes(groupShape: TLShape, editor: Editor): TLShape[] {
  const descendantIds = editor.getShapeAndDescendantIds([groupShape.id])
  const allShapes = Array.from(descendantIds)
    .map(id => editor.getShape(id))
    .filter(Boolean) as TLShape[]
  
  // Filter out the group shape itself - we only want child shapes
  return allShapes.filter(shape => shape.id !== groupShape.id)
} 