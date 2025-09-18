import type { PanelId, PanelState, TabGroupState, PanelPosition } from '../panelStore'

// Panel layout constants
export const PANEL_WIDTH = 280
export const TOP_MARGIN = 8
export const PANEL_GAP = 0
export const BOTTOM_MARGIN = 40
export const COLLAPSED_HEIGHT = 28

export interface LayoutResult {
  positions: Record<PanelId, PanelPosition>
  calculatedHeights: Record<PanelId, number>
}

export interface TabGroupLayoutResult extends LayoutResult {
  tabGroupPositions: Record<string, PanelPosition>
  tabGroupCalculatedHeights: Record<string, number>
  displayItems: Array<{ type: 'panel' | 'tabGroup'; id: string }>
}

// Function to calculate stacked layout including tab groups
export const calculateStackedLayoutWithTabGroups = (
  panelOrder: PanelId[],
  panels: Record<PanelId, PanelState>,
  tabGroups: Record<string, TabGroupState>,
  tabGroupOrder: string[],
  viewportHeight: number
): TabGroupLayoutResult => {
  let currentY = TOP_MARGIN
  const positions: Record<PanelId, PanelPosition> = {
    properties: { y: 0 },
    style: { y: 0 },
    modifiers: { y: 0 }
  }
  const calculatedHeights: Record<PanelId, number> = {
    properties: 0,
    style: 0,
    modifiers: 0
  }
  const tabGroupPositions: Record<string, PanelPosition> = {}
  const tabGroupCalculatedHeights: Record<string, number> = {}

  // Get display order (individual panels + tab groups) sorted by order property
  const displayItemsWithOrder: Array<{ type: 'panel' | 'tabGroup'; id: string; order: number }> = []

  // Add individual panels (not in tab groups) with their order
  panelOrder.forEach(panelId => {
    if (panels[panelId]?.isVisible && !panels[panelId]?.tabGroupId) {
      displayItemsWithOrder.push({
        type: 'panel',
        id: panelId,
        order: panels[panelId].order
      })
    }
  })

  // Add tab groups with their order
  tabGroupOrder.forEach(tabGroupId => {
    const tabGroup = tabGroups[tabGroupId]
    if (tabGroup) {
      displayItemsWithOrder.push({
        type: 'tabGroup',
        id: tabGroupId,
        order: tabGroup.order
      })
    }
  })

  // Sort by order value for proper visual stacking (lower order = higher in stack)
  displayItemsWithOrder.sort((a, b) => a.order - b.order)

  // Convert to the expected format without order property
  const displayItems: Array<{ type: 'panel' | 'tabGroup'; id: string }> = displayItemsWithOrder.map(item => ({
    type: item.type,
    id: item.id
  }))

  // Calculate fixed heights and collect modifier items
  const fixedHeights: Record<PanelId, number> = {
    properties: panels.properties?.contentHeight || 213,
    style: panels.style?.contentHeight || 164,
    modifiers: 0 // Will be calculated based on remaining space
  }

  const modifierItems: Array<{ type: 'panel' | 'tabGroup'; id: string }> = []
  let fixedItemsHeight = 0

  displayItems.forEach(item => {
    if (item.type === 'panel') {
      const panelId = item.id as PanelId
      const panel = panels[panelId]
      if (panel) {
        if (panelId === 'modifiers') {
          modifierItems.push(item)
        } else {
          const height = panel.isCollapsed ? COLLAPSED_HEIGHT : fixedHeights[panelId] || 200
          fixedItemsHeight += height + PANEL_GAP
        }
      }
    } else if (item.type === 'tabGroup') {
      const tabGroup = tabGroups[item.id]
      if (tabGroup) {
        // Check if tab group contains modifiers
        if (tabGroup.panelIds.includes('modifiers')) {
          modifierItems.push(item)
        } else {
          // Use the height from the tab group, or calculate from content
          let tabGroupHeight = tabGroup.size.height
          if (tabGroup.isCollapsed) {
            tabGroupHeight = COLLAPSED_HEIGHT
          }
          fixedItemsHeight += tabGroupHeight + PANEL_GAP
        }
      }
    }
  })

  // Calculate remaining height for modifier items
  const availableHeight = viewportHeight - TOP_MARGIN - BOTTOM_MARGIN
  const remainingHeight = Math.max(200, availableHeight - fixedItemsHeight)
  const modifierItemHeight = modifierItems.length > 0 ? remainingHeight / modifierItems.length : 0

  // Second pass: assign positions and final heights
  displayItems.forEach(item => {
    if (item.type === 'panel') {
      const panelId = item.id as PanelId
      const panel = panels[panelId]
      if (panel) {
        positions[panelId] = { y: currentY }

        let panelHeight: number
        if (panel.isCollapsed) {
          panelHeight = COLLAPSED_HEIGHT
        } else if (panelId === 'modifiers') {
          panelHeight = modifierItemHeight
        } else {
          panelHeight = fixedHeights[panelId] || 200
        }

        calculatedHeights[panelId] = panelHeight
        currentY += panelHeight + PANEL_GAP
      }
    } else if (item.type === 'tabGroup') {
      const tabGroup = tabGroups[item.id]
      if (tabGroup) {
        tabGroupPositions[item.id] = { y: currentY }

        let tabGroupHeight: number
        if (tabGroup.isCollapsed) {
          tabGroupHeight = COLLAPSED_HEIGHT
        } else if (tabGroup.panelIds.includes('modifiers')) {
          tabGroupHeight = modifierItemHeight
        } else {
          tabGroupHeight = tabGroup.size.height
        }

        tabGroupCalculatedHeights[item.id] = tabGroupHeight
        currentY += tabGroupHeight + PANEL_GAP
      }
    }
  })

  return {
    positions,
    calculatedHeights,
    tabGroupPositions,
    tabGroupCalculatedHeights,
    displayItems
  }
}

