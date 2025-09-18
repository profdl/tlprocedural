import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type PanelId = 'properties' | 'style' | 'modifiers'

export interface PanelPosition {
  y: number
}

export interface PanelSize {
  width: number
  height: number
}

export interface PanelStackState {
  isReordering: boolean
  insertIndex?: number
}

export interface TabGroupState {
  id: string
  panelIds: PanelId[]
  activeTabId: PanelId
  position: PanelPosition
  size: PanelSize
  isCollapsed: boolean
  order: number
  isDragging?: boolean
  stackState?: PanelStackState
}

export interface PanelState {
  id: PanelId
  isCollapsed: boolean
  isVisible: boolean
  position: PanelPosition
  size: PanelSize
  originalSize: PanelSize
  contentHeight?: number
  order: number
  isDragging?: boolean
  stackState?: PanelStackState
  tabGroupId?: string
  tabIndex?: number
}

interface PanelStoreState {
  // State
  panels: Record<PanelId, PanelState>
  panelOrder: PanelId[]
  activePanelId: PanelId | null
  viewportHeight: number
  tabGroups: Record<string, TabGroupState>
  tabGroupOrder: string[]

  // Panel management
  initializePanels: () => void
  setPanelCollapsed: (id: PanelId, collapsed: boolean) => void
  setPanelVisible: (id: PanelId, visible: boolean) => void
  setPanelContentHeight: (id: PanelId, contentHeight: number) => void
  setActivePanel: (id: PanelId | null) => void
  setViewportHeight: (height: number) => void

  // Stacked panel state
  setPanelDragging: (id: PanelId, isDragging: boolean) => void
  setPanelStackState: (id: PanelId, stackState: PanelStackState) => void
  clearPanelStackState: (id: PanelId) => void

  // Tab group management
  createTabGroup: (panelIds: PanelId[], position?: PanelPosition) => string
  mergeIntoTabGroup: (targetPanelId: PanelId, draggedPanelId: PanelId) => void
  splitPanelFromTabGroup: (panelId: PanelId) => void
  setActiveTab: (tabGroupId: string, panelId: PanelId) => void
  reorderTabsInGroup: (tabGroupId: string, fromIndex: number, toIndex: number) => void
  setTabGroupCollapsed: (tabGroupId: string, collapsed: boolean) => void
  setTabGroupDragging: (tabGroupId: string, isDragging: boolean) => void
  setTabGroupStackState: (tabGroupId: string, stackState: PanelStackState) => void
  clearTabGroupStackState: (tabGroupId: string) => void

  // Layout management
  resetPanelLayout: () => void
  reorderPanels: (fromIndex: number, toIndex: number) => void
  reorderTabGroups: (fromIndex: number, toIndex: number) => void

  // Panel ordering
  setPanelOrder: (order: PanelId[]) => void
  insertPanelAt: (panelId: PanelId, index: number) => void

  // Position calculation
  calculatePanelPositions: () => void
  getCalculatedPanelHeight: (panelId: PanelId) => number

  // Utility functions
  getDisplayOrder: () => Array<{ type: 'panel' | 'tabGroup'; id: string }>
  isTabGroupEmpty: (tabGroupId: string) => boolean
}

// Panel layout constants
const PANEL_WIDTH = 280
const TOP_MARGIN = 8
const PANEL_GAP = 0
const BOTTOM_MARGIN = 40
const COLLAPSED_HEIGHT = 28

