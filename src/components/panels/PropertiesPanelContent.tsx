import { useCallback } from 'react'
import { useEditor, useValue } from 'tldraw'
import { EnhancedNumberInput } from '../modifiers/ui/EnhancedNumberInput'

export function PropertiesPanelContent() {
  const editor = useEditor()

  // Get selected shapes and their properties
  const selectedShapes = useValue(
    'selected-shapes',
    () => editor.getSelectedShapes(),
    [editor]
  )

  // Get common properties from selected shapes
  const shapeProperties = useValue(
    'shape-properties',
    () => {
      if (selectedShapes.length === 0) return null

      const firstShape = selectedShapes[0]
      const bounds = editor.getShapePageBounds(firstShape.id)

      if (!bounds) return null

      // Check if all shapes have the same values
      const allSame = selectedShapes.every(shape => {
        const shapeBounds = editor.getShapePageBounds(shape.id)
        if (!shapeBounds) return false

        return (
          Math.abs(shapeBounds.x - bounds.x) < 0.01 &&
          Math.abs(shapeBounds.y - bounds.y) < 0.01 &&
          Math.abs(shapeBounds.width - bounds.width) < 0.01 &&
          Math.abs(shapeBounds.height - bounds.height) < 0.01 &&
          Math.abs((shape.rotation || 0) - (firstShape.rotation || 0)) < 0.01
        )
      })

      if (!allSame) return null

      return {
        x: Math.round(bounds.x * 100) / 100,
        y: Math.round(bounds.y * 100) / 100,
        width: Math.round(bounds.width * 100) / 100,
        height: Math.round(bounds.height * 100) / 100,
        rotation: Math.round(((firstShape.rotation || 0) * 180 / Math.PI) * 100) / 100
      }
    },
    [selectedShapes, editor]
  )

  // Update shape position
  const updatePosition = useCallback((axis: 'x' | 'y', value: number) => {
    if (selectedShapes.length === 0) return

    selectedShapes.forEach(shape => {
      const bounds = editor.getShapePageBounds(shape.id)
      if (!bounds) return

      const newPosition = {
        x: axis === 'x' ? value : bounds.x,
        y: axis === 'y' ? value : bounds.y
      }

      editor.updateShape({
        ...shape,
        x: shape.x + (newPosition.x - bounds.x),
        y: shape.y + (newPosition.y - bounds.y)
      })
    })
  }, [selectedShapes, editor])

  // Update shape size
  const updateSize = useCallback((dimension: 'width' | 'height', value: number) => {
    if (selectedShapes.length === 0 || value <= 0) return

    selectedShapes.forEach(shape => {
      const bounds = editor.getShapePageBounds(shape.id)
      if (!bounds) return

      const scale = dimension === 'width'
        ? value / bounds.width
        : value / bounds.height

      // For now, we'll update the shape's props if it has w/h
      // This is a simplified approach - proper scaling would need shape-specific handling
      const props = shape.props as Record<string, unknown>
      if ('w' in props && 'h' in props) {
        editor.updateShape({
          ...shape,
          props: {
            ...props,
            w: dimension === 'width' ? (props.w as number) * scale : props.w,
            h: dimension === 'height' ? (props.h as number) * scale : props.h
          }
        })
      }
    })
  }, [selectedShapes, editor])

  // Update shape rotation
  const updateRotation = useCallback((value: number) => {
    if (selectedShapes.length === 0) return

    const rotationInRadians = (value * Math.PI) / 180

    selectedShapes.forEach(shape => {
      const currentRotation = shape.rotation || 0
      const deltaRotation = rotationInRadians - currentRotation

      // Use TLDraw's rotation API for proper center-based rotation
      editor.rotateShapesBy([shape.id], deltaRotation)
    })
  }, [selectedShapes, editor])

  if (selectedShapes.length === 0) {
    return (
      <div className="panel-empty-state">
        <p>Select a shape to view properties</p>
      </div>
    )
  }

  if (!shapeProperties) {
    return (
      <div className="panel-empty-state">
        <p>Multiple shapes with different properties selected</p>
      </div>
    )
  }

  return (
    <div className="properties-panel__content">
      {/* X Position */}
      <div className="modifier-input-row">
        <label className="modifier-input-row__label">X Position</label>
        <div className="modifier-input-row__control">
          <EnhancedNumberInput
            value={shapeProperties.x}
            min={-10000}
            max={10000}
            step={1}
            precision={2}
            unit="px"
            onChange={(value) => updatePosition('x', value)}
          />
        </div>
      </div>

      {/* Y Position */}
      <div className="modifier-input-row">
        <label className="modifier-input-row__label">Y Position</label>
        <div className="modifier-input-row__control">
          <EnhancedNumberInput
            value={shapeProperties.y}
            min={-10000}
            max={10000}
            step={1}
            precision={2}
            unit="px"
            onChange={(value) => updatePosition('y', value)}
          />
        </div>
      </div>

      {/* Width */}
      <div className="modifier-input-row">
        <label className="modifier-input-row__label">Width</label>
        <div className="modifier-input-row__control">
          <EnhancedNumberInput
            value={shapeProperties.width}
            min={1}
            max={10000}
            step={1}
            precision={2}
            unit="px"
            onChange={(value) => updateSize('width', value)}
          />
        </div>
      </div>

      {/* Height */}
      <div className="modifier-input-row">
        <label className="modifier-input-row__label">Height</label>
        <div className="modifier-input-row__control">
          <EnhancedNumberInput
            value={shapeProperties.height}
            min={1}
            max={10000}
            step={1}
            precision={2}
            unit="px"
            onChange={(value) => updateSize('height', value)}
          />
        </div>
      </div>

      {/* Rotation */}
      <div className="modifier-input-row">
        <label className="modifier-input-row__label">Rotation</label>
        <div className="modifier-input-row__control">
          <EnhancedNumberInput
            value={shapeProperties.rotation}
            min={-360}
            max={360}
            step={1}
            precision={1}
            unit="°"
            onChange={updateRotation}
          />
        </div>
      </div>
    </div>
  )
}