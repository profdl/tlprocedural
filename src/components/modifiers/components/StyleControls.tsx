import { useCallback } from 'react'
import { useEditor, type TLShape } from 'tldraw'
import { EnhancedNumberInput } from '../ui/EnhancedNumberInput'

interface StyleControlsProps {
  selectedShapes: TLShape[]
}


export function StyleControls({ selectedShapes }: StyleControlsProps) {
  const editor = useEditor()

  // Get common style properties from selected shapes
  const commonStyles = useCallback(() => {
    if (selectedShapes.length === 0) return null

    // Check if all shapes have the same style properties
    const firstShape = selectedShapes[0]
    const firstProps = firstShape.props as any

    const styles = {
      strokeWidth: firstProps.strokeWidth ?? 2,
      color: firstProps.color ?? '#000000',
      fill: firstProps.fill ?? false,
      opacity: (firstShape.opacity ?? 1) * 100 // Convert to percentage
    }

    // Check if all shapes have the same values
    const allSame = selectedShapes.every(shape => {
      const props = shape.props as any
      return (
        (props.strokeWidth ?? 2) === styles.strokeWidth &&
        (props.color ?? '#000000') === styles.color &&
        (props.fill ?? false) === styles.fill &&
        ((shape.opacity ?? 1) * 100) === styles.opacity
      )
    })

    return allSame ? styles : null
  }, [selectedShapes])

  const styles = commonStyles()

  const updateShapeStyles = useCallback((updates: Record<string, any>) => {
    if (selectedShapes.length === 0) return

    const shapesToUpdate = selectedShapes.map(shape => {
      const newProps = { ...shape.props }
      const newShape = { ...shape }

      // Handle opacity separately as it's a shape property, not a prop
      if ('opacity' in updates) {
        newShape.opacity = updates.opacity / 100 // Convert from percentage
      }

      // Handle other style properties
      Object.keys(updates).forEach(key => {
        if (key !== 'opacity') {
          (newProps as any)[key] = updates[key]
        }
      })

      return { ...newShape, props: newProps }
    })

    editor.updateShapes(shapesToUpdate)
  }, [editor, selectedShapes])

  if (selectedShapes.length === 0) {
    return (
      <div className="style-controls">
        <div className="style-controls__empty">
          <p>Select a shape to edit styles</p>
        </div>
      </div>
    )
  }

  if (!styles) {
    return (
      <div className="style-controls">
        <div className="style-controls__mixed">
          <p>Mixed styles selected</p>
          <p>Select shapes with matching styles to edit</p>
        </div>
      </div>
    )
  }

  return (
    <div className="style-controls">
      {/* Stroke Section */}
      <div className="style-controls__group">
        <h4 className="style-controls__group-title">Stroke</h4>
        <div className="style-controls__row">
          <div className="style-controls__col">
            <label className="style-controls__label">Width</label>
            <EnhancedNumberInput
              label=""
              value={styles.strokeWidth}
              min={0}
              max={20}
              step={0.5}
              precision={1}
              unit="px"
              onChange={(value) => updateShapeStyles({ strokeWidth: value })}
            />
          </div>
          <div className="style-controls__col">
            <label className="style-controls__label">Color</label>
            <div className="style-controls__color-input-container">
              <input
                type="color"
                value={styles.color}
                onChange={(e) => updateShapeStyles({ color: e.target.value })}
                className="style-controls__color-input"
              />
              <input
                type="text"
                value={styles.color}
                onChange={(e) => updateShapeStyles({ color: e.target.value })}
                className="style-controls__color-text"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fill Section */}
      <div className="style-controls__group">
        <h4 className="style-controls__group-title">Fill</h4>
        <div className="style-controls__row">
          <div className="style-controls__col">
            <label className="style-controls__label">Enable</label>
            <div className="style-controls__checkbox-wrapper">
              <input
                type="checkbox"
                checked={styles.fill}
                onChange={(e) => updateShapeStyles({ fill: e.target.checked })}
                className="style-controls__checkbox"
              />
              <span className="style-controls__checkbox-text">Fill Shape</span>
            </div>
          </div>
          {styles.fill && (
            <div className="style-controls__col">
              <label className="style-controls__label">Color</label>
              <div className="style-controls__color-input-container">
                <input
                  type="color"
                  value={styles.color}
                  onChange={(e) => updateShapeStyles({ color: e.target.value })}
                  className="style-controls__color-input"
                />
                <input
                  type="text"
                  value={styles.color}
                  onChange={(e) => updateShapeStyles({ color: e.target.value })}
                  className="style-controls__color-text"
                  placeholder="#000000"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Opacity Section */}
      <div className="style-controls__group">
        <h4 className="style-controls__group-title">Opacity</h4>
        <div className="style-controls__row">
          <div className="style-controls__col">
            <label className="style-controls__label">Opacity</label>
            <EnhancedNumberInput
              label=""
              value={styles.opacity}
              min={0}
              max={100}
              step={5}
              precision={0}
              unit="%"
              onChange={(value) => updateShapeStyles({ opacity: value })}
            />
          </div>
          <div className="style-controls__col">
            {/* Empty column for spacing */}
          </div>
        </div>
      </div>
    </div>
  )
}