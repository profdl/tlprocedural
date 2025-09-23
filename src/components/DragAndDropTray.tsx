import { useEditor, createShapeId, Vec, useValue } from 'tldraw'
import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useCustomShapes } from './hooks/useCustomShapes'
import { useCustomShapeInstances } from './hooks/useCustomShapeInstances'
import { bezierShapeToCustomTrayItem } from './utils/bezierToCustomShape'
import { combineShapesToCustom } from './utils/multiShapeToCustomShape'
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
  const [selectedCustomShapeId, setSelectedCustomShapeId] = useState<string | null>(null)
  const trayRef = useRef<HTMLDivElement>(null)

  // Custom shapes management
  const { customShapes, addCustomShape, removeCustomShape } = useCustomShapes()
  const { generateInstanceId } = useCustomShapeInstances()

  // Monitor selected shapes to detect bezier shapes
  const selectedShapes = useValue(
    'selected-shapes',
    () => editor.getSelectedShapes(),
    [editor]
  )


  // Check for any valid shapes to create custom shape from
  const validSelectedShapes = useMemo(() => {
    return selectedShapes.filter(shape => {
      // Exclude shapes in edit mode
      if ('editMode' in shape.props && shape.props.editMode) {
        return false
      }
      // Include all shape types
      return true
    })
  }, [selectedShapes])

  const hasValidShapesSelected = validSelectedShapes.length > 0

  // Combine default and custom tray items
  const allTrayItems = useMemo(() => {
    return [...defaultTrayItems, ...customShapes]
  }, [customShapes])

  // Helper function to check if an item is a custom shape (user-created)
  const isCustomShape = useCallback((itemId: string) => {
    return customShapes.some(shape => shape.id === itemId)
  }, [customShapes])

  // Handle delete key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('Key pressed:', e.key, 'Selected shape:', selectedCustomShapeId)

      if (e.key === 'Delete' || e.key === 'Backspace') {
        console.log('Delete/Backspace key detected')

        if (selectedCustomShapeId) {
          console.log('Shape selected:', selectedCustomShapeId)

          if (isCustomShape(selectedCustomShapeId)) {
            console.log('Is custom shape, deleting...')
            e.preventDefault()
            e.stopPropagation()
            removeCustomShape(selectedCustomShapeId)
            setSelectedCustomShapeId(null)
            console.log('Shape deleted')
          } else {
            console.log('Not a custom shape, ignoring')
          }
        } else {
          console.log('No shape selected')
        }
      }
    }

    // Use capture phase to handle before TLDraw
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [selectedCustomShapeId, isCustomShape, removeCustomShape])

  // Handle click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setSelectedCustomShapeId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Helper function to clean metadata and ensure it's JSON serializable
  const cleanMetadata = (meta: any) => {
    if (!meta || typeof meta !== 'object') return {}

    const cleaned: any = {}
    for (const [key, value] of Object.entries(meta)) {
      // Only include JSON serializable values
      if (value === null ||
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          (typeof value === 'object' && value.constructor === Object) ||
          Array.isArray(value)) {
        cleaned[key] = value
      }
    }
    return cleaned
  }

  // Handle creating custom shape from selected shapes
  const handleCreateCustomShape = useCallback(() => {
    if (validSelectedShapes.length === 0 || !editor) return

    let customTrayItem

    // If only one bezier shape selected, use the existing specialized function
    if (validSelectedShapes.length === 1 && validSelectedShapes[0].type === 'bezier') {
      const bezierShape = validSelectedShapes[0] as BezierShape
      customTrayItem = bezierShapeToCustomTrayItem(bezierShape)
    } else {
      // For multiple shapes or non-bezier shapes, use the multi-shape converter
      customTrayItem = combineShapesToCustom(validSelectedShapes, editor)
    }

    // Add to custom shapes and get the ID
    const customShapeId = addCustomShape(customTrayItem)

    // Convert original selected shapes to instances of the new custom shape
    if (customShapeId) {
      const shapeInstances: any[] = []
      const instanceId = generateInstanceId()

      if (customTrayItem.shapeType === 'multi-shape') {
        // For multi-shape custom shapes, create a single instance group
        const shapes = customTrayItem.defaultProps?.shapes as any[]
        if (shapes && shapes.length > 0) {
          const bounds = customTrayItem.defaultProps?.originalBounds as any
          const centerOffsetX = bounds ? -bounds.width / 2 : -50
          const centerOffsetY = bounds ? -bounds.height / 2 : -50

          // Calculate the center position from the original group
          const groupBounds = editor.getSelectionPageBounds()
          const groupCenterX = groupBounds ? groupBounds.x + groupBounds.width / 2 : 0
          const groupCenterY = groupBounds ? groupBounds.y + groupBounds.height / 2 : 0

          // Create instances for each shape in the multi-shape
          for (const shape of shapes) {
            const newShapeId = createShapeId()
            // Remove any potential ID remnants from the template
            const { id, ...shapeWithoutId } = shape
            const instanceShape = {
              ...shapeWithoutId,
              id: newShapeId,
              x: groupCenterX + shape.x + centerOffsetX,
              y: groupCenterY + shape.y + centerOffsetY,
              meta: {
                ...cleanMetadata(shape.meta),
                customShapeId: customShapeId,
                instanceId: instanceId,
                isCustomShapeInstance: true as const,
                version: 1,
                groupEditMode: false,
                isGroupChild: true
              }
            }
            shapeInstances.push(instanceShape)
          }
        }
      } else {
        // For single shapes, convert the original shape to an instance
        const originalShape = validSelectedShapes[0]
        const instanceShape = {
          ...originalShape,
          id: createShapeId(),
          meta: {
            ...cleanMetadata(originalShape.meta),
            customShapeId: customShapeId,
            instanceId: instanceId,
            isCustomShapeInstance: true as const,
            version: 1,
            groupEditMode: false
          }
        }
        shapeInstances.push(instanceShape)
      }

      // Delete the original shapes and create the instances
      editor.run(() => {
        // Delete original shapes
        const originalIds = validSelectedShapes.map(shape => shape.id)
        editor.deleteShapes(originalIds)

        // Create the instances
        editor.createShapes(shapeInstances)

        // For multi-shape instances, group them
        if (customTrayItem.shapeType === 'multi-shape' && shapeInstances.length > 1) {
          const instanceIds = shapeInstances.map(shape => shape.id)
          const groupId = editor.groupShapes(instanceIds)

          // Add custom metadata to the group
          if (groupId) {
            const group = editor.getShape(groupId)
            if (group) {
              editor.updateShape({
                ...group,
                meta: {
                  customShapeId: customShapeId,
                  instanceId: instanceId,
                  isCustomShapeInstance: true as const,
                  version: 1,
                  isMultiShapeGroup: true
                }
              })
            }
            editor.setSelectedShapes([groupId])
          } else {
            // Fallback if grouping fails
            const instanceIds = shapeInstances.map(shape => shape.id).filter(id => id && typeof id === 'object')
            if (instanceIds.length > 0) {
              editor.setSelectedShapes(instanceIds)
            }
          }
        } else {
          // Select the new instances for single shapes
          const instanceIds = shapeInstances.map(shape => shape.id).filter(id => id && typeof id === 'object')
          if (instanceIds.length > 0) {
            editor.setSelectedShapes(instanceIds)
          }
        }
      }, { history: 'record-preserveRedoStack' })
    }

    const shapeDescription = validSelectedShapes.length === 1
      ? `${validSelectedShapes[0].type} shape`
      : `${validSelectedShapes.length} shapes`

    console.log(`Created custom shape from ${shapeDescription}:`, customTrayItem.label)
  }, [validSelectedShapes, editor, addCustomShape, generateInstanceId, cleanMetadata])

  const handlePointerDown = useCallback((e: React.PointerEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()

    // Handle selection for custom shapes
    if (isCustomShape(itemId)) {
      // If clicking on an already selected custom shape, keep it selected
      // If clicking on a different custom shape, select it
      setSelectedCustomShapeId(prev => prev === itemId ? itemId : itemId)

      // Focus the tray so it can receive keyboard events
      setTimeout(() => {
        trayRef.current?.focus()
      }, 0)
    } else {
      // Clear selection when clicking on pre-made shapes
      setSelectedCustomShapeId(null)
    }

    setDragState({
      type: 'pointing_item',
      itemId,
      pointerId: e.pointerId
    })

    const pointerId = e.pointerId
    const element = e.currentTarget as HTMLElement
    element.setPointerCapture(pointerId)
  }, [setDragState, isCustomShape])

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
        // Check if this is a custom shape (has createdAt field)
        const isCustomShape = 'createdAt' in trayItem && 'version' in trayItem

        if (trayItem.shapeType === 'multi-shape') {
          // Handle multi-shape custom shapes
          const shapes = trayItem.defaultProps?.shapes as any[]
          if (shapes && shapes.length > 0) {
            const createdShapeIds: string[] = []
            const instanceId = generateInstanceId()

            // Calculate center offset for the entire group
            const bounds = trayItem.defaultProps?.originalBounds as any
            const centerOffsetX = bounds ? -bounds.width / 2 : -50
            const centerOffsetY = bounds ? -bounds.height / 2 : -50

            // Create individual shapes first
            for (const shape of shapes) {
              const newShapeId = createShapeId()
              // Remove any potential ID remnants from the template
              const { id, ...shapeWithoutId } = shape
              const newShape = {
                ...shapeWithoutId,
                id: newShapeId,
                x: pagePoint.x + shape.x + centerOffsetX,
                y: pagePoint.y + shape.y + centerOffsetY,
                // Add instance metadata if this is a custom shape, but mark as grouped
                meta: isCustomShape ? {
                  customShapeId: trayItem.id,
                  instanceId: instanceId,
                  isCustomShapeInstance: true as const,
                  version: (trayItem as any).version,
                  groupEditMode: false,
                  isGroupChild: true // Mark as part of a group
                } : shape.meta
              }

              editor.createShape(newShape)
              createdShapeIds.push(newShapeId)
            }

            // Group the created shapes and add metadata to the group
            if (isCustomShape && createdShapeIds.length > 1) {
              const groupId = editor.groupShapes(createdShapeIds)

              // Add custom metadata to the group to track it as a custom shape instance
              if (groupId) {
                const group = editor.getShape(groupId)
                if (group) {
                  editor.updateShape({
                    ...group,
                    meta: {
                      customShapeId: trayItem.id,
                      instanceId: instanceId,
                      isCustomShapeInstance: true as const,
                      version: (trayItem as any).version,
                      isMultiShapeGroup: true
                    }
                  })
                }
              }

              // Select the group
              if (groupId) {
                editor.setSelectedShapes([groupId])
              }
            } else {
              // Fallback: select all created shapes if not grouped
              const validShapeIds = createdShapeIds.filter(id => id && typeof id === 'object')
              if (validShapeIds.length > 0) {
                editor.setSelectedShapes(validShapeIds)
              }
            }
          }
        } else {
          // Handle single shapes
          const baseShape = {
            id: shapeId,
            type: trayItem.shapeType,
            x: pagePoint.x - 50, // Center the shape on cursor
            y: pagePoint.y - 50,
            props: trayItem.defaultProps || {},
            // Add instance metadata if this is a custom shape
            meta: isCustomShape ? {
              customShapeId: trayItem.id,
              instanceId: generateInstanceId(),
              isCustomShapeInstance: true as const,
              version: (trayItem as any).version,
              groupEditMode: false
            } : undefined
          }

          editor.createShape(baseShape)
          if (shapeId && typeof shapeId === 'object') {
            editor.setSelectedShapes([shapeId])
          }
        }
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
        tabIndex={0}
        onKeyDown={(e) => {
          console.log('Tray keydown:', e.key, 'Selected shape:', selectedCustomShapeId)

          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCustomShapeId && isCustomShape(selectedCustomShapeId)) {
            console.log('Tray handling delete for:', selectedCustomShapeId)
            e.preventDefault()
            e.stopPropagation()
            removeCustomShape(selectedCustomShapeId)
            setSelectedCustomShapeId(null)
          }
        }}
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
          zIndex: 10,
          userSelect: 'none',
          outline: 'none'
        }}
      >
        {allTrayItems.map((item) => {
          const isSelected = selectedCustomShapeId === item.id

          return (
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
                border: isSelected ? '2px solid #007acc' : '1px solid transparent',
                backgroundColor: isSelected ? '#e6f3ff' : '#f8f9fa',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? '0 0 0 1px rgba(0, 122, 204, 0.3)' : 'none'
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
          )
        })}

        {/* Add Custom Shape Button - visible when any valid shapes are selected */}
        {hasValidShapesSelected && (
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
            title={validSelectedShapes.length === 1
              ? `Add selected ${validSelectedShapes[0].type} as custom shape`
              : `Add ${validSelectedShapes.length} selected shapes as custom shape`
            }
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