import { useState, useMemo, useEffect } from 'react'
import {
  useEditor,
  useValue,
  type TLShapeId,
  type TLGeoShape,
  type TLBezierShape,
  TldrawUiButtonIcon
} from 'tldraw'
import {
  useSortable
} from '@dnd-kit/sortable'
import {
  useDroppable
} from '@dnd-kit/core'
import {
  CSS
} from '@dnd-kit/utilities'
import { ShapeTree } from './ShapeTree'
import { useModifierStore } from '../../../store/modifierStore'
import { BezierState } from '../../shapes/services/BezierState'
import type { BezierShape } from '../../shapes/BezierShape'

interface ShapeTreeItemProps {
  shapeId: TLShapeId
  depth: number
  isSelected: boolean
  parentIsHidden?: boolean
}

export function ShapeTreeItem({
  shapeId,
  depth,
  isSelected,
  parentIsHidden = false
}: ShapeTreeItemProps) {
  const editor = useEditor()
  const [isExpanded, setIsExpanded] = useState(true)

  // Get the shape data
  const shape = useValue('shape', () => editor.getShape(shapeId), [editor, shapeId])

  // Set up drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: shapeId,
    data: {
      type: shape?.type === 'group' ? 'group-item' : 'shape-item',
      parentId: shape?.parentId,
      shapeType: shape?.type
    }
  })

  // Set up drop zone for groups
  const {
    setNodeRef: setDropRef,
    isOver: isDropOver
  } = useDroppable({
    id: `${shapeId}-group-drop`,
    data: {
      type: 'group-drop-zone',
      groupId: shapeId,
      accepts: ['shape-item', 'group-item']
    },
    disabled: shape?.type !== 'group'
  })

  // Check if this is a modifier clone that should be hidden
  const isModifierClone = useMemo(() => {
    if (!shape) return false
    return shape.meta?.stackProcessed === true && !shape.meta?.appliedFromModifier
  }, [shape])

  // Track modifier state with local state to prevent infinite loops
  const [modifierInfo, setModifierInfo] = useState(() => {
    const modifiers = useModifierStore.getState().getModifiersForShape(shapeId)
    return {
      hasModifiers: modifiers.length > 0,
      modifierCount: modifiers.length,
      enabledModifiersCount: modifiers.filter(m => m.enabled).length
    }
  })

  // Subscribe to modifier changes for this specific shape
  useEffect(() => {
    const unsubscribe = useModifierStore.subscribe(
      (state) => state.getModifiersForShape(shapeId),
      (modifiers) => {
        setModifierInfo({
          hasModifiers: modifiers.length > 0,
          modifierCount: modifiers.length,
          enabledModifiersCount: modifiers.filter(m => m.enabled).length
        })
      },
      { equalityFn: (a, b) => a.length === b.length && a.every((m, i) => m.id === b[i].id && m.enabled === b[i].enabled) }
    )
    return unsubscribe
  }, [shapeId])

  const { hasModifiers, modifierCount, enabledModifiersCount } = modifierInfo

  // Check if this is a custom shape instance
  const isCustomShapeInstance = useMemo(() => {
    if (!shape) return false
    return shape.meta?.isCustomShapeInstance === true
  }, [shape])

  // Get child IDs if this shape has children
  const childIds = useValue(
    'childIds',
    () => editor.getSortedChildIdsForParent(shapeId),
    [editor, shapeId]
  )

  // Check if shape is hidden (opacity 0 means hidden)
  const isHidden = useValue(
    'isHidden',
    () => {
      const shp = editor.getShape(shapeId)
      return shp?.opacity === 0
    },
    [editor, shapeId]
  )

  // Get selected shape IDs for child components
  const selectedShapeIds = useValue(
    'selectedShapeIds',
    () => editor.getSelectedShapeIds(),
    [editor]
  )

  // Determine the effective hidden state (parent hidden or self hidden)
  const effectivelyHidden = parentIsHidden || isHidden

  // Format the shape name
  const shapeName = useMemo(() => {
    if (!shape) return 'Unknown'

    // Handle different shape types
    switch (shape.type) {
      case 'group': {
        // Check if it has a boolean operation in meta
        const operation = shape.meta?.operation
        if (operation) {
          return `Group (${operation})`
        }
        return 'Group'
      }
      case 'geo': {
        const geoShape = shape as TLGeoShape
        const geoType = geoShape.props?.geo
        if (geoType) {
          return geoType.charAt(0).toUpperCase() + geoType.slice(1)
        }
        return 'Geo'
      }
      case 'bezier':
        return 'Path'
      case 'arrow':
        return 'Arrow'
      case 'text':
        return 'Text'
      case 'image':
        return 'Image'
      case 'video':
        return 'Video'
      case 'embed':
        return 'Embed'
      case 'frame':
        return shape.name || 'Frame'
      case 'polygon':
        return 'Polygon'
      case 'triangle':
        return 'Triangle'
      case 'circle':
        return 'Circle'
      case 'custom-line':
        return 'Line'
      case 'custom-draw':
        return 'Drawing'
      case 'sine-wave':
        return 'Sine Wave'
      case 'compound':
        return 'Compound'
      default:
        // For custom shapes, try to use a friendly name
        return shape.type.charAt(0).toUpperCase() + shape.type.slice(1).replace(/-/g, ' ')
    }
  }, [shape])

  // Get anchor points for bezier shapes
  const anchorPoints = useMemo(() => {
    if (shape?.type !== 'bezier') return []
    const { props } = shape as TLBezierShape
    const points = props?.points
    if (!Array.isArray(points)) return []
    return points.map((_, index) => `Anchor ${index + 1}`)
  }, [shape])

  // Get selected anchor points for bezier shapes
  const selectedAnchorIndices = useMemo(() => {
    if (shape?.type !== 'bezier') return []
    const bezierShape = shape as BezierShape
    return bezierShape.props.selectedPointIndices || []
  }, [shape])

  // Don't render if shape doesn't exist or if it's a modifier clone
  if (!shape || isModifierClone) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    // Don't handle clicks during drag operations
    if (isDragging) {
      return
    }

    // Exit edit mode for any bezier shape that's currently in edit mode
    const allShapes = editor.getCurrentPageShapes()
    const editingBezierShape = allShapes.find(s =>
      s.type === 'bezier' &&
      'editMode' in s.props &&
      s.props.editMode === true
    ) as BezierShape | undefined

    if (editingBezierShape) {
      // If this click is on the same shape that's in edit mode, exit edit mode
      // If this click is on a different shape, also exit edit mode
      BezierState.exitEditMode(editingBezierShape, editor)
    }

    // Handle multi-selection with shift key
    if (e.shiftKey) {
      const currentSelectedIds = editor.getSelectedShapeIds()

      if (currentSelectedIds.includes(shapeId)) {
        // Deselect if already selected
        const newSelection = currentSelectedIds.filter(id => id !== shapeId)
        editor.setSelectedShapes(newSelection)
      } else {
        // Add to selection
        editor.setSelectedShapes([...currentSelectedIds, shapeId])
      }
    } else {
      // Single selection (replace current selection)
      editor.select(shapeId)
    }

    // Only move camera if shape is out of view and it's a single selection
    if (!e.shiftKey) {
      const shapeBounds = editor.getShapePageBounds(shapeId)
      if (shapeBounds) {
        const viewportBounds = editor.getViewportPageBounds()

        // Check if shape is completely outside the viewport
        const isOutOfView = (
          shapeBounds.x + shapeBounds.width < viewportBounds.x ||
          shapeBounds.x > viewportBounds.x + viewportBounds.width ||
          shapeBounds.y + shapeBounds.height < viewportBounds.y ||
          shapeBounds.y > viewportBounds.y + viewportBounds.height
        )

        if (isOutOfView) {
          editor.zoomToSelection()
        }
      }
    }
  }

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation()

    // Toggle opacity between 0 and 1
    const newOpacity = isHidden ? 1 : 0

    // Helper function to recursively update child shapes
    const updateChildShapes = (parentId: TLShapeId, opacity: number) => {
      const childIds = editor.getSortedChildIdsForParent(parentId)
      const childShapes = childIds.map(id => editor.getShape(id)).filter(Boolean)

      if (childShapes.length > 0) {
        editor.updateShapes(
          childShapes.map(child => ({
            id: child.id,
            type: child.type,
            opacity: opacity
          }))
        )

        // Recursively update grandchildren
        childShapes.forEach(child => {
          updateChildShapes(child.id, opacity)
        })
      }
    }

    // Update the main shape
    editor.updateShape({
      id: shapeId,
      type: shape.type,
      opacity: newOpacity
    })

    // Update child shapes (for groups)
    if (childIds.length > 0) {
      updateChildShapes(shapeId, newOpacity)
    }

    // If this shape has modifiers, also hide/show its clones
    if (hasModifiers) {
      const allShapes = editor.getCurrentPageShapes()
      const cloneShapes = allShapes.filter(s =>
        s.meta?.originalShapeId === shapeId &&
        s.meta?.stackProcessed === true
      )

      // Update all clone shapes
      if (cloneShapes.length > 0) {
        editor.updateShapes(
          cloneShapes.map(clone => ({
            id: clone.id,
            type: clone.type,
            opacity: newOpacity
          }))
        )
      }
    }
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleAnchorClick = (e: React.MouseEvent, anchorIndex: number) => {
    e.stopPropagation()

    if (!shape || shape.type !== 'bezier') return

    // Cast to proper BezierShape type
    const bezierShape = shape as BezierShape

    // Check if this anchor is already selected and is the only selection
    const currentSelectedIndices = bezierShape.props.selectedPointIndices || []
    const isOnlySelectedAnchor = currentSelectedIndices.length === 1 && currentSelectedIndices[0] === anchorIndex

    // If clicking the only selected anchor, exit edit mode instead of deselecting
    if (isOnlySelectedAnchor && bezierShape.props.editMode) {
      BezierState.exitEditMode(bezierShape, editor)
      return
    }

    // Enter edit mode for the bezier shape if not already in edit mode
    if (!bezierShape.props.editMode) {
      BezierState.enterEditMode(bezierShape, editor)
    }

    // Select the specific anchor point after a brief delay to ensure edit mode is active
    setTimeout(() => {
      const currentShape = editor.getShape(shape.id) as BezierShape
      if (currentShape) {
        const updatedShape = BezierState.handlePointSelection(currentShape, anchorIndex, false, editor)

        // Check if all points were deselected and exit edit mode if so
        setTimeout(() => {
          const finalShape = editor.getShape(shape.id) as BezierShape
          if (finalShape && finalShape.props.editMode && (!finalShape.props.selectedPointIndices || finalShape.props.selectedPointIndices.length === 0)) {
            BezierState.exitEditMode(finalShape, editor)
          }
        }, 10)
      }
    }, 50)

    // Keep the current tool active (don't switch to bezier tool)
  }

  const hasChildren = childIds.length > 0 || anchorPoints.length > 0

  // Combine refs
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    if (shape?.type === 'group') {
      setDropRef(node)
    }
  }

  // Combine drag styles
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${12 + depth * 20}px`,
    opacity: effectivelyHidden ? 0.4 : isDragging ? 0.5 : 1
  }

  return (
    <>
      <div
        ref={combinedRef}
        className={`shape-tree-item ${isSelected ? 'shape-tree-item--selected' : ''} ${isDragging ? 'shape-tree-item--dragging' : ''} ${isDropOver && shape?.type === 'group' ? 'shape-tree-item--drop-target' : ''}`}
        style={dragStyle}
        onClick={handleClick}
      >
        <div className="shape-tree-item__content">
          <div className="shape-tree-item__left">
            {/* Drag handle */}
            <button
              className="shape-tree-item__drag-handle"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="6" cy="3" r="1" fill="currentColor" />
                <circle cx="6" cy="6" r="1" fill="currentColor" />
                <circle cx="6" cy="9" r="1" fill="currentColor" />
              </svg>
            </button>

            {/* Expand/collapse button */}
            {hasChildren && (
              <button
                className="shape-tree-item__expand"
                onClick={handleToggleExpand}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <TldrawUiButtonIcon
                  icon={isExpanded ? 'chevron-down' : 'chevron-right'}
                />
              </button>
            )}

            {/* Shape name */}
            <span className="shape-tree-item__name">
              {shapeName}
            </span>

            {/* Modifier tag */}
            {hasModifiers && (
              <span
                className="shape-tree-item__modifier-tag"
                title={`${modifierCount} modifier${modifierCount !== 1 ? 's' : ''} applied (${enabledModifiersCount} active)`}
              >
                {modifierCount > 1 ? 'Modifiers' : 'Modifier'}
              </span>
            )}

            {/* Instance tag */}
            {isCustomShapeInstance && (
              <span
                className="shape-tree-item__instance-tag"
                title="Instance of user-created custom shape"
              >
                Instance
              </span>
            )}
          </div>

          <div className="shape-tree-item__actions">
            {/* Visibility toggle */}
            <button
              className="shape-tree-item__visibility"
              onClick={handleToggleVisibility}
              aria-label={isHidden ? 'Show' : 'Hide'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isHidden ? (
                  <>
                    <path d="M2 2l20 20" />
                    <path d="M6.71 6.71A10.5 10.5 0 0 0 1 12c1.5 3.5 5.5 7 11 7a9.77 9.77 0 0 0 5.29-1.71" />
                    <path d="M14 14a3 3 0 1 1-4.24-4.24" />
                    <path d="M1 1l6 6" />
                    <path d="M17.29 17.29A9.77 9.77 0 0 0 23 12c-1.5-3.5-5.5-7-11-7" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>

            {/* Edit tool icon for bezier shapes */}
            {shape.type === 'bezier' && (
              <button
                className="shape-tree-item__edit"
                onClick={(e) => {
                  e.stopPropagation()
                  editor.select(shapeId)
                  editor.setCurrentTool('bezier')
                }}
                aria-label="Edit path"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/>
                  <path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/>
                  <path d="m2.3 2.3 7.286 7.286"/>
                  <circle cx="11" cy="11" r="2"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Render children or anchor points if expanded */}
      {isExpanded && hasChildren && (
        <>
          {/* Render anchor points for bezier shapes */}
          {anchorPoints.length > 0 && (
            <div
              className="shape-tree-anchors"
              style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
            >
              {anchorPoints.map((anchor, index) => {
                const isAnchorSelected = selectedAnchorIndices.includes(index)
                return (
                  <button
                    key={`anchor-${index}`}
                    className={`shape-tree-item shape-tree-item--anchor ${isAnchorSelected ? 'shape-tree-item--anchor--selected' : ''}`}
                    style={{
                      paddingLeft: `${32 + depth * 20}px`,
                      opacity: effectivelyHidden ? 0.4 : 1,
                      pointerEvents: isDragging ? 'none' : 'auto'
                    }}
                    onClick={(e) => handleAnchorClick(e, index)}
                    aria-label={`Select ${anchor}`}
                    tabIndex={isDragging ? -1 : 0}
                  >
                    <span className="shape-tree-item__name">{anchor}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Render child shapes */}
          {childIds.length > 0 && (
            <ShapeTree
              shapeIds={childIds}
              selectedIds={selectedShapeIds}
              depth={depth + 1}
              parentIsHidden={effectivelyHidden}
            />
          )}
        </>
      )}
    </>
  )
}
