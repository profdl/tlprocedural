import { useCallback, useMemo } from 'react'
import { type TLShapeId } from 'tldraw'
import { type TLModifier, type TLModifierId, createModifierId } from '../../../types/modifiers'
import { DEFAULT_SETTINGS } from '../constants'
import { useModifierStore } from '../../../store/modifierStore'

/**
 * Hook for managing modifiers on shapes
 * 
 * Provides a simple API for adding, updating, removing, and querying modifiers
 * associated with shapes. Now uses the centralized Zustand store.
 */
export function useModifierManager() {
  const store = useModifierStore()

  /**
   * Get all modifiers for a specific shape
   * 
   * @param shapeId - The ID of the shape
   * @returns Array of modifiers for the shape
   */
  const getModifiers = useCallback((shapeId: TLShapeId): TLModifier[] => {
    return store.getModifiersForShape(shapeId)
  }, [store])

  /**
   * Get enabled modifiers for a specific shape
   * 
   * @param shapeId - The ID of the shape
   * @returns Array of enabled modifiers for the shape
   */
  const getEnabledModifiers = useCallback((shapeId: TLShapeId): TLModifier[] => {
    return store.getEnabledModifiersForShape(shapeId)
  }, [store])

  /**
   * Add a new modifier to a shape
   * 
   * @param shapeId - The ID of the shape to add the modifier to
   * @param type - The type of modifier to add
   * @returns The created modifier
   */
  const addModifier = useCallback((shapeId: TLShapeId, type: 'linear-array' | 'circular-array' | 'grid-array' | 'mirror'): TLModifier => {
    // For now, we only support linear-array in the store
    // TODO: Add support for other modifier types
    if (type === 'linear-array') {
      return store.createLinearArrayModifier(shapeId, DEFAULT_SETTINGS[type])
    }
    
    // Fallback for other types - create a basic modifier structure
    const newModifier = {
      id: createModifierId(),
      typeName: 'modifier',
      targetShapeId: shapeId,
      enabled: true,
      order: store.getModifiersForShape(shapeId).length,
      type,
      props: DEFAULT_SETTINGS[type]
    } as TLModifier

    // For now, we'll need to add support for other types in the store
    // This is a temporary workaround
    console.warn(`Modifier type ${type} not yet supported in Zustand store`)
    
    return newModifier
  }, [store])

  /**
   * Update a specific modifier
   * 
   * @param shapeId - The ID of the shape
   * @param modifierId - The ID of the modifier to update
   * @param updates - Partial updates to apply to the modifier
   */
  const updateModifier = useCallback((
    shapeId: TLShapeId, 
    modifierId: string, 
    updates: Partial<TLModifier>
  ) => {
    store.updateModifier(modifierId as TLModifierId, updates)
  }, [store])

  /**
   * Remove a modifier from a shape
   * 
   * @param shapeId - The ID of the shape
   * @param modifierId - The ID of the modifier to remove
   */
  const removeModifier = useCallback((shapeId: TLShapeId, modifierId: string) => {
    store.deleteModifier(modifierId as TLModifierId)
  }, [store])

  /**
   * Toggle the enabled state of a modifier
   * 
   * @param shapeId - The ID of the shape
   * @param modifierId - The ID of the modifier to toggle
   */
  const toggleModifier = useCallback((shapeId: TLShapeId, modifierId: string) => {
    store.toggleModifier(modifierId as TLModifierId)
  }, [store])

  /**
   * Remove all modifiers from a shape
   * 
   * @param shapeId - The ID of the shape
   */
  const clearModifiers = useCallback((shapeId: TLShapeId) => {
    store.deleteModifiersForShape(shapeId)
  }, [store])

  /**
   * Get statistics about modifiers
   * 
   * @returns Object with modifier statistics
   */
  const getStats = useMemo(() => {
    const allModifiers = store.getAllModifiers()
    const totalModifiers = allModifiers.length
    const enabledModifiers = allModifiers.filter(m => m.enabled).length
    const shapesWithModifiers = new Set(allModifiers.map(m => m.targetShapeId)).size

    return {
      totalModifiers,
      enabledModifiers,
      disabledModifiers: totalModifiers - enabledModifiers,
      shapesWithModifiers,
      totalShapes: shapesWithModifiers // This is an approximation
    }
  }, [store])

  /**
   * Check if a shape has any modifiers
   * 
   * @param shapeId - The ID of the shape
   * @returns True if the shape has modifiers
   */
  const hasModifiers = useCallback((shapeId: TLShapeId): boolean => {
    return store.hasModifiers(shapeId)
  }, [store])

  /**
   * Check if a shape has any enabled modifiers
   * 
   * @param shapeId - The ID of the shape
   * @returns True if the shape has enabled modifiers
   */
  const hasEnabledModifiers = useCallback((shapeId: TLShapeId): boolean => {
    return getEnabledModifiers(shapeId).length > 0
  }, [getEnabledModifiers])

  /**
   * Get modifiers by type for a shape
   * 
   * @param shapeId - The ID of the shape
   * @param type - The type of modifier to filter by
   * @returns Array of modifiers of the specified type
   */
  const getModifiersByType = useCallback((
    shapeId: TLShapeId, 
    type: 'linear-array' | 'circular-array' | 'grid-array' | 'mirror'
  ): TLModifier[] => {
    return getModifiers(shapeId).filter(modifier => modifier.type === type)
  }, [getModifiers])

  return {
    // Core operations
    getModifiers,
    getEnabledModifiers,
    addModifier,
    updateModifier,
    removeModifier,
    toggleModifier,
    clearModifiers,
    
    // Queries
    hasModifiers,
    hasEnabledModifiers,
    getModifiersByType,
    getStats,
    
    // Internal state (for debugging) - now from store
    modifiers: store.getAllModifiers()
  }
}

/**
 * Hook for managing modifiers for a specific shape
 * 
 * Provides a simplified API focused on a single shape
 * 
 * @param shapeId - The ID of the shape to manage modifiers for
 * @returns Object with modifier management functions for the specific shape
 */
export function useShapeModifiers(shapeId: TLShapeId) {
  const manager = useModifierManager()
  
  return useMemo(() => ({
    modifiers: manager.getModifiers(shapeId),
    enabledModifiers: manager.getEnabledModifiers(shapeId),
    hasModifiers: manager.hasModifiers(shapeId),
    hasEnabledModifiers: manager.hasEnabledModifiers(shapeId),
    
    addModifier: (type: 'linear-array' | 'circular-array' | 'grid-array' | 'mirror') => 
      manager.addModifier(shapeId, type),
    
    updateModifier: (modifierId: string, updates: Partial<TLModifier>) => 
      manager.updateModifier(shapeId, modifierId, updates),
    
    removeModifier: (modifierId: string) => 
      manager.removeModifier(shapeId, modifierId),
    
    toggleModifier: (modifierId: string) => 
      manager.toggleModifier(shapeId, modifierId),
    
    clearModifiers: () => manager.clearModifiers(shapeId),
    
    getModifiersByType: (type: 'linear-array' | 'circular-array' | 'grid-array' | 'mirror') => 
      manager.getModifiersByType(shapeId, type)
  }), [manager, shapeId])
} 