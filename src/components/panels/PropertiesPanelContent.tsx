import { useCallback } from 'react'
import { useEditor, useValue } from 'tldraw'
import type { Editor, TLShape } from 'tldraw'
import { EnhancedNumberInput } from '../modifiers/ui/EnhancedNumberInput'
import { applyRotationToShapes } from '../modifiers/utils/transformUtils'
import { useDynamicPanelHeight } from './hooks/useDynamicPanelHeight'
import type { PolygonShape } from '../shapes/PolygonShape'
import type { SineWaveShape } from '../shapes/SineWaveShape'
import type { StarShape } from '../shapes/StarShape'

type StableShapeMetrics = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

const roundTo = (value: number, precision = 2) => {
  const factor = 10 ** precision
  const rounded = Math.round(value * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

const getStableShapeMetrics = (editor: Editor, shape: TLShape): StableShapeMetrics | null => {
  const transform = editor.getShapePageTransform(shape)
  const geometry = editor.getShapeGeometry(shape)

  if (!transform || !geometry) {
    return null
  }

  const localBounds = geometry.bounds
  const { scaleX, scaleY } = transform.decompose()
  const effectiveWidth = localBounds.width * Math.abs(scaleX || 1)
  const effectiveHeight = localBounds.height * Math.abs(scaleY || 1)

  const localCenter = {
    x: localBounds.minX + localBounds.width / 2,
    y: localBounds.minY + localBounds.height / 2
  }

  const pageCenter = transform.applyToPoint(localCenter)

  return {
    x: pageCenter.x - effectiveWidth / 2,
    y: pageCenter.y - effectiveHeight / 2,
    width: effectiveWidth,
    height: effectiveHeight,
    rotation: shape.rotation || 0
  }
}

export function PropertiesPanelContent() {
  const editor = useEditor()

  // Dynamic height measurement for this panel
  const { contentRef } = useDynamicPanelHeight({
    panelId: 'properties',
    minHeight: 84, // Increased by 24px: 60 + 24
    padding: 40    // Increased by 24px: 16 + 24
  })

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
      const firstMetrics = getStableShapeMetrics(editor, firstShape)

      if (!firstMetrics) return null

      const allSame = selectedShapes.every(shape => {
        const metrics = getStableShapeMetrics(editor, shape)
        if (!metrics) return false

        return (
          Math.abs(metrics.x - firstMetrics.x) < 0.01 &&
          Math.abs(metrics.y - firstMetrics.y) < 0.01 &&
          Math.abs(metrics.width - firstMetrics.width) < 0.01 &&
          Math.abs(metrics.height - firstMetrics.height) < 0.01 &&
          Math.abs(metrics.rotation - firstMetrics.rotation) < 0.01
        )
      })

      if (!allSame) return null

      return {
        x: roundTo(firstMetrics.x),
        y: roundTo(firstMetrics.y),
        width: roundTo(firstMetrics.width),
        height: roundTo(firstMetrics.height),
        rotation: roundTo((firstMetrics.rotation * 180) / Math.PI, 2)
      }
    },
    [selectedShapes, editor]
  )

  // Detect polygon shapes for sides property
  const polygonShapes = useValue(
    'polygon-shapes',
    () => selectedShapes.filter(shape => shape.type === 'polygon') as PolygonShape[],
    [selectedShapes]
  )

  // Detect sine wave shapes for wave properties
  const sineWaveShapes = useValue(
    'sine-wave-shapes',
    () => selectedShapes.filter(shape => shape.type === 'sine-wave') as SineWaveShape[],
    [selectedShapes]
  )

  // Detect star shapes for star properties
  const starShapes = useValue(
    'star-shapes',
    () => selectedShapes.filter(shape => shape.type === 'star') as StarShape[],
    [selectedShapes]
  )

  // Update shape position
  const updatePosition = useCallback((axis: 'x' | 'y', value: number) => {
    if (selectedShapes.length === 0) return

    selectedShapes.forEach(shape => {
      const metrics = getStableShapeMetrics(editor, shape)
      if (!metrics) return

      const currentPosition = axis === 'x' ? metrics.x : metrics.y
      const delta = value - currentPosition
      if (Math.abs(delta) < 1e-4) return

      editor.updateShape({
        id: shape.id,
        type: shape.type,
        x: axis === 'x' ? shape.x + delta : shape.x,
        y: axis === 'y' ? shape.y + delta : shape.y
      })
    })
  }, [selectedShapes, editor])

  // Update shape size
  const updateSize = useCallback((dimension: 'width' | 'height', value: number) => {
    if (selectedShapes.length === 0 || value <= 0) return

    selectedShapes.forEach(shape => {
      const metrics = getStableShapeMetrics(editor, shape)
      if (!metrics) return

      const currentSize = dimension === 'width' ? metrics.width : metrics.height
      if (currentSize === 0) return

      const scale = value / currentSize

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

      // Use shared utility for proper center-based rotation
      applyRotationToShapes(editor, [shape.id], deltaRotation)
    })
  }, [selectedShapes, editor])

  // Update polygon sides
  const updatePolygonSides = useCallback((value: number) => {
    if (polygonShapes.length === 0) return

    const updatedShapes = polygonShapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, sides: value }
    }))

    editor.updateShapes(updatedShapes)
  }, [polygonShapes, editor])

  // Update sine wave properties

  const updateSineWaveFrequency = useCallback((value: number) => {
    if (sineWaveShapes.length === 0) return

    const updatedShapes = sineWaveShapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, frequency: value }
    }))

    editor.updateShapes(updatedShapes)
  }, [sineWaveShapes, editor])

  const updateSineWavePhase = useCallback((value: number) => {
    if (sineWaveShapes.length === 0) return

    const updatedShapes = sineWaveShapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, phase: value }
    }))

    editor.updateShapes(updatedShapes)
  }, [sineWaveShapes, editor])

  // Update star properties
  const updateStarCount = useCallback((value: number) => {
    if (starShapes.length === 0) return
    const updatedShapes = starShapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, count: value }
    }))
    editor.updateShapes(updatedShapes)
  }, [starShapes, editor])

  const updateStarInnerRadius = useCallback((value: number) => {
    if (starShapes.length === 0) return
    const updatedShapes = starShapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, innerRadius: value }
    }))
    editor.updateShapes(updatedShapes)
  }, [starShapes, editor])

  if (selectedShapes.length === 0) {
    return (
      <div ref={contentRef} className="panel-empty-state">
        <p>Select a shape to view properties</p>
      </div>
    )
  }

  if (!shapeProperties) {
    return (
      <div ref={contentRef} className="panel-empty-state">
        <p>Multiple shapes with different properties selected</p>
      </div>
    )
  }

  return (
    <div ref={contentRef} className="properties-panel__content">
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

      {/* Polygon Sides - only show for polygon shapes */}
      {polygonShapes.length > 0 && (
        <div className="modifier-input-row">
          <label className="modifier-input-row__label" style={{ fontWeight: 'bold' }}>Sides</label>
          <div className="modifier-input-row__control">
            <EnhancedNumberInput
              value={polygonShapes[0].props.sides}
              min={3}
              max={12}
              step={1}
              precision={0}
              unit="#"
              onChange={updatePolygonSides}
            />
          </div>
        </div>
      )}

      {/* Sine Wave Properties - only show for sine wave shapes */}
      {sineWaveShapes.length > 0 && (
        <>
          {/* Frequency */}
          <div className="modifier-input-row">
            <label className="modifier-input-row__label" style={{ fontWeight: 'bold' }}>Frequency</label>
            <div className="modifier-input-row__control">
              <EnhancedNumberInput
                value={sineWaveShapes[0].props.frequency}
                min={0.1}
                max={20}
                step={0.1}
                precision={1}
                unit="Hz"
                onChange={updateSineWaveFrequency}
              />
            </div>
          </div>

          {/* Phase */}
          <div className="modifier-input-row">
            <label className="modifier-input-row__label" style={{ fontWeight: 'bold' }}>Phase</label>
            <div className="modifier-input-row__control">
              <EnhancedNumberInput
                value={sineWaveShapes[0].props.phase}
                min={0}
                max={360}
                step={15}
                precision={0}
                unit="°"
                onChange={updateSineWavePhase}
              />
            </div>
          </div>
        </>
      )}

      {/* Star Properties - only show for star shapes */}
      {starShapes.length > 0 && (
        <>
          {/* Count */}
          <div className="modifier-input-row">
            <label className="modifier-input-row__label" style={{ fontWeight: 'bold' }}>Count</label>
            <div className="modifier-input-row__control">
              <EnhancedNumberInput
                value={starShapes[0].props.count}
                min={3}
                max={20}
                step={1}
                precision={0}
                unit="#"
                onChange={updateStarCount}
              />
            </div>
          </div>

          {/* Inner Radius */}
          <div className="modifier-input-row">
            <label className="modifier-input-row__label" style={{ fontWeight: 'bold' }}>Inner Radius</label>
            <div className="modifier-input-row__control">
              <EnhancedNumberInput
                value={starShapes[0].props.innerRadius}
                min={0.1}
                max={0.9}
                step={0.05}
                precision={2}
                unit="%"
                onChange={updateStarInnerRadius}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
