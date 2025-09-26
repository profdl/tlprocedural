import { useCallback, useMemo } from 'react'
import { useModifierStore } from '../../../store/modifierStore'
import { TransformComposer, extractShapesFromState } from '../../../store/modifiers'
import { getOriginalShapeId, findTopLevelGroup, getGroupPageBounds, getGroupChildShapes } from '../utils'
import { applyRotationToShapes } from '../utils/transformUtils'
import { useEditor, createShapeId, Vec } from 'tldraw'
import type { TLShape, TLShapeId } from 'tldraw'
import type { TLModifier, TLModifierId, GroupContext, ModifierType } from '../../../types/modifiers'
import { CompoundShapeUtil, type CompoundShape } from '../../shapes/CompoundShape'

// Since ModifierActionButtons now sends the correct internal types,
// we don't need a mapping - just pass through the type directly

interface UseModifierManagerProps {
  selectedShapes: TLShape[]
}

interface UseModifierManagerReturn {
  selectedShape: TLShape | undefined
  selectedShapes: TLShape[]
  isMultiShapeSelection: boolean
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

  // Multi-shape selection detection
  const isMultiShapeSelection = selectedShapes.length > 1

  // Get modifiers for the first selected shape (simplified for now)
  const selectedShape = selectedShapes[0]
  
  const shapeModifiers = useMemo(() => {
    if (!selectedShape) return []

    // Boolean result shapes should be treated as independent shapes that can have their own modifiers
    // Even though they have originalShapeId metadata, they're no longer preview clones
    if (selectedShape.meta?.appliedFromBoolean || selectedShape.meta?.isBooleanResult) {
      return store.getModifiersForShape(selectedShape.id)
    }

    // For preview clones/processed shapes, we need to look up modifiers using the original shape ID
    const originalShapeId = getOriginalShapeId(selectedShape)
    if (originalShapeId && selectedShape.meta?.stackProcessed && !selectedShape.meta?.appliedFromModifier) {
      return store.getModifiersForShape(originalShapeId)
    }

    // For all other shapes (including permanently applied modifier results), use the shape's own ID
    return store.getModifiersForShape(selectedShape.id)
  }, [store, selectedShape])

  // Check if there are any enabled modifiers that can be applied
  const hasEnabledModifiers = useMemo(() => {
    return shapeModifiers.some(modifier => modifier.enabled)
  }, [shapeModifiers])

  // Helper function to create compound shape from multiple selected shapes
  const createCompoundShape = useCallback((shapes: TLShape[]) => {
    if (!editor || shapes.length < 2) return null

    // Calculate the relative positions of each shape
    const shapesWithPositions = shapes.map(shape => ({
      shape,
      relativePosition: { x: shape.x, y: shape.y }
    }))

    // Create compound shape properties using the CompoundShapeUtil helper
    const compoundProps = CompoundShapeUtil.createFromShapes(shapesWithPositions)

    // Calculate compound shape position (top-left of bounding box)
    const allX = shapes.map(s => s.x)
    const allY = shapes.map(s => s.y)
    const minX = Math.min(...allX)
    const minY = Math.min(...allY)

    // Create the compound shape
    const compoundShapeId = createShapeId()
    const compoundShape: CompoundShape = {
      id: compoundShapeId,
      type: 'compound',
      x: minX,
      y: minY,
      rotation: 0,
      isLocked: false,
      opacity: 1,
      parentId: shapes[0].parentId,
      index: shapes[0].index,
      typeName: 'shape' as const,
      props: {
        ...compoundProps,
        color: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 1,
        fill: false
      },
      meta: {
        isMultiShapeCompound: true,
        originalShapeIds: shapes.map(s => s.id)
      }
    }

    return { compoundShape, originalShapes: shapes }
  }, [editor])

