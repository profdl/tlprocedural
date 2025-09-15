import { useEditor, TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { useState, useCallback } from 'react'
import type { PolygonShape } from './PolygonShape'
import { EnhancedNumberInput } from '../modifiers/ui/EnhancedNumberInput'

interface PolygonControlsProps {
  shapes: PolygonShape[]
}

// Local stopEventPropagation implementation
function stopEventPropagation(e: React.SyntheticEvent | Event) {
  e.stopPropagation()
}

export const PolygonControls = ({ shapes }: PolygonControlsProps) => {
  const editor = useEditor()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  if (shapes.length === 0) return null

  const currentSides = shapes[0].props.sides

  const handleSidesChange = (value: number) => {
    const updatedShapes = shapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, sides: value }
    }))

    editor.updateShapes(updatedShapes)
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
            Shape Properties
          </span>
        </div>
      </div>

      {!isCollapsed && (
        <div className="modifier-controls__item-details">
          <div className="modifier-controls__grid">
            <div className="modifier-input">
              <EnhancedNumberInput
                label="Sides"
                value={currentSides}
                min={3}
                max={12}
                step={1}
                precision={0}
                onChange={handleSidesChange}
              />
            </div>
            <div className="modifier-input">
              {/* Empty column for spacing */}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}