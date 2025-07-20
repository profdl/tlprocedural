import { useEditor } from 'tldraw'
import { StackedModifier } from '../StackedModifier'
import { useModifierRenderer, findTopLevelGroup } from '../hooks/useModifierRenderer'
import { useModifierStore } from '../../../store/modifierStore'

/**
 * Core component for rendering modifiers
 * Extracted from ModifierRenderer.tsx
 */
export function ModifierRendererCore() {
  const editor = useEditor()
  const store = useModifierStore()
  
  // Get all shapes and their modifiers
  const { shapesWithModifiers } = useModifierRenderer()
  
  // Use StackedModifier approach - one component per shape processes all modifiers
  return (
    <div className="modifier-renderer">
      {shapesWithModifiers.flatMap(({ shape, modifiers, modifiersKey }) => {
        if (shape.type === 'group' && editor) {
          // For groups, we need to process the group as a whole
          // The ModifierStack.processGroupModifiers will handle all child shapes
          // We only need one StackedModifier for the group itself
          return (
            <StackedModifier
              key={`stacked-group-${shape.id}-${modifiersKey}`}
              shape={shape}
              modifiers={modifiers}
            />
          )
        } else {
          // Check if this shape is part of a group that has modifiers
          const parentGroup = findTopLevelGroup(shape, editor)
          if (parentGroup) {
            const groupModifiers = store.getModifiersForShape(parentGroup.id)
            if (groupModifiers.length > 0) {
              // This shape is part of a group with modifiers, so it will be processed
              // by the group's StackedModifier - don't create a separate one
              return []
            }
          }
          
          return (
            <StackedModifier
              key={`stacked-${shape.id}-${modifiersKey}`}
              shape={shape}
              modifiers={modifiers}
            />
          )
        }
      })}
    </div>
  )
} 