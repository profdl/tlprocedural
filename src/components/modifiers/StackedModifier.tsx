import { useMemo, useEffect } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId } from 'tldraw'
import { ModifierStack, extractShapesFromState } from '../../store/modifierStack'
import type { TLModifier } from '../../types/modifiers'
import { 
  getOriginalShapeId, 
  getShapeDimensions,
  logShapeOperation 
} from './utils/shapeUtils'

interface StackedModifierProps {
  shape: TLShape
  modifiers: TLModifier[]
}

export function StackedModifier({ shape, modifiers }: StackedModifierProps) {
  const editor = useEditor()
  
  // Create stable dependency keys to avoid infinite loops
  // We use stringified keys instead of object references to prevent infinite re-renders
  // while still tracking all relevant changes
  const shapeKey = `${shape.id}-${shape.x}-${shape.y}-${shape.rotation}-${JSON.stringify(shape.props)}`
  const modifiersKey = modifiers.map(m => `${m.id}-${m.enabled}-${JSON.stringify(m.props)}`).join('|')
  
  // Process all modifiers using ModifierStack
  const processedShapes = useMemo(() => {
    logShapeOperation('StackedModifier', shape.id, {
      modifierCount: modifiers.length,
      modifiers: modifiers.map(m => ({ type: m.type, enabled: m.enabled }))
    })
    
    if (!modifiers.length) return []
    
    const result = ModifierStack.processModifiers(shape, modifiers)
    const shapes = extractShapesFromState(result)
    
    logShapeOperation('StackedModifier Result', shape.id, {
      instances: result.instances.length,
      extractedShapes: shapes.length
    })
    
    // Convert to TLShapePartial for tldraw, including all shapes (original is now positioned in the array)
    return shapes.map((processedShape, index) => {
      const cloneId = createShapeId()
      
      // Get the corresponding instance with metadata from the result
      const instance = result.instances[index]
      
      // Handle mirrored shapes specially
      if (instance?.metadata?.isMirrored && processedShape.meta?.isMirrored) {
        // For mirrored shapes, we need to adjust the position to account for the flipping
        let adjustedX = processedShape.x
        let adjustedY = processedShape.y
        
        // Get the shape dimensions using utility function
        const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(shape)
        
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
            originalShapeRotation: shape.rotation,
            processedShapeRotation: processedShape.rotation,
            instanceRotation: instance?.transform?.rotation
          }
        })
        
        const cloneShape: TLShapePartial = {
          id: cloneId,
          type: shape.type,
          x: adjustedX,
          y: adjustedY,
          rotation: processedShape.rotation, // Use the processed rotation from modifier stack
          isLocked: true,
          opacity: 0, // Hide the original mirrored shape - visual will be handled by overlay
          props: { ...shape.props },
          meta: {
            ...shape.meta,
            isArrayClone: true,
            originalShapeId: shape.id,
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
        
        return cloneShape
      } else {
        // Handle non-mirrored shapes normally
        const cloneShape: TLShapePartial = {
          id: cloneId,
          type: shape.type,
          x: processedShape.x,
          y: processedShape.y,
          rotation: processedShape.rotation,
          isLocked: true,
          opacity: processedShape.meta?.isFirstClone ? 0 : (shape.opacity || 1) * 0.75,
          props: { ...processedShape.props }, // Use processed shape props instead of original
          meta: {
            ...shape.meta,
            isArrayClone: true,
            originalShapeId: shape.id,
            arrayIndex: index,
            stackProcessed: true,
            modifierCount: modifiers.filter(m => m.enabled).length
          }
        }

        logShapeOperation('Stacked Clone', cloneId, {
          index: index,
          shapeType: shape.type,
          opacity: cloneShape.opacity,
          position: { x: processedShape.x, y: processedShape.y }
        })

        return cloneShape
      }
    })
  }, [shapeKey, modifiersKey])

  // Create and manage shape clones
  useEffect(() => {
    if (!editor) return

    logShapeOperation('StackedModifier Effect', shape.id, {
      processedShapes: processedShapes.length
    })

    // Clean up existing clones for this shape
    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id && s.meta?.stackProcessed
    })

    logShapeOperation('StackedModifier Cleanup', shape.id, {
      existingClones: existingClones.length
    })

    // Delete existing clones
    if (existingClones.length > 0) {
      editor.run(() => {
        editor.deleteShapes(existingClones.map((s: TLShape) => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }

    // Move the original shape to the first array position and make the first clone transparent
    if (processedShapes.length > 0) {
      // Find the first clone to get its position
      const firstClone = processedShapes.find(s => s.meta?.isFirstClone)
      if (firstClone) {
        editor.run(() => {
          // Move the original shape to the first array position
          editor.updateShape({
            id: shape.id,
            type: shape.type,
            x: firstClone.x,
            y: firstClone.y,
            rotation: firstClone.rotation
          })
          
          // Make the first clone transparent since it's now redundant
          editor.updateShape({
            id: firstClone.id,
            type: firstClone.type,
            opacity: 0
          })
        }, { history: 'ignore' })
      }
    }

    // Create new clones if we have processed shapes
    if (processedShapes.length > 0) {
      logShapeOperation('StackedModifier Create', shape.id, {
        newClones: processedShapes.length
      })
      
      editor.run(() => {
        editor.createShapes(processedShapes)
      }, { history: 'ignore' })
    }

    // Cleanup function
    return () => {
      if (!editor) return
      
      const clonesToCleanup = editor.getCurrentPageShapes().filter((s: TLShape) => {
        const originalId = getOriginalShapeId(s)
        return originalId === shape.id && s.meta?.stackProcessed
      })

      if (clonesToCleanup.length > 0) {
        editor.run(() => {
          editor.deleteShapes(clonesToCleanup.map((s: TLShape) => s.id))
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
    }
  }, [editor, shapeKey, processedShapes.length])

  // Update existing clones when original shape changes (second effect for live updates)
  useEffect(() => {
    if (!editor || !processedShapes.length) return
    
    console.log('StackedModifier: Live update triggered for shape:', shape.id, {
      shapeProps: shape.props,
      modifierProps: modifiers.map(m => ({ type: m.type, props: m.props }))
    })

    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id && s.meta?.stackProcessed
    })

    if (existingClones.length > 0) {
      // Recalculate positions based on current shape state
      const result = ModifierStack.processModifiers(shape, modifiers)
      const updatedShapes = extractShapesFromState(result)
      
      // Update existing clones with new positions
      const updatedClones = existingClones.map((clone: TLShape) => {
        const cloneIndex = clone.meta?.arrayIndex as number
        const updatedShape = updatedShapes.find(s => s.meta?.arrayIndex === cloneIndex)
        
        if (!updatedShape) return null

        return {
          id: clone.id,
          type: shape.type,
          x: updatedShape.x,
          y: updatedShape.y,
          rotation: updatedShape.rotation,
          props: { ...updatedShape.props }
        }
      }).filter(Boolean) as TLShapePartial[]

      if (updatedClones.length > 0) {
        editor.run(() => {
          editor.updateShapes(updatedClones)
        }, { ignoreShapeLock: true, history: 'ignore' })
        
        console.log('StackedModifier: Updated clones with new style properties:', {
          shapeId: shape.id,
          updatedClones: updatedClones.length,
          hasStyleChanges: true
        })
      }
    }
  }, [editor, shapeKey, modifiersKey])

  // This component doesn't render anything visible - shapes are managed directly in the editor
  return null
} 