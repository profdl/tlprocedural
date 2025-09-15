import React, { useState, useCallback } from 'react'
import { TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  CSS,
} from '@dnd-kit/utilities'
import { MODIFIER_DISPLAY_NAMES } from '../constants'
import { ModifierControlPanel } from '../controls/ModifierControlPanel'
import type { 
  TLModifier, 
  TLModifierId,
  LinearArraySettings,
  CircularArraySettings,
  GridArraySettings,
  MirrorSettings,
  LSystemSettings
} from '../../../types/modifiers'
import { useModifierStore } from '../../../store/modifierStore'

// Local stopEventPropagation implementation
function stopEventPropagation(e: React.SyntheticEvent | Event) {
  e.stopPropagation()
}

interface ModifierListProps {
  modifiers: TLModifier[]
  onToggleModifier: (modifierId: string) => void
  onRemoveModifier: (modifierId: string) => void
  shapeId: string
}

/**
 * Component for rendering the list of modifiers
 * Extracts the modifier list rendering logic from ModifierControls
 */
export function ModifierList({ modifiers, onToggleModifier, onRemoveModifier, shapeId }: ModifierListProps) {
  const store = useModifierStore()
  const [collapsedModifiers, setCollapsedModifiers] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  const toggleCollapsed = useCallback((modifierId: string) => {
    setCollapsedModifiers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(modifierId)) {
        newSet.delete(modifierId)
      } else {
        newSet.add(modifierId)
      }
      return newSet
    })
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (active.id !== over?.id) {
      const oldIndex = modifiers.findIndex(m => m.id === active.id)
      const newIndex = modifiers.findIndex(m => m.id === over?.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Create new order array
        const newOrder = [...modifiers]
        const [removed] = newOrder.splice(oldIndex, 1)
        newOrder.splice(newIndex, 0, removed)
        
        // Update the order in the store
        const newOrderIds = newOrder.map(m => m.id as TLModifierId)
        store.reorderModifiers(shapeId as import('tldraw').TLShapeId, newOrderIds)
      }
    }
    
    setActiveId(null)
  }, [modifiers, shapeId, store])

  if (modifiers.length === 0) {
    return (
      <div className="modifier-controls__empty">
        <p>No modifiers added yet</p>
        <p>Click the "Add Modifier" button to add modifiers</p>
      </div>
    )
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={modifiers.map(m => m.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="modifier-controls__list">
          {modifiers.map((modifier) => {
            const isCollapsed = collapsedModifiers.has(modifier.id)
            const isEnabled = modifier.enabled
            
            return (
              <SortableModifierItem
                key={modifier.id}
                modifier={modifier}
                isCollapsed={isCollapsed}
                isEnabled={isEnabled}
                onToggleCollapsed={toggleCollapsed}
                onToggleModifier={onToggleModifier}
                onRemoveModifier={onRemoveModifier}
                onUpdateSettings={(newSettings) => {
                  store.updateModifier(modifier.id as TLModifierId, { props: newSettings })
                }}
              />
            )
          })}
        </div>
      </SortableContext>
      
      <DragOverlay>
        {activeId ? (
          <div className="modifier-controls__item modifier-controls__item--dragging">
            <div className="modifier-controls__item-header">
              <div className="modifier-controls__item-title">
                <div className="modifier-controls__drag-handle">⋮⋮</div>
                <span className="modifier-controls__checkbox-text">
                  {MODIFIER_DISPLAY_NAMES[modifiers.find(m => m.id === activeId)?.type as keyof typeof MODIFIER_DISPLAY_NAMES] || 'Modifier'}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface ModifierItemProps {
  modifier: TLModifier
  isCollapsed: boolean
  isEnabled: boolean
  onToggleCollapsed: (modifierId: string) => void
  onToggleModifier: (modifierId: string) => void
  onRemoveModifier: (modifierId: string) => void
  onUpdateSettings: (newSettings: LinearArraySettings | CircularArraySettings | GridArraySettings | MirrorSettings | LSystemSettings) => void
}

/**
 * Sortable wrapper for modifier items
 */
function SortableModifierItem(props: ModifierItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.modifier.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ModifierItem
        {...props}
        dragAttributes={attributes}
        dragListeners={listeners}
        isDragging={isDragging}
      />
    </div>
  )
}

interface ModifierItemProps {
  modifier: TLModifier
  isCollapsed: boolean
  isEnabled: boolean
  onToggleCollapsed: (modifierId: string) => void
  onToggleModifier: (modifierId: string) => void
  onRemoveModifier: (modifierId: string) => void
  onUpdateSettings: (newSettings: LinearArraySettings | CircularArraySettings | GridArraySettings | MirrorSettings | LSystemSettings) => void
  dragAttributes?: Record<string, unknown>
  dragListeners?: Record<string, unknown>
  isDragging?: boolean
}

/**
 * Component for rendering a single modifier item
 */
function ModifierItem({
  modifier,
  isCollapsed,
  isEnabled,
  onToggleCollapsed,
  onToggleModifier,
  onRemoveModifier,
  onUpdateSettings,
  dragAttributes,
  dragListeners,
  isDragging = false
}: ModifierItemProps) {
  return (
    <div className={`modifier-controls__item ${isDragging ? 'modifier-controls__item--dragging' : ''}`}>
      <div className="modifier-controls__item-header">
        <div className="modifier-controls__item-title">
          <div
            className="modifier-controls__drag-handle"
            {...dragAttributes}
            {...dragListeners}
            title="Drag to reorder"
          >
            ⋮⋮
          </div>
          <TldrawUiButton
            type="icon"
            onPointerDown={(e) => {
              stopEventPropagation(e)
              onToggleCollapsed(modifier.id)
            }}
            title={isCollapsed ? "Expand" : "Collapse"}
            className="modifier-controls__caret"
          >
            <TldrawUiButtonIcon
              icon={isCollapsed ? "chevron-right" : "chevron-down"}
            />
          </TldrawUiButton>
          <label className="modifier-controls__checkbox-label">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={() => onToggleModifier(modifier.id)}
              onPointerDown={stopEventPropagation}
              className="modifier-controls__checkbox"
            />
            <span className="modifier-controls__checkbox-text">
              {MODIFIER_DISPLAY_NAMES[modifier.type] || modifier.type}
            </span>
          </label>
        </div>
        <TldrawUiButton
          type="icon"
          onPointerDown={(e) => {
            stopEventPropagation(e)
            onRemoveModifier(modifier.id)
          }}
          title="Remove Modifier"
          className="modifier-controls__remove-button"
        >
          ×
        </TldrawUiButton>
      </div>
      
      {/* Modifier details UI */}
      {!isCollapsed && (
        <div className="modifier-controls__item-details">
          <ModifierControlPanel
            modifierType={modifier.type}
            settings={modifier.props}
            onChange={onUpdateSettings}
          />
        </div>
      )}
    </div>
  )
} 