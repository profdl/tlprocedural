import { useState, useEffect, useCallback } from 'react'

export interface CustomTrayItem {
  id: string
  label: string
  iconSvg: string
  shapeType: string
  defaultProps: Record<string, unknown>
  createdAt: number
}

const STORAGE_KEY = 'tldraw-custom-shapes'

/**
 * Hook for managing persistent custom shapes in localStorage
 * Provides CRUD operations for custom shape tray items
 */
export function useCustomShapes() {
  const [customShapes, setCustomShapes] = useState<CustomTrayItem[]>([])

  // Load custom shapes from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as CustomTrayItem[]
        setCustomShapes(parsed)
      }
    } catch (error) {
      console.warn('Failed to load custom shapes from storage:', error)
    }
  }, [])

  // Save custom shapes to localStorage whenever they change
  const saveToStorage = useCallback((shapes: CustomTrayItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shapes))
    } catch (error) {
      console.warn('Failed to save custom shapes to storage:', error)
    }
  }, [])

  // Add a new custom shape
  const addCustomShape = useCallback((shape: Omit<CustomTrayItem, 'id' | 'createdAt'>) => {
    const newShape: CustomTrayItem = {
      ...shape,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    }

    setCustomShapes(prev => {
      const updated = [...prev, newShape]
      saveToStorage(updated)
      return updated
    })

    return newShape.id
  }, [saveToStorage])

  // Remove a custom shape by ID
  const removeCustomShape = useCallback((id: string) => {
    setCustomShapes(prev => {
      const updated = prev.filter(shape => shape.id !== id)
      saveToStorage(updated)
      return updated
    })
  }, [saveToStorage])

  // Clear all custom shapes
  const clearCustomShapes = useCallback(() => {
    setCustomShapes([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear custom shapes from storage:', error)
    }
  }, [])

  // Get a custom shape by ID
  const getCustomShape = useCallback((id: string) => {
    return customShapes.find(shape => shape.id === id)
  }, [customShapes])

  return {
    customShapes,
    addCustomShape,
    removeCustomShape,
    clearCustomShapes,
    getCustomShape
  }
}