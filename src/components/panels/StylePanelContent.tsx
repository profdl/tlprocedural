import { useCallback } from 'react'
import { useEditor, useValue } from 'tldraw'
import { EnhancedNumberInput } from '../modifiers/ui/EnhancedNumberInput'

export function StylePanelContent() {
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
      const firstProps = firstShape.props as Record<string, unknown>

      const styles = {
        strokeWidth: (firstProps.strokeWidth as number) ?? 2,
        strokeColor: (firstProps.color as string) ?? 'black',
        fill: (firstProps.fill as boolean) ?? false,
        fillColor: (firstProps.fillColor as string) ?? 'black',
        opacity: (firstShape.opacity ?? 1) * 100
      }

      // Check if all shapes have the same values
      const allSame = selectedShapes.every(shape => {
        const props = shape.props as Record<string, unknown>
        return (
          ((props.strokeWidth as number) ?? 2) === styles.strokeWidth &&
          ((props.color as string) ?? 'black') === styles.strokeColor &&
          ((props.fill as boolean) ?? false) === styles.fill &&
          ((props.fillColor as string) ?? 'black') === styles.fillColor &&
          ((shape.opacity ?? 1) * 100) === styles.opacity
        )
      })

      return allSame ? styles : null
    },
    [selectedShapes]
  )

  // Update shape styles
  const updateShapeStyles = useCallback((updates: Record<string, unknown>) => {
    if (selectedShapes.length === 0) return

    const shapesToUpdate = selectedShapes.map(shape => {
      const newProps = { ...shape.props } as Record<string, unknown>
      const newShape = { ...shape }

      // Handle opacity separately as it's a shape property, not a prop
      if ('opacity' in updates) {
        newShape.opacity = (updates.opacity as number) / 100
      }

      // Handle stroke width
      if ('strokeWidth' in updates) {
        // Only set strokeWidth directly, don't try to set size
        newProps.strokeWidth = updates.strokeWidth
      }

      // Handle color property
      if ('strokeColor' in updates) {
        newProps.color = updates.strokeColor
      }

      if ('fillColor' in updates) {
        newProps.fillColor = updates.fillColor
      }

      if ('fill' in updates) {
        newProps.fill = updates.fill
      }

      return { ...newShape, props: newProps }
    })

    editor.updateShapes(shapesToUpdate)
  }, [editor, selectedShapes])

  if (selectedShapes.length === 0) {
    return (
      <div className="panel-empty-state">
        <p>Select a shape to edit styles</p>
      </div>
    )
  }

  if (!commonStyles) {
    return (
      <div className="panel-empty-state">
        <p>Mixed styles selected</p>
        <p>Select shapes with matching styles to edit</p>
      </div>
    )
  }

  return (
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
            <input
              type="color"
              value={commonStyles.strokeColor === 'black' ? '#000000' :
                     commonStyles.strokeColor === 'white' ? '#ffffff' :
                     commonStyles.strokeColor === 'red' ? '#ff0000' :
                     commonStyles.strokeColor === 'green' ? '#00ff00' :
                     commonStyles.strokeColor === 'blue' ? '#0000ff' :
                     commonStyles.strokeColor}
              onChange={(e) => updateShapeStyles({ strokeColor: e.target.value })}
              className="color-input-compact__input"
            />
          </div>
        </div>
      </div>

      {/* Fill Color */}
      <div className="modifier-input-row">
        <label className="modifier-input-row__label">Fill Color</label>
        <div className="modifier-input-row__control">
          <div className="fill-color-controls">
            <div className="fill-color-checkbox">
              <input
                type="checkbox"
                checked={commonStyles.fill}
                onChange={(e) => {
                  updateShapeStyles({ fill: e.target.checked })
                }}
                className="style-controls__checkbox"
              />
            </div>
            <div className="color-input-compact__container">
              <input
                type="color"
                value={commonStyles.fillColor === 'black' ? '#000000' :
                       commonStyles.fillColor === 'white' ? '#ffffff' :
                       commonStyles.fillColor === 'red' ? '#ff0000' :
                       commonStyles.fillColor === 'green' ? '#00ff00' :
                       commonStyles.fillColor === 'blue' ? '#0000ff' :
                       commonStyles.fillColor}
                onChange={(e) => updateShapeStyles({ fillColor: e.target.value })}
                className="color-input-compact__input"
                disabled={!commonStyles.fill}
              />
            </div>
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
  )
}