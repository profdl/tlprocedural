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
    initializePanels
  } = usePanelStore()

  const { repositionOnResize } = usePanelConstraints()

  // Initialize panels on mount
  useEffect(() => {
    initializePanels()
  }, [initializePanels])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const newViewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }

      // Reposition panels to stay within viewport
      const repositioned = repositionOnResize(panels, newViewport)

      // Update panel positions in store
      Object.entries(repositioned).forEach(([id, { position, size }]) => {
        const panelId = id as PanelId
        if (panels[panelId]) {
          // Update position and size if they changed
          if (position.x !== panels[panelId].position.x || position.y !== panels[panelId].position.y) {
            // setPanelPosition(panelId, position) - would need to add this method to store
          }
          if (size.width !== panels[panelId].size.width || size.height !== panels[panelId].size.height) {
            // setPanelSize(panelId, size) - already exists
          }
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [panels, repositionOnResize])

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