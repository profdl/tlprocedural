import React, { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { type PanelId } from '../../store/panelStore'

interface PanelItemProps {
  id: PanelId
  title: string
  children: ReactNode
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function PanelItem({
  id,
  title,
  children,
  isCollapsed,
  onToggleCollapse
}: PanelItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  }

  // Stop event propagation to prevent canvas interactions
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`panel-item ${isDragging ? 'panel-item--dragging' : ''} ${isCollapsed ? 'panel-item--collapsed' : ''}`}
      onWheel={stopPropagation}
      onPointerDown={stopPropagation}
      onMouseDown={(e) => {
        // Only stop propagation if it's not the drag handle
        if (!(e.target as HTMLElement).closest('.panel-item__drag-handle')) {
          e.stopPropagation()
        }
      }}
    >
      <div className="panel-item__header">
        {/* Drag handle */}
        <div
          className="panel-item__drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
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