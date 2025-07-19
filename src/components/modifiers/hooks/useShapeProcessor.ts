import { useMemo, useCallback } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId, type TLShapeId } from 'tldraw'
import { ModifierStack, extractShapesFromState } from '../../../store/modifiers'
import type { TLModifier, ShapeInstance } from '../../../types/modifiers'
import { 
  getShapeDimensions,
  logShapeOperation 
} from '../utils'

interface UseShapeProcessorProps {
  shape: TLShape
  modifiers: TLModifier[]
}

interface ProcessedShapeResult {
  processedShapes: TLShapePartial[]
  shapeKey: string
  modifiersKey: string
}

/**
 * Custom hook for processing shapes with modifiers
 * Extracts the shape processing logic from StackedModifier
 */
export function useShapeProcessor({ shape, modifiers }: UseShapeProcessorProps): ProcessedShapeResult {
  const editor = useEditor()
  
  // Create stable dependency keys to avoid infinite loops
  const shapeKey = `${shape.id}-${shape.x}-${shape.y}-${shape.rotation}-${JSON.stringify(shape.props)}`
  const modifiersKey = modifiers.map(m => `${m.id}-${m.enabled}-${JSON.stringify(m.props)}`).join('|')
  
  // Create a stable callback for processing modifiers
  const getProcessedShapes = useCallback(() => {
    logShapeOperation('useShapeProcessor', shape.id, {
      shapeType: shape.type,
      modifierCount: modifiers.filter(m => m.enabled).length,
      modifiers: modifiers.map(m => ({ type: m.type, enabled: m.enabled }))
    })
    
    if (!modifiers.length) return []
    
    const result = ModifierStack.processModifiers(shape, modifiers, editor)
    const shapes = extractShapesFromState(result)
    
    logShapeOperation('useShapeProcessor Result', shape.id, {
      instances: result.instances.length,
      extractedShapes: shapes.length,
      isGroupModifier: result.metadata?.isGroupModifier
    })
    
    // Convert to TLShapePartial for tldraw, including all shapes (original is now positioned in the array)
    return shapes.map((processedShape, index) => {
      const cloneId = createShapeId()
      
      // Get the corresponding instance with metadata from the result
      const instance = result.instances[index]
      
      // Handle mirrored shapes specially
      if (instance?.metadata?.isMirrored && processedShape.meta?.isMirrored) {
        return createMirroredShape(processedShape, instance, cloneId, index, modifiers)
      } else {
        return createRegularShape(processedShape, cloneId, index, modifiers)
      }
    })
  }, [shapeKey, modifiersKey, editor])
  
  // Process all modifiers using the stable callback
  const processedShapes = useMemo(() => {
    return getProcessedShapes()
  }, [getProcessedShapes])

  return {
    processedShapes,
    shapeKey,
    modifiersKey
  }
}

/**
 * Create a mirrored shape with proper position adjustments
 */
function createMirroredShape(
  processedShape: TLShape,
  instance: ShapeInstance,
  cloneId: TLShapeId,
  index: number,
  modifiers: TLModifier[]
): TLShapePartial {
  // For mirrored shapes, we need to adjust the position to account for the flipping
  let adjustedX = processedShape.x
  let adjustedY = processedShape.y
  
  // Get the shape dimensions using utility function
  const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(processedShape)
  
  // Adjust position based on the flip direction
  if (processedShape.meta.isFlippedX) {
    // For horizontal flip, adjust X position to account for the shape's width
    adjustedX = processedShape.x - shapeWidth
  }
  
  if (processedShape.meta.isFlippedY) {
    // For vertical flip, adjust Y position to account for the shape's height  
    adjustedY = processedShape.y - shapeHeight
  }
  
  logShapeOperation('Mirrored Shape Position', cloneId, {
    original: { x: processedShape.x, y: processedShape.y },
    adjusted: { x: adjustedX, y: adjustedY },
    flips: { x: processedShape.meta.isFlippedX, y: processedShape.meta.isFlippedY },
    shapeDims: { w: shapeWidth, h: shapeHeight },
    rotations: {
      originalShapeRotation: processedShape.rotation,
      processedShapeRotation: processedShape.rotation,
      instanceRotation: instance?.transform?.rotation
    }
  })
  
  return {
    id: cloneId,
    type: processedShape.type,
    x: adjustedX,
    y: adjustedY,
    rotation: processedShape.rotation, // Use the processed rotation from modifier stack
    isLocked: true,
    opacity: 0, // Hide the original mirrored shape - visual will be handled by overlay
    props: { ...processedShape.props },
    meta: {
      ...processedShape.meta,
      isArrayClone: true,
      originalShapeId: processedShape.id,
      arrayIndex: index,
      stackProcessed: true,
      modifierCount: modifiers.filter(m => m.enabled).length,
      isMirrored: true,
      mirrorAxis: processedShape.meta.mirrorAxis,
      // Store the flipping information for potential future use
      isFlippedX: processedShape.meta.isFlippedX,
      isFlippedY: processedShape.meta.isFlippedY
    }
  }
}

/**
 * Create a regular (non-mirrored) shape
 */
function createRegularShape(
  processedShape: TLShape,
  cloneId: TLShapeId,
  index: number,
  modifiers: TLModifier[]
): TLShapePartial {
  const cloneShape: TLShapePartial = {
    id: cloneId,
    type: processedShape.type,
    x: processedShape.x,
    y: processedShape.y,
    rotation: processedShape.rotation,
    isLocked: true,
    opacity: processedShape.meta?.isFirstClone ? 0 : (processedShape.opacity || 1) * 0.75,
    props: { ...processedShape.props }, // Use processed shape props instead of original
    meta: {
      ...processedShape.meta,
      isArrayClone: true,
      originalShapeId: processedShape.id,
      arrayIndex: index,
      stackProcessed: true,
      modifierCount: modifiers.filter(m => m.enabled).length
    }
  }

  logShapeOperation('Regular Clone', cloneId, {
    index: index,
    shapeType: processedShape.type,
    opacity: cloneShape.opacity,
    position: { x: processedShape.x, y: processedShape.y }
  })

  return cloneShape
} 