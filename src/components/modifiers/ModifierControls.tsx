import type { TLShape } from 'tldraw'
import { useModifierManager } from './hooks/useModifierManager'
import { ModifierActionButtons } from './components/ModifierActionButtons'
import { ModifierList } from './components/ModifierList'

interface ModifierControlsProps {
  /** Array of currently selected shapes */
  selectedShapes: TLShape[]
}

/**
 * Refactored ModifierControls component
 * Uses extracted hooks and components for better separation of concerns
 */
export function ModifierControls({ selectedShapes }: ModifierControlsProps) {
  // Use the extracted modifier management hook
  const {
    selectedShape,
    shapeModifiers,
    hasEnabledModifiers,
    addModifier,
    removeModifier,
    toggleModifier,
    applyModifiers
  } = useModifierManager({ selectedShapes })

  if (!selectedShape) {
    return (
      <div className="modifier-controls">
        <div className="modifier-controls__empty">
          <p>Select a shape to add modifiers</p>
        </div>
      </div>
    )
  }

  return (
    <div className="modifier-controls" onPointerDown={(e) => e.stopPropagation()}>
      <ModifierActionButtons
        selectedShape={!!selectedShape}
        hasEnabledModifiers={hasEnabledModifiers}
        onAddModifier={addModifier}
        onApplyModifiers={applyModifiers}
      />
      <ModifierList
        modifiers={shapeModifiers}
        onToggleModifier={toggleModifier}
        onRemoveModifier={removeModifier}
        shapeId={selectedShape.id}
      />
    </div>
  )
}
