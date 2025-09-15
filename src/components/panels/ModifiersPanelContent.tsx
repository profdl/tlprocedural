import React, { useState, useCallback } from 'react'
import { useEditor, useValue, type TLShape } from 'tldraw'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useModifierManager } from '../modifiers/hooks/useModifierManager'
import { ModifierActionButtons } from '../modifiers/components/ModifierActionButtons'
import { ModifierSubPanel } from './ModifierSubPanel'
import { useModifierStore } from '../../store/modifierStore'
import { MODIFIER_DISPLAY_NAMES } from '../modifiers/constants'
import type { TLModifierId } from '../../types/modifiers'

export function ModifiersPanelContent() {
  const editor = useEditor()
  const store = useModifierStore()
  const [activeId, setActiveId] = useState<string | null>(null)

  // Get the currently selected shapes, expanding groups to include their child shapes
  const selectedShapes = useValue(
    'selected-shapes',
    () => {
      const shapes = editor.getSelectedShapes()

      // Expand groups to include their child shapes for modifier processing
      const expandedShapes: TLShape[] = []

      shapes.forEach(shape => {
        if (shape.type === 'group') {
          // Get all child shapes in the group
          const childShapeIds = editor.getShapeAndDescendantIds([shape.id])
          const childShapes = Array.from(childShapeIds)
            .map((id) => editor.getShape(id))
            .filter(Boolean) as TLShape[]

          expandedShapes.push(...childShapes)
        } else {
          expandedShapes.push(shape)
        }
      })

      return expandedShapes
    },
    [editor]
  )

  // Use the modifier management hook
  const {
    selectedShape,
    shapeModifiers,
    hasEnabledModifiers,
    addModifier,
    removeModifier,
    toggleModifier,
    applyModifier,
    applyModifiers
  } = useModifierManager({ selectedShapes })

  // Handle drag start for modifier reordering
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // Handle drag end for modifier reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id && selectedShape) {
      const oldIndex = shapeModifiers.findIndex(m => m.id === active.id)
      const newIndex = shapeModifiers.findIndex(m => m.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // Create new order array
        const newOrder = [...shapeModifiers]
        const [removed] = newOrder.splice(oldIndex, 1)
        newOrder.splice(newIndex, 0, removed)

        // Update the order in the store
        const newOrderIds = newOrder.map(m => m.id as TLModifierId)
        store.reorderModifiers(selectedShape.id as any, newOrderIds)
      }
    }

    setActiveId(null)
  }, [shapeModifiers, selectedShape, store])

  if (!selectedShape) {
    return (
      <div className="panel-empty-state">
        <p>Select a shape to add modifiers</p>
      </div>
    )
  }

  return (
    <div className="modifiers-panel__content">
      {/* Action Buttons */}
      <div className="modifiers-panel__actions">
        <ModifierActionButtons
          selectedShape={!!selectedShape}
          hasEnabledModifiers={hasEnabledModifiers}
          onAddModifier={addModifier}
          onApplyModifiers={applyModifiers}
        />
      </div>

      {/* Scrollable Modifier List */}
      <div className="modifiers-panel__scroll-container">
        {shapeModifiers.length === 0 ? (
          <div className="panel-empty-state panel-empty-state--small">
            <p>No modifiers added yet</p>
            <p>Click "Add Modifier" to get started</p>
          </div>
        ) : (
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={shapeModifiers.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="modifiers-panel__list">
                {shapeModifiers.map((modifier) => (
                  <ModifierSubPanel
                    key={modifier.id}
                    modifier={modifier}
                    onToggle={() => applyModifier(modifier.id)}
                    onRemove={() => removeModifier(modifier.id)}
                    shapeId={selectedShape.id}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeId ? (
                <div className="modifier-sub-panel modifier-sub-panel--dragging">
                  <div className="modifier-sub-panel__header">
                    <div className="modifier-sub-panel__header-left">
                      <div className="modifier-sub-panel__drag-handle">⋮⋮</div>
                      <span className="modifier-sub-panel__title">
                        {MODIFIER_DISPLAY_NAMES[shapeModifiers.find(m => m.id === activeId)?.type as keyof typeof MODIFIER_DISPLAY_NAMES] || 'Modifier'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}