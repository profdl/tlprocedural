import type { TLShape } from 'tldraw'
import type { TLModifier } from '../../types/modifiers'
import { useStackedModifier } from './hooks/useStackedModifier'
import { useCloneManager } from './hooks/useCloneManager'

interface StackedModifierProps {
  shape: TLShape
  modifiers: TLModifier[]
}

/**
 * Refactored StackedModifier component
 * Uses extracted hooks for better separation of concerns
 */
export function StackedModifier({ shape, modifiers }: StackedModifierProps) {
  // Process shapes with modifiers
  const { processedShapes, shapeKey, modifiersKey } = useStackedModifier({ shape, modifiers })
  
  // Manage clones in the editor
  useCloneManager({ 
    shape, 
    modifiers, 
    processedShapes, 
    shapeKey, 
    modifiersKey 
  })

  // This component doesn't render anything visible - shapes are managed directly in the editor
  return null
} 