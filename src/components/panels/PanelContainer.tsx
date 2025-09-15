import React, { useRef, useState, useCallback, ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { usePanelStore, type PanelId } from '../../store/panelStore'

interface PanelContainerProps {
  id: PanelId
  title: string
  children: ReactNode
  showClose?: boolean
  minHeight?: number
  maxHeight?: number
  resizable?: boolean
  autoHeight?: boolean
  className?: string
}

export function PanelContainer({
  id,
  title,
  children,
  showClose = false,
  minHeight = 100,
  maxHeight = 800,
  resizable = false,
  autoHeight = true,
  className = ''
}: PanelContainerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  const {
    panels,
    setPanelCollapsed,
    setPanelPosition,
    setPanelSize,
    setActivePanel,
    startDragging,
    stopDragging
  } = usePanelStore()

  const panel = panels[id]
  if (!panel) return null

  const { isCollapsed, position, size } = panel

  // Drag and drop setup using @dnd-kit
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging
  } = useDraggable({
    id,
    data: { type: 'panel', panelId: id }
  })

  const dragStyle = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined

  // Handle panel activation (focus)
  const handlePanelClick = useCallback(() => {
    setActivePanel(id)
  }, [id, setActivePanel])

  // Handle collapse/expand
  const handleToggleCollapse = useCallback(() => {
    setPanelCollapsed(id, !isCollapsed)
  }, [id, isCollapsed, setPanelCollapsed])

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!resizable) return

    e.preventDefault()
    e.stopPropagation()

    setIsResizing(true)
    resizeStartY.current = e.clientY
    resizeStartHeight.current = size.height

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartY.current
      const newHeight = Math.min(maxHeight, Math.max(minHeight, resizeStartHeight.current + deltaY))
      setPanelSize(id, { height: newHeight })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [id, resizable, minHeight, maxHeight, size.height, setPanelSize])

  // Stop event propagation to prevent canvas interactions
  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      ref={panelRef}
      className={`panel-container ${className} ${isDragging ? 'panel-container--dragging' : ''} ${isCollapsed ? 'panel-container--collapsed' : ''}`}
      style={{
        ...dragStyle,
        left: position.x,
        top: position.y,
        width: size.width,
        height: isCollapsed ? 'auto' : (autoHeight ? 'auto' : size.height),
        maxHeight: autoHeight && !isCollapsed ? maxHeight : undefined,
        zIndex: panel.order
      }}
      onClick={handlePanelClick}
      onPointerDown={stopPropagation}
      onPointerMove={stopPropagation}
      onPointerUp={stopPropagation}
      onWheel={stopPropagation}
    >
      <div className="panel-container__header">
        <div className="panel-container__header-left">
          {/* Drag handle */}
          <div
            ref={setDragRef}
            className="tlui-button tlui-button__panel panel-container__drag-handle"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            style={{ cursor: 'grab' }}
          >
            ⋮
          </div>

          {/* Title */}
          <span className="panel-container__title">{title}</span>
        </div>

        <div className="panel-container__header-right">
          {/* Collapse/Expand button */}
          <TldrawUiButton
            type="icon"
            onClick={handleToggleCollapse}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            <TldrawUiButtonIcon
              icon={isCollapsed ? "chevron-right" : "chevron-down"}
            />
          </TldrawUiButton>

          {/* Close button (if enabled) */}
          {showClose && (
            <TldrawUiButton
              type="icon"
              onClick={() => setPanelCollapsed(id, true)}
              title="Close panel"
            >
              ×
            </TldrawUiButton>
          )}
        </div>
      </div>

      {/* Panel content */}
      {!isCollapsed && (
        <div className="panel-container__content">
          {children}
        </div>
      )}

      {/* Resize handle */}
      {resizable && !autoHeight && !isCollapsed && (
        <div
          className="panel-container__resize-handle"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  )
}