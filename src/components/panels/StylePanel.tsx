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
          {/* Stroke Size */}
          <div className="modifier-input-row">
            <label className="modifier-input-row__label">Stroke Size</label>
            <div className="modifier-input-row__control">
              <EnhancedNumberInput
                value={commonStyles.strokeWidth}
                min={0}
                max={20}
                step={0.5}
                precision={1}
                unit="px"
                onChange={(value) => updateShapeStyles({ strokeWidth: value })}
              />
            </div>
          </div>

          {/* Stroke Color */}
          <div className="modifier-input-row">
            <label className="modifier-input-row__label">Stroke Color</label>
            <div className="modifier-input-row__control">
              <div className="color-input-compact__container">
                <div
                  className="color-input-compact__preview"
                  style={{
                    backgroundColor: commonStyles.strokeColor === 'black' ? '#000000' :
                                   commonStyles.strokeColor === 'white' ? '#ffffff' :
                                   commonStyles.strokeColor === 'red' ? '#ff0000' :
                                   commonStyles.strokeColor === 'green' ? '#00ff00' :
                                   commonStyles.strokeColor === 'blue' ? '#0000ff' :
                                   commonStyles.strokeColor
                  }}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'color'
                    input.value = commonStyles.strokeColor === 'black' ? '#000000' :
                                  commonStyles.strokeColor === 'white' ? '#ffffff' :
                                  commonStyles.strokeColor === 'red' ? '#ff0000' :
                                  commonStyles.strokeColor === 'green' ? '#00ff00' :
                                  commonStyles.strokeColor === 'blue' ? '#0000ff' :
                                  commonStyles.strokeColor
                    input.onchange = (e) => updateShapeStyles({ strokeColor: (e.target as HTMLInputElement).value })
                    input.click()
                  }}
                />
                <input
                  type="text"
                  value={commonStyles.strokeColor}
                  onChange={(e) => updateShapeStyles({ strokeColor: e.target.value })}
                  className="color-input-compact__text"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>

          {/* Fill Color */}
          <div className="modifier-input-row">
            <label className="modifier-input-row__label">Fill Color</label>
            <div className="modifier-input-row__control">
              <div className="color-input-compact__container">
                <div
                  className="color-input-compact__preview"
                  style={{
                    backgroundColor: commonStyles.fillColor === 'none' ? 'transparent' :
                                   commonStyles.fillColor === 'black' ? '#000000' :
                                   commonStyles.fillColor === 'white' ? '#ffffff' :
                                   commonStyles.fillColor === 'red' ? '#ff0000' :
                                   commonStyles.fillColor === 'green' ? '#00ff00' :
                                   commonStyles.fillColor === 'blue' ? '#0000ff' :
                                   commonStyles.fillColor,
                    backgroundImage: commonStyles.fillColor === 'none' ?
                      'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)' :
                      undefined,
                    backgroundSize: commonStyles.fillColor === 'none' ? '6px 6px' : undefined,
                    backgroundPosition: commonStyles.fillColor === 'none' ? '0 0, 0 3px, 3px -3px, -3px 0px' : undefined
                  }}
                  onClick={() => {
                    if (commonStyles.fillColor === 'none') {
                      updateShapeStyles({ fillColor: '#ffffff' })
                    } else {
                      const input = document.createElement('input')
                      input.type = 'color'
                      input.value = commonStyles.fillColor === 'black' ? '#000000' :
                                    commonStyles.fillColor === 'white' ? '#ffffff' :
                                    commonStyles.fillColor === 'red' ? '#ff0000' :
                                    commonStyles.fillColor === 'green' ? '#00ff00' :
                                    commonStyles.fillColor === 'blue' ? '#0000ff' :
                                    commonStyles.fillColor
                      input.onchange = (e) => updateShapeStyles({ fillColor: (e.target as HTMLInputElement).value })
                      input.click()
                    }
                  }}
                />
                <input
                  type="text"
                  value={commonStyles.fillColor}
                  onChange={(e) => updateShapeStyles({ fillColor: e.target.value })}
                  className="color-input-compact__text"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
          </div>

          {/* Opacity */}
          <div className="modifier-input-row">
            <label className="modifier-input-row__label">Opacity</label>
            <div className="modifier-input-row__control">
              <EnhancedNumberInput
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
      ) : (
        <div className="panel-empty-state">
          <p>Mixed styles selected</p>
          <p>Select shapes with matching styles to edit</p>
        </div>
      )}
    </PanelContainer>
  )
}