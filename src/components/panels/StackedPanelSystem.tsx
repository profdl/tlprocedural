import React, { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { usePanelStore, type PanelId } from '../../store/panelStore'
import { PanelItem } from './PanelItem'
import { PropertiesPanelContent } from './PropertiesPanelContent'
import { StylePanelContent } from './StylePanelContent'
import { ModifiersPanelContent } from './ModifiersPanelContent'
import './styles/stacked-panels.css'

const PANEL_CONFIGS = {
  properties: {
    id: 'properties' as PanelId,
    title: 'Properties',
    component: PropertiesPanelContent
  },
  style: {
    id: 'style' as PanelId,
    title: 'Style',
    component: StylePanelContent
  },
  modifiers: {
    id: 'modifiers' as PanelId,
    title: 'Modifiers',
    component: ModifiersPanelContent
  }
}

export function StackedPanelSystem() {
  const [activeDragId, setActiveDragId] = useState<PanelId | null>(null)

  const {
    panelOrder,
    setPanelOrder,
    panels,
    setPanelCollapsed
  } = usePanelStore()

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10, // Minimum drag distance to activate
      },
    })
  )

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const panelId = event.active.id as PanelId
    setActiveDragId(panelId)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = panelOrder.indexOf(active.id as PanelId)
      const newIndex = panelOrder.indexOf(over.id as PanelId)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(panelOrder, oldIndex, newIndex)
        setPanelOrder(newOrder)
      }
    }

    setActiveDragId(null)
  }

  // Get the dragged panel config for overlay
  const draggedPanelConfig = activeDragId ? PANEL_CONFIGS[activeDragId] : null

  return (
    <div className="stacked-panel-system">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="stacked-panel-system__container">
          <SortableContext
            items={panelOrder}
            strategy={verticalListSortingStrategy}
          >
            {panelOrder.map((panelId) => {
              const config = PANEL_CONFIGS[panelId]
              const panel = panels[panelId]

              if (!config || !panel) return null

              const PanelComponent = config.component

              return (
                <PanelItem
                  key={panelId}
                  id={panelId}
                  title={config.title}
                  isCollapsed={panel.isCollapsed}
                  onToggleCollapse={() => setPanelCollapsed(panelId, !panel.isCollapsed)}
                >
                  <PanelComponent />
                </PanelItem>
              )
            })}
          </SortableContext>
        </div>

        <DragOverlay>
          {draggedPanelConfig && (
            <div className="panel-item panel-item--drag-overlay">
              <div className="panel-item__header">
                <div className="panel-item__drag-handle">
                  ⋮
                </div>
                <span className="panel-item__title">
                  {draggedPanelConfig.title}
                </span>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}