import { useEffect } from 'react'
import { useEditor, type TLShape, type TLShapePartial, type Editor } from 'tldraw'
import { ModifierStack, extractShapesFromState } from '../../../store/modifiers'
import type { TLModifier } from '../../../types/modifiers'
import { 
  getOriginalShapeId,
  logShapeOperation 
} from '../utils'

interface UseCloneManagerProps {
  shape: TLShape
  modifiers: TLModifier[]
  processedShapes: TLShapePartial[]
  shapeKey: string
  modifiersKey: string
}

/**
 * Custom hook for managing shape clones in the editor
 * Extracts the clone management logic from StackedModifier
 */
export function useCloneManager({ 
  shape, 
  modifiers, 
  processedShapes, 
  shapeKey, 
  modifiersKey 
}: UseCloneManagerProps) {
  const editor = useEditor()

  // Create and manage shape clones
  useEffect(() => {
    if (!editor) return

    logShapeOperation('useCloneManager Effect', shape.id, {
      processedShapes: processedShapes.length
    })

    // Clean up existing clones for this shape
    cleanupExistingClones(editor, shape)

    // For group modifiers, also clean up clones of all shapes in the group
    if (shape.type === 'group' && processedShapes.length > 0) {
      cleanupGroupClones(editor, shape)
    }

    // Move the original shape to the first array position and make the first clone transparent
    // Only do this for non-group shapes
    if (processedShapes.length > 0 && shape.type !== 'group') {
      moveOriginalShapeToFirstPosition(editor, shape, processedShapes)
    }

    // Create new clones if we have processed shapes
    if (processedShapes.length > 0) {
      logShapeOperation('useCloneManager Create', shape.id, {
        newClones: processedShapes.length
      })
      
      editor.run(() => {
        // Create shapes with rotation set to 0, then rotate them properly
        const shapesToCreate = processedShapes.map(s => ({
          ...s,
          rotation: 0
        }))
        
        
        editor.createShapes(shapesToCreate)
        
        // Now rotate each shape around its center using TLDraw's API
        processedShapes.forEach((processedShape, index) => {
          if (processedShape.rotation && processedShape.rotation !== 0) {
            editor.rotateShapesBy([shapesToCreate[index].id], processedShape.rotation)
          }
        })
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

      // For group modifiers, also clean up clones of all shapes in the group during cleanup
      if (shape.type === 'group') {
        cleanupGroupClones(editor, shape)
      }
    }
  }, [editor, shapeKey, processedShapes.length])

  // Update existing clones when original shape changes (second effect for live updates)
  useEffect(() => {
    if (!editor || !processedShapes.length) return
    

    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id && s.meta?.stackProcessed
    })

    if (existingClones.length > 0) {
      updateExistingClones(editor, shape, modifiers, existingClones)
    }
  }, [editor, shapeKey, modifiersKey])
}

/**
 * Clean up existing clones for a shape
 */
function cleanupExistingClones(editor: Editor, shape: TLShape) {
  const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
    const originalId = getOriginalShapeId(s)
    return originalId === shape.id && s.meta?.stackProcessed
  })

  logShapeOperation('useCloneManager Cleanup', shape.id, {
    existingClones: existingClones.length
  })

  // Delete existing clones
  if (existingClones.length > 0) {
    editor.run(() => {
      editor.deleteShapes(existingClones.map((s: TLShape) => s.id))
    }, { ignoreShapeLock: true, history: 'ignore' })
  }
}

/**
 * Clean up clones for all shapes in a group
 */
function cleanupGroupClones(editor: Editor, shape: TLShape) {
  const groupShapeIds = editor.getShapeAndDescendantIds([shape.id])
  const groupShapes = Array.from(groupShapeIds)
    .map(id => editor.getShape(id))
    .filter(Boolean) as TLShape[]
  
  const groupClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
    const originalId = getOriginalShapeId(s)
    return groupShapes.some(groupShape => groupShape.id === originalId) && s.meta?.stackProcessed
  })

  if (groupClones.length > 0) {
    editor.run(() => {
      editor.deleteShapes(groupClones.map((s: TLShape) => s.id))
    }, { ignoreShapeLock: true, history: 'ignore' })
    
    logShapeOperation('useCloneManager Group Cleanup', shape.id, {
      groupClones: groupClones.length
    })
  }
}

/**
 * Move the original shape to the first array position
 */
function moveOriginalShapeToFirstPosition(editor: Editor, shape: TLShape, processedShapes: TLShapePartial[]) {
  // Find the first clone to get its position
  const firstClone = processedShapes.find(s => s.meta?.isFirstClone)
  if (firstClone) {
    editor.run(() => {
      // Move the original shape to the first array position
      const targetRotation = firstClone.rotation || 0
      const currentRotation = shape.rotation || 0
      const rotationDelta = targetRotation - currentRotation
      
      // Update position first
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        x: firstClone.x,
        y: firstClone.y
      })
      
      // Then rotate around center if needed
      if (rotationDelta !== 0) {
        editor.rotateShapesBy([shape.id], rotationDelta)
      }
      
      // Make the first clone transparent since it's now redundant
      editor.updateShape({
        id: firstClone.id,
        type: firstClone.type,
        opacity: 0
      })
    }, { history: 'ignore' })
  }
}

/**
 * Update existing clones with new positions and properties
 */
function updateExistingClones(editor: Editor, shape: TLShape, modifiers: TLModifier[], existingClones: TLShape[]) {
  // Recalculate positions based on current shape state
  const result = ModifierStack.processModifiers(shape, modifiers, editor)
  const updatedShapes = extractShapesFromState(result)
  
  // Update existing clones with new positions
  const updatedClones = existingClones.map((clone: TLShape) => {
    const cloneIndex = clone.meta?.arrayIndex as number
    const updatedShape = updatedShapes.find(s => s.meta?.arrayIndex === cloneIndex)
    
    if (!updatedShape) return null

    // Store the target rotation separately
    return {
      id: clone.id,
      type: updatedShape.type,
      x: updatedShape.x,
      y: updatedShape.y,
      targetRotation: updatedShape.rotation || 0,
      props: { ...updatedShape.props }
    }
  }).filter(Boolean)

  if (updatedClones.length > 0) {
    editor.run(() => {
      updatedClones.forEach((update) => {
        if (update) {
          const { targetRotation, ...shapeUpdate } = update
          const currentShape = editor.getShape(update.id)
          
          // Update position and props (but not rotation)
          editor.updateShape(shapeUpdate)
          
          // Apply rotation around center if needed
          if (currentShape && targetRotation !== undefined) {
            const currentRotation = currentShape.rotation || 0
            const rotationDelta = targetRotation - currentRotation
            if (rotationDelta !== 0) {
              editor.rotateShapesBy([update.id], rotationDelta)
            }
          }
        }
      })
    }, { ignoreShapeLock: true, history: 'ignore' })
    
  }
} 