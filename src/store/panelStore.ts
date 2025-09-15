import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type PanelId = 'properties' | 'style' | 'modifiers'

export interface PanelPosition {
  x: number
  y: number
}

export interface PanelSize {
  width: number
  height: number
}

export interface PanelSnapState {
  snappedToBrowser: ('top' | 'bottom' | 'left' | 'right')[]
  snappedToPanels: Array<{
    panelId: PanelId
    edge: 'top' | 'bottom' | 'left' | 'right'
  }>
}

export interface PanelState {
  id: PanelId
  isCollapsed: boolean
  position: PanelPosition
  size: PanelSize
  order: number // For stacking order (z-index)
  isDragging?: boolean
  isResizing?: boolean

  // Legacy docking (for compatibility)
  isDocked: boolean
  dockedTo?: PanelId // Which panel this is docked to
  dockPosition?: 'above' | 'below' | 'left' | 'right'

  // New snap state
  snapState?: PanelSnapState
}

interface PanelStoreState {
  // State
  panels: Record<PanelId, PanelState>
  panelOrder: PanelId[] // Order for stacked panels
  activePanelId: PanelId | null
  draggedPanelId: PanelId | null

  // Panel management
  initializePanels: () => void
  setPanelCollapsed: (id: PanelId, collapsed: boolean) => void
  setPanelPosition: (id: PanelId, position: PanelPosition) => void
  setPanelSize: (id: PanelId, size: Partial<PanelSize>) => void
  setActivePanel: (id: PanelId | null) => void

  // Floating panel state
  setPanelDragging: (id: PanelId, isDragging: boolean) => void
  setPanelResizing: (id: PanelId, isResizing: boolean) => void
  setPanelSnapState: (id: PanelId, snapState: PanelSnapState) => void
  clearPanelSnapState: (id: PanelId) => void

  // Layout management
  resetPanelLayout: () => void
  bringPanelToFront: (id: PanelId) => void

  // Stacked panel ordering
  setPanelOrder: (order: PanelId[]) => void

  // Drag and drop (legacy - for compatibility)
  startDragging: (id: PanelId) => void
  stopDragging: () => void
  reorderPanels: (fromId: PanelId, toId: PanelId, position: 'above' | 'below') => void

  // Docking (legacy - for compatibility)
  dockPanel: (panelId: PanelId, targetId: PanelId, position: 'above' | 'below' | 'left' | 'right') => void
  undockPanel: (panelId: PanelId) => void

  // Utilities
  getPanelById: (id: PanelId) => PanelState | undefined
  getPanelsByOrder: () => PanelState[]
  getDockedPanels: (id: PanelId) => PanelState[]
}

// Default panel configurations
const defaultPanels: Record<PanelId, PanelState> = {
  properties: {
    id: 'properties',
    isCollapsed: false,
    position: { x: 20, y: 60 },
    size: { width: 280, height: 200 },
    order: 0,
    isDragging: false,
    isResizing: false,
    isDocked: false,
    snapState: {
      snappedToBrowser: [],
      snappedToPanels: []
    }
  },
  style: {
    id: 'style',
    isCollapsed: false,
    position: { x: 20, y: 280 },
    size: { width: 280, height: 250 },
    order: 1,
    isDragging: false,
    isResizing: false,
    isDocked: false,
    snapState: {
      snappedToBrowser: [],
      snappedToPanels: []
    }
  },
  modifiers: {
    id: 'modifiers',
    isCollapsed: false,
    position: { x: 20, y: 550 },
    size: { width: 280, height: 400 },
    order: 2,
    isDragging: false,
    isResizing: false,
    isDocked: false,
    snapState: {
      snappedToBrowser: [],
      snappedToPanels: []
    }
  }
}

