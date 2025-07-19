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