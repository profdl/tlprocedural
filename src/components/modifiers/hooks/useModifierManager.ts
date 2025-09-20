import { useCallback, useMemo } from 'react'
import { useModifierStore } from '../../../store/modifierStore'
import { TransformComposer, extractShapesFromState } from '../../../store/modifiers'
import { getOriginalShapeId, findTopLevelGroup, getGroupPageBounds, getGroupChildShapes } from '../utils'
import { applyRotationToShapes } from '../utils/transformUtils'
import { useEditor, createShapeId } from 'tldraw'
import type { TLShape } from 'tldraw'
import type { TLModifier, TLModifierId, GroupContext, ModifierType } from '../../../types/modifiers'

// Since ModifierActionButtons now sends the correct internal types,
// we don't need a mapping - just pass through the type directly

interface UseModifierManagerProps {
  selectedShapes: TLShape[]
}

interface UseModifierManagerReturn {
  selectedShape: TLShape | undefined
  shapeModifiers: TLModifier[]
  hasEnabledModifiers: boolean
  addModifier: (type: ModifierType) => void
  removeModifier: (modifierId: string) => void
  toggleModifier: (modifierId: string) => void
  applyModifier: (modifierId: string) => void
  applyModifiers: () => void
}

/**
 * Custom hook for managing modifiers
 * Extracts the modifier management logic from ModifierControls
 */
