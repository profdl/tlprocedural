import React, { ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { type PanelId } from '../../store/panelStore'

interface SimpleDragPanelItemProps {
  id: PanelId
  title: string
  children: ReactNode
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function SimpleDragPanelItem({
  id,
  title,
  children,
  isCollapsed,
  onToggleCollapse
}: SimpleDragPanelItemProps) {
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    transform,
    isDragging
  } = useDraggable({
    id,
    data: { type: 'panel-item', id }
  })

  const {
    setNodeRef: setDropRef,
    isOver
  } = useDroppable({
    id,
    data: { type: 'panel-item', id }
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  // Stop event propagation to prevent canvas interactions
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      ref={setDropRef}
      className={`panel-item ${isDragging ? 'panel-item--dragging' : ''} ${isCollapsed ? 'panel-item--collapsed' : ''} ${isOver ? 'panel-item--drop-target' : ''}`}
      onWheel={stopPropagation}
    >
      <div className="panel-item__header">
        {/* Drag handle */}
        <div
          ref={setDragRef}
          style={style}
          className="panel-item__drag-handle"
          {...dragAttributes}
          {...dragListeners}
          title="Drag to reorder"
          onMouseDown={(e) => {
            console.log('Simple drag handle mouse down:', id)
            e.stopPropagation()
          }}
        >
          ⋮
        </div>

        {/* Title */}
        <span className="panel-item__title">{title}</span>

        {/* Collapse/Expand button */}
        <TldrawUiButton
          type="icon"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand" : "Collapse"}
          className="panel-item__toggle"
        >
          <TldrawUiButtonIcon
            icon={isCollapsed ? "chevron-right" : "chevron-down"}
          />
        </TldrawUiButton>
      </div>

      {/* Panel content */}
      {!isCollapsed && (
        <div className="panel-item__content">
          {children}
        </div>
      )}
    </div>
  )
}