import { useEditor, createShapeId, Vec, useValue } from 'tldraw'
import { useState, useRef, useCallback, useMemo } from 'react'
import { useCustomShapes } from './hooks/useCustomShapes'
import { bezierShapeToCustomTrayItem } from './utils/bezierToCustomShape'
import type { BezierShape } from './shapes/BezierShape'

type DragState =
  | { type: 'idle' }
  | { type: 'pointing_item'; itemId: string; pointerId: number }
  | { type: 'dragging'; itemId: string; pointerId: number }

interface TrayItem {
  id: string
  label: string
  iconSvg: string
  shapeType: string
  defaultProps?: Record<string, unknown>
}

// SVG strings for Lucide icons (matching the toolbar icons)
const lucideIcons = {
  rectangle: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>',
  ellipse: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
  triangle: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>',
  pentagon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.7c-.7.5-1 1.4-.7 2.2l2.8 8.7c.3.8 1 1.4 1.9 1.4h9c.9 0 1.6-.6 1.9-1.4l2.8-8.7c.3-.8 0-1.7-.7-2.2L12 2.2c-.7-.5-1.7-.5-2.4 0Z"/></svg>',
  circle: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
  waves: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>'
}

const defaultTrayItems: TrayItem[] = [
  {
    id: 'triangle',
    label: 'Triangle',
    iconSvg: lucideIcons.triangle,
    shapeType: 'triangle',
    defaultProps: {
      w: 100,
      h: 100,
      color: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 1,
      fill: true
    }
  },
  {
    id: 'polygon',
    label: 'Polygon',
    iconSvg: lucideIcons.pentagon,
    shapeType: 'polygon',
    defaultProps: {
      w: 120,
      h: 120,
      sides: 6,
      color: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 1,
      fill: true
    }
  },
  {
    id: 'circle',
    label: 'Circle',
    iconSvg: lucideIcons.circle,
    shapeType: 'circle',
    defaultProps: {
      w: 100,
      h: 100,
      color: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 1,
      fill: true
    }
  },
  {
    id: 'sine-wave',
    label: 'Sine Wave',
    iconSvg: lucideIcons.waves,
    shapeType: 'sine-wave',
    defaultProps: {
      w: 200,
      h: 100,
      color: '#000000',
      strokeWidth: 1
    }
  }
]

