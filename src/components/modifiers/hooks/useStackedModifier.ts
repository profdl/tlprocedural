import { useMemo, useCallback } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId, type TLShapeId } from 'tldraw'
import { ModifierStack, extractShapesFromState } from '../../../store/modifiers'
import { isPathModifierType } from '../../../store/modifiers/core/PathModifier'
import type { TLModifier } from '../../../types/modifiers'
import { 
  logShapeOperation 
} from '../utils'

interface UseStackedModifierProps {
  shape: TLShape
  modifiers: TLModifier[]
}

interface ProcessedShapeResult {
  processedShapes: TLShapePartial[]
  shapeKey: string
  modifiersKey: string
}

/**
 * Custom hook for processing shapes with modifiers in StackedModifier
 * Extracts the shape processing logic from StackedModifier
 */
export function useStackedModifier({ shape, modifiers }: UseStackedModifierProps): ProcessedShapeResult {
  const editor = useEditor()
  
  // Create stable dependency keys to avoid infinite loops
  const shapeKey = `${shape.id}-${shape.x}-${shape.y}-${shape.rotation}-${JSON.stringify(shape.props)}`
  const modifiersKey = modifiers.map(m => `${m.id}-${m.enabled}-${JSON.stringify(m.props)}`).join('|')
  
  
  // Create a stable callback for processing modifiers
  const getProcessedShapes = useCallback(() => {
    logShapeOperation('useStackedModifier', shape.id, {
      shapeType: shape.type,
      modifierCount: modifiers.filter(m => m.enabled).length,
      modifiers: modifiers.map(m => ({ type: m.type, enabled: m.enabled }))
    })
    
    if (!modifiers.length) return []
    
    const result = ModifierStack.processModifiers(shape, modifiers, editor)
    const shapes = extractShapesFromState(result)
    
    logShapeOperation('useStackedModifier Result', shape.id, {
      instances: result.instances.length,
      extractedShapes: shapes.length,
      isGroupModifier: result.metadata?.isGroupModifier
    })
    
    
    // Convert to TLShapePartial for tldraw, including all shapes
    const shapePartials = shapes.map((processedShape, index) => {
      const cloneId = createShapeId()
      
      // All shapes are now created the same way since flipping is done in shape data
      return createRegularShape(processedShape, cloneId, index, modifiers)
    })
    
    return shapePartials
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
 * Create a regular (non-mirrored) shape
 */
function createRegularShape(
  processedShape: TLShape,
  cloneId: TLShapeId,
  index: number,
  modifiers: TLModifier[]
): TLShapePartial {
  // Check if this is from path modifiers - they should not be locked
  const hasPathModifiers = modifiers.some(m => m.enabled && isPathModifierType(m.type))
  const hasOnlyPathModifiers = modifiers.every(m => !m.enabled || isPathModifierType(m.type))
  
  const cloneShape: TLShapePartial = {
    id: cloneId,
    type: processedShape.type,
    x: processedShape.x,
    y: processedShape.y,
    rotation: processedShape.rotation,
    // Path modifiers with single output should not be locked, array modifiers should be
    isLocked: hasOnlyPathModifiers ? false : true,
    // Path modifiers show full opacity, array modifiers are semi-transparent
    opacity: hasOnlyPathModifiers ? (processedShape.opacity || 1) : 
             (processedShape.meta?.isFirstClone ? 0 : (processedShape.opacity || 1) * 0.75),
    props: { ...processedShape.props }, // Use processed shape props instead of original
    meta: {
      ...processedShape.meta,
      isArrayClone: !hasOnlyPathModifiers, // Path-only modifiers are not array clones
      isPathModified: hasPathModifiers,
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