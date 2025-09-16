import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useEditor, type TLShape, type TLShapePartial, type Editor } from 'tldraw'
import { ModifierStack, extractShapesFromState } from '../../../store/modifiers'
import type { TLModifier } from '../../../types/modifiers'
import { isPathModifierType } from '../../../store/modifiers/core/PathModifier'
import {
  getOriginalShapeId,
  logShapeOperation
} from '../utils'

interface UseCloneManagerProps {
  shape: TLShape
  modifiers: TLModifier[]
  processedShapes: TLShapePartial[]
  shapeKey: string
}

/**
 * Custom hook for managing shape clones in the editor
 * Extracts the clone management logic from StackedModifier
 */
export function useCloneManager({
  shape,
  modifiers,
  processedShapes,
  shapeKey
}: UseCloneManagerProps) {
  const editor = useEditor()

  // Memoize processedShapes count to avoid dependency issues
  const processedShapesCount = useMemo(() => processedShapes.length, [processedShapes.length])

  // Memoize modifier state for stable dependencies
  const hasPathModifiers = useMemo(() => {
    return modifiers.some(m => m.enabled && isPathModifierType(m.type))
  }, [modifiers.map(m => `${m.type}-${m.enabled}`).join(',')])

  // Create stable cleanup function
  const cleanupFunction = useCallback(() => {
    if (!editor) return

    const currentShape = shapeRef.current
    const clonesToCleanup = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === currentShape.id && s.meta?.stackProcessed
    })

    if (clonesToCleanup.length > 0) {
      editor.run(() => {
        editor.deleteShapes(clonesToCleanup.map((s: TLShape) => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }

    // Restore original shape opacity when cleaning up
    if (hasPathModifiers) {
      editor.run(() => {
        editor.updateShape({
          id: currentShape.id,
          type: currentShape.type,
          opacity: 1 // Restore full opacity
        })
      }, { history: 'ignore' })
    }

    // For group modifiers, also clean up clones of all shapes in the group during cleanup
    if (currentShape.type === 'group') {
      cleanupGroupClones(editor, currentShape)
    }
  }, [editor, hasPathModifiers, shapeKey])

  // Use refs to store current values without triggering re-renders
  const modifiersRef = useRef(modifiers)
  const processedShapesRef = useRef(processedShapes)
  const shapeRef = useRef(shape)

  // Update refs when values change
  modifiersRef.current = modifiers
  processedShapesRef.current = processedShapes
  shapeRef.current = shape

  // Create and manage shape clones
  useEffect(() => {
    if (!editor) return

    const currentShape = shapeRef.current
    const currentProcessedShapes = processedShapesRef.current

    logShapeOperation('useCloneManager Effect', currentShape.id, {
      processedShapes: processedShapesCount
    })

    // Clean up existing clones for this shape
    cleanupExistingClones(editor, currentShape)

    // For group modifiers, also clean up clones of all shapes in the group
    if (currentShape.type === 'group' && processedShapesCount > 0) {
      cleanupGroupClones(editor, currentShape)
    }

    // Batch all shape operations together for better performance
    editor.run(() => {
      // Handle original shape opacity based on modifier types
      if (hasPathModifiers && processedShapesCount > 0) {
        // Hide the original shape by setting opacity to 0
        editor.updateShape({
          id: currentShape.id,
          type: currentShape.type,
          opacity: 0
        })
      } else if (!hasPathModifiers) {
        // Restore original opacity for non-path modifiers
        editor.updateShape({
          id: currentShape.id,
          type: currentShape.type,
          opacity: currentShape.opacity || 1
        })
      }

      // Create new clones if we have processed shapes
      if (processedShapesCount > 0) {
        logShapeOperation('useCloneManager Create', currentShape.id, {
          newClones: currentProcessedShapes.length
        })

        // Create shapes at their target positions with rotation set to 0
        const shapesToCreate = currentProcessedShapes.map(s => ({
          ...s,
          rotation: 0  // Always create with 0 rotation
        }))

        editor.createShapes(shapesToCreate)

        // Apply rotation using rotateShapesBy for center-based rotation
        currentProcessedShapes.forEach((processedShape, index) => {
          if (processedShape.rotation && processedShape.rotation !== 0) {
            const shapeId = shapesToCreate[index].id
            editor.rotateShapesBy([shapeId], processedShape.rotation)
          }
        })
      }
    }, { history: 'ignore' })

    // Return cleanup function
    return cleanupFunction
  }, [editor, shapeKey, processedShapesCount, hasPathModifiers, cleanupFunction])

  // Update existing clones when original shape changes (second effect for live updates)
  useEffect(() => {
    if (!editor || !processedShapesCount) return

    const currentShape = shapeRef.current
    const currentModifiers = modifiersRef.current

    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === currentShape.id && s.meta?.stackProcessed
    })

    if (existingClones.length > 0) {
      updateExistingClones(editor, currentShape, currentModifiers, existingClones)
    }
  }, [editor, shapeKey, processedShapesCount])

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
      // Batch all shape updates first
      const rotationsToApply: Array<{ id: string; delta: number }> = []

      updatedClones.forEach((update) => {
        if (!update) return

        const { targetRotation, ...shapeUpdate } = update
        const currentShape = editor.getShape(update.id)
        if (!currentShape) return

        // Update position and props (but NOT rotation directly)
        editor.updateShape(shapeUpdate)

        // Calculate rotation delta for batch application
        const currentRotation = currentShape.rotation || 0
        const rotationDelta = targetRotation - currentRotation

        if (Math.abs(rotationDelta) > 0.001) { // Only rotate if there's a meaningful difference
          rotationsToApply.push({ id: update.id, delta: rotationDelta })
        }
      })

      // Batch apply all rotations
      rotationsToApply.forEach(({ id, delta }) => {
        editor.rotateShapesBy([id as import('tldraw').TLShapeId], delta)
      })
    }, { ignoreShapeLock: true, history: 'ignore' })

  }
} 