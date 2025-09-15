import { type ReactNode } from 'react'
import { Rnd } from 'react-rnd'
import { TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { type PanelId } from '../../store/panelStore'
import { useFloatingPanel } from './hooks/useFloatingPanel'

interface FloatingPanelProps {
  id: PanelId
  title: string
  children: ReactNode
  isCollapsed: boolean
  onToggleCollapse: () => void
  className?: string
}

export function FloatingPanel({
  id,
  title,
  children,
  isCollapsed,
  onToggleCollapse,
  className = ''
}: FloatingPanelProps) {

  const {
    panel,
    isDragging,
    isResizing,
    activeSnapGuides,
    handleDragStart,
    handleDrag,
    handleDragStop,
    handleResizeStart,
    handleResize,
    handleResizeStop,
    handlePanelClick,
    constraints
  } = useFloatingPanel({
    panelId: id
  })

  // Height calculation is now handled by the panel store defaults
  // This component simply uses whatever height is stored in the panel state

  if (!panel) return null

  const zIndex = 1000 + panel.order

  // Always use panel store height (respects user resizing and initial calculations)
  const effectiveHeight = isCollapsed
    ? 32
    : panel.size.height

  return (
    <Rnd
      size={{
        width: panel.size.width,
        height: effectiveHeight
      }}
      position={{
        x: panel.position.x,
        y: panel.position.y
      }}

      // Drag configuration
      dragHandleClassName="floating-panel__header"
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}

      // Resize configuration
      minWidth={constraints.minWidth}
      minHeight={isCollapsed ? undefined : constraints.minHeight}
      maxWidth={constraints.maxWidth}
      maxHeight={isCollapsed ? undefined : constraints.maxHeight}

      resizeHandleStyles={{
        bottom: {
          cursor: 'ns-resize',
          height: '8px',
          bottom: '-4px'
        },
        right: {
          cursor: 'ew-resize',
          width: '8px',
          right: '-4px'
        },
        bottomRight: {
          cursor: 'nwse-resize',
          width: '12px',
          height: '12px',
          right: '-6px',
          bottom: '-6px'
        }
      }}

      resizeHandleClasses={{
        bottom: 'floating-panel__resize-handle floating-panel__resize-handle--bottom',
        right: 'floating-panel__resize-handle floating-panel__resize-handle--right',
        bottomRight: 'floating-panel__resize-handle floating-panel__resize-handle--corner'
      }}

      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeStop={handleResizeStop}

      // Bounds and constraints
      bounds="parent"
      dragGrid={[1, 1]}
      resizeGrid={[1, 1]}

      // Enable/disable based on collapse state
      enableResizing={!isCollapsed}

      // Z-index and styling
      style={{
        zIndex: isDragging || isResizing ? zIndex + 1000 : zIndex
      }}

      className={`floating-panel ${className} ${
        isDragging ? 'floating-panel--dragging' : ''
      } ${
        isResizing ? 'floating-panel--resizing' : ''
      } ${
        isCollapsed ? 'floating-panel--collapsed' : ''
      }`}
    >
      <div
        className="floating-panel__container"
        onClick={handlePanelClick}
      >
        {/* Panel Header */}
        <div className="floating-panel__header">
          <div className="floating-panel__header-left">
            {/* Drag handle */}
            <div className="floating-panel__drag-handle" title="Drag to move">
              ⋮
            </div>

            {/* Title */}
            <span className="floating-panel__title">{title}</span>
          </div>

          <div className="floating-panel__header-right">
            {/* Collapse/Expand button */}
            <TldrawUiButton
              type="icon"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand" : "Collapse"}
              className="floating-panel__toggle"
            >
              <TldrawUiButtonIcon
                icon={isCollapsed ? "chevron-right" : "chevron-down"}
              />
            </TldrawUiButton>
          </div>
        </div>

        {/* Panel Content */}
        {!isCollapsed && (
          <div className="floating-panel__content">
            {children}
          </div>
        )}

        {/* Snap guides overlay */}
        {isDragging && activeSnapGuides.length > 0 && (
          <div className="floating-panel__snap-guides">
            {activeSnapGuides.map((guide, index) => (
              <div
                key={index}
                className={`snap-guide snap-guide--${guide.type} ${
                  guide.isActive ? 'snap-guide--active' : ''
                } ${
                  guide.snapType ? `snap-guide--${guide.snapType}` : ''
                }`}
                style={{
                  position: 'fixed',
                  ...(guide.type === 'vertical'
                    ? {
                        left: guide.position,
                        top: guide.start,
                        height: guide.end - guide.start,
                        width: 2
                      }
                    : {
                        top: guide.position,
                        left: guide.start,
                        width: guide.end - guide.start,
                        height: 2
                      }
                  ),
                  pointerEvents: 'none',
                  zIndex: 10000
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Rnd>
  )
}