// Function to calculate stacked layout including tab groups
const calculateStackedLayoutWithTabGroups = (
  panelOrder: PanelId[],
  panels: Record<PanelId, PanelState>,
  tabGroups: Record<string, TabGroupState>,
  tabGroupOrder: string[],
  viewportHeight: number
) => {
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

  // Get display order (individual panels + tab groups)
  const displayItems: Array<{ type: 'panel' | 'tabGroup'; id: string }> = []

  // Add individual panels (not in tab groups)
  panelOrder.forEach(panelId => {
    if (panels[panelId]?.isVisible && !panels[panelId]?.tabGroupId) {
      displayItems.push({ type: 'panel', id: panelId })
    }
  })

  // Add tab groups
  tabGroupOrder.forEach(tabGroupId => {
    displayItems.push({ type: 'tabGroup', id: tabGroupId })
  })

  // Calculate fixed heights and collect modifier items
  const fixedHeights: Record<PanelId, number> = {
    properties: panels.properties?.contentHeight || 213,
    style: panels.style?.contentHeight || 164,
    modifiers: 0 // Will be calculated based on remaining space
  }

  let modifierItems: Array<{ type: 'panel' | 'tabGroup'; id: string }> = []
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
const calculateStackedLayout = (panelOrder: PanelId[], panels: Record<PanelId, PanelState>, viewportHeight: number) => {
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

// Default panel configurations for stacked layout
const createDefaultPanels = (viewportHeight: number = 1080): Record<PanelId, PanelState> => {
  const defaultOrder: PanelId[] = ['properties', 'style', 'modifiers']
  const defaultPanels = {
    properties: {
      id: 'properties' as PanelId,
      isCollapsed: false,
      isVisible: true,
      position: { y: TOP_MARGIN },
      size: { width: PANEL_WIDTH, height: 213 },
      originalSize: { width: PANEL_WIDTH, height: 213 },
      order: 0,
      isDragging: false
    },
    style: {
      id: 'style' as PanelId,
      isCollapsed: false,
      isVisible: true,
      position: { y: TOP_MARGIN + 213 + PANEL_GAP },
      size: { width: PANEL_WIDTH, height: 164 },
      originalSize: { width: PANEL_WIDTH, height: 164 },
      order: 1,
      isDragging: false
    },
    modifiers: {
      id: 'modifiers' as PanelId,
      isCollapsed: false,
      isVisible: true,
      position: { y: TOP_MARGIN + 213 + PANEL_GAP + 164 + PANEL_GAP },
      size: { width: PANEL_WIDTH, height: 200 },
      originalSize: { width: PANEL_WIDTH, height: 200 },
      order: 2,
      isDragging: false
    }
  }

  // Calculate proper layout
  const { positions, calculatedHeights } = calculateStackedLayout(defaultOrder, defaultPanels, viewportHeight)

  // Apply calculated positions and heights
  Object.keys(defaultPanels).forEach(id => {
    const panelId = id as PanelId
    if (positions[panelId]) {
      defaultPanels[panelId].position = positions[panelId]
      if (calculatedHeights[panelId]) {
        defaultPanels[panelId].size.height = calculatedHeights[panelId]
      }
    }
  })

  return defaultPanels
}

const defaultPanels = createDefaultPanels()

export const usePanelStore = create<PanelStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    panels: defaultPanels,
    panelOrder: ['properties', 'style', 'modifiers'],
    activePanelId: null,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 1080,
    tabGroups: {},
    tabGroupOrder: [],

    // Initialize panels with default configuration
    initializePanels: () => {
      const currentState = get()
      const newPanels = createDefaultPanels(currentState.viewportHeight)
      set({ panels: newPanels })
    },

    // Set viewport height and recalculate layout
    setViewportHeight: (height: number) => {
      set(state => {
        const { positions, calculatedHeights } = calculateStackedLayout(state.panelOrder, state.panels, height)
        const updatedPanels = { ...state.panels }

        Object.keys(updatedPanels).forEach(id => {
          const panelId = id as PanelId
          if (positions[panelId]) {
            updatedPanels[panelId] = {
              ...updatedPanels[panelId],
              position: positions[panelId],
              size: {
                ...updatedPanels[panelId].size,
                height: calculatedHeights[panelId] || updatedPanels[panelId].size.height
              }
            }
          }
        })

        return {
          ...state,
          viewportHeight: height,
          panels: updatedPanels
        }
      })
    },

    // Set panel collapsed state
    setPanelCollapsed: (id: PanelId, collapsed: boolean) => {
      set(state => {
        const targetPanel = state.panels[id]
        if (!targetPanel) return state

        // Update collapsed state
        const updatedPanels = {
          ...state.panels,
          [id]: {
            ...targetPanel,
            isCollapsed: collapsed
          }
        }

        // Recalculate layout with new collapsed state
        const { positions, calculatedHeights } = calculateStackedLayout(state.panelOrder, updatedPanels, state.viewportHeight)

        // Apply calculated positions and heights
        Object.keys(updatedPanels).forEach(panelKey => {
          const panelId = panelKey as PanelId
          if (positions[panelId]) {
            updatedPanels[panelId] = {
              ...updatedPanels[panelId],
              position: positions[panelId],
              size: {
                ...updatedPanels[panelId].size,
                height: calculatedHeights[panelId] || updatedPanels[panelId].size.height
              }
            }
          }
        })

        return {
          ...state,
          panels: updatedPanels
        }
      })
    },

    // Set panel visibility state
    setPanelVisible: (id: PanelId, visible: boolean) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            isVisible: visible
          }
        }
      }))
    },

    // Calculate panel positions based on current order
    calculatePanelPositions: () => {
      set(state => {
        const {
          positions,
          calculatedHeights,
          tabGroupPositions,
          tabGroupCalculatedHeights
        } = calculateStackedLayoutWithTabGroups(
          state.panelOrder,
          state.panels,
          state.tabGroups,
          state.tabGroupOrder,
          state.viewportHeight
        )

        // Update panel positions and heights
        const updatedPanels = { ...state.panels }
        Object.keys(updatedPanels).forEach(id => {
          const panelId = id as PanelId
          if (positions[panelId]) {
            updatedPanels[panelId] = {
              ...updatedPanels[panelId],
              position: positions[panelId],
              size: {
                ...updatedPanels[panelId].size,
                height: calculatedHeights[panelId] || updatedPanels[panelId].size.height
              }
            }
          }
        })

        // Update tab group positions and heights
        const updatedTabGroups = { ...state.tabGroups }
        Object.keys(updatedTabGroups).forEach(tabGroupId => {
          if (tabGroupPositions[tabGroupId]) {
            updatedTabGroups[tabGroupId] = {
              ...updatedTabGroups[tabGroupId],
              position: tabGroupPositions[tabGroupId],
              size: {
                ...updatedTabGroups[tabGroupId].size,
                height: tabGroupCalculatedHeights[tabGroupId] || updatedTabGroups[tabGroupId].size.height
              }
            }
          }
        })

        return {
          ...state,
          panels: updatedPanels,
          tabGroups: updatedTabGroups
        }
      })
    },

    // Get calculated height for a specific panel
    getCalculatedPanelHeight: (panelId: PanelId): number => {
      const state = get()
      const { calculatedHeights } = calculateStackedLayout(state.panelOrder, state.panels, state.viewportHeight)
      return calculatedHeights[panelId] || state.panels[panelId]?.size.height || 200
    },

    // Set panel content height (measured from content)
    setPanelContentHeight: (id: PanelId, contentHeight: number) => {
      set(state => {
        const targetPanel = state.panels[id]
        if (!targetPanel) return state

        // Update the target panel with new content height
        const updatedPanels = {
          ...state.panels,
          [id]: {
            ...targetPanel,
            contentHeight
          }
        }

        // Recalculate layout if content height changed significantly
        const oldContentHeight = targetPanel.contentHeight || targetPanel.size.height
        const heightDifference = Math.abs(contentHeight - oldContentHeight)

        if (heightDifference > 5) {
          const { positions, calculatedHeights } = calculateStackedLayout(state.panelOrder, updatedPanels, state.viewportHeight)

          Object.keys(updatedPanels).forEach(panelKey => {
            const panelId = panelKey as PanelId
            if (positions[panelId]) {
              updatedPanels[panelId] = {
                ...updatedPanels[panelId],
                position: positions[panelId],
                size: {
                  ...updatedPanels[panelId].size,
                  height: calculatedHeights[panelId] || updatedPanels[panelId].size.height
                }
              }
            }
          })
        }

        return {
          ...state,
          panels: updatedPanels
        }
      })
    },

    // Set active panel (for focus/z-index management)
    setActivePanel: (id: PanelId | null) => {
      set({ activePanelId: id })

      // Update order to bring active panel to front
      if (id) {
        const panels = get().panels
        const maxOrder = Math.max(...Object.values(panels).map(p => p.order))

        set(state => ({
          panels: {
            ...state.panels,
            [id]: {
              ...state.panels[id],
              order: maxOrder + 1
            }
          }
        }))
      }
    },

    // Set panel order for stacked layout
    setPanelOrder: (order: PanelId[]) => {
      set({ panelOrder: order })
    },

    // Set panel dragging state
    setPanelDragging: (id: PanelId, isDragging: boolean) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            isDragging
          }
        }
      }))
    },

    // Set panel stack state (for reordering)
    setPanelStackState: (id: PanelId, stackState: PanelStackState) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            stackState
          }
        }
      }))
    },

    // Clear panel stack state
    clearPanelStackState: (id: PanelId) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            stackState: {
              isReordering: false
            }
          }
        }
      }))
    },

    // Reset panel layout to defaults
    resetPanelLayout: () => {
      const currentState = get()
      set({
        panels: createDefaultPanels(currentState.viewportHeight),
        panelOrder: ['properties', 'style', 'modifiers']
      })
    },

    // Reorder panels from one index to another
    reorderPanels: (fromIndex: number, toIndex: number) => {
      set(state => {
        const newOrder = [...state.panelOrder]
        const [movedPanel] = newOrder.splice(fromIndex, 1)
        newOrder.splice(toIndex, 0, movedPanel)

        // Recalculate positions based on new order
        const { positions, calculatedHeights } = calculateStackedLayout(newOrder, state.panels, state.viewportHeight)
        const updatedPanels = { ...state.panels }

        Object.keys(updatedPanels).forEach(id => {
          const panelId = id as PanelId
          if (positions[panelId]) {
            updatedPanels[panelId] = {
              ...updatedPanels[panelId],
              position: positions[panelId],
              size: {
                ...updatedPanels[panelId].size,
                height: calculatedHeights[panelId] || updatedPanels[panelId].size.height
              }
            }
          }
        })

        return {
          ...state,
          panelOrder: newOrder,
          panels: updatedPanels
        }
      })
    },

    // Insert panel at specific index
    insertPanelAt: (panelId: PanelId, index: number) => {
      set(state => {
        const currentIndex = state.panelOrder.indexOf(panelId)
        if (currentIndex === -1) return state

        const newOrder = [...state.panelOrder]
        newOrder.splice(currentIndex, 1)
        newOrder.splice(index, 0, panelId)

        return {
          ...state,
          panelOrder: newOrder
        }
      })
    },

    // Tab group management methods
    createTabGroup: (panelIds: PanelId[], position?: PanelPosition) => {
      const tabGroupId = `tabgroup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      set(state => {
        // Create the tab group
        const tabGroup: TabGroupState = {
          id: tabGroupId,
          panelIds: [...panelIds],
          activeTabId: panelIds[0],
          position: position || state.panels[panelIds[0]]?.position || { y: 0 },
          size: state.panels[panelIds[0]]?.size || { width: 280, height: 200 },
          isCollapsed: false,
          order: Math.max(...Object.values(state.panels).map(p => p.order)) + 1
        }

        // Update panels to reference the tab group
        const updatedPanels = { ...state.panels }
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
        const newPanelOrder = state.panelOrder.filter(id => !panelIds.includes(id))

        // Add tab group to order
        const newTabGroupOrder = [...state.tabGroupOrder, tabGroupId]

        return {
          ...state,
          panels: updatedPanels,
          panelOrder: newPanelOrder,
          tabGroups: {
            ...state.tabGroups,
            [tabGroupId]: tabGroup
          },
          tabGroupOrder: newTabGroupOrder
        }
      })

      return tabGroupId
    },

    mergeIntoTabGroup: (targetPanelId: PanelId, draggedPanelId: PanelId) => {
      set(state => {
        const targetPanel = state.panels[targetPanelId]
        const draggedPanel = state.panels[draggedPanelId]

        if (!targetPanel || !draggedPanel) return state

        // If target is already in a tab group, add dragged panel to it
        if (targetPanel.tabGroupId) {
          const tabGroup = state.tabGroups[targetPanel.tabGroupId]
          if (!tabGroup) return state

          const updatedPanels = {
            ...state.panels,
            [draggedPanelId]: {
              ...draggedPanel,
              tabGroupId: targetPanel.tabGroupId,
              tabIndex: tabGroup.panelIds.length,
              isVisible: false
            }
          }

          const updatedTabGroup = {
            ...tabGroup,
            panelIds: [...tabGroup.panelIds, draggedPanelId]
          }

          // Remove dragged panel from panel order
          const newPanelOrder = state.panelOrder.filter(id => id !== draggedPanelId)

          return {
            ...state,
            panels: updatedPanels,
            panelOrder: newPanelOrder,
            tabGroups: {
              ...state.tabGroups,
              [targetPanel.tabGroupId]: updatedTabGroup
            }
          }
        } else {
          // Create new tab group with both panels
          const tabGroupId = `tabgroup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

          const tabGroup: TabGroupState = {
            id: tabGroupId,
            panelIds: [targetPanelId, draggedPanelId],
            activeTabId: targetPanelId,
            position: targetPanel.position,
            size: targetPanel.size,
            isCollapsed: targetPanel.isCollapsed,
            order: Math.max(targetPanel.order, draggedPanel.order)
          }

          const updatedPanels = {
            ...state.panels,
            [targetPanelId]: {
              ...targetPanel,
              tabGroupId,
              tabIndex: 0,
              isVisible: false
            },
            [draggedPanelId]: {
              ...draggedPanel,
              tabGroupId,
              tabIndex: 1,
              isVisible: false
            }
          }

          // Remove both panels from panel order
          const newPanelOrder = state.panelOrder.filter(id => id !== targetPanelId && id !== draggedPanelId)

          // Add tab group to order
          const newTabGroupOrder = [...state.tabGroupOrder, tabGroupId]

          return {
            ...state,
            panels: updatedPanels,
            panelOrder: newPanelOrder,
            tabGroups: {
              ...state.tabGroups,
              [tabGroupId]: tabGroup
            },
            tabGroupOrder: newTabGroupOrder
          }
        }
      })
    },

    splitPanelFromTabGroup: (panelId: PanelId) => {
      set(state => {
        const panel = state.panels[panelId]
        if (!panel?.tabGroupId) return state

        const tabGroup = state.tabGroups[panel.tabGroupId]
        if (!tabGroup) return state

        // Remove panel from tab group
        const newPanelIds = tabGroup.panelIds.filter(id => id !== panelId)

        // Find tab group position in display order to insert panel nearby
        const tabGroupIndex = state.tabGroupOrder.indexOf(panel.tabGroupId)

        // Insert panel after the tab group position in panel order
        // Count how many individual panels come before this tab group
        let insertPosition = 0
        const displayOrder = [...state.panelOrder.filter(id => state.panels[id]?.isVisible && !state.panels[id]?.tabGroupId)]

        // Add individual panels that come before tab groups
        for (let i = 0; i < tabGroupIndex && i < state.tabGroupOrder.length; i++) {
          insertPosition = displayOrder.length
        }

        // Update panel to be independent
        const updatedPanels = {
          ...state.panels,
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
        const newPanelOrder = [...state.panelOrder]
        if (!newPanelOrder.includes(panelId)) {
          newPanelOrder.splice(Math.min(insertPosition, newPanelOrder.length), 0, panelId)
        }

        // Update or remove tab group
        let updatedTabGroups = { ...state.tabGroups }
        let updatedTabGroupOrder = [...state.tabGroupOrder]

        if (newPanelIds.length === 0) {
          // Remove empty tab group
          delete updatedTabGroups[panel.tabGroupId]
          updatedTabGroupOrder = updatedTabGroupOrder.filter(id => id !== panel.tabGroupId)
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
          updatedTabGroupOrder = updatedTabGroupOrder.filter(id => id !== panel.tabGroupId)
        } else {
          // Update tab group with remaining panels
          updatedTabGroups[panel.tabGroupId] = {
            ...tabGroup,
            panelIds: newPanelIds,
            activeTabId: tabGroup.activeTabId === panelId ? newPanelIds[0] : tabGroup.activeTabId
          }
        }

        return {
          ...state,
          panels: updatedPanels,
          panelOrder: newPanelOrder,
          tabGroups: updatedTabGroups,
          tabGroupOrder: updatedTabGroupOrder
        }
      })

      // Recalculate panel positions after the state update
      setTimeout(() => {
        get().calculatePanelPositions()
      }, 0)
    },

    setActiveTab: (tabGroupId: string, panelId: PanelId) => {
      set(state => {
        const tabGroup = state.tabGroups[tabGroupId]
        if (!tabGroup || !tabGroup.panelIds.includes(panelId)) return state

        return {
          ...state,
          tabGroups: {
            ...state.tabGroups,
            [tabGroupId]: {
              ...tabGroup,
              activeTabId: panelId
            }
          }
        }
      })
    },

    reorderTabsInGroup: (tabGroupId: string, fromIndex: number, toIndex: number) => {
      set(state => {
        const tabGroup = state.tabGroups[tabGroupId]
        if (!tabGroup) return state

        const newPanelIds = [...tabGroup.panelIds]
        const [movedPanel] = newPanelIds.splice(fromIndex, 1)
        newPanelIds.splice(toIndex, 0, movedPanel)

        // Update tab indexes
        const updatedPanels = { ...state.panels }
        newPanelIds.forEach((panelId, index) => {
          if (updatedPanels[panelId]) {
            updatedPanels[panelId] = {
              ...updatedPanels[panelId],
              tabIndex: index
            }
          }
        })

        return {
          ...state,
          panels: updatedPanels,
          tabGroups: {
            ...state.tabGroups,
            [tabGroupId]: {
              ...tabGroup,
              panelIds: newPanelIds
            }
          }
        }
      })
    },

    setTabGroupCollapsed: (tabGroupId: string, collapsed: boolean) => {
      set(state => {
        const tabGroup = state.tabGroups[tabGroupId]
        if (!tabGroup) return state

        return {
          ...state,
          tabGroups: {
            ...state.tabGroups,
            [tabGroupId]: {
              ...tabGroup,
              isCollapsed: collapsed
            }
          }
        }
      })
    },

    setTabGroupDragging: (tabGroupId: string, isDragging: boolean) => {
      set(state => {
        const tabGroup = state.tabGroups[tabGroupId]
        if (!tabGroup) return state

        return {
          ...state,
          tabGroups: {
            ...state.tabGroups,
            [tabGroupId]: {
              ...tabGroup,
              isDragging
            }
          }
        }
      })
    },

    setTabGroupStackState: (tabGroupId: string, stackState: PanelStackState) => {
      set(state => {
        const tabGroup = state.tabGroups[tabGroupId]
        if (!tabGroup) return state

        return {
          ...state,
          tabGroups: {
            ...state.tabGroups,
            [tabGroupId]: {
              ...tabGroup,
              stackState
            }
          }
        }
      })
    },

    clearTabGroupStackState: (tabGroupId: string) => {
      set(state => {
        const tabGroup = state.tabGroups[tabGroupId]
        if (!tabGroup) return state

        return {
          ...state,
          tabGroups: {
            ...state.tabGroups,
            [tabGroupId]: {
              ...tabGroup,
              stackState: {
                isReordering: false
              }
            }
          }
        }
      })
    },

    reorderTabGroups: (fromIndex: number, toIndex: number) => {
      set(state => {
        const newOrder = [...state.tabGroupOrder]
        const [movedGroup] = newOrder.splice(fromIndex, 1)
        newOrder.splice(toIndex, 0, movedGroup)

        return {
          ...state,
          tabGroupOrder: newOrder
        }
      })
    },

    getDisplayOrder: () => {
      const state = get()
      const displayItems: Array<{ type: 'panel' | 'tabGroup'; id: string }> = []

      // Add individual panels
      state.panelOrder.forEach(panelId => {
        if (state.panels[panelId]?.isVisible && !state.panels[panelId]?.tabGroupId) {
          displayItems.push({ type: 'panel', id: panelId })
        }
      })

      // Add tab groups
      state.tabGroupOrder.forEach(tabGroupId => {
        displayItems.push({ type: 'tabGroup', id: tabGroupId })
      })

      // Sort by order/position for consistent display
      return displayItems
    },

    isTabGroupEmpty: (tabGroupId: string) => {
      const state = get()
      const tabGroup = state.tabGroups[tabGroupId]
      return !tabGroup || tabGroup.panelIds.length === 0
    }
  }))
)