export function DragAndDropTray() {
  const editor = useEditor()
  const [dragState, setDragState] = useState<DragState>({ type: 'idle' })
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; itemId: string } | null>(null)
  const trayRef = useRef<HTMLDivElement>(null)

  // Custom shapes management
  const { customShapes, addCustomShape } = useCustomShapes()

  // Monitor selected shapes to detect bezier shapes
  const selectedShapes = useValue(
    'selected-shapes',
    () => editor.getSelectedShapes(),
    [editor]
  )

  // Check if any selected shapes are bezier shapes (not in edit mode)
  const selectedBezierShapes = useMemo(() => {
    return selectedShapes.filter(shape =>
      shape.type === 'bezier' &&
      !('editMode' in shape.props && shape.props.editMode)
    ) as BezierShape[]
  }, [selectedShapes])

  const hasBezierSelected = selectedBezierShapes.length > 0

  // Combine default and custom tray items
  const allTrayItems = useMemo(() => {
    return [...defaultTrayItems, ...customShapes]
  }, [customShapes])

  // Handle creating custom shape from selected bezier
  const handleCreateCustomShape = useCallback(() => {
    if (selectedBezierShapes.length === 0) return

    // Use the first selected bezier shape
    const bezierShape = selectedBezierShapes[0]

    // Convert to custom tray item
    const customTrayItem = bezierShapeToCustomTrayItem(bezierShape)

    // Add to custom shapes
    addCustomShape(customTrayItem)

    console.log('Created custom shape from bezier:', customTrayItem.label)
  }, [selectedBezierShapes, addCustomShape])

  const handlePointerDown = useCallback((e: React.PointerEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()

    setDragState({
      type: 'pointing_item',
      itemId,
      pointerId: e.pointerId
    })

    const pointerId = e.pointerId
    const element = e.currentTarget as HTMLElement
    element.setPointerCapture(pointerId)
  }, [setDragState])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragState.type === 'pointing_item' && e.pointerId === dragState.pointerId) {
      const threshold = 5
      const rect = trayRef.current?.getBoundingClientRect()
      if (!rect) return

      const startX = rect.left + 50 // Approximate center of tray item
      const startY = rect.top + 30

      const distance = Math.sqrt(
        Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2)
      )

      if (distance > threshold) {
        setDragState({
          type: 'dragging',
          itemId: dragState.itemId,
          pointerId: dragState.pointerId
        })
        setDragPreview({
          x: e.clientX,
          y: e.clientY,
          itemId: dragState.itemId
        })
      }
    } else if (dragState.type === 'dragging' && e.pointerId === dragState.pointerId) {
      setDragPreview({
        x: e.clientX,
        y: e.clientY,
        itemId: dragState.itemId
      })
    }
  }, [dragState, setDragState])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragState.type === 'dragging' && e.pointerId === dragState.pointerId) {
      const trayItem = allTrayItems.find(item => item.id === dragState.itemId)
      if (!trayItem || !editor) return

      // Convert screen coordinates to page coordinates
      const pagePoint = editor.screenToPage(new Vec(e.clientX, e.clientY))

      // Create the shape at the drop location
      const shapeId = createShapeId()

      try {
        const baseShape = {
          id: shapeId,
          type: trayItem.shapeType,
          x: pagePoint.x - 50, // Center the shape on cursor
          y: pagePoint.y - 50,
          props: trayItem.defaultProps || {}
        }

        editor.createShape(baseShape)
        editor.setSelectedShapes([shapeId])
      } catch (error) {
        console.error('Failed to create shape:', error)
      }
    }

    // Reset drag state
    setDragState({ type: 'idle' })
    setDragPreview(null)

    const element = e.currentTarget as HTMLElement
    element.releasePointerCapture(e.pointerId)
  }, [dragState, setDragState, editor, allTrayItems])

  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    if (dragState.type === 'pointing_item' && e.pointerId === dragState.pointerId) {
      setDragState({ type: 'idle' })
    }
  }, [dragState, setDragState])

  return (
    <>
      <div
        ref={trayRef}
        className="drag-drop-tray"
        style={{
          position: 'absolute',
          top: '50%',
          left: '10px',
          transform: 'translateY(-50%)',
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1000,
          userSelect: 'none'
        }}
      >
        {allTrayItems.map((item) => (
          <div
            key={item.id}
            data-drag_item_index={item.id}
            className="tray-item"
            style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              borderRadius: '4px',
              border: '1px solid transparent',
              backgroundColor: '#f8f9fa',
              transition: 'all 0.2s ease'
            }}
            onPointerDown={(e) => handlePointerDown(e, item.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            title={item.label}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              dangerouslySetInnerHTML={{
                __html: item.iconSvg.replace(/stroke="currentColor"/g, 'stroke="#333"')
              }}
            />
          </div>
        ))}

        {/* Add Custom Shape Button - only visible when bezier shape is selected */}
        {hasBezierSelected && (
          <div
            key="add-custom-shape"
            className="tray-item add-button"
            style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: '4px',
              border: '2px dashed #007acc',
              backgroundColor: '#f0f8ff',
              transition: 'all 0.2s ease',
              opacity: 0.9
            }}
            onClick={handleCreateCustomShape}
            title="Add selected bezier as custom shape"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e6f3ff'
              e.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f8ff'
              e.currentTarget.style.opacity = '0.9'
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              dangerouslySetInnerHTML={{
                __html: lucideIcons.plus.replace(/stroke="currentColor"/g, 'stroke="#007acc"')
              }}
            />
          </div>
        )}
      </div>

      {/* Drag Preview */}
      {dragPreview && dragState.type === 'dragging' && (
        <div
          style={{
            position: 'fixed',
            left: dragPreview.x - 24,
            top: dragPreview.y - 24,
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            border: '1px solid #007acc',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
            zIndex: 10000,
            opacity: 0.8
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            dangerouslySetInnerHTML={{
              __html: (allTrayItems.find(item => item.id === dragPreview.itemId)?.iconSvg || '').replace(/stroke="currentColor"/g, 'stroke="#007acc"')
            }}
          />
        </div>
      )}
    </>
  )
}