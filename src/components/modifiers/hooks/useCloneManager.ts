import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useEditor, type TLShape, type TLShapePartial, type Editor, Vec } from 'tldraw'
import { TransformComposer, extractShapesFromState } from '../../../store/modifiers'
import type { TLModifier, GroupContext } from '../../../types/modifiers'
import {
  getOriginalShapeId,
  logShapeOperation,
  findTopLevelGroup,
  getGroupPageBounds,
  getGroupChildShapes
} from '../utils'
import { applyRotationToShapes } from '../utils/transformUtils'
import { BEZIER_DEBUG } from '../../shapes/utils/bezierConstants'

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

  // Check if we should hide the source shape based on modifier types
  // Keep source visible for array modifiers (linear-array, circular-array, grid-array, mirror)
  // Also keep compound shapes visible (they represent the combined multi-shape entity)
  const shouldHideSourceShape = useMemo(() => {
    // Never hide compound shapes - they should remain visible as the final result
    if (shape?.type === 'compound') {
      return false
    }

    const arrayModifierTypes = ['linear-array', 'circular-array', 'grid-array', 'mirror']
    return !modifiers.some(modifier =>
      modifier.enabled && arrayModifierTypes.includes(modifier.type)
    )
  }, [modifiers, shape?.type])

  // All remaining modifiers are array modifiers (no path modifiers left)
  const hasPathModifiers = false

  // Create stable cleanup function
  const cleanupFunction = useCallback(() => {
    if (!editor) return

    const currentShape = shapeRef.current
    const clonesToCleanup = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      // Only cleanup preview clones, not permanent shapes applied from modifiers
      return originalId === currentShape.id && s.meta?.stackProcessed && !s.meta?.appliedFromModifier
    })

    if (clonesToCleanup.length > 0) {
      editor.run(() => {
        editor.deleteShapes(clonesToCleanup.map((s: TLShape) => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }

    // Restore source shape opacity if it was hidden
    if (currentShape.opacity === 0) {
      editor.run(() => {
        editor.updateShape({
          id: currentShape.id,
          type: currentShape.type,
          opacity: 1
        })
      }, { ignoreShapeLock: true, history: 'ignore' })
    }

    // For group modifiers, also clean up clones of all shapes in the group during cleanup
    if (currentShape.type === 'group') {
      cleanupGroupClones(editor, currentShape)
    }
  }, [editor])

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

    // Update boolean results when source shape position changes
    updateBooleanResults(editor, currentShape)

    // For group modifiers, also clean up clones of all shapes in the group
    if (currentShape.type === 'group' && processedShapesCount > 0) {
      cleanupGroupClones(editor, currentShape)
    }

    // Batch all shape operations together for better performance
    editor.run(() => {
      // Hide original shape when clones exist (set opacity to 0) only for certain modifier types
      if (processedShapesCount > 0 && shouldHideSourceShape) {
        editor.updateShape({
          id: currentShape.id,
          type: currentShape.type,
          opacity: 0
        })
      }

      // Create new clones if we have processed shapes
      if (processedShapesCount > 0) {
        logShapeOperation('useCloneManager Create', currentShape.id, {
          newClones: currentProcessedShapes.length
        })

        // Create shapes at their target positions with rotation set to 0
        const shapesToCreate = currentProcessedShapes.map(s => {
          // Only set edit mode properties for shapes that support them (bezier and draw shapes)
          const hasEditMode = s.type === 'bezier' || s.type === 'draw'

          return {
            ...s,
            rotation: 0,  // Always create with 0 rotation
            props: hasEditMode ? {
              ...s.props,
              // Ensure clones never show edit handles by removing edit mode properties
              editMode: false,
              selectedPointIndices: [],
              hoverPoint: undefined,
              hoverSegmentIndex: undefined
            } : s.props
          }
        })

        editor.createShapes(shapesToCreate)

        // Apply rotation using shared utility for center-based rotation
        currentProcessedShapes.forEach((processedShape, index) => {
          // Check both rotation property and targetRotation in metadata
          const targetRotation = (processedShape.meta?.targetRotation as number) || processedShape.rotation
          if (targetRotation && targetRotation !== 0) {
            const shapeId = shapesToCreate[index].id
            applyRotationToShapes(editor, [shapeId], targetRotation)
          }
        })

        // Apply scaling using resizeShape for center-based scaling
        currentProcessedShapes.forEach((processedShape, index) => {
          const targetScaleX = processedShape.meta?.targetScaleX as number
          const targetScaleY = processedShape.meta?.targetScaleY as number
          if (targetScaleX && targetScaleY && (targetScaleX !== 1 || targetScaleY !== 1)) {
            const shapeId = shapesToCreate[index].id
            editor.resizeShape(shapeId, new Vec(targetScaleX, targetScaleY))
          }
        })
      }
    }, { history: 'ignore' })

    // Return cleanup function
    return cleanupFunction
  }, [editor, shapeKey, processedShapesCount, hasPathModifiers, shouldHideSourceShape, cleanupFunction])

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

  // FUTURE ENHANCEMENT: Transform synchronization from clone back to original
  // This would allow users to transform clones and have changes reflect in the original
  // Requires careful design to avoid circular dependencies and performance issues
}


