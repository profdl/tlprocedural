import type { PanelId, PanelState, TabGroupState, PanelPosition, PanelStackState } from '../panelStore'

export interface TabGroupOperations {
  createTabGroup: (
    panelIds: PanelId[],
    panels: Record<PanelId, PanelState>,
    tabGroups: Record<string, TabGroupState>,
    panelOrder: PanelId[],
    tabGroupOrder: string[],
    position?: PanelPosition
  ) => {
    tabGroupId: string
    updatedPanels: Record<PanelId, PanelState>
    newPanelOrder: PanelId[]
    updatedTabGroups: Record<string, TabGroupState>
    newTabGroupOrder: string[]
  }

  mergeIntoTabGroup: (
    targetPanelId: PanelId,
    draggedPanelId: PanelId,
    panels: Record<PanelId, PanelState>,
    tabGroups: Record<string, TabGroupState>,
    panelOrder: PanelId[],
    tabGroupOrder: string[]
  ) => {
    updatedPanels: Record<PanelId, PanelState>
    newPanelOrder: PanelId[]
    updatedTabGroups: Record<string, TabGroupState>
    newTabGroupOrder: string[]
  } | null

  splitPanelFromTabGroup: (
    panelId: PanelId,
    panels: Record<PanelId, PanelState>,
    tabGroups: Record<string, TabGroupState>,
    panelOrder: PanelId[],
    tabGroupOrder: string[]
  ) => {
    updatedPanels: Record<PanelId, PanelState>
    newPanelOrder: PanelId[]
    updatedTabGroups: Record<string, TabGroupState>
    newTabGroupOrder: string[]
  } | null

  setActiveTab: (
    tabGroupId: string,
    panelId: PanelId,
    tabGroups: Record<string, TabGroupState>
  ) => Record<string, TabGroupState> | null

  reorderTabsInGroup: (
    tabGroupId: string,
    fromIndex: number,
    toIndex: number,
    panels: Record<PanelId, PanelState>,
    tabGroups: Record<string, TabGroupState>
  ) => {
    updatedPanels: Record<PanelId, PanelState>
    updatedTabGroups: Record<string, TabGroupState>
  } | null

  setTabGroupCollapsed: (
    tabGroupId: string,
    collapsed: boolean,
    tabGroups: Record<string, TabGroupState>
  ) => Record<string, TabGroupState> | null

  setTabGroupDragging: (
    tabGroupId: string,
    isDragging: boolean,
    tabGroups: Record<string, TabGroupState>
  ) => Record<string, TabGroupState> | null

  setTabGroupStackState: (
    tabGroupId: string,
    stackState: PanelStackState,
    tabGroups: Record<string, TabGroupState>
  ) => Record<string, TabGroupState> | null

  clearTabGroupStackState: (
    tabGroupId: string,
    tabGroups: Record<string, TabGroupState>
  ) => Record<string, TabGroupState> | null

  reorderTabGroups: (
    fromIndex: number,
    toIndex: number,
    tabGroupOrder: string[]
  ) => string[]

  isTabGroupEmpty: (
    tabGroupId: string,
    tabGroups: Record<string, TabGroupState>
  ) => boolean
}

