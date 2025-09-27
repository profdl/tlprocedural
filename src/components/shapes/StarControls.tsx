import { useEditor, TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { useState, useCallback } from 'react'
import type { StarShape } from './StarShape'
import { EnhancedNumberInput } from '../modifiers/ui/EnhancedNumberInput'

interface StarControlsProps {
  shapes: StarShape[]
}

// Local stopEventPropagation implementation
function stopEventPropagation(e: React.SyntheticEvent | Event) {
  e.stopPropagation()
}

export const StarControls = ({ shapes }: StarControlsProps) => {
  const editor = useEditor()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  if (shapes.length === 0) return null

  const currentCount = shapes[0].props.count
  const currentRadius = shapes[0].props.radius
  const currentLength = shapes[0].props.length

  const handleCountChange = (value: number) => {
    const updatedShapes = shapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, count: value }
    }))

    editor.updateShapes(updatedShapes)
  }

  const handleRadiusChange = (value: number) => {
    const updatedShapes = shapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, radius: value }
    }))

    editor.updateShapes(updatedShapes)
  }

  const handleLengthChange = (value: number) => {
    const updatedShapes = shapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, length: value }
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
            Star Properties
          </span>
        </div>
      </div>

      {!isCollapsed && (
        <div className="modifier-controls__item-details">
          <div className="modifier-controls__grid">
            <div className="modifier-input">
              <EnhancedNumberInput
                label="Count"
                value={currentCount}
                min={3}
                max={20}
                step={1}
                precision={0}
                onChange={handleCountChange}
              />
            </div>
            <div className="modifier-input">
              <EnhancedNumberInput
                label="Radius"
                value={currentRadius}
                min={0.1}
                max={0.9}
                step={0.05}
                precision={2}
                onChange={handleRadiusChange}
              />
            </div>
          </div>
          <div className="modifier-controls__grid">
            <div className="modifier-input">
              <EnhancedNumberInput
                label="Length"
                value={currentLength}
                min={0.1}
                max={0.9}
                step={0.05}
                precision={2}
                onChange={handleLengthChange}
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