/**
 * Clean up existing clones for a shape
 */
function cleanupExistingClones(editor: Editor, shape: TLShape) {
  const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
    const originalId = getOriginalShapeId(s)
    // Only cleanup preview clones, not permanent shapes applied from modifiers
    return originalId === shape.id && s.meta?.stackProcessed && !s.meta?.appliedFromModifier
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
 * Update boolean results when source shape position changes
 */
function updateBooleanResults(editor: Editor, shape: TLShape) {
  // Find boolean results created from this source shape
  const booleanResults = editor.getCurrentPageShapes().filter((s: TLShape) => {
    return s.meta?.originalShapeId === shape.id && s.meta?.isBooleanResult === true
  })

  if (booleanResults.length === 0) return

  // Calculate the position offset between old and new source shape position
  const currentProps = shape.props as { w?: number; h?: number }
  const currentW = currentProps.w || 100
  const currentH = currentProps.h || 100
  const currentCenterX = shape.x + currentW / 2
  const currentCenterY = shape.y + currentH / 2

  if (BEZIER_DEBUG) {
    console.log('🔄 Updating boolean results for source shape movement:', {
      sourceShapeId: shape.id,
      sourcePosition: { x: shape.x, y: shape.y },
      sourceCenter: { x: currentCenterX, y: currentCenterY },
      booleanResultsCount: booleanResults.length
    })
  }

  editor.run(() => {
    booleanResults.forEach(booleanResult => {
      // Get the stored relative positioning from when the boolean was created
      const booleanProps = booleanResult.props as { w?: number; h?: number }
      const booleanW = booleanProps.w || 100
      const booleanH = booleanProps.h || 100

      // Position the boolean result centered on the source shape's new center
      const newX = currentCenterX - booleanW / 2
      const newY = currentCenterY - booleanH / 2

      editor.updateShape({
        id: booleanResult.id,
        type: booleanResult.type,
        x: newX,
        y: newY
      })

      if (BEZIER_DEBUG) {
        console.log('📍 Updated boolean result position:', {
          booleanResultId: booleanResult.id,
          oldPosition: { x: booleanResult.x, y: booleanResult.y },
          newPosition: { x: newX, y: newY }
        })
      }
    })
  }, { ignoreShapeLock: true, history: 'ignore' })
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
    // Only cleanup preview clones, not permanent shapes applied from modifiers
    return groupShapes.some(groupShape => groupShape.id === originalId) && s.meta?.stackProcessed && !s.meta?.appliedFromModifier
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
  if (BEZIER_DEBUG) {
    console.log(`[updateExistingClones] Processing ${shape.id} with ${existingClones.length} existing clones`)
  }

  // Recalculate positions based on current shape state
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

  if (BEZIER_DEBUG) {
    console.log(`[updateExistingClones] Calling TransformComposer.processModifiers for ${shape.id}`)
  }
  const result = TransformComposer.processModifiers(shape, modifiers, groupContext, editor)

  const updatedShapes = extractShapesFromState(result)

  // Update existing clones with new positions
  const updatedClones = existingClones.map((clone: TLShape) => {
    const cloneIndex = clone.meta?.index as number
    const updatedShape = updatedShapes.find(s => s.meta?.index === cloneIndex)

    if (!updatedShape) return null

    // Store the target rotation separately
    // Only set edit mode properties for shapes that support them (bezier and draw shapes)
    const hasEditMode = updatedShape.type === 'bezier' || updatedShape.type === 'draw'

    return {
      id: clone.id,
      type: updatedShape.type,
      x: updatedShape.x,
      y: updatedShape.y,
      targetRotation: (updatedShape.meta?.targetRotation as number) || updatedShape.rotation || 0,
      props: hasEditMode ? {
        ...updatedShape.props,
        // Ensure clones never show edit handles by removing edit mode properties
        editMode: false,
        selectedPointIndices: [],
        hoverPoint: undefined,
        hoverSegmentIndex: undefined
      } : updatedShape.props
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
        const rotationDelta = (targetRotation as number) - currentRotation

        if (Math.abs(rotationDelta) > 0.001) { // Only rotate if there's a meaningful difference
          rotationsToApply.push({ id: update.id, delta: rotationDelta })
        }
      })

      // Batch apply all rotations using shared utility
      rotationsToApply.forEach(({ id, delta }) => {
        editor.rotateShapesBy([id] as import('tldraw').TLShapeId[], delta)
      })

      // Apply scaling using resizeShape for center-based scaling
      updatedClones.forEach((update, index) => {
        if (!update) return
        const correspondingUpdatedShape = updatedShapes[index]
        if (!correspondingUpdatedShape) return

        const targetScaleX = correspondingUpdatedShape.meta?.targetScaleX as number
        const targetScaleY = correspondingUpdatedShape.meta?.targetScaleY as number
        if (targetScaleX && targetScaleY && (targetScaleX !== 1 || targetScaleY !== 1)) {
          editor.resizeShape(update.id, new Vec(targetScaleX, targetScaleY))
        }
      })
    }, { ignoreShapeLock: true, history: 'ignore' })

  }
} 
