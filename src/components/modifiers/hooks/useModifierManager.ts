import { useCallback, useMemo } from 'react'
import { useModifierStore } from '../../../store/modifierStore'
import { ModifierStack, extractShapesFromState } from '../../../store/modifiers'
import { getOriginalShapeId } from '../utils'
import { isPathModifierType } from '../../../store/modifiers/core/PathModifier'
import { applyRotationToShapes } from '../utils/transformUtils'
import { useEditor, createShapeId } from 'tldraw'
import type { TLShape } from 'tldraw'
import type { TLModifier, TLModifierId } from '../../../types/modifiers'

type ModifierType = 'linear' | 'circular' | 'grid' | 'mirror' | 'lsystem' | 'subdivide' | 'noise-offset' | 'smooth' | 'simplify'

// Optimized mapping from UI type names to internal store type names
const UI_TO_STORE_TYPE_MAP: Record<ModifierType, 'linear-array' | 'circular-array' | 'grid-array' | 'mirror' | 'lsystem' | 'subdivide' | 'noise-offset' | 'smooth' | 'simplify'> = {
  linear: 'linear-array',
  circular: 'circular-array',
  grid: 'grid-array',
  mirror: 'mirror',
  lsystem: 'lsystem',
  subdivide: 'subdivide',
  'noise-offset': 'noise-offset',
  smooth: 'smooth',
  simplify: 'simplify'
} as const

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

    // Map UI type to internal type using the optimized constant
    const storeType = UI_TO_STORE_TYPE_MAP[type]

    // Create modifier using existing store method (simpler approach)
    store.createModifier(originalShapeId as import('tldraw').TLShapeId, storeType, {})
  }, [selectedShape, store])

  const applyModifiers = useCallback(() => {
    if (!selectedShape || !editor) return
    
    // Use original shape ID for clones/processed shapes
    const originalShapeId = getOriginalShapeId(selectedShape) || selectedShape.id
    
    // Get all enabled modifiers for this shape
    const enabledModifiers = store.getEnabledModifiersForShape(originalShapeId as import('tldraw').TLShapeId)
    if (enabledModifiers.length === 0) return

    try {
      // Get the actual original shape for processing
      const actualOriginalShape = originalShapeId !== selectedShape.id
        ? editor.getShape(originalShapeId as import('tldraw').TLShapeId) || selectedShape
        : selectedShape
      
      // Categorize modifiers
      const pathModifiers = enabledModifiers.filter(m => isPathModifierType(m.type))
      const arrayModifiers = enabledModifiers.filter(m => !isPathModifierType(m.type))
      
      if (pathModifiers.length > 0) {
        // Handle path modifiers: update the original shape with modified path data
        const result = ModifierStack.processModifiers(actualOriginalShape, enabledModifiers, editor)
        const transformedShapes = extractShapesFromState(result)
        
        if (transformedShapes.length > 0) {
          const modifiedShape = transformedShapes[0] // For path modifiers, we want the modified original
          
          // Update the original shape with the modified data
          editor.run(() => {
            // Create update object preserving all properties
            // CRITICAL: Use modifiedShape.type to handle shape conversions (e.g., polygon → bezier)
            // When shape type changes, use only the new props to avoid invalid property mixing
            const isTypeChange = actualOriginalShape.type !== modifiedShape.type

            const updateData = {
              id: actualOriginalShape.id,
              type: modifiedShape.type,
              props: isTypeChange
                ? modifiedShape.props  // Type change: use only new props (prevents polygon+isClosed errors)
                : {  // Same type: merge props for updates
                    ...actualOriginalShape.props,
                    ...modifiedShape.props
                  }
            }

            // Include metadata if the shape was path-modified
            if (modifiedShape.meta?.pathModified) {
              const updateDataWithMeta = {
                ...updateData,
                meta: {
                  ...actualOriginalShape.meta,
                  ...modifiedShape.meta
                }
              }
              console.log('🔧 Applying path modifier - updating shape with meta:', {
                id: updateDataWithMeta.id,
                originalType: actualOriginalShape.type,
                newType: updateDataWithMeta.type,
                isTypeChange,
                editMode: (updateDataWithMeta.props as any)?.editMode,
                pathModified: updateDataWithMeta.meta?.pathModified
              })

              if (isTypeChange) {
                // TLDraw can't change shape type via updateShape - must delete and recreate
                console.log('🔄 Type change detected: deleting and recreating shape')

                // Preserve position and transform properties from original shape
                const shapeToCreate = {
                  ...updateDataWithMeta,
                  x: actualOriginalShape.x,
                  y: actualOriginalShape.y,
                  rotation: actualOriginalShape.rotation,
                  opacity: actualOriginalShape.opacity,
                  parentId: actualOriginalShape.parentId,
                  index: actualOriginalShape.index
                }

                editor.deleteShapes([actualOriginalShape.id])
                editor.createShapes([shapeToCreate])
              } else {
                editor.updateShape(updateDataWithMeta)
              }
            } else {
              console.log('🔧 Applying path modifier - updating shape:', {
                id: updateData.id,
                originalType: actualOriginalShape.type,
                newType: updateData.type,
                isTypeChange,
                editMode: (updateData.props as any)?.editMode
              })

              if (isTypeChange) {
                // TLDraw can't change shape type via updateShape - must delete and recreate
                console.log('🔄 Type change detected: deleting and recreating shape')

                // Preserve position and transform properties from original shape
                const shapeToCreate = {
                  ...updateData,
                  x: actualOriginalShape.x,
                  y: actualOriginalShape.y,
                  rotation: actualOriginalShape.rotation,
                  opacity: actualOriginalShape.opacity,
                  parentId: actualOriginalShape.parentId,
                  index: actualOriginalShape.index
                }

                editor.deleteShapes([actualOriginalShape.id])
                editor.createShapes([shapeToCreate])
              } else {
                editor.updateShape(updateData)
              }
            }
            
            // Clean up any existing clones from the modifier system
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
          }, { history: 'record' })
          
          // Remove applied path modifiers
          pathModifiers.forEach(modifier => {
            store.deleteModifier(modifier.id)
          })
        }
      } else if (arrayModifiers.length > 0) {
        // Handle array modifiers: create new shapes (existing behavior)
        const result = ModifierStack.processModifiers(actualOriginalShape, arrayModifiers, editor)
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
              ...transformedShape.meta,
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

          // Remove the applied modifiers
          arrayModifiers.forEach(modifier => {
            store.deleteModifier(modifier.id)
          })
        }
      }
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

      // Process only this specific modifier
      const modifiersToProcess = [modifier]

      // Categorize the modifier
      const isPathModifier = isPathModifierType(modifier.type)

      if (isPathModifier) {
        // Handle path modifiers: update the original shape with modified path data
        const result = ModifierStack.processModifiers(actualOriginalShape, modifiersToProcess, editor)
        const transformedShapes = extractShapesFromState(result)

        if (transformedShapes.length > 0) {
          const modifiedShape = transformedShapes[0]

          // Update the original shape with the modified data
          editor.run(() => {
            // Check if shape type is changing to handle prop merging correctly
            const isTypeChange = actualOriginalShape.type !== modifiedShape.type

            const updateData = {
              id: actualOriginalShape.id,
              type: modifiedShape.type, // CRITICAL: Use modifiedShape.type for shape conversions
              props: isTypeChange
                ? modifiedShape.props  // Type change: use only new props
                : {  // Same type: merge props for updates
                    ...actualOriginalShape.props,
                    ...modifiedShape.props
                  }
            }

            if (modifiedShape.meta?.pathModified) {
              const updateDataWithMeta = {
                ...updateData,
                meta: {
                  ...actualOriginalShape.meta,
                  ...modifiedShape.meta
                }
              }

              if (isTypeChange) {
                // TLDraw can't change shape type via updateShape - must delete and recreate
                const shapeToCreate = {
                  ...updateDataWithMeta,
                  x: actualOriginalShape.x,
                  y: actualOriginalShape.y,
                  rotation: actualOriginalShape.rotation,
                  opacity: actualOriginalShape.opacity,
                  parentId: actualOriginalShape.parentId,
                  index: actualOriginalShape.index
                }

                editor.deleteShapes([actualOriginalShape.id])
                editor.createShapes([shapeToCreate])
              } else {
                editor.updateShape(updateDataWithMeta)
              }
            } else {
              if (isTypeChange) {
                // TLDraw can't change shape type via updateShape - must delete and recreate
                const shapeToCreate = {
                  ...updateData,
                  x: actualOriginalShape.x,
                  y: actualOriginalShape.y,
                  rotation: actualOriginalShape.rotation,
                  opacity: actualOriginalShape.opacity,
                  parentId: actualOriginalShape.parentId,
                  index: actualOriginalShape.index
                }

                editor.deleteShapes([actualOriginalShape.id])
                editor.createShapes([shapeToCreate])
              } else {
                editor.updateShape(updateData)
              }
            }

            // Clean up any existing clones from the modifier system
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
          }, { history: 'record' })

          // Remove the applied modifier
          store.deleteModifier(modifier.id)
        }
      } else {
        // Handle array modifiers: create new shapes
        const result = ModifierStack.processModifiers(actualOriginalShape, modifiersToProcess, editor)
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
              ...transformedShape.meta,
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