export function useModifierManager({ selectedShapes }: UseModifierManagerProps): UseModifierManagerReturn {
  const store = useModifierStore()
  const editor = useEditor()

  // Get modifiers for the first selected shape (simplified for now)
  const selectedShape = selectedShapes[0]
  
  const shapeModifiers = useMemo(() => {
    if (!selectedShape) return []
    
    // For clones/processed shapes, we need to look up modifiers using the original shape ID
    const originalShapeId = getOriginalShapeId(selectedShape) || selectedShape.id
    return store.getModifiersForShape(originalShapeId as import('tldraw').TLShapeId)
  }, [store, selectedShape])

  // Check if there are any enabled modifiers that can be applied
  const hasEnabledModifiers = useMemo(() => {
    return shapeModifiers.some(modifier => modifier.enabled)
  }, [shapeModifiers])

  const addModifier = useCallback((type: ModifierType) => {
    if (!selectedShape) return

    // Use original shape ID for clones/processed shapes
    const originalShapeId = getOriginalShapeId(selectedShape) || selectedShape.id

    // Create modifier using existing store method
    // ModifierActionButtons already provides the correct internal type
    store.createModifier(originalShapeId as import('tldraw').TLShapeId, type, {})
  }, [selectedShape, store])

  const applyModifiers = useCallback(() => {
    if (!selectedShape || !editor) return

    // Use original shape ID for clones/processed shapes
    const originalShapeId = getOriginalShapeId(selectedShape) || selectedShape.id

    // Get all enabled modifiers for this shape
    const enabledModifiers = store.getEnabledModifiersForShape(originalShapeId as import('tldraw').TLShapeId)

    console.log('🔧 Apply All started:', {
      selectedShapeId: selectedShape.id,
      originalShapeId,
      enabledModifiersCount: enabledModifiers.length,
      enabledModifiers: enabledModifiers.map(m => ({ id: m.id, type: m.type, enabled: m.enabled }))
    })

    if (enabledModifiers.length === 0) {
      console.log('❌ No enabled modifiers found, returning early')
      return
    }

    try {
      // Get the actual original shape for processing
      const actualOriginalShape = originalShapeId !== selectedShape.id
        ? editor.getShape(originalShapeId as import('tldraw').TLShapeId) || selectedShape
        : selectedShape

      // Check if we have boolean modifiers (they need special handling)
      const hasBooleanModifiers = enabledModifiers.some(m => m.type === 'boolean')
      const arrayModifiers = enabledModifiers.filter(m => m.type !== 'boolean')
      const booleanModifiers = enabledModifiers.filter(m => m.type === 'boolean')

      console.log('🔄 Processing modifiers:', {
        total: enabledModifiers.length,
        boolean: booleanModifiers.length,
        array: arrayModifiers.length,
        modifiers: enabledModifiers.map(m => ({ id: m.id, type: m.type }))
      })

      // Create group context if needed
      const parentGroup = findTopLevelGroup(actualOriginalShape, editor)
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

      const result = TransformComposer.processModifiers(actualOriginalShape, enabledModifiers, groupContext)
      const transformedShapes = extractShapesFromState(result)

      console.log('📐 Transform results:', {
        totalShapes: transformedShapes.length,
        originalShape: transformedShapes[0]?.id,
        hasBooleanModifiers,
        shapeTypes: transformedShapes.map(s => s.type)
      })

      editor.run(() => {
        // Clean up existing preview clones before creating permanent shapes
        const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
          const originalId = getOriginalShapeId(s)
          return originalId === actualOriginalShape.id && s.meta?.stackProcessed
        })

        if (existingClones.length > 0) {
          editor.deleteShapes(existingClones.map((s: TLShape) => s.id))
        }

        if (hasBooleanModifiers) {
          // Boolean operations: Replace the original shape with the boolean result
          console.log('🔧 Handling boolean modifiers - replacing original shape')

          // Find the boolean result shape (should be a bezier shape)
          const booleanResult = transformedShapes.find(s => s.type === 'bezier')

          if (booleanResult) {
            console.log('✨ Creating boolean result shape:', {
              type: booleanResult.type,
              x: booleanResult.x,
              y: booleanResult.y
            })

            // Delete the original shape
            editor.deleteShapes([actualOriginalShape.id])

            // Create the boolean result shape
            const newId = createShapeId()
            const resultShape = {
              id: newId,
              type: booleanResult.type,
              x: booleanResult.x,
              y: booleanResult.y,
              rotation: 0,
              props: booleanResult.props,
              parentId: actualOriginalShape.parentId,
              meta: {
                appliedFromBoolean: true,
                originalShapeId: actualOriginalShape.id
              }
            }

            editor.createShapes([resultShape])
            console.log('✅ Boolean result shape created successfully!')
          } else {
            console.error('❌ No boolean result shape found in transform results')
          }
        } else {
          // Array modifiers: Create clones alongside the original
          console.log('🏗️ Handling array modifiers - creating clones')

          // Create actual shapes from the transformed results (skip the first one as it's the original)
          const shapesToCreate = transformedShapes.slice(1).map(transformedShape => {
            const newId = createShapeId()
            return {
              id: newId,
              type: transformedShape.type,
              x: transformedShape.x,
              y: transformedShape.y,
              rotation: 0, // Always create with 0 rotation, then apply rotation separately
              props: transformedShape.props,
              parentId: actualOriginalShape.parentId,
              meta: {
                // Don't include stackProcessed or other preview-related metadata
                appliedFromModifier: true,
                originalShapeId: actualOriginalShape.id
              }
            }
          })

          console.log('🏗️ Shapes to create:', {
            count: shapesToCreate.length,
            shapes: shapesToCreate.map(s => ({ id: s.id, type: s.type, x: s.x, y: s.y }))
          })

          // Restore original shape visibility
          editor.updateShape({
            id: actualOriginalShape.id,
            type: actualOriginalShape.type,
            opacity: 1
          })

          if (shapesToCreate.length > 0) {
            console.log('✨ About to create permanent shapes:', {
              count: shapesToCreate.length,
              firstShape: shapesToCreate[0]
            })

            // Create the permanent shapes
            editor.createShapes(shapesToCreate)
            console.log('✅ Shapes created successfully!')

            // Apply rotation using shared utility for center-based rotation (same as preview)
            transformedShapes.slice(1).forEach((transformedShape, index) => {
              if (transformedShape.rotation && transformedShape.rotation !== 0) {
                const shapeId = shapesToCreate[index].id
                applyRotationToShapes(editor, [shapeId], transformedShape.rotation)
              }
            })
          }
        }
      }, { history: 'record' })

      console.log('🗑️ Removing applied modifiers:', enabledModifiers.map(m => m.id))
      // Remove the applied modifiers
      enabledModifiers.forEach(modifier => {
        store.deleteModifier(modifier.id)
      })
    } catch (error) {
      console.error('Failed to apply modifiers:', error)
    }
  }, [selectedShape, editor, store])

  const removeModifier = useCallback((modifierId: string) => {
    store.deleteModifier(modifierId as TLModifierId)
  }, [store])

  const toggleModifier = useCallback((modifierId: string) => {
    const modifier = shapeModifiers.find(m => m.id === modifierId)
    if (modifier) {
      store.updateModifier(modifierId as TLModifierId, { enabled: !modifier.enabled })
    }
  }, [shapeModifiers, store])

  const applyModifier = useCallback((modifierId: string) => {
    if (!selectedShape || !editor) return

    const modifier = shapeModifiers.find(m => m.id === modifierId)
    if (!modifier) return

    // Use original shape ID for clones/processed shapes
    const originalShapeId = getOriginalShapeId(selectedShape) || selectedShape.id

    try {
      // Get the actual original shape for processing
      const actualOriginalShape = originalShapeId !== selectedShape.id
        ? editor.getShape(originalShapeId as import('tldraw').TLShapeId) || selectedShape
        : selectedShape

      // Process only this specific modifier (all remaining modifiers are array modifiers)
      const modifiersToProcess = [modifier]

      // Create group context if needed
      const parentGroup = findTopLevelGroup(actualOriginalShape, editor)
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
      // Handle array modifiers: create new shapes
      const result = TransformComposer.processModifiers(actualOriginalShape, modifiersToProcess, groupContext)
        const transformedShapes = extractShapesFromState(result)

        // Create actual shapes from the transformed results (skip the first one as it's the original)
        const shapesToCreate = transformedShapes.slice(1).map(transformedShape => {
          const newId = createShapeId()
          return {
            id: newId,
            type: transformedShape.type,
            x: transformedShape.x,
            y: transformedShape.y,
            rotation: 0, // Always create with 0 rotation, then apply rotation separately
            props: transformedShape.props,
            parentId: actualOriginalShape.parentId,
            meta: {
              // Don't include stackProcessed or other preview-related metadata
              appliedFromModifier: true,
              originalShapeId: actualOriginalShape.id
            }
          }
        })

        if (shapesToCreate.length > 0) {
          editor.run(() => {
            // Clean up existing preview clones before creating permanent shapes
            const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
              const originalId = getOriginalShapeId(s)
              return originalId === actualOriginalShape.id && s.meta?.stackProcessed
            })

            if (existingClones.length > 0) {
              editor.deleteShapes(existingClones.map((s: TLShape) => s.id))
            }

            // Restore original shape visibility
            editor.updateShape({
              id: actualOriginalShape.id,
              type: actualOriginalShape.type,
              opacity: 1
            })

            // Create the permanent shapes
            editor.createShapes(shapesToCreate)

            // Apply rotation using shared utility for center-based rotation (same as preview)
            transformedShapes.slice(1).forEach((transformedShape, index) => {
              if (transformedShape.rotation && transformedShape.rotation !== 0) {
                const shapeId = shapesToCreate[index].id
                applyRotationToShapes(editor, [shapeId], transformedShape.rotation)
              }
            })
          }, { history: 'record' })

          // Remove the applied modifier
          store.deleteModifier(modifier.id)
        }
    } catch (error) {
      console.error('Failed to apply modifier:', error)
    }
  }, [selectedShape, editor, shapeModifiers, store])

  return {
    selectedShape,
    shapeModifiers,
    hasEnabledModifiers,
    addModifier,
    removeModifier,
    toggleModifier,
    applyModifier,
    applyModifiers
  }
} 