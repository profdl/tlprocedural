import { useMemo } from 'react'
import { type TLShape } from 'tldraw'
import { ModifierStack, extractShapesFromState } from '../../../store/modifierStack'
import { useModifierStore } from '../../../store/modifierStore'
import type { TLModifier, TLModifierId } from '../../../types/modifiers'

/**
 * Hook for processing modifiers using the ModifierStack with Zustand store integration
 * 
 * This hook provides a clean API for getting and processing modifiers for a specific shape
 * using the centralized Zustand store.
 */
export function useModifierStack(shape: TLShape) {
  const store = useModifierStore()
  
  // Get modifiers for this shape from the store
  const modifiers = useMemo(() => {
    return store.getModifiersForShape(shape.id)
  }, [store, shape.id])
  
  // Get enabled modifiers for this shape
  const enabledModifiers = useMemo(() => {
    return store.getEnabledModifiersForShape(shape.id)
  }, [store, shape.id])
  
  // Process modifiers using ModifierStack
  const processedShapes = useMemo(() => {
    if (!enabledModifiers.length) return []
    
    const result = ModifierStack.processModifiers(shape, enabledModifiers)
    return extractShapesFromState(result)
  }, [shape, enabledModifiers])
  
  // Get modifier statistics for this shape
  const stats = useMemo(() => {
    return {
      totalModifiers: modifiers.length,
      enabledModifiers: enabledModifiers.length,
      disabledModifiers: modifiers.length - enabledModifiers.length,
      processedShapes: processedShapes.length
    }
  }, [modifiers.length, enabledModifiers.length, processedShapes.length])
  
  return {
    // Modifiers
    modifiers,
    enabledModifiers,
    
    // Processed results
    processedShapes,
    
    // Statistics
    stats,
    
    // Store actions (for convenience)
    addModifier: (type: 'linear-array' | 'circular-array' | 'grid-array' | 'mirror') => {
      // For now, we only support linear-array in the store
      if (type === 'linear-array') {
        return store.createLinearArrayModifier(shape.id)
      }
      console.warn(`Modifier type ${type} not yet supported in Zustand store`)
      return null
    },
    
    updateModifier: (modifierId: string, updates: Partial<TLModifier>) => {
      store.updateModifier(modifierId as TLModifierId, updates)
    },
    
    removeModifier: (modifierId: string) => {
      store.deleteModifier(modifierId as TLModifierId)
    },
    
    toggleModifier: (modifierId: string) => {
      store.toggleModifier(modifierId as TLModifierId)
    },
    
    clearModifiers: () => {
      store.deleteModifiersForShape(shape.id)
    }
  }
}

/**
 * Hook for getting all modifiers from the store with processing capabilities
 * 
 * This is useful for components that need to work with all modifiers across all shapes
 */
export function useAllModifierStacks() {
  const store = useModifierStore()
  
  const allModifiers = useMemo(() => {
    return store.getAllModifiers()
  }, [store])
  
  const enabledModifiers = useMemo(() => {
    return allModifiers.filter(m => m.enabled)
  }, [allModifiers])
  
  const stats = useMemo(() => {
    const shapesWithModifiers = new Set(allModifiers.map(m => m.targetShapeId)).size
    
    return {
      totalModifiers: allModifiers.length,
      enabledModifiers: enabledModifiers.length,
      disabledModifiers: allModifiers.length - enabledModifiers.length,
      shapesWithModifiers,
      totalShapes: shapesWithModifiers // This is an approximation
    }
  }, [allModifiers, enabledModifiers])
  
  return {
    allModifiers,
    enabledModifiers,
    stats,
    
    // Store actions
    clearAll: () => store.clearAll(),
    exportModifiers: () => store.exportModifiers(),
    importModifiers: (json: string) => store.importModifiers(json)
  }
} 