import { useValue } from 'tldraw'
import { useEditor, type TLShape, type Editor } from 'tldraw'
import { useModifierStore } from '../../../store/modifierStore'
import type { TLModifier } from '../../../types/modifiers'

interface ShapeWithModifiers {
  shape: TLShape
  modifiers: TLModifier[]
  modifiersKey: string
}

interface UseModifierRendererReturn {
  shapesWithModifiers: ShapeWithModifiers[]
}

/**
 * Custom hook for processing shapes with modifiers
 * Extracted from ModifierRenderer.tsx
 */
export function useModifierRenderer(): UseModifierRendererReturn {
  const editor = useEditor()
  const store = useModifierStore()
  
  // Get all shapes and their modifiers
  const shapesWithModifiers = useValue(
    'shapes-with-modifiers',
    () => {
      const allShapes = editor.getCurrentPageShapes()
      console.log('useModifierRenderer: All shapes:', allShapes.length)
      
      const shapesWithMods = allShapes
        .map(shape => {
          const modifiers = store.getModifiersForShape(shape.id)
          return {
            shape,
            modifiers,
            // Create a stable key for memoization that includes shape position, style properties, and modifier properties
            modifiersKey: `${modifiers.map(m => `${m.id}-${m.enabled}-${JSON.stringify(m.props)}`).join('|')}-${shape.x}-${shape.y}-${shape.rotation}-${JSON.stringify(shape.props)}`
          }
        })
        .filter(item => item.modifiers.length > 0)
      
      console.log('useModifierRenderer: Shapes with modifiers:', shapesWithMods.length)
      shapesWithMods.forEach(item => {
        console.log(`Shape ${item.shape.id} has ${item.modifiers.length} modifiers:`, item.modifiers.map((m: TLModifier) => m.type))
      })
      
      return shapesWithMods
    },
    [editor, store] // Track both editor and store changes
  )

  return {
    shapesWithModifiers
  }
}

/**
 * Helper function to find the top-level group of a shape
 * Extracted from ModifierRenderer.tsx
 */
export function findTopLevelGroup(shape: TLShape, editor: Editor): TLShape | null {
  if (shape.type === 'group') {
    return shape
  }
  const parent = shape.parentId ? editor.getShape(shape.parentId) : null
  if (parent && parent.type === 'group') {
    return findTopLevelGroup(parent, editor)
  }
  return null
} 