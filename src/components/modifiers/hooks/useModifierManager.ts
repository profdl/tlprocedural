import { useCallback, useMemo } from 'react'
import { useModifierStore } from '../../../store/modifierStore'
import { ModifierStack, extractShapesFromState } from '../../../store/modifiers'
import { DEFAULT_SETTINGS } from '../constants'
import { useEditor } from 'tldraw'
import type { TLShape } from 'tldraw'
import type { TLModifier, TLModifierId } from '../../../types/modifiers'

type ModifierType = 'linear' | 'circular' | 'grid' | 'mirror'

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
    return selectedShape ? store.getModifiersForShape(selectedShape.id) : []
  }, [store, selectedShape])

  // Check if there are any enabled modifiers that can be applied
  const hasEnabledModifiers = useMemo(() => {
    return shapeModifiers.some(modifier => modifier.enabled)
  }, [shapeModifiers])

  const addModifier = useCallback((type: ModifierType) => {
    if (!selectedShape) return
    // Map UI type to store type
    const typeMap: Record<ModifierType, 'linear-array' | 'circular-array' | 'grid-array' | 'mirror'> = {
      linear: 'linear-array',
      circular: 'circular-array',
      grid: 'grid-array',
      mirror: 'mirror',
    }
    const storeType = typeMap[type]
    const settings = DEFAULT_SETTINGS[storeType] || {}
    store.createModifier(selectedShape.id, storeType, settings)
  }, [selectedShape, store])

  const applyModifiers = useCallback(() => {
    if (!selectedShape || !editor) return
    
    // Get all enabled modifiers for this shape
    const enabledModifiers = store.getEnabledModifiersForShape(selectedShape.id)
    if (enabledModifiers.length === 0) return

    try {
      // Process the modifiers to get the transformed shapes
      const result = ModifierStack.processModifiers(selectedShape, enabledModifiers, editor)
      const transformedShapes = extractShapesFromState(result)
      
      // Create actual shapes from the transformed results (skip the first one as it's the original)
      const shapesToCreate = transformedShapes.slice(1).map(transformedShape => {
        // Create shape object without id, letting tldraw generate new IDs
        return {
          type: transformedShape.type,
          x: transformedShape.x,
          y: transformedShape.y,
          rotation: transformedShape.rotation,
          props: transformedShape.props,
          parentId: selectedShape.parentId,
          meta: {
            ...transformedShape.meta,
            appliedFromModifier: true,
            originalShapeId: selectedShape.id
          }
        }
      })

      if (shapesToCreate.length > 0) {
        // Create the shapes in the editor
        editor.createShapes(shapesToCreate)
        
        // Remove the modifiers from the original shape since they're now applied
        enabledModifiers.forEach(modifier => {
          store.deleteModifier(modifier.id)
        })
        
        console.log(`Applied ${shapesToCreate.length} shapes from modifiers`)
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

  return {
    selectedShape,
    shapeModifiers,
    hasEnabledModifiers,
    addModifier,
    removeModifier,
    toggleModifier,
    applyModifiers
  }
} 