  const addModifier = useCallback((type: ModifierType) => {
    if (!selectedShape) return

    // Handle boolean modifiers with multiple shapes selected
    if (type === 'boolean' && isMultiShapeSelection && editor) {
      console.log('🔧 Adding boolean modifier to multiple shapes:', selectedShapes.length)

      // Create compound shape containing all selected shapes
      const compoundResult = createCompoundShape(selectedShapes)
      if (!compoundResult) {
        console.error('❌ Failed to create compound shape')
        return
      }

      const { compoundShape, originalShapes } = compoundResult

      editor.run(() => {
        // Delete the original shapes
        editor.deleteShapes(originalShapes.map(s => s.id))

        // Create the compound shape
        editor.createShapes([compoundShape])

        // Select the new compound shape
        editor.select(compoundShape.id)

        // Create boolean modifier for the compound shape with multi-shape settings
        store.createModifier(compoundShape.id, type, {
          operation: 'union', // Default operation for multi-shape boolean
          isMultiShape: true,
          targetShapeIds: originalShapes.map(s => s.id)
        })
      }, { history: 'record' })

      console.log('✅ Multi-shape boolean modifier created successfully')
      return
    }

    // Standard single-shape modifier logic
    let targetShapeId: TLShapeId = selectedShape.id

    // Boolean result shapes should be treated as independent shapes
    if (selectedShape.meta?.appliedFromBoolean || selectedShape.meta?.isBooleanResult) {
      targetShapeId = selectedShape.id
    } else {
      // For preview clones/processed shapes, use the original shape ID
      const originalShapeId = getOriginalShapeId(selectedShape)
      if (originalShapeId && selectedShape.meta?.stackProcessed && !selectedShape.meta?.appliedFromModifier) {
        targetShapeId = originalShapeId
      }
      // For permanently applied modifier results and regular shapes, use the shape's own ID
    }

    // Create modifier using existing store method
    store.createModifier(targetShapeId, type, {})
  }, [selectedShape, selectedShapes, isMultiShapeSelection, store, editor, createCompoundShape])

