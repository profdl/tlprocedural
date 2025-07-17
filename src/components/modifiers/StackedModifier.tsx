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
      
      const cloneShape: TLShapePartial = {
        id: cloneId,
        type: shape.type,
        x: processedShape.x,
        y: processedShape.y,
        rotation: processedShape.rotation,
        isLocked: true,
        opacity: (shape.opacity || 1) * 0.75, // Slightly more transparent for stacked results
        props: { ...shape.props },
        meta: {
          ...shape.meta,
          isArrayClone: true,
          originalShapeId: shape.id,
          arrayIndex: index + 1,
          stackProcessed: true, // Mark as processed by stack
          modifierCount: modifiers.filter(m => m.enabled).length // Track how many modifiers were applied
        }
      }

      // Handle scaling for shapes that support it
      if ('w' in shape.props && 'h' in shape.props) {
        // We can access transform data from the processed shape if needed
        cloneShape.props = {
          ...cloneShape.props,
          w: shape.props.w, // For now, keep original size
          h: shape.props.h  // We'll add scaling support later
        }
      }

      return cloneShape
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