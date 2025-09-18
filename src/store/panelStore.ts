import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { calculateStackedLayoutWithTabGroups, calculateStackedLayout } from './panel/layoutCalculations'
import { createDefaultPanels } from './panel/panelUtils'
import { createTabGroupOperations } from './panel/tabGroupOperations'
import { createPanelOperations } from './panel/panelOperations'
import { getDisplayOrder } from './panel/displayUtils'

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

// Initialize operation handlers
const tabGroupOps = createTabGroupOperations()
const panelOps = createPanelOperations()

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
        const updatedPanels = panelOps.setPanelCollapsed(id, collapsed, state.panels, state.panelOrder, state.viewportHeight)
        if (!updatedPanels) return state

        return {
          ...state,
          panels: updatedPanels
        }
      })
    },

    // Set panel visibility state
    setPanelVisible: (id: PanelId, visible: boolean) => {
      set(state => {
        const updatedPanels = panelOps.setPanelVisible(id, visible, state.panels)
        if (!updatedPanels) return state

        return {
          ...state,
          panels: updatedPanels
        }
      })
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
        const updatedPanels = panelOps.setPanelContentHeight(id, contentHeight, state.panels, state.panelOrder, state.viewportHeight)
        if (!updatedPanels) return state

        return {
          ...state,
          panels: updatedPanels
        }
      })
    },

    // Set active panel (for focus/z-index management)
    setActivePanel: (id: PanelId | null) => {
      set(state => {
        const result = panelOps.setActivePanel(id, state.panels)
        return {
          ...state,
          panels: result.panels,
          activePanelId: result.activePanelId
        }
      })
    },

    // Set panel order for stacked layout
    setPanelOrder: (order: PanelId[]) => {
      set({ panelOrder: order })
    },

    // Set panel dragging state
    setPanelDragging: (id: PanelId, isDragging: boolean) => {
      set(state => {
        const updatedPanels = panelOps.setPanelDragging(id, isDragging, state.panels)
        if (!updatedPanels) return state

        return {
          ...state,
          panels: updatedPanels
        }
      })
    },

    // Set panel stack state (for reordering)
    setPanelStackState: (id: PanelId, stackState: PanelStackState) => {
      set(state => {
        const updatedPanels = panelOps.setPanelStackState(id, stackState, state.panels)
        if (!updatedPanels) return state

        return {
          ...state,
          panels: updatedPanels
        }
      })
    },

    // Clear panel stack state
    clearPanelStackState: (id: PanelId) => {
      set(state => {
        const updatedPanels = panelOps.clearPanelStackState(id, state.panels)
        if (!updatedPanels) return state

        return {
          ...state,
          panels: updatedPanels
        }
      })
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
        const result = panelOps.reorderPanels(fromIndex, toIndex, state.panelOrder, state.panels, state.viewportHeight)
        return {
          ...state,
          panelOrder: result.newOrder,
          panels: result.updatedPanels
        }
      })
    },

    // Insert panel at specific index
    insertPanelAt: (panelId: PanelId, index: number) => {
      set(state => {
        const newOrder = panelOps.insertPanelAt(panelId, index, state.panelOrder)
        if (!newOrder) return state

        return {
          ...state,
          panelOrder: newOrder
        }
      })
    },

    // Tab group management methods
    createTabGroup: (panelIds: PanelId[], position?: PanelPosition) => {
      let tabGroupId = ''
      set(state => {
        const result = tabGroupOps.createTabGroup(panelIds, state.panels, state.tabGroups, state.panelOrder, state.tabGroupOrder, position)
        tabGroupId = result.tabGroupId
        return {
          ...state,
          panels: result.updatedPanels,
          panelOrder: result.newPanelOrder,
          tabGroups: result.updatedTabGroups,
          tabGroupOrder: result.newTabGroupOrder
        }
      })
      return tabGroupId
    },

    mergeIntoTabGroup: (targetPanelId: PanelId, draggedPanelId: PanelId) => {
      set(state => {
        const result = tabGroupOps.mergeIntoTabGroup(targetPanelId, draggedPanelId, state.panels, state.tabGroups, state.panelOrder, state.tabGroupOrder)
        if (!result) return state

        return {
          ...state,
          panels: result.updatedPanels,
          panelOrder: result.newPanelOrder,
          tabGroups: result.updatedTabGroups,
          tabGroupOrder: result.newTabGroupOrder
        }
      })

      // Recalculate panel positions after merging to prevent overlaps
      setTimeout(() => {
        get().calculatePanelPositions()
      }, 0)
    },

    splitPanelFromTabGroup: (panelId: PanelId) => {
      set(state => {
        const result = tabGroupOps.splitPanelFromTabGroup(panelId, state.panels, state.tabGroups, state.panelOrder, state.tabGroupOrder)
        if (!result) return state

        return {
          ...state,
          panels: result.updatedPanels,
          panelOrder: result.newPanelOrder,
          tabGroups: result.updatedTabGroups,
          tabGroupOrder: result.newTabGroupOrder
        }
      })

      // Recalculate panel positions after the state update
      setTimeout(() => {
        get().calculatePanelPositions()
      }, 0)
    },

    setActiveTab: (tabGroupId: string, panelId: PanelId) => {
      set(state => {
        const updatedTabGroups = tabGroupOps.setActiveTab(tabGroupId, panelId, state.tabGroups)
        if (!updatedTabGroups) return state

        return {
          ...state,
          tabGroups: updatedTabGroups
        }
      })
    },

    reorderTabsInGroup: (tabGroupId: string, fromIndex: number, toIndex: number) => {
      set(state => {
        const result = tabGroupOps.reorderTabsInGroup(tabGroupId, fromIndex, toIndex, state.panels, state.tabGroups)
        if (!result) return state

        return {
          ...state,
          panels: result.updatedPanels,
          tabGroups: result.updatedTabGroups
        }
      })
    },

    setTabGroupCollapsed: (tabGroupId: string, collapsed: boolean) => {
      set(state => {
        const updatedTabGroups = tabGroupOps.setTabGroupCollapsed(tabGroupId, collapsed, state.tabGroups)
        if (!updatedTabGroups) return state

        return {
          ...state,
          tabGroups: updatedTabGroups
        }
      })
    },

    setTabGroupDragging: (tabGroupId: string, isDragging: boolean) => {
      set(state => {
        const updatedTabGroups = tabGroupOps.setTabGroupDragging(tabGroupId, isDragging, state.tabGroups)
        if (!updatedTabGroups) return state

        return {
          ...state,
          tabGroups: updatedTabGroups
        }
      })
    },

    setTabGroupStackState: (tabGroupId: string, stackState: PanelStackState) => {
      set(state => {
        const updatedTabGroups = tabGroupOps.setTabGroupStackState(tabGroupId, stackState, state.tabGroups)
        if (!updatedTabGroups) return state

        return {
          ...state,
          tabGroups: updatedTabGroups
        }
      })
    },

    clearTabGroupStackState: (tabGroupId: string) => {
      set(state => {
        const updatedTabGroups = tabGroupOps.clearTabGroupStackState(tabGroupId, state.tabGroups)
        if (!updatedTabGroups) return state

        return {
          ...state,
          tabGroups: updatedTabGroups
        }
      })
    },

    reorderTabGroups: (fromIndex: number, toIndex: number) => {
      set(state => {
        const newOrder = tabGroupOps.reorderTabGroups(fromIndex, toIndex, state.tabGroupOrder)
        return {
          ...state,
          tabGroupOrder: newOrder
        }
      })
    },

    getDisplayOrder: () => {
      const state = get()
      return getDisplayOrder(state.panelOrder, state.panels, state.tabGroupOrder, state.tabGroups)
    },

    isTabGroupEmpty: (tabGroupId: string) => {
      const state = get()
      return tabGroupOps.isTabGroupEmpty(tabGroupId, state.tabGroups)
    }
  }))
)