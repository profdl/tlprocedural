import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { setCustomShapesRegistry } from './CustomShapesRegistry'

export interface CustomTrayItem {
  id: string
  label: string
  iconSvg: string
  shapeType: string
  defaultProps: Record<string, unknown>
  createdAt: number
  version: number
  lastModified: number
}

interface CustomShapesContextType {
  customShapes: CustomTrayItem[]
  addCustomShape: (shape: Omit<CustomTrayItem, 'id' | 'createdAt' | 'version' | 'lastModified'>) => string
  updateCustomShape: (id: string, updates: Partial<Omit<CustomTrayItem, 'id' | 'createdAt' | 'version' | 'lastModified'>>) => void
  removeCustomShape: (id: string) => void
  clearCustomShapes: () => void
  getCustomShape: (id: string) => CustomTrayItem | undefined
}

const CustomShapesContext = createContext<CustomShapesContextType | null>(null)

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
        if (initialShapes.some((shape, index) =>
          !parsed[index].version || !parsed[index].lastModified
        )) {
          saveToStorage(initialShapes)
        }
      }

      // Add a default sample custom shape for testing if no shapes exist
      if (initialShapes.length === 0) {
        const sampleShape: CustomTrayItem = {
          id: 'sample-bezier-heart',
          label: 'Sample Heart',
          iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 6 4 C 4 4 2 6 2 8 C 2 12 12 20 12 20 C 12 20 22 12 22 8 C 22 6 20 4 18 4 C 16 4 12 8 12 8 C 12 8 8 4 6 4 Z"/></svg>',
          shapeType: 'bezier',
          defaultProps: {
            w: 100,
            h: 80,
            points: [
              { x: 50, y: 15 },
              { x: 25, y: 5, cp2: { x: 5, y: 5 } },
              { x: 5, y: 25, cp1: { x: 5, y: 15 } },
              { x: 50, y: 75, cp1: { x: 20, y: 40 } },
              { x: 95, y: 25, cp2: { x: 80, y: 40 } },
              { x: 75, y: 5, cp1: { x: 95, y: 15 } },
              { x: 50, y: 15, cp1: { x: 95, y: 5 } }
            ],
            isClosed: true,
            color: '#e91e63',
            fillColor: '#e91e63',
            strokeWidth: 2,
            fill: true,
            editMode: false,
            selectedPointIndices: [],
            hoverPoint: undefined,
            hoverSegmentIndex: undefined
          },
          createdAt: Date.now(),
          version: 1,
          lastModified: Date.now()
        }

        initialShapes = [sampleShape]
        saveToStorage(initialShapes)
      }

      setCustomShapes(initialShapes)
    } catch (error) {
      console.warn('Failed to load custom shapes from storage:', error)
    }
  }, [])

  // Keep the non-React registry in sync for tools that run outside React context
  useEffect(() => {
    setCustomShapesRegistry(customShapes)
  }, [customShapes])

  // Save custom shapes to localStorage whenever they change
  const saveToStorage = useCallback((shapes: CustomTrayItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shapes))
    } catch (error) {
      console.warn('Failed to save custom shapes to storage:', error)
    }
  }, [])

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
export function useCustomShapes(): CustomShapesContextType {
  const context = useContext(CustomShapesContext)
  if (!context) {
    throw new Error('useCustomShapes must be used within a CustomShapesProvider')
  }
  return context
}
