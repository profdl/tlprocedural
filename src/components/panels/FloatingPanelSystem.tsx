import React, { useEffect } from 'react'
import { usePanelStore, type PanelId } from '../../store/panelStore'
import { FloatingPanel } from './FloatingPanel'
import { PropertiesPanelContent } from './PropertiesPanelContent'
import { StylePanelContent } from './StylePanelContent'
import { ModifiersPanelContent } from './ModifiersPanelContent'
import { usePanelConstraints } from './hooks/usePanelConstraints'
import './styles/floating-panels.css'

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

export function FloatingPanelSystem() {
  const {
    panels,
    panelOrder,
    setPanelCollapsed,
    setPanelPosition,
    initializeRightAlignedLayout
  } = usePanelStore()

  const { repositionOnResize } = usePanelConstraints()

  // Initialize panels on mount with right-aligned layout
  useEffect(() => {
    initializeRightAlignedLayout()
  }, [initializeRightAlignedLayout])

  // Handle window resize - maintain right-aligned panels
  useEffect(() => {
    const handleResize = () => {
      // Check if panels are snapped to browser right edge and maintain alignment
      Object.values(panels).forEach(panel => {
        if (panel.snapState?.snappedToBrowser.includes('right')) {
          const newX = window.innerWidth - panel.size.width - 20 // RIGHT_MARGIN
          if (newX !== panel.position.x) {
            setPanelPosition(panel.id, { ...panel.position, x: newX })
          }
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [panels, setPanelPosition])

  // Stop event propagation to prevent canvas interactions
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      className="floating-panel-system"
      onWheel={stopPropagation}
      onPointerDown={stopPropagation}
      onMouseDown={stopPropagation}
    >
      {panelOrder.map((panelId) => {
        const config = PANEL_CONFIGS[panelId]
        const panel = panels[panelId]

        if (!config || !panel) return null

        const PanelComponent = config.component

        return (
          <FloatingPanel
            key={panelId}
            id={panelId}
            title={config.title}
            isCollapsed={panel.isCollapsed}
            onToggleCollapse={() => setPanelCollapsed(panelId, !panel.isCollapsed)}
            className={`floating-panel--${panelId}`}
          >
            <PanelComponent />
          </FloatingPanel>
        )
      })}

      {/* Global snap guides container */}
      <div className="floating-panel-system__snap-guides">
        {/* Snap guide lines will be rendered here by individual panels */}
      </div>
    </div>
  )
}