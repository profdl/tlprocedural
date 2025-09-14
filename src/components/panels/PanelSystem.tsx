import React, { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  type DragMoveEvent,
  type ClientRect
} from '@dnd-kit/core'
import { usePanelStore, type PanelId } from '../../store/panelStore'
import { PropertiesPanel } from './PropertiesPanel'
import { StylePanel } from './StylePanel'
import { ModifiersPanel } from './ModifiersPanel'
import './styles/panels.css'

// Snap distance threshold in pixels
const SNAP_THRESHOLD = 30

interface SnapZone {
  panelId: PanelId
  position: 'above' | 'below' | 'left' | 'right'
  rect: ClientRect
}

export function PanelSystem() {
  const [activeDragId, setActiveDragId] = useState<PanelId | null>(null)
  const [snapZones, setSnapZones] = useState<SnapZone[]>([])
  const [activeSnapZone, setActiveSnapZone] = useState<SnapZone | null>(null)

  const {
    panels,
    initializePanels,
    startDragging,
    stopDragging,
    dockPanel,
    undockPanel,
    setPanelPosition
  } = usePanelStore()

  // Initialize panels on mount
  useEffect(() => {
    initializePanels()
  }, [initializePanels])

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance to activate
      },
    })
  )

  // Calculate snap zones when dragging starts
  const calculateSnapZones = useCallback((draggedId: PanelId) => {
    const zones: SnapZone[] = []

    Object.values(panels).forEach(panel => {
      if (panel.id === draggedId) return

      // Create snap zones for each panel
      const rect = {
        top: panel.position.y,
        bottom: panel.position.y + panel.size.height,
        left: panel.position.x,
        right: panel.position.x + panel.size.width,
        width: panel.size.width,
        height: panel.size.height
      }

      // Above zone
      zones.push({
        panelId: panel.id,
        position: 'above',
        rect: {
          ...rect,
          bottom: rect.top,
          height: SNAP_THRESHOLD
        }
      })

      // Below zone
      zones.push({
        panelId: panel.id,
        position: 'below',
        rect: {
          ...rect,
          top: rect.bottom,
          height: SNAP_THRESHOLD
        }
      })

      // Left zone (disabled for now to keep vertical stacking)
      // zones.push({
      //   panelId: panel.id,
      //   position: 'left',
      //   rect: {
      //     ...rect,
      //     right: rect.left,
      //     width: SNAP_THRESHOLD
      //   }
      // })

      // Right zone (disabled for now to keep vertical stacking)
      // zones.push({
      //   panelId: panel.id,
      //   position: 'right',
      //   rect: {
      //     ...rect,
      //     left: rect.right,
      //     width: SNAP_THRESHOLD
      //   }
      // })
    })

    return zones
  }, [panels])

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const panelId = event.active.id as PanelId
    setActiveDragId(panelId)
    startDragging(panelId)
    setSnapZones(calculateSnapZones(panelId))
  }, [startDragging, calculateSnapZones])

  // Handle drag move - check for snap zones
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!activeDragId || !event.active.rect.current.translated) return

    const draggedRect = event.active.rect.current.translated
    const draggedCenter = {
      x: draggedRect.left + draggedRect.width / 2,
      y: draggedRect.top + draggedRect.height / 2
    }

    // Find the closest snap zone
    let closestZone: SnapZone | null = null
    let minDistance = SNAP_THRESHOLD

    snapZones.forEach(zone => {
      const zoneCenter = {
        x: zone.rect.left + zone.rect.width / 2,
        y: zone.rect.top + zone.rect.height / 2
      }

      const distance = Math.sqrt(
        Math.pow(draggedCenter.x - zoneCenter.x, 2) +
        Math.pow(draggedCenter.y - zoneCenter.y, 2)
      )

      if (distance < minDistance) {
        minDistance = distance
        closestZone = zone
      }
    })

    setActiveSnapZone(closestZone)
  }, [activeDragId, snapZones])

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const panelId = event.active.id as PanelId
    const delta = event.delta

    if (activeSnapZone) {
      // Dock to the snap zone
      dockPanel(panelId, activeSnapZone.panelId, activeSnapZone.position)
    } else if (delta) {
      // Update position based on drag delta
      const panel = panels[panelId]
      if (panel) {
        const newPosition = {
          x: panel.position.x + delta.x,
          y: panel.position.y + delta.y
        }
        setPanelPosition(panelId, newPosition)

        // Undock if it was docked
        if (panel.isDocked) {
          undockPanel(panelId)
        }
      }
    }

    // Clean up
    setActiveDragId(null)
    setActiveSnapZone(null)
    setSnapZones([])
    stopDragging()
  }, [activeSnapZone, panels, dockPanel, setPanelPosition, undockPanel, stopDragging])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="panel-system">
        {/* Render panels */}
        <PropertiesPanel />
        <StylePanel />
        <ModifiersPanel />

        {/* Snap zone indicators */}
        {activeSnapZone && (
          <div
            className="panel-system__snap-indicator"
            style={{
              position: 'absolute',
              left: activeSnapZone.rect.left,
              top: activeSnapZone.rect.top,
              width: activeSnapZone.rect.width,
              height: activeSnapZone.rect.height
            }}
          />
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeDragId && (
            <div className="panel-container panel-container--drag-overlay">
              <div className="panel-container__header">
                <span className="panel-container__title">
                  {activeDragId === 'properties' && 'Shape Properties'}
                  {activeDragId === 'style' && 'Style'}
                  {activeDragId === 'modifiers' && 'Modifiers'}
                </span>
              </div>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}