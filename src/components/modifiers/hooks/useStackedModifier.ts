import { useMemo, useRef } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId, type TLShapeId } from 'tldraw'
import { TransformComposer, extractShapesFromState } from '../../../store/modifiers'
import type { TLModifier, GroupContext } from '../../../types/modifiers'
import {
  logShapeOperation,
  findTopLevelGroup,
  getGroupPageBounds,
  getGroupChildShapes
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

  // Memoize shape signature for stable dependencies
  const shapeSignature = useMemo(() => {
    return `${shape.id}-${shape.x}-${shape.y}-${shape.rotation}-${JSON.stringify(shape.props)}`
  }, [shape.id, shape.x, shape.y, shape.rotation, shape.props])

  // Memoize modifier signature for stable dependencies
  const modifierSignature = useMemo(() => {
    return modifiers.map(m => `${m.id}-${m.enabled}-${m.order}-${JSON.stringify(m.props)}`).join('|')
  }, [modifiers])


  
  
  // Optimize processing with better memoization strategy using stable signatures
  const processedShapes = useMemo(() => {
    try {
      console.log(`[useStackedModifier] Processing ${shape.id} with ${modifiers.length} modifiers, signature: ${modifierSignature.substring(0, 50)}...`)

      logShapeOperation('useStackedModifier', shape.id, {
        shapeType: shape.type,
        modifierCount: modifiers.filter(m => m.enabled).length,
        modifiers: modifiers.map(m => ({ type: m.type, enabled: m.enabled })),
        shapeSignature,
        modifierSignature
      })

      if (!modifiers.length) {
        console.log(`[useStackedModifier] No modifiers for ${shape.id}`)
        return []
      }

      // Create group context if needed
      const parentGroup = findTopLevelGroup(shape, editor)
      let groupContext: GroupContext | undefined = undefined

      if (parentGroup) {
        const childShapes = getGroupChildShapes(parentGroup, editor)
        const groupBounds = getGroupPageBounds(parentGroup, editor)

        groupContext = {
          groupCenter: { x: groupBounds.centerX, y: groupBounds.centerY },
          groupTopLeft: { x: groupBounds.minX, y: groupBounds.minY },
          groupShapes: childShapes,
          groupBounds: {
            minX: groupBounds.minX,
            maxX: groupBounds.maxX,
            minY: groupBounds.minY,
            maxY: groupBounds.maxY,
            width: groupBounds.width,
            height: groupBounds.height,
            centerX: groupBounds.centerX,
            centerY: groupBounds.centerY
          },
          groupTransform: {
            x: parentGroup.x,
            y: parentGroup.y,
            rotation: parentGroup.rotation || 0
          }
        }
      }

      const result = TransformComposer.processModifiers(shape, modifiers, groupContext)
      const shapes = extractShapesFromState(result)

      if (!result || !shapes) {
        console.warn(`Modifier processing returned no valid shapes for ${shape.id}`)
        return []
      }

      logShapeOperation('useStackedModifier Result', shape.id, {
        instances: result.virtualInstances.length,
        extractedShapes: shapes.length,
        isGroupModifier: result.metadata?.isGroupModifier
      })

      // Convert to TLShapePartial for tldraw, including all shapes
      const shapePartials = shapes.map((processedShape, index) => {
        const cloneId = createShapeId()

        // All shapes are now created the same way since flipping is done in shape data
        return createRegularShape(processedShape, cloneId, index, modifiers, shape.id)
      })

      console.log(`[useStackedModifier] Created ${shapePartials.length} processed shapes for ${shape.id}`)
      return shapePartials
    } catch (error) {
      console.error('Error in modifier processing:', error, {
        shapeId: shape.id,
        shapeType: shape.type,
        modifiers: modifiers.map(m => ({ type: m.type, enabled: m.enabled })),
        shapeSignature,
        modifierSignature
      })
      // Return empty array to gracefully handle the error
      return []
    }
  }, [editor, shapeSignature, modifierSignature])
  
  // Remove redundant useMemo wrapper since we already memoized above

  // Create a stable shapeKey for use by consumers - use signature to avoid recalculation
  const shapeKey = useMemo(() => {
    return shapeSignature
  }, [shapeSignature])

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
  modifiers: TLModifier[],
  originalShapeId: string
): TLShapePartial {
  // All remaining modifiers are array modifiers (no path modifiers left)
  
  const cloneShape: TLShapePartial = {
    id: cloneId,
    type: processedShape.type,
    x: processedShape.x,
    y: processedShape.y,
    rotation: processedShape.rotation,
    // Array modifiers should be locked
    isLocked: true,
    // Array modifiers are semi-transparent
    opacity: processedShape.meta?.isFirstClone ? 0 : (processedShape.opacity || 1) * 0.75,
    props: { ...processedShape.props }, // Use processed shape props instead of original
    meta: {
      ...processedShape.meta,
      isArrayClone: true, // All remaining modifiers are array modifiers
      isPathModified: false,
      originalShapeId: originalShapeId,
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