export const createTabGroupOperations = (): TabGroupOperations => ({
  createTabGroup: (panelIds, panels, tabGroups, panelOrder, tabGroupOrder, position) => {
    const tabGroupId = `tabgroup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

    // Create the tab group
    const tabGroup: TabGroupState = {
      id: tabGroupId,
      panelIds: [...panelIds],
      activeTabId: panelIds[0],
      position: position || panels[panelIds[0]]?.position || { y: 0 },
      size: panels[panelIds[0]]?.size || { width: 280, height: 200 },
      isCollapsed: false,
      order: Math.max(...Object.values(panels).map(p => p.order)) + 1
    }

    // Update panels to reference the tab group
    const updatedPanels = { ...panels }
    panelIds.forEach((panelId, index) => {
      if (updatedPanels[panelId]) {
        updatedPanels[panelId] = {
          ...updatedPanels[panelId],
          tabGroupId,
          tabIndex: index,
          isVisible: false // Hide individual panels when in tab group
        }
      }
    })

    // Remove panels from panel order
    const newPanelOrder = panelOrder.filter(id => !panelIds.includes(id))

    // Add tab group to order
    const newTabGroupOrder = [...tabGroupOrder, tabGroupId]

    const updatedTabGroups = {
      ...tabGroups,
      [tabGroupId]: tabGroup
    }

    return {
      tabGroupId,
      updatedPanels,
      newPanelOrder,
      updatedTabGroups,
      newTabGroupOrder
    }
  },

  mergeIntoTabGroup: (targetPanelId, draggedPanelId, panels, tabGroups, panelOrder, tabGroupOrder) => {
    const targetPanel = panels[targetPanelId]
    const draggedPanel = panels[draggedPanelId]

    if (!targetPanel || !draggedPanel) return null

    // If target is already in a tab group, add dragged panel to it
    if (targetPanel.tabGroupId) {
      const tabGroup = tabGroups[targetPanel.tabGroupId]
      if (!tabGroup) return null

      // Find the correct insertion index based on Y position
      const draggedPanelY = draggedPanel.position.y
      const existingPanels = tabGroup.panelIds.map(id => ({
        id,
        y: panels[id]?.position.y || 0
      })).sort((a, b) => a.y - b.y)

      // Find where to insert the dragged panel to maintain Y order
      let insertIndex = 0
      for (let i = 0; i < existingPanels.length; i++) {
        if (draggedPanelY > existingPanels[i].y) {
          insertIndex = i + 1
        } else {
          break
        }
      }

      // Create new panel order with dragged panel inserted at correct position
      const newPanelIds = [...tabGroup.panelIds]
      newPanelIds.splice(insertIndex, 0, draggedPanelId)

      // Update all panels with their new tab indexes
      const updatedPanels = { ...panels }
      newPanelIds.forEach((panelId, index) => {
        if (updatedPanels[panelId]) {
          updatedPanels[panelId] = {
            ...updatedPanels[panelId],
            tabGroupId: targetPanel.tabGroupId,
            tabIndex: index,
            isVisible: false
          }
        }
      })

      // Update tab group position to be at the top if dragged panel is higher
      const tabGroupY = tabGroup.position.y
      const shouldMoveToTop = draggedPanelY < tabGroupY

      const updatedTabGroup = {
        ...tabGroup,
        panelIds: newPanelIds,
        activeTabId: draggedPanelId, // Make the dragged panel active for visual feedback
        position: shouldMoveToTop ? draggedPanel.position : tabGroup.position,
        order: Math.min(draggedPanel.order, tabGroup.order) // Always use the lowest order (earliest in default sequence)
      }

      // Remove dragged panel from panel order
      const newPanelOrder = panelOrder.filter(id => id !== draggedPanelId)

      return {
        updatedPanels,
        newPanelOrder,
        updatedTabGroups: {
          ...tabGroups,
          [targetPanel.tabGroupId]: updatedTabGroup
        },
        newTabGroupOrder: tabGroupOrder
      }
    } else {
      // Create new tab group with both panels ordered by Y position
      const tabGroupId = `tabgroup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

      // Order panels by Y position (top to bottom)
      const panelsWithY = [
        { id: targetPanelId, panel: targetPanel, y: targetPanel.position.y },
        { id: draggedPanelId, panel: draggedPanel, y: draggedPanel.position.y }
      ].sort((a, b) => a.y - b.y)

      const orderedPanelIds = panelsWithY.map(p => p.id)
      const topPanel = panelsWithY[0].panel
      const topPosition = panelsWithY[0].panel.position

      const tabGroup: TabGroupState = {
        id: tabGroupId,
        panelIds: orderedPanelIds, // Order by Y position
        activeTabId: draggedPanelId, // Make dragged panel active for visual feedback
        position: topPosition, // Use the topmost position
        size: topPanel.size,
        isCollapsed: topPanel.isCollapsed,
        order: Math.min(targetPanel.order, draggedPanel.order) // Use the topmost panel's order (lower number = higher in stack)
      }

      const updatedPanels = { ...panels }
      orderedPanelIds.forEach((panelId, index) => {
        updatedPanels[panelId] = {
          ...updatedPanels[panelId],
          tabGroupId,
          tabIndex: index,
          isVisible: false
        }
      })

      // Remove both panels from panel order
      const newPanelOrder = panelOrder.filter(id => id !== targetPanelId && id !== draggedPanelId)

      // Add tab group to order - position will be determined by order value in getDisplayOrder
      const newTabGroupOrder = [...tabGroupOrder, tabGroupId]

      return {
        updatedPanels,
        newPanelOrder,
        updatedTabGroups: {
          ...tabGroups,
          [tabGroupId]: tabGroup
        },
        newTabGroupOrder
      }
    }
  },

  splitPanelFromTabGroup: (panelId, panels, tabGroups, panelOrder, tabGroupOrder) => {
    const panel = panels[panelId]
    if (!panel?.tabGroupId) return null

    const tabGroup = tabGroups[panel.tabGroupId]
    if (!tabGroup) return null

    // Remove panel from tab group
    const newPanelIds = tabGroup.panelIds.filter(id => id !== panelId)

    // Find tab group position in display order to insert panel nearby
    const tabGroupIndex = tabGroupOrder.indexOf(panel.tabGroupId)

    // Insert panel after the tab group position in panel order
    // Count how many individual panels come before this tab group
    let insertPosition = 0
    const displayOrder = [...panelOrder.filter(id => panels[id]?.isVisible && !panels[id]?.tabGroupId)]

    // Add individual panels that come before tab groups
    for (let i = 0; i < tabGroupIndex && i < tabGroupOrder.length; i++) {
      insertPosition = displayOrder.length
    }

    // Update panel to be independent
    const updatedPanels = {
      ...panels,
      [panelId]: {
        ...panel,
        tabGroupId: undefined,
        tabIndex: undefined,
        isVisible: true,
        position: tabGroup.position,
        size: tabGroup.size
      }
    }

    // Update tab indexes for remaining panels
    newPanelIds.forEach((id, index) => {
      if (updatedPanels[id]) {
        updatedPanels[id] = {
          ...updatedPanels[id],
          tabIndex: index
        }
      }
    })

    // Insert panel at calculated position instead of at the end
    const newPanelOrder = [...panelOrder]
    if (!newPanelOrder.includes(panelId)) {
      newPanelOrder.splice(Math.min(insertPosition, newPanelOrder.length), 0, panelId)
    }

    // Update or remove tab group
    const updatedTabGroups = { ...tabGroups }
    let newTabGroupOrder = [...tabGroupOrder]

    if (newPanelIds.length === 0) {
      // Remove empty tab group
      delete updatedTabGroups[panel.tabGroupId]
      newTabGroupOrder = newTabGroupOrder.filter(id => id !== panel.tabGroupId)
    } else if (newPanelIds.length === 1) {
      // Convert single-panel tab group back to individual panel
      const lastPanelId = newPanelIds[0]
      updatedPanels[lastPanelId] = {
        ...updatedPanels[lastPanelId],
        tabGroupId: undefined,
        tabIndex: undefined,
        isVisible: true,
        position: tabGroup.position,
        size: tabGroup.size
      }

      // Add last panel to the order at the same position
      if (!newPanelOrder.includes(lastPanelId)) {
        newPanelOrder.splice(Math.min(insertPosition + 1, newPanelOrder.length), 0, lastPanelId)
      }

      // Remove tab group
      delete updatedTabGroups[panel.tabGroupId]
      newTabGroupOrder = newTabGroupOrder.filter(id => id !== panel.tabGroupId)
    } else {
      // Update tab group with remaining panels
      updatedTabGroups[panel.tabGroupId] = {
        ...tabGroup,
        panelIds: newPanelIds,
        activeTabId: tabGroup.activeTabId === panelId ? newPanelIds[0] : tabGroup.activeTabId
      }
    }

    return {
      updatedPanels,
      newPanelOrder,
      updatedTabGroups,
      newTabGroupOrder
    }
  },

  setActiveTab: (tabGroupId, panelId, tabGroups) => {
    const tabGroup = tabGroups[tabGroupId]
    if (!tabGroup || !tabGroup.panelIds.includes(panelId)) return null

    return {
      ...tabGroups,
      [tabGroupId]: {
        ...tabGroup,
        activeTabId: panelId
      }
    }
  },

  reorderTabsInGroup: (tabGroupId, fromIndex, toIndex, panels, tabGroups) => {
    const tabGroup = tabGroups[tabGroupId]
    if (!tabGroup) return null

    const newPanelIds = [...tabGroup.panelIds]
    const [movedPanel] = newPanelIds.splice(fromIndex, 1)
    newPanelIds.splice(toIndex, 0, movedPanel)

    // Update tab indexes
    const updatedPanels = { ...panels }
    newPanelIds.forEach((panelId, index) => {
      if (updatedPanels[panelId]) {
        updatedPanels[panelId] = {
          ...updatedPanels[panelId],
          tabIndex: index
        }
      }
    })

    return {
      updatedPanels,
      updatedTabGroups: {
        ...tabGroups,
        [tabGroupId]: {
          ...tabGroup,
          panelIds: newPanelIds
        }
      }
    }
  },

  setTabGroupCollapsed: (tabGroupId, collapsed, tabGroups) => {
    const tabGroup = tabGroups[tabGroupId]
    if (!tabGroup) return null

    return {
      ...tabGroups,
      [tabGroupId]: {
        ...tabGroup,
        isCollapsed: collapsed
      }
    }
  },

  setTabGroupDragging: (tabGroupId, isDragging, tabGroups) => {
    const tabGroup = tabGroups[tabGroupId]
    if (!tabGroup) return null

    return {
      ...tabGroups,
      [tabGroupId]: {
        ...tabGroup,
        isDragging
      }
    }
  },

  setTabGroupStackState: (tabGroupId, stackState, tabGroups) => {
    const tabGroup = tabGroups[tabGroupId]
    if (!tabGroup) return null

    return {
      ...tabGroups,
      [tabGroupId]: {
        ...tabGroup,
        stackState
      }
    }
  },

  clearTabGroupStackState: (tabGroupId, tabGroups) => {
    const tabGroup = tabGroups[tabGroupId]
    if (!tabGroup) return null

    return {
      ...tabGroups,
      [tabGroupId]: {
        ...tabGroup,
        stackState: {
          isReordering: false
        }
      }
    }
  },

  reorderTabGroups: (fromIndex, toIndex, tabGroupOrder) => {
    const newOrder = [...tabGroupOrder]
    const [movedGroup] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, movedGroup)
    return newOrder
  },

  isTabGroupEmpty: (tabGroupId, tabGroups) => {
    const tabGroup = tabGroups[tabGroupId]
    return !tabGroup || tabGroup.panelIds.length === 0
  }
})