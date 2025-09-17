import { useEffect } from 'react'
import { usePanelStore, type PanelId } from '../../store/panelStore'
import { StackedPanel } from './StackedPanel'

// Import the individual panel content components
import { PropertiesPanelContent } from './PropertiesPanelContent'
import { StylePanelContent } from './StylePanelContent'
import { ModifiersPanelContent } from './ModifiersPanelContent'
import { useSelectionMonitor } from './hooks/useSelectionMonitor'

interface PanelConfig {
  id: PanelId
  title: string
  component: React.ComponentType
}

const PANEL_CONFIGS: PanelConfig[] = [
  {
    id: 'properties',
    title: 'Properties',
    component: PropertiesPanelContent
  },
  {
    id: 'style',
    title: 'Style',
    component: StylePanelContent
  },
  {
    id: 'modifiers',
    title: 'Modifiers',
    component: ModifiersPanelContent
  }
]

export function StackedPanelSystem() {
  const {
    panels,
    panelOrder,
    setPanelCollapsed,
    initializePanels,
    setViewportHeight
  } = usePanelStore()

  // Monitor shape selection to control panel visibility
  useSelectionMonitor()

  // Initialize panels on mount
  useEffect(() => {
    initializePanels()
  }, [initializePanels])

  // Monitor viewport height changes
  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight)
    }

    // Set initial height
    updateViewportHeight()

    // Listen for resize events
    window.addEventListener('resize', updateViewportHeight)

    return () => {
      window.removeEventListener('resize', updateViewportHeight)
    }
  }, [setViewportHeight])

  // Render panels in the order specified by panelOrder
  const renderPanels = () => {
    return panelOrder.map(panelId => {
      const panel = panels[panelId]
      const config = PANEL_CONFIGS.find(c => c.id === panelId)

      if (!panel || !config || !panel.isVisible) {
        return null
      }

      const PanelContent = config.component

      return (
        <StackedPanel
          key={panelId}
          id={panelId}
          title={config.title}
          isCollapsed={panel.isCollapsed}
          onToggleCollapse={() => setPanelCollapsed(panelId, !panel.isCollapsed)}
        >
          <PanelContent />
        </StackedPanel>
      )
    })
  }

  // Stop event propagation to prevent canvas interactions
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      className="stacked-panel-system"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        pointerEvents: 'none',
        zIndex: 500,
        width: 296, // 280px panel + 16px margin
        height: '100vh'
      }}
      onWheel={stopPropagation}
      onPointerDown={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <div style={{ pointerEvents: 'auto' }}>
        {renderPanels()}
      </div>
    </div>
  )
}