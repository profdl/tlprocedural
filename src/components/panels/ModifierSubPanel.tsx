import React, { useState, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { useModifierStore } from '../../store/modifierStore'
import { ModifierControlPanel } from '../modifiers/controls/ModifierControlPanel'
import { MODIFIER_DISPLAY_NAMES } from '../modifiers/constants'
import type {
  TLModifier,
  TLModifierId,
  LinearArraySettings,
  CircularArraySettings,
  GridArraySettings,
  MirrorSettings,
  LSystemSettings
} from '../../types/modifiers'

interface ModifierSubPanelProps {
  modifier: TLModifier
  onToggle: () => void
  onRemove: () => void
  shapeId: string
}

export function ModifierSubPanel({
  modifier,
  onToggle,
  onRemove,
  shapeId
}: ModifierSubPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const store = useModifierStore()

  // Sortable setup for drag and drop reordering
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: modifier.id,
    data: { type: 'modifier', modifierId: modifier.id }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Handle collapsing
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  // Handle settings update
  const handleUpdateSettings = useCallback((
    newSettings: LinearArraySettings | CircularArraySettings | GridArraySettings | MirrorSettings | LSystemSettings
  ) => {
    store.updateModifier(modifier.id as TLModifierId, { props: newSettings as any })
  }, [modifier.id, store])

  // Stop event propagation
  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`modifier-sub-panel ${isDragging ? 'modifier-sub-panel--dragging' : ''} ${isCollapsed ? 'modifier-sub-panel--collapsed' : ''}`}
    >
      <div className="modifier-sub-panel__header">
        <div className="modifier-sub-panel__header-left">
          {/* Drag handle */}
          <div
            className="modifier-sub-panel__drag-handle"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
          >
            ⋮
          </div>

          {/* Modifier name */}
          <span className="modifier-sub-panel__title">
            {MODIFIER_DISPLAY_NAMES[modifier.type] || modifier.type}
          </span>
        </div>

        <div className="modifier-sub-panel__header-right">
          {/* Apply button */}
          <TldrawUiButton
            type="normal"
            onClick={onToggle}
            onPointerDown={stopPropagation}
            title={modifier.enabled ? "Applied" : "Apply"}
            className={`modifier-sub-panel__apply-button ${modifier.enabled ? 'modifier-sub-panel__apply-button--enabled' : ''}`}
          >
            {modifier.enabled ? "APPLIED" : "APPLY"}
          </TldrawUiButton>

          {/* Collapse/Expand button */}
          <TldrawUiButton
            type="icon"
            onClick={handleToggleCollapse}
            onPointerDown={stopPropagation}
            title={isCollapsed ? "Expand" : "Collapse"}
            className="modifier-sub-panel__collapse-button"
          >
            <TldrawUiButtonIcon
              icon={isCollapsed ? "chevron-right" : "chevron-down"}
            />
          </TldrawUiButton>

          {/* Remove button */}
          <TldrawUiButton
            type="icon"
            onClick={onRemove}
            onPointerDown={stopPropagation}
            title="Remove modifier"
            className="modifier-sub-panel__remove-button"
          >
            ×
          </TldrawUiButton>
        </div>
      </div>

      {/* Modifier controls */}
      {!isCollapsed && (
        <div className="modifier-sub-panel__content">
          <ModifierControlPanel
            modifierType={modifier.type as any}
            settings={modifier.props}
            onChange={handleUpdateSettings as any}
          />
        </div>
      )}
    </div>
  )
}