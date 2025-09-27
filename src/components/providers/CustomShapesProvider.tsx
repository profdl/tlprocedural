import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { setCustomShapesRegistry } from './CustomShapesRegistry'
import {
  CustomShapesContext,
  type CustomShapesContextType,
  type CustomTrayItem
} from './CustomShapesContext'

const STORAGE_KEY = 'tldraw-custom-shapes'

interface CustomShapesProviderProps {
  children: ReactNode
}

/**
 * Provider for managing custom shapes state across the entire application
 * Ensures all components share the same custom shapes data
 */
export function CustomShapesProvider({ children }: CustomShapesProviderProps) {
  const [customShapes, setCustomShapes] = useState<CustomTrayItem[]>([])

  // Save custom shapes to localStorage whenever they change
  const saveToStorage = useCallback((shapes: CustomTrayItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shapes))
    } catch (error) {
      console.warn('Failed to save custom shapes to storage:', error)
    }
  }, [])

  // Load custom shapes from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      let initialShapes: CustomTrayItem[] = []

      if (stored) {
        const parsed = JSON.parse(stored) as (CustomTrayItem | Partial<CustomTrayItem>)[]

        // Migrate existing custom shapes to new format
        initialShapes = parsed.map(shape => {
          if (!shape.version || !shape.lastModified) {
            return {
              ...shape,
              version: 1,
              lastModified: shape.createdAt || Date.now()
            } as CustomTrayItem
          }
          return shape as CustomTrayItem
        })

        // Save migrated shapes back to storage if migration occurred
        if (initialShapes.some((_, index) =>
          !parsed[index].version || !parsed[index].lastModified
        )) {
          saveToStorage(initialShapes)
        }
      }

      // Remove the default sample custom shape - no longer needed

      setCustomShapes(initialShapes)
    } catch (error) {
      console.warn('Failed to load custom shapes from storage:', error)
    }
  }, [saveToStorage])

  // Keep the non-React registry in sync for tools that run outside React context
  useEffect(() => {
    setCustomShapesRegistry(customShapes)
  }, [customShapes])

  // Add a new custom shape
  const addCustomShape = useCallback((shape: Omit<CustomTrayItem, 'id' | 'createdAt' | 'version' | 'lastModified'>) => {
    const now = Date.now()
    const newShape: CustomTrayItem = {
      ...shape,
      id: `custom-${now}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      version: 1,
      lastModified: now
    }

    setCustomShapes(prev => {
      const updated = [...prev, newShape]
      saveToStorage(updated)
      return updated
    })

    return newShape.id
  }, [saveToStorage])

  // Update an existing custom shape
  const updateCustomShape = useCallback((id: string, updates: Partial<Omit<CustomTrayItem, 'id' | 'createdAt' | 'version' | 'lastModified'>>) => {
    setCustomShapes(prev => {
      const updated = prev.map(shape => {
        if (shape.id === id) {
          return {
            ...shape,
            ...updates,
            version: shape.version + 1,
            lastModified: Date.now()
          }
        }
        return shape
      })
      saveToStorage(updated)
      return updated
    })
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

  const contextValue: CustomShapesContextType = {
    customShapes,
    addCustomShape,
    updateCustomShape,
    removeCustomShape,
    clearCustomShapes,
    getCustomShape
  }

  return (
    <CustomShapesContext.Provider value={contextValue}>
      {children}
    </CustomShapesContext.Provider>
  )
}

/**
 * Hook for accessing custom shapes context
 * Must be used within a CustomShapesProvider
 */
// The hook lives in src/components/hooks/useCustomShapes.ts to keep this file component-only.
