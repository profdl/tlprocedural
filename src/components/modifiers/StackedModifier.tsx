import { useMemo, useEffect } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId } from 'tldraw'
import { ModifierStack, extractShapesFromState } from '../../store/modifierStack'
import type { TLModifier } from '../../types/modifiers'
import { isArrayClone, getOriginalShapeId } from './LinearArrayModifier'

interface StackedModifierProps {
  shape: TLShape
  modifiers: TLModifier[]
}

export function StackedModifier({ shape, modifiers }: StackedModifierProps) {
  const editor = useEditor()
  
  // Process all modifiers using ModifierStack
  const processedShapes = useMemo(() => {
    if (!modifiers.length) return []
    
    const result = ModifierStack.processModifiers(shape, modifiers)
    const shapes = extractShapesFromState(result)
    
    // Convert to TLShapePartial for tldraw, excluding the original (first shape)
    return shapes.slice(1).map((processedShape, index) => {
      const cloneId = createShapeId()
      
      // Get the corresponding instance with metadata from the result
      const instanceIndex = index + 1 // Skip original shape
      const instance = result.instances[instanceIndex]
      
      // Handle mirrored shapes specially
      if (instance?.metadata?.isMirrored && processedShape.meta?.isMirrored) {
        // For mirrored shapes, we need to adjust the position to account for the flipping
        let adjustedX = processedShape.x
        let adjustedY = processedShape.y
        
        // Get the shape dimensions
        const shapeWidth = 'w' in shape.props ? (shape.props.w as number) : 100
        const shapeHeight = 'h' in shape.props ? (shape.props.h as number) : 100
        
        // Adjust position based on the flip direction
        if (processedShape.meta.isFlippedX) {
          // For horizontal flip, adjust X position to account for the shape's width
          adjustedX = processedShape.x - shapeWidth
        }
        
        if (processedShape.meta.isFlippedY) {
          // For vertical flip, adjust Y position to account for the shape's height  
          adjustedY = processedShape.y - shapeHeight
        }
        
        console.log(`Adjusting mirrored shape position:`, {
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
            arrayIndex: index + 1,
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
          opacity: (shape.opacity || 1) * 0.75,
          props: { ...shape.props },
          meta: {
            ...shape.meta,
            isArrayClone: true,
            originalShapeId: shape.id,
            arrayIndex: index + 1,
            stackProcessed: true,
            modifierCount: modifiers.filter(m => m.enabled).length
          }
        }

        // Handle scaling for shapes that support it
        if ('w' in shape.props && 'h' in shape.props) {
          cloneShape.props = {
            ...cloneShape.props,
            w: shape.props.w,
            h: shape.props.h
          }
        }

        return cloneShape
      }
    })
  }, [shape, modifiers])

  // Create and manage shape clones
  useEffect(() => {
    if (!editor) return

    // Clean up existing clones for this shape
    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id && s.meta?.stackProcessed
    })

    // Delete existing clones
    if (existingClones.length > 0) {
      editor.run(() => {
        editor.deleteShapes(existingClones.map((s: TLShape) => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }

    // Create new clones if we have processed shapes
    if (processedShapes.length > 0) {
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
  }, [editor, shape, processedShapes])

  // This component doesn't render anything visible - shapes are managed directly in the editor
  return null
} 