export const usePanelStore = create<PanelStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    panels: defaultPanels,
    panelOrder: ['properties', 'style', 'modifiers'], // Default stacked order
    activePanelId: null,
    draggedPanelId: null,

    // Initialize panels with default configuration
    initializePanels: () => {
      set({ panels: defaultPanels })
    },

    // Set panel collapsed state
    setPanelCollapsed: (id: PanelId, collapsed: boolean) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            isCollapsed: collapsed
          }
        }
      }))
    },

    // Set panel position
    setPanelPosition: (id: PanelId, position: PanelPosition) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            position
          }
        }
      }))
    },

    // Set panel size
    setPanelSize: (id: PanelId, size: Partial<PanelSize>) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            size: {
              ...state.panels[id].size,
              ...size
            }
          }
        }
      }))
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

    // Set panel resizing state
    setPanelResizing: (id: PanelId, isResizing: boolean) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            isResizing
          }
        }
      }))
    },

    // Set panel snap state
    setPanelSnapState: (id: PanelId, snapState: PanelSnapState) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            snapState
          }
        }
      }))
    },

    // Clear panel snap state
    clearPanelSnapState: (id: PanelId) => {
      set(state => ({
        panels: {
          ...state.panels,
          [id]: {
            ...state.panels[id],
            snapState: {
              snappedToBrowser: [],
              snappedToPanels: []
            }
          }
        }
      }))
    },

    // Reset panel layout to defaults
    resetPanelLayout: () => {
      set({ panels: defaultPanels })
    },

    // Bring panel to front (highest z-index)
    bringPanelToFront: (id: PanelId) => {
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
    },

    // Start dragging a panel
    startDragging: (id: PanelId) => {
      set({ draggedPanelId: id })
      get().setActivePanel(id)
    },

    // Stop dragging
    stopDragging: () => {
      set({ draggedPanelId: null })
    },

    // Reorder panels (for drag and drop)
    reorderPanels: (fromId: PanelId, toId: PanelId, position: 'above' | 'below') => {
      const panels = get().panels
      const fromPanel = panels[fromId]
      const toPanel = panels[toId]

      if (!fromPanel || !toPanel) return

      // Calculate new position based on drop position
      const newY = position === 'above'
        ? toPanel.position.y - 10
        : toPanel.position.y + toPanel.size.height + 10

      set(state => ({
        panels: {
          ...state.panels,
          [fromId]: {
            ...fromPanel,
            position: {
              ...fromPanel.position,
              y: newY
            }
          }
        }
      }))
    },

    // Dock a panel to another panel
    dockPanel: (panelId: PanelId, targetId: PanelId, position: 'above' | 'below' | 'left' | 'right') => {
      const panels = get().panels
      const panel = panels[panelId]
      const targetPanel = panels[targetId]

      if (!panel || !targetPanel) return

      // Calculate docked position
      let newPosition = { ...panel.position }

      switch (position) {
        case 'above':
          newPosition = {
            x: targetPanel.position.x,
            y: targetPanel.position.y - panel.size.height
          }
          break
        case 'below':
          newPosition = {
            x: targetPanel.position.x,
            y: targetPanel.position.y + targetPanel.size.height
          }
          break
        case 'left':
          newPosition = {
            x: targetPanel.position.x - panel.size.width,
            y: targetPanel.position.y
          }
          break
        case 'right':
          newPosition = {
            x: targetPanel.position.x + targetPanel.size.width,
            y: targetPanel.position.y
          }
          break
      }

      set(state => ({
        panels: {
          ...state.panels,
          [panelId]: {
            ...panel,
            position: newPosition,
            isDocked: true,
            dockedTo: targetId,
            dockPosition: position
          }
        }
      }))
    },

    // Undock a panel
    undockPanel: (panelId: PanelId) => {
      set(state => ({
        panels: {
          ...state.panels,
          [panelId]: {
            ...state.panels[panelId],
            isDocked: false,
            dockedTo: undefined,
            dockPosition: undefined
          }
        }
      }))
    },

    // Get panel by ID
    getPanelById: (id: PanelId) => {
      return get().panels[id]
    },

    // Get panels sorted by order
    getPanelsByOrder: () => {
      const panels = get().panels
      return Object.values(panels).sort((a, b) => a.order - b.order)
    },

    // Get panels docked to a specific panel
    getDockedPanels: (id: PanelId) => {
      const panels = get().panels
      return Object.values(panels).filter(p => p.dockedTo === id)
    }
  }))
)