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
}

interface PanelStoreState {
  // State
  panels: Record<PanelId, PanelState>
  panelOrder: PanelId[]
  activePanelId: PanelId | null
  viewportHeight: number

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

  // Layout management
  resetPanelLayout: () => void
  reorderPanels: (fromIndex: number, toIndex: number) => void

  // Panel ordering
  setPanelOrder: (order: PanelId[]) => void
  insertPanelAt: (panelId: PanelId, index: number) => void

  // Position calculation
  calculatePanelPositions: () => void
  getCalculatedPanelHeight: (panelId: PanelId) => number
}

// Panel layout constants
const PANEL_WIDTH = 280
const TOP_MARGIN = 8
const PANEL_GAP = 0
const BOTTOM_MARGIN = 40
const COLLAPSED_HEIGHT = 28

// Function to calculate stacked panel positions and heights
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
        const { positions, calculatedHeights } = calculateStackedLayout(state.panelOrder, state.panels, state.viewportHeight)
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
          panels: updatedPanels
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
    }
  }))
)