// Function to calculate stacked panel positions and heights (legacy for individual panels)
export const calculateStackedLayout = (
  panelOrder: PanelId[],
  panels: Record<PanelId, PanelState>,
  viewportHeight: number
): LayoutResult => {
  let currentY = TOP_MARGIN
  const positions: Record<PanelId, PanelPosition> = {
    properties: { y: 0 },
    style: { y: 0 },
    modifiers: { y: 0 }
  }
  const calculatedHeights: Record<PanelId, number> = {
    properties: 0,
    style: 0,
    modifiers: 0
  }

  // Calculate positions and heights for visible panels
  const visiblePanels = panelOrder.filter(id => panels[id]?.isVisible)

  // First pass: calculate fixed heights for properties and style panels
  const fixedHeights: Record<PanelId, number> = {
    properties: panels.properties?.contentHeight || 213,
    style: panels.style?.contentHeight || 164,
    modifiers: 0 // Will be calculated based on remaining space
  }

  // Calculate remaining height for modifiers panel
  const fixedPanelsHeight = visiblePanels
    .filter(id => id !== 'modifiers')
    .reduce((total, id) => {
      const height = panels[id]?.isCollapsed ? COLLAPSED_HEIGHT : fixedHeights[id] || 200
      return total + height + PANEL_GAP
    }, 0)

  const availableHeight = viewportHeight - TOP_MARGIN - BOTTOM_MARGIN
  const modifiersHeight = Math.max(200, availableHeight - fixedPanelsHeight)

  // Second pass: assign positions and final heights
  visiblePanels.forEach(id => {
    positions[id] = { y: currentY }

    let panelHeight: number
    if (panels[id]?.isCollapsed) {
      panelHeight = COLLAPSED_HEIGHT
    } else if (id === 'modifiers') {
      panelHeight = modifiersHeight
    } else {
      panelHeight = fixedHeights[id] || 200
    }

    calculatedHeights[id] = panelHeight
    currentY += panelHeight + PANEL_GAP
  })

  return { positions, calculatedHeights }
}