import React, { useCallback } from 'react'
import { useEditor, useValue } from 'tldraw'
import { PanelContainer } from './PanelContainer'
import { EnhancedNumberInput } from '../modifiers/ui/EnhancedNumberInput'

export function StylePanel() {
  const editor = useEditor()

  // Get selected shapes
  const selectedShapes = useValue(
    'selected-shapes',
    () => editor.getSelectedShapes(),
    [editor]
  )

  // Get common style properties from selected shapes
  const commonStyles = useValue(
    'common-styles',
    () => {
      if (selectedShapes.length === 0) return null

      const firstShape = selectedShapes[0]
      const firstProps = firstShape.props as any

      const styles = {
        strokeWidth: firstProps.size === 's' ? 2 : firstProps.size === 'm' ? 3.5 : firstProps.size === 'l' ? 5 :
                     firstProps.size === 'xl' ? 10 : (firstProps.strokeWidth ?? 2),
        strokeColor: firstProps.color ?? 'black',
        fillColor: firstProps.fill ?? 'none',
        opacity: (firstShape.opacity ?? 1) * 100
      }

      // Check if all shapes have the same values
      const allSame = selectedShapes.every(shape => {
        const props = shape.props as any
        const shapeStrokeWidth = props.size === 's' ? 2 : props.size === 'm' ? 3.5 : props.size === 'l' ? 5 :
                                 props.size === 'xl' ? 10 : (props.strokeWidth ?? 2)
        return (
          shapeStrokeWidth === styles.strokeWidth &&
          (props.color ?? 'black') === styles.strokeColor &&
          (props.fill ?? 'none') === styles.fillColor &&
          ((shape.opacity ?? 1) * 100) === styles.opacity
        )
      })

      return allSame ? styles : null
    },
    [selectedShapes]
  )

  // Update shape styles
  const updateShapeStyles = useCallback((updates: Record<string, any>) => {
    if (selectedShapes.length === 0) return

    const shapesToUpdate = selectedShapes.map(shape => {
      const newProps = { ...shape.props } as any
      const newShape = { ...shape }

      // Handle opacity separately as it's a shape property, not a prop
      if ('opacity' in updates) {
        newShape.opacity = updates.opacity / 100
      }

      // Handle stroke width - convert to size enum for tldraw shapes
      if ('strokeWidth' in updates) {
        const width = updates.strokeWidth
        if (width <= 2.5) newProps.size = 's'
        else if (width <= 4) newProps.size = 'm'
        else if (width <= 7) newProps.size = 'l'
        else newProps.size = 'xl'

        // Also set strokeWidth for custom shapes
        newProps.strokeWidth = width
      }

      // Handle other style properties
      Object.keys(updates).forEach(key => {
        if (key !== 'opacity' && key !== 'strokeWidth') {
          newProps[key] = updates[key]
        }
      })

      // Handle color property
      if ('strokeColor' in updates) {
        newProps.color = updates.strokeColor
      }

      if ('fillColor' in updates) {
        newProps.fill = updates.fillColor
      }

      return { ...newShape, props: newProps }
    })

    editor.updateShapes(shapesToUpdate)
  }, [editor, selectedShapes])

  return (
    <PanelContainer
      id="style"
      title="Style"
      className="style-panel"
    >
      {selectedShapes.length === 0 ? (
        <div className="panel-empty-state">
          <p>Select a shape to edit styles</p>
        </div>
      ) : commonStyles ? (
        <div className="style-panel__content">
          {/* Stroke Section */}
          <div className="style-panel__section">
            <div className="style-panel__row">
              <div className="style-panel__field">
                <label className="style-panel__label">Stroke Size</label>
                <EnhancedNumberInput
                  label=""
                  value={commonStyles.strokeWidth}
                  min={0}
                  max={20}
                  step={0.5}
                  precision={1}
                  unit="px"
                  onChange={(value) => updateShapeStyles({ strokeWidth: value })}
                />
              </div>
              <div className="style-panel__field">
                <label className="style-panel__label">Stroke Color</label>
                <div className="style-panel__color-input-container">
                  <input
                    type="color"
                    value={commonStyles.strokeColor === 'black' ? '#000000' :
                           commonStyles.strokeColor === 'white' ? '#ffffff' :
                           commonStyles.strokeColor === 'red' ? '#ff0000' :
                           commonStyles.strokeColor === 'green' ? '#00ff00' :
                           commonStyles.strokeColor === 'blue' ? '#0000ff' :
                           commonStyles.strokeColor}
                    onChange={(e) => updateShapeStyles({ strokeColor: e.target.value })}
                    className="style-panel__color-input"
                  />
                  <input
                    type="text"
                    value={commonStyles.strokeColor}
                    onChange={(e) => updateShapeStyles({ strokeColor: e.target.value })}
                    className="style-panel__color-text"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fill Section */}
          <div className="style-panel__section">
            <div className="style-panel__row">
              <div className="style-panel__field style-panel__field--full">
                <label className="style-panel__label">Fill Color</label>
                <div className="style-panel__color-input-container">
                  <input
                    type="color"
                    value={commonStyles.fillColor === 'none' ? '#ffffff' :
                           commonStyles.fillColor === 'black' ? '#000000' :
                           commonStyles.fillColor === 'white' ? '#ffffff' :
                           commonStyles.fillColor === 'red' ? '#ff0000' :
                           commonStyles.fillColor === 'green' ? '#00ff00' :
                           commonStyles.fillColor === 'blue' ? '#0000ff' :
                           commonStyles.fillColor}
                    onChange={(e) => updateShapeStyles({ fillColor: e.target.value })}
                    className="style-panel__color-input"
                  />
                  <input
                    type="text"
                    value={commonStyles.fillColor}
                    onChange={(e) => updateShapeStyles({ fillColor: e.target.value })}
                    className="style-panel__color-text"
                    placeholder="#FFFFFF"
                  />
                  <button
                    className="style-panel__none-button"
                    onClick={() => updateShapeStyles({ fillColor: 'none' })}
                    title="No fill"
                  >
                    None
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Opacity Section */}
          <div className="style-panel__section">
            <div className="style-panel__row">
              <div className="style-panel__field style-panel__field--full">
                <label className="style-panel__label">Opacity</label>
                <EnhancedNumberInput
                  label=""
                  value={commonStyles.opacity}
                  min={0}
                  max={100}
                  step={5}
                  precision={0}
                  unit="%"
                  onChange={(value) => updateShapeStyles({ opacity: value })}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel-empty-state">
          <p>Mixed styles selected</p>
          <p>Select shapes with matching styles to edit</p>
        </div>
      )}
    </PanelContainer>
  )
}