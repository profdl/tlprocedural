import { useCallback, useState } from 'react'
import { useEditor, type TLShape, TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { EnhancedNumberInput } from '../ui/EnhancedNumberInput'

interface StyleControlsProps {
  selectedShapes: TLShape[]
}

// Local stopEventPropagation implementation
function stopEventPropagation(e: React.SyntheticEvent | Event) {
  e.stopPropagation()
}


export function StyleControls({ selectedShapes }: StyleControlsProps) {
  const editor = useEditor()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  // Get common style properties from selected shapes
  const commonStyles = useCallback(() => {
    if (selectedShapes.length === 0) return null

    // Check if all shapes have the same style properties
    const firstShape = selectedShapes[0]
    const firstProps = firstShape.props as Record<string, unknown>

    const styles = {
      strokeWidth: (firstProps.strokeWidth as number) ?? 2,
      color: (firstProps.color as string) ?? '#000000',
      fill: (firstProps.fill as boolean) ?? false,
      opacity: (firstShape.opacity ?? 1) * 100 // Convert to percentage
    }

    // Check if all shapes have the same values
    const allSame = selectedShapes.every(shape => {
      const props = shape.props as Record<string, unknown>
      return (
        ((props.strokeWidth as number) ?? 2) === styles.strokeWidth &&
        ((props.color as string) ?? '#000000') === styles.color &&
        ((props.fill as boolean) ?? false) === styles.fill &&
        ((shape.opacity ?? 1) * 100) === styles.opacity
      )
    })

    return allSame ? styles : null
  }, [selectedShapes])

  const styles = commonStyles()

  const updateShapeStyles = useCallback((updates: Record<string, unknown>) => {
    if (selectedShapes.length === 0) return

    const shapesToUpdate = selectedShapes.map(shape => {
      const newProps = { ...shape.props }
      const newShape = { ...shape }

      // Handle opacity separately as it's a shape property, not a prop
      if ('opacity' in updates) {
        newShape.opacity = (updates.opacity as number) / 100 // Convert from percentage
      }

      // Handle other style properties
      Object.keys(updates).forEach(key => {
        if (key !== 'opacity') {
          (newProps as Record<string, unknown>)[key] = updates[key]
        }
      })

      return { ...newShape, props: newProps }
    })

    editor.updateShapes(shapesToUpdate)
  }, [editor, selectedShapes])

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  if (selectedShapes.length === 0) {
    return (
      <div className="modifier-controls__empty">
        <p>Select a shape to edit styles</p>
      </div>
    )
  }

  if (!styles) {
    return (
      <div className="modifier-controls__empty">
        <p>Mixed styles selected</p>
        <p>Select shapes with matching styles to edit</p>
      </div>
    )
  }

  return (
    <div className="modifier-controls__item">
      <div className="modifier-controls__item-header">
        <div className="modifier-controls__item-title">
          <TldrawUiButton
            type="icon"
            onPointerDown={(e) => {
              stopEventPropagation(e)
              toggleCollapsed()
            }}
            title={isCollapsed ? "Expand" : "Collapse"}
            className="modifier-controls__caret"
          >
            <TldrawUiButtonIcon
              icon={isCollapsed ? "chevron-right" : "chevron-down"}
            />
          </TldrawUiButton>
          <span className="modifier-controls__checkbox-text">
            Style
          </span>
        </div>
      </div>

      {!isCollapsed && (
        <div className="modifier-controls__item-details">
          {/* Stroke Section */}
          <div className="modifier-controls__section">
            <div className="modifier-controls__section-header">Stroke</div>
            <div className="modifier-controls__grid">
              <div className="modifier-input">
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
              <div className="modifier-input">
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
          <div className="modifier-controls__section">
            <div className="modifier-controls__section-header">Fill</div>
            <div className="modifier-controls__grid">
              <div className="modifier-input">
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
                <div className="modifier-input">
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
          <div className="modifier-controls__section">
            <div className="modifier-controls__section-header">Opacity</div>
            <div className="modifier-controls__grid">
              <div className="modifier-input">
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
              <div className="modifier-input">
                {/* Empty column for spacing */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

