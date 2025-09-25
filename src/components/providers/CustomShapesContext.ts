import { createContext } from 'react'

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

export interface CustomShapesContextType {
  customShapes: CustomTrayItem[]
  addCustomShape: (shape: Omit<CustomTrayItem, 'id' | 'createdAt' | 'version' | 'lastModified'>) => string
  updateCustomShape: (id: string, updates: Partial<Omit<CustomTrayItem, 'id' | 'createdAt' | 'version' | 'lastModified'>>) => void
  removeCustomShape: (id: string) => void
  clearCustomShapes: () => void
  getCustomShape: (id: string) => CustomTrayItem | undefined
}

export const CustomShapesContext = createContext<CustomShapesContextType | null>(null)
