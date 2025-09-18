import { useEffect } from 'react'
import { usePanelStore, type PanelId } from '../../store/panelStore'
import { StackedPanel } from './StackedPanel'
import { TabbedPanelContainer } from './TabbedPanelContainer'

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
    tabGroups,
    tabGroupOrder,
    setPanelCollapsed,
    initializePanels,
    setViewportHeight,
    getDisplayOrder
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

  // Helper function to get panel content component
  const getPanelContent = (panelId: PanelId) => {
    const config = PANEL_CONFIGS.find(c => c.id === panelId)
    if (!config) return null

    const PanelContent = config.component
    return <PanelContent />
  }

  // Render panels and tab groups in display order
  const renderPanels = () => {
    const displayOrder = getDisplayOrder()

    return displayOrder.map(item => {
      if (item.type === 'panel') {
        const panelId = item.id as PanelId
        const panel = panels[panelId]
        const config = PANEL_CONFIGS.find(c => c.id === panelId)

        if (!panel || !config || !panel.isVisible || panel.tabGroupId) {
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
      } else if (item.type === 'tabGroup') {
        const tabGroupId = item.id
        const tabGroup = tabGroups[tabGroupId]

        if (!tabGroup || tabGroup.panelIds.length === 0) {
          return null
        }

        // Create panel contents map for the tab group
        const panelContents: Record<PanelId, React.ReactNode> = {}
        tabGroup.panelIds.forEach(panelId => {
          panelContents[panelId] = getPanelContent(panelId)
        })

        return (
          <TabbedPanelContainer
            key={tabGroupId}
            tabGroup={tabGroup}
            panelContents={panelContents}
          />
        )
      }

      return null
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