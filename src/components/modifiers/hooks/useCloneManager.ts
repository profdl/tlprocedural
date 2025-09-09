import { useEffect, useMemo } from 'react'
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
  
  // Memoize processedShapes count to avoid dependency issues
  const processedShapesCount = useMemo(() => processedShapes.length, [processedShapes.length])

  // Create and manage shape clones
  useEffect(() => {
    if (!editor) return

    logShapeOperation('useCloneManager Effect', shape.id, {
      processedShapes: processedShapesCount
    })

    // Clean up existing clones for this shape
    cleanupExistingClones(editor, shape)

    // For group modifiers, also clean up clones of all shapes in the group
    if (shape.type === 'group' && processedShapesCount > 0) {
      cleanupGroupClones(editor, shape)
    }

    // Keep original shape visible - don't hide it

    // Create new clones if we have processed shapes
    if (processedShapesCount > 0) {
      logShapeOperation('useCloneManager Create', shape.id, {
        newClones: processedShapes.length
      })
      
      editor.run(() => {
        // Create shapes at their target positions with rotation set to 0
        const shapesToCreate = processedShapes.map(s => ({
          ...s,
          rotation: 0  // Always create with 0 rotation
        }))
        
        editor.createShapes(shapesToCreate)
        
        // Apply rotation using rotateShapesBy for center-based rotation
        processedShapes.forEach((processedShape, index) => {
          if (processedShape.rotation && processedShape.rotation !== 0) {
            const shapeId = shapesToCreate[index].id
            editor.rotateShapesBy([shapeId], processedShape.rotation)
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
  }, [editor, shapeKey, processedShapesCount, processedShapes, shape])

  // Update existing clones when original shape changes (second effect for live updates)
  useEffect(() => {
    if (!editor || !processedShapesCount) return
    

    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id && s.meta?.stackProcessed
    })

    if (existingClones.length > 0) {
      updateExistingClones(editor, shape, modifiers, existingClones)
    }
  }, [editor, shapeKey, modifiersKey, modifiers, processedShapesCount, shape])

  // TODO: Implement transform synchronization from clone back to original
  // This would allow users to transform clones and have changes reflect in the original
  // Commented out for now to avoid circular dependency issues
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
 * Update existing clones with new positions and properties
 */
function updateExistingClones(editor: Editor, shape: TLShape, modifiers: TLModifier[], existingClones: TLShape[]) {
  // Debug: Log when this function is called
  console.log(`updateExistingClones called for shape ${shape.id}, rotation: ${shape.rotation ? (shape.rotation * 180 / Math.PI).toFixed(1) + '°' : '0°'}, existing clones: ${existingClones.length}`)
  
  // Recalculate positions based on current shape state
  const result = ModifierStack.processModifiers(shape, modifiers, editor)
  const updatedShapes = extractShapesFromState(result)
  
  console.log(`ModifierStack result: ${result.instances.length} instances, extractedShapes: ${updatedShapes.length}`)
  
  // Debug: Log existing clones metadata
  existingClones.forEach((clone, i) => {
    console.log(`Existing clone ${i}: id=${clone.id}, arrayIndex=${clone.meta?.arrayIndex}`)
  })
  
  // Debug: Log updated shapes metadata  
  updatedShapes.forEach((shape, i) => {
    console.log(`Updated shape ${i}: id=${shape.id}, arrayIndex=${shape.meta?.arrayIndex}`)
  })

  // Update existing clones with new positions
  const updatedClones = existingClones.map((clone: TLShape) => {
    const cloneIndex = clone.meta?.arrayIndex as number
    const updatedShape = updatedShapes.find(s => s.meta?.arrayIndex === cloneIndex)
    
    console.log(`Looking for clone index ${cloneIndex}, found: ${!!updatedShape}`)
    
    if (!updatedShape) return null

    console.log(`Clone ${clone.id} (index ${cloneIndex}): current rotation ${clone.rotation ? (clone.rotation * 180 / Math.PI).toFixed(1) + '°' : '0°'}, target rotation ${updatedShape.rotation ? (updatedShape.rotation * 180 / Math.PI).toFixed(1) + '°' : '0°'}`)

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
      // Batch process all clones
      updatedClones.forEach((update) => {
        if (!update) return
        
        const { targetRotation, ...shapeUpdate } = update
        const currentShape = editor.getShape(update.id)
        if (!currentShape) return
        
        // Update position and props (but NOT rotation directly)
        editor.updateShape(shapeUpdate)
        
        // Calculate rotation delta and apply it
        const currentRotation = currentShape.rotation || 0
        const rotationDelta = targetRotation - currentRotation
        
        if (Math.abs(rotationDelta) > 0.001) { // Only rotate if there's a meaningful difference
          console.log(`Rotating clone ${update.id} from ${(currentRotation * 180 / Math.PI).toFixed(1)}° to ${(targetRotation * 180 / Math.PI).toFixed(1)}° (delta: ${(rotationDelta * 180 / Math.PI).toFixed(1)}°)`)
          editor.rotateShapesBy([update.id], rotationDelta)
        }
      })
    }, { ignoreShapeLock: true, history: 'ignore' })
    
  }
} 