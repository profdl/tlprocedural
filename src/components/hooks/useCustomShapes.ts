import { useContext } from 'react'
import { CustomShapesContext, type CustomTrayItem } from '../providers/CustomShapesContext'

export { type CustomTrayItem }

export function useCustomShapes() {
  const context = useContext(CustomShapesContext)
  if (!context) {
    throw new Error('useCustomShapes must be used within a CustomShapesProvider')
  }
  return context
}
