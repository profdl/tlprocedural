import { useEditor, useValue, type TLShape } from 'tldraw'
import { useModifierManager } from '../modifiers/hooks/useModifierManager'
import { ModifierActionButtons } from '../modifiers/components/ModifierActionButtons'
import { ModifierList } from '../modifiers/components/ModifierList'

export function ModifiersPanelContent() {
  const editor = useEditor()

  // Get the currently selected shapes, expanding groups to include their child shapes
  const selectedShapes = useValue(
    'selected-shapes',
    () => {
      const shapes = editor.getSelectedShapes()

      // Expand groups to include their child shapes for modifier processing
      const expandedShapes: TLShape[] = []

      shapes.forEach(shape => {
        if (shape.type === 'group') {
          // Get all child shapes in the group
          const childShapeIds = editor.getShapeAndDescendantIds([shape.id])
          const childShapes = Array.from(childShapeIds)
            .map((id) => editor.getShape(id))
            .filter(Boolean) as TLShape[]

          expandedShapes.push(...childShapes)
        } else {
          expandedShapes.push(shape)
        }
      })

      return expandedShapes
    },
    [editor]
  )

  // Use the modifier management hook
  const {
    selectedShape,
    shapeModifiers,
    hasEnabledModifiers,
    addModifier,
    removeModifier,
    applyModifiers
  } = useModifierManager({ selectedShapes })

  if (!selectedShape) {
    return (
      <div className="panel-empty-state">
        <p>Select a shape to add modifiers</p>
      </div>
    )
  }

  return (
    <div className="modifiers-panel__content">
      {/* Action Buttons */}
      <div className="modifiers-panel__actions">
        <ModifierActionButtons
          selectedShape={!!selectedShape}
          hasEnabledModifiers={hasEnabledModifiers}
          onAddModifier={addModifier}
          onApplyModifiers={applyModifiers}
        />
      </div>

      {/* Scrollable Modifier List */}
      <div className="modifiers-panel__scroll-container">
        {shapeModifiers.length === 0 ? (
          <div className="panel-empty-state panel-empty-state--small">
            <p>No modifiers added yet</p>
            <p>Click "Add Modifier" to get started</p>
          </div>
        ) : (
          <ModifierList
            modifiers={shapeModifiers}
            onToggleModifier={(id) => removeModifier(id)}
            onRemoveModifier={removeModifier}
            shapeId={selectedShape.id}
          />
        )}
      </div>
    </div>
  )
}