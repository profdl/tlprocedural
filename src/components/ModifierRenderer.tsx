import { useValue, useEditor } from 'tldraw'
import { LinearArrayModifier, CircularArrayModifier, GridArrayModifier } from './modifiers/LinearArrayModifier'
import { StackedModifier } from './modifiers/StackedModifier'
import { getShapeModifiers, useModifierRefresh } from './modifiers/ModifierControls'

export function ModifierRenderer() {
  const editor = useEditor()
  const modifierRefreshKey = useModifierRefresh() // Subscribe to modifier changes
  
  // Feature flag to toggle between old and new modifier processing
  // TODO: This will become a user setting later
  const useStackedModifiers = true // Set to false to use old individual modifier approach
  
  // Get all shapes and their modifiers
  const shapesWithModifiers = useValue(
    'shapes-with-modifiers',
    () => {
      const allShapes = editor.getCurrentPageShapes()
      const shapesWithMods = allShapes
        .map(shape => ({
          shape,
          modifiers: getShapeModifiers(shape.id)
        }))
        .filter(item => item.modifiers.length > 0)
      
      return shapesWithMods
    },
    [editor, modifierRefreshKey] // Add modifierRefreshKey as dependency
  )

  if (useStackedModifiers) {
    // NEW: Use StackedModifier approach - one component per shape processes all modifiers
    return (
      <div className="modifier-renderer">
        {shapesWithModifiers.map(({ shape, modifiers }) => (
          <StackedModifier
            key={`stacked-${shape.id}`}
            shape={shape}
            modifiers={modifiers}
          />
        ))}
      </div>
    )
  }

  // OLD: Individual modifier approach (for comparison/fallback)
  return (
    <div className="modifier-renderer">
      {shapesWithModifiers.map(({ shape, modifiers }) =>
        modifiers.map(modifier => {
          const anyModifier = modifier as any // Cast to handle different modifier types
          
          switch (anyModifier.type) {
            case 'linear-array':
              return (
                <LinearArrayModifier
                  key={`${shape.id}-${modifier.id}`}
                  shape={shape}
                  settings={anyModifier.props}
                  enabled={anyModifier.enabled}
                />
              )
            case 'circular-array':
              return (
                <CircularArrayModifier
                  key={`${shape.id}-${modifier.id}`}
                  shape={shape}
                  settings={anyModifier.props}
                  enabled={anyModifier.enabled}
                />
              )
            case 'grid-array':
              return (
                <GridArrayModifier
                  key={`${shape.id}-${modifier.id}`}
                  shape={shape}
                  settings={anyModifier.props}
                  enabled={anyModifier.enabled}
                />
              )
            default:
              return null
          }
        })
      )}
    </div>
  )
}

// Helper component to integrate with tldraw's UI zones
export function ModifierOverlay() {
  return (
    <div 
      className="modifier-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000, // Above canvas but below UI
      }}
    >
      <ModifierRenderer />
    </div>
  )
} 