  const applyModifiers = useCallback(() => {
    if (!selectedShape || !editor) return

    // Determine the correct shape ID to get modifiers from
    let targetShapeId: TLShapeId = selectedShape.id

    // Boolean result shapes should be treated as independent shapes
    if (selectedShape.meta?.appliedFromBoolean || selectedShape.meta?.isBooleanResult) {
      targetShapeId = selectedShape.id
    } else {
      // For preview clones/processed shapes, use the original shape ID
      const originalShapeId = getOriginalShapeId(selectedShape)
      if (originalShapeId && selectedShape.meta?.stackProcessed && !selectedShape.meta?.appliedFromModifier) {
        targetShapeId = originalShapeId
      }
      // For permanently applied modifier results and regular shapes, use the shape's own ID
    }

    // Get all enabled modifiers for this shape
    const enabledModifiers = store.getEnabledModifiersForShape(targetShapeId)

    console.log('🔧 Apply All started:', {
      selectedShapeId: selectedShape.id,
      targetShapeId,
      enabledModifiersCount: enabledModifiers.length,
      enabledModifiers: enabledModifiers.map(m => ({ id: m.id, type: m.type, enabled: m.enabled }))
    })

    if (enabledModifiers.length === 0) {
      console.log('❌ No enabled modifiers found, returning early')
      return
    }

    try {
      // Get the actual shape to apply modifiers to
      const actualOriginalShape = targetShapeId !== selectedShape.id
        ? editor.getShape(targetShapeId) || selectedShape
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

            // Create the boolean result shape with complete TLDraw metadata
            const newId = createShapeId()
            const resultShape = {
              id: newId,
              type: booleanResult.type,
              x: booleanResult.x,
              y: booleanResult.y,
              rotation: 0,
              isLocked: false,
              opacity: 1,
              props: booleanResult.props,
              parentId: actualOriginalShape.parentId,
              index: actualOriginalShape.index, // Inherit index from original shape
              typeName: 'shape' as const, // Required by TLDraw
              meta: {
                appliedFromBoolean: true,
                originalShapeId: actualOriginalShape.id,
                isBooleanResult: true
              }
            }

            editor.createShapes([resultShape])

            // Select the newly created boolean result shape to update transform controls
            editor.select(newId)
            console.log('✅ Boolean result shape created and selected successfully!')
          } else {
            console.error('❌ No boolean result shape found in transform results')
          }
        } else {
          // Array modifiers: Create clones alongside the original
          console.log('🏗️ Handling array modifiers - creating clones')

          // Create actual shapes from the transformed results (transformedShapes already excludes the original)
          const shapesToCreate = transformedShapes.map(transformedShape => {
            const newId = createShapeId()
            return {
              id: newId,
              type: transformedShape.type,
              x: transformedShape.x,
              y: transformedShape.y,
              rotation: 0, // Always create with 0 rotation, then apply rotation separately
              isLocked: false,
              opacity: 1,
              props: transformedShape.props,
              parentId: actualOriginalShape.parentId,
              index: actualOriginalShape.index, // Inherit index from original shape
              typeName: 'shape' as const, // Required by TLDraw
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
            transformedShapes.forEach((transformedShape, index) => {
              const targetRotation = transformedShape.meta?.targetRotation as number
              if (targetRotation && targetRotation !== 0) {
                const shapeId = shapesToCreate[index].id
                applyRotationToShapes(editor, [shapeId], targetRotation)
              }
            })

            // Apply scaling using resizeShape for center-based scaling
            transformedShapes.forEach((transformedShape, index) => {
              const targetScaleX = transformedShape.meta?.targetScaleX as number
              const targetScaleY = transformedShape.meta?.targetScaleY as number
              if (targetScaleX && targetScaleY && (targetScaleX !== 1 || targetScaleY !== 1)) {
                const shapeId = shapesToCreate[index].id
                editor.resizeShape(shapeId, new Vec(targetScaleX, targetScaleY))
              }
            })

            // Select all newly created shapes along with the original to update transform controls
            const allShapeIds = [actualOriginalShape.id, ...shapesToCreate.map(s => s.id)]
            editor.select(...allShapeIds)
            console.log('✅ Array modifier shapes created and selected successfully!')
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

    // Determine the correct shape ID to apply modifiers to (same logic as applyModifiers)
    let targetShapeId = selectedShape.id

    // Boolean result shapes should be treated as independent shapes
    if (selectedShape.meta?.appliedFromBoolean || selectedShape.meta?.isBooleanResult) {
      targetShapeId = selectedShape.id
    } else {
      // For preview clones/processed shapes, use the original shape ID
      const originalShapeId = getOriginalShapeId(selectedShape)
      if (originalShapeId && selectedShape.meta?.stackProcessed && !selectedShape.meta?.appliedFromModifier) {
        targetShapeId = originalShapeId
      }
      // For permanently applied modifier results and regular shapes, use the shape's own ID
    }

    try {
      // Get the actual shape to apply modifiers to
      const actualOriginalShape = targetShapeId !== selectedShape.id
        ? editor.getShape(targetShapeId) || selectedShape
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
            isLocked: false,
            opacity: 1,
            props: transformedShape.props,
            parentId: actualOriginalShape.parentId,
            index: actualOriginalShape.index, // Inherit index from original shape
            typeName: 'shape' as const, // Required by TLDraw
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

            // Select all newly created shapes along with the original to update transform controls
            const allShapeIds = [actualOriginalShape.id, ...shapesToCreate.map(s => s.id)]
            editor.select(...allShapeIds)
            console.log('✅ Single modifier shapes created and selected successfully!')
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
    selectedShapes,
    isMultiShapeSelection,
    shapeModifiers,
    hasEnabledModifiers,
    addModifier,
    removeModifier,
    toggleModifier,
    applyModifier,
    applyModifiers
  }
} 
