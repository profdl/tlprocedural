import { useState, useMemo } from 'react'
import {
  useEditor,
  useValue,
  type TLShapeId,
  type TLGeoShape,
  type TLBezierShape,
  TldrawUiButtonIcon
} from 'tldraw'
import { ShapeTree } from './ShapeTree'

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

  // Get child IDs if this shape has children
  const childIds = useValue(
    'childIds',
    () => editor.getSortedChildIdsForParent(shapeId),
    [editor, shapeId]
  )

  // Check if shape is hidden
  const isHidden = useValue(
    'isHidden',
    () => {
      const shp = editor.getShape(shapeId)
      return shp?.meta?.isHidden === true
    },
    [editor, shapeId]
  )

  // Get selected shape IDs for child components
  const selectedShapeIds = useValue(
    'selectedShapeIds',
    () => editor.getSelectedShapeIds(),
    [editor]
  )

  // Determine the effective hidden state
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

  if (!shape) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Select the shape
    editor.select(shapeId)
    // Center the camera on the shape
    editor.zoomToSelection()
  }

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation()
    editor.updateShape({
      id: shapeId,
      type: shape.type,
      meta: {
        ...shape.meta,
        isHidden: !isHidden
      }
    })
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const hasChildren = childIds.length > 0 || anchorPoints.length > 0

  return (
    <>
      <div
        className={`shape-tree-item ${isSelected ? 'shape-tree-item--selected' : ''}`}
        style={{
          paddingLeft: `${12 + depth * 20}px`,
          opacity: effectivelyHidden ? 0.4 : 1
        }}
        onClick={handleClick}
      >
        <div className="shape-tree-item__content">
          <div className="shape-tree-item__left">
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
            <div className="shape-tree-anchors">
              {anchorPoints.map((anchor, index) => (
                <div
                  key={`anchor-${index}`}
                  className="shape-tree-item shape-tree-item--anchor"
                  style={{
                    paddingLeft: `${32 + depth * 20}px`,
                    opacity: effectivelyHidden ? 0.4 : 1
                  }}
                >
                  <span className="shape-tree-item__name">{anchor}</span>
                </div>
              ))}
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
