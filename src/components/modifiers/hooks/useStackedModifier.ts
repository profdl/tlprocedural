import { useMemo, useRef } from 'react'
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
}

/**
 * Custom hook for processing shapes with modifiers in StackedModifier
 * Extracts the shape processing logic from StackedModifier
 */
export function useStackedModifier({ shape, modifiers }: UseStackedModifierProps): ProcessedShapeResult {
  const editor = useEditor()

  // Use refs to store stable references
  const shapeRef = useRef(shape)
  const modifiersRef = useRef(modifiers)

  // Update refs on each render but memoize expensive computations
  shapeRef.current = shape
  modifiersRef.current = modifiers

  // Memoize shape dimensions separately to avoid repeated type casting
  const shapeDimensions = useMemo(() => {
    const props = shape.props as { w?: number; h?: number }
    return { w: props.w || 0, h: props.h || 0 }
  }, [shape.props])

  // Create stable dependency keys using primitive values only
  const shapeKey = useMemo(() => {
    return `${shape.id}-${shape.x}-${shape.y}-${shape.rotation}-${shapeDimensions.w}-${shapeDimensions.h}`
  }, [shape.id, shape.x, shape.y, shape.rotation, shapeDimensions.w, shapeDimensions.h])

  // Optimize modifier key generation with primitive dependencies
  const modifiersKey = useMemo(() => {
    const enabledIds: string[] = []
    const enabledTypes: string[] = []

    for (const mod of modifiers) {
      if (mod.enabled) {
        enabledIds.push(mod.id)
        enabledTypes.push(mod.type)
      }
    }

    return `${enabledIds.join(',')}-${enabledTypes.join(',')}`
  }, [modifiers.map(m => m.enabled ? `${m.id}:${m.type}` : '').filter(Boolean).join(',')])
  
  
  // Optimize processing with better memoization strategy
  const processedShapes = useMemo(() => {
    try {
      const currentShape = shapeRef.current
      const currentModifiers = modifiersRef.current

      logShapeOperation('useStackedModifier', currentShape.id, {
        shapeType: currentShape.type,
        modifierCount: currentModifiers.filter(m => m.enabled).length,
        modifiers: currentModifiers.map(m => ({ type: m.type, enabled: m.enabled }))
      })

      if (!currentModifiers.length) return []

      const result = ModifierStack.processModifiers(currentShape, currentModifiers, editor)
      const shapes = extractShapesFromState(result)

      if (!result || !shapes) {
        console.warn(`Modifier processing returned no valid shapes for ${currentShape.id}`)
        return []
      }

      logShapeOperation('useStackedModifier Result', currentShape.id, {
        instances: result.instances.length,
        extractedShapes: shapes.length,
        isGroupModifier: result.metadata?.isGroupModifier
      })

      // Convert to TLShapePartial for tldraw, including all shapes
      const shapePartials = shapes.map((processedShape, index) => {
        const cloneId = createShapeId()

        // All shapes are now created the same way since flipping is done in shape data
        return createRegularShape(processedShape, cloneId, index, currentModifiers)
      })

      return shapePartials
    } catch (error) {
      console.error('Error in modifier processing:', error, {
        shapeId: shapeRef.current.id,
        shapeType: shapeRef.current.type,
        modifiers: modifiersRef.current.map(m => ({ type: m.type, enabled: m.enabled }))
      })
      // Return empty array to gracefully handle the error
      return []
    }
  }, [editor, shapeKey, modifiersKey])
  
  // Remove redundant useMemo wrapper since we already memoized above

  return {
    processedShapes,
    shapeKey
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