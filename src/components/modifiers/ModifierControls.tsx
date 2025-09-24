import type { TLShape } from 'tldraw'
import { useModifierManager } from './hooks/useModifierManager'
import { ModifierActionButtons } from './components/ModifierActionButtons'
import { ModifierList } from './components/ModifierList'
import { ModifierErrorBoundary } from './ErrorBoundary'

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
    selectedShapes: allSelectedShapes,
    isMultiShapeSelection,
    shapeModifiers,
    hasEnabledModifiers,
    addModifier,
    removeModifier,
    toggleModifier,
    applyModifiers
  } = useModifierManager({ selectedShapes })

  if (!selectedShape && selectedShapes.length === 0) {
    return (
      <div className="modifier-controls">
        <div className="modifier-controls__empty">
          <p>Select a shape to add modifiers</p>
        </div>
      </div>
    )
  }

  if (isMultiShapeSelection) {
    return (
      <ModifierErrorBoundary
        fallback={
          <div className="modifier-controls-error" style={{
            padding: '12px',
            color: '#d63031',
            fontSize: '12px',
            textAlign: 'center'
          }}>
            Modifier controls unavailable
          </div>
        }
      >
        <div className="modifier-controls" onPointerDown={(e) => e.stopPropagation()}>
          <div className="modifier-controls__multi-shape" style={{
            padding: '12px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '4px',
            marginBottom: '12px'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>
              Multi-Shape Selection ({allSelectedShapes.length} shapes)
            </h4>
            <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#6c757d' }}>
              Boolean operations are available for multiple shapes. Other modifiers apply to the first selected shape only.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => addModifier('boolean')}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                + Boolean Union
              </button>
            </div>
          </div>

          {/* Show modifiers for the primary selected shape */}
          {selectedShape && (
            <>
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '11px'
              }}>
                Primary shape: {selectedShape.type} (other modifiers apply here only)
              </div>
              <ModifierActionButtons
                selectedShape={!!selectedShape}
                hasEnabledModifiers={hasEnabledModifiers}
                onAddModifier={addModifier}
                onApplyModifiers={applyModifiers}
                isMultiShapeSelection={true}
              />
              <ModifierList
                modifiers={shapeModifiers}
                onToggleModifier={toggleModifier}
                onRemoveModifier={removeModifier}
                shapeId={selectedShape.id}
              />
            </>
          )}
        </div>
      </ModifierErrorBoundary>
    )
  }

  return (
    <ModifierErrorBoundary
      fallback={
        <div className="modifier-controls-error" style={{
          padding: '12px',
          color: '#d63031',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          Modifier controls unavailable
        </div>
      }
    >
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
    </ModifierErrorBoundary>
  )
}
