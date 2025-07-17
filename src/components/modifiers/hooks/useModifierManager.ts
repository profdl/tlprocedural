import { useState, useCallback, useMemo } from 'react'
import { type TLShape, type TLShapeId } from 'tldraw'
import { type TLModifier, createModifierId } from '../../../types/modifiers'
import { DEFAULT_SETTINGS } from '../constants'

/**
 * Hook for managing modifiers on shapes
 * 
 * Provides a simple API for adding, updating, removing, and querying modifiers
 * associated with shapes.
 */
export function useModifierManager() {
  // Internal storage for modifiers (in a real app, this would be in a store)
  const [modifiers, setModifiers] = useState<Map<TLShapeId, any[]>>(new Map())

  /**
   * Get all modifiers for a specific shape
   * 
   * @param shapeId - The ID of the shape
   * @returns Array of modifiers for the shape
   */
  const getModifiers = useCallback((shapeId: TLShapeId): TLModifier[] => {
    return (modifiers.get(shapeId) || []) as TLModifier[]
  }, [modifiers])

  /**
   * Get enabled modifiers for a specific shape
   * 
   * @param shapeId - The ID of the shape
   * @returns Array of enabled modifiers for the shape
   */
  const getEnabledModifiers = useCallback((shapeId: TLShapeId): TLModifier[] => {
    return getModifiers(shapeId).filter(modifier => modifier.enabled)
  }, [getModifiers])

  /**
   * Add a new modifier to a shape
   * 
   * @param shapeId - The ID of the shape to add the modifier to
   * @param type - The type of modifier to add
   * @returns The created modifier
   */
  const addModifier = useCallback((shapeId: TLShapeId, type: 'linear-array' | 'circular-array' | 'grid-array' | 'mirror'): TLModifier => {
    const existingModifiers = getModifiers(shapeId)
    
    const newModifier = {
      id: createModifierId(),
      typeName: 'modifier',
      targetShapeId: shapeId,
      enabled: true,
      order: existingModifiers.length,
      type,
      props: DEFAULT_SETTINGS[type]
    } as any

    const updatedModifiers = [...existingModifiers, newModifier]
    setModifiers(prev => new Map(prev).set(shapeId, updatedModifiers))

    return newModifier
  }, [getModifiers])

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
    const existingModifiers = getModifiers(shapeId)
    const updatedModifiers = existingModifiers.map(modifier => 
      modifier.id === modifierId ? { ...modifier, ...updates } : modifier
    )
    
    setModifiers(prev => new Map(prev).set(shapeId, updatedModifiers))
  }, [getModifiers])

  /**
   * Remove a modifier from a shape
   * 
   * @param shapeId - The ID of the shape
   * @param modifierId - The ID of the modifier to remove
   */
  const removeModifier = useCallback((shapeId: TLShapeId, modifierId: string) => {
    const existingModifiers = getModifiers(shapeId)
    const filteredModifiers = existingModifiers.filter(modifier => modifier.id !== modifierId)
    
    setModifiers(prev => new Map(prev).set(shapeId, filteredModifiers))
  }, [getModifiers])

  /**
   * Toggle the enabled state of a modifier
   * 
   * @param shapeId - The ID of the shape
   * @param modifierId - The ID of the modifier to toggle
   */
  const toggleModifier = useCallback((shapeId: TLShapeId, modifierId: string) => {
    const existingModifiers = getModifiers(shapeId)
    const modifier = existingModifiers.find(m => m.id === modifierId)
    
    if (modifier) {
      updateModifier(shapeId, modifierId, { enabled: !modifier.enabled })
    }
  }, [getModifiers, updateModifier])

  /**
   * Remove all modifiers from a shape
   * 
   * @param shapeId - The ID of the shape
   */
  const clearModifiers = useCallback((shapeId: TLShapeId) => {
    setModifiers(prev => {
      const newMap = new Map(prev)
      newMap.delete(shapeId)
      return newMap
    })
  }, [])

  /**
   * Get statistics about modifiers
   * 
   * @returns Object with modifier statistics
   */
  const getStats = useMemo(() => {
    let totalModifiers = 0
    let enabledModifiers = 0
    let shapesWithModifiers = 0
    
    modifiers.forEach(shapeModifiers => {
      if (shapeModifiers.length > 0) {
        shapesWithModifiers++
        totalModifiers += shapeModifiers.length
        enabledModifiers += shapeModifiers.filter(m => m.enabled).length
      }
    })

    return {
      totalModifiers,
      enabledModifiers,
      disabledModifiers: totalModifiers - enabledModifiers,
      shapesWithModifiers,
      totalShapes: modifiers.size
    }
  }, [modifiers])

  /**
   * Check if a shape has any modifiers
   * 
   * @param shapeId - The ID of the shape
   * @returns True if the shape has modifiers
   */
  const hasModifiers = useCallback((shapeId: TLShapeId): boolean => {
    return getModifiers(shapeId).length > 0
  }, [getModifiers])

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
    
    // Internal state (for debugging)
    modifiers: modifiers as ReadonlyMap<TLShapeId, any[]>
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