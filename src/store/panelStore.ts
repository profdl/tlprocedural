import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { constraintSolver } from '../components/panels/utils/constraintSolver'

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
  isVisible: boolean
  position: PanelPosition
  size: PanelSize
  originalSize: PanelSize
  contentHeight?: number
  order: number
  isDragging?: boolean
  isResizing?: boolean
  snapState?: PanelSnapState
}

interface PanelStoreState {
  // State
  panels: Record<PanelId, PanelState>
  panelOrder: PanelId[]
  activePanelId: PanelId | null

  // Panel management
  initializePanels: () => void
  setPanelCollapsed: (id: PanelId, collapsed: boolean) => void
  setPanelVisible: (id: PanelId, visible: boolean) => void
  setPanelPosition: (id: PanelId, position: PanelPosition) => void
  setPanelSize: (id: PanelId, size: Partial<PanelSize>) => void
  setPanelContentHeight: (id: PanelId, contentHeight: number) => void
  setActivePanel: (id: PanelId | null) => void

  // Floating panel state
  setPanelDragging: (id: PanelId, isDragging: boolean) => void
  setPanelResizing: (id: PanelId, isResizing: boolean) => void
  setPanelSnapState: (id: PanelId, snapState: PanelSnapState) => void
  clearPanelSnapState: (id: PanelId) => void

  // Layout management
  resetPanelLayout: () => void
  initializeRightAlignedLayout: () => void
  bringPanelToFront: (id: PanelId) => void

  // Stacked panel ordering
  setPanelOrder: (order: PanelId[]) => void
}

// Panel layout constants
const PANEL_WIDTH = 280
const RIGHT_MARGIN = 8  // Reduced margin for closer edge snapping
const TOP_MARGIN = 8  // Changed from 60 to snap to top
const PANEL_GAP = 8

// Function to calculate right-aligned positions
const calculateRightAlignedPositions = (panels?: Record<PanelId, PanelState>) => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
  const rightX = viewportWidth - PANEL_WIDTH - RIGHT_MARGIN

  // Use more accurate heights based on actual CSS measurements
  // Each input row is ~32px, content padding is 16px total (8px floating + 8px inner)
  const propertiesHeight = panels?.properties?.contentHeight || 208 // header + 5 rows + gaps + padding
  const styleHeight = panels?.style?.contentHeight || 188 // header + 4 rows + gaps + padding

  return {
    properties: {
      x: rightX,
      y: TOP_MARGIN
    },
    style: {
      x: rightX,
      y: TOP_MARGIN + propertiesHeight + PANEL_GAP
    },
    modifiers: {
      x: rightX,
      y: TOP_MARGIN + propertiesHeight + PANEL_GAP + styleHeight + PANEL_GAP
    }
  }
}

// Default panel configurations with right-aligned positions
const createDefaultPanels = (): Record<PanelId, PanelState> => {
  const positions = calculateRightAlignedPositions()

  return {
    properties: {
      id: 'properties',
      isCollapsed: false,
      isVisible: true,
      position: positions.properties,
      size: { width: PANEL_WIDTH, height: 208 },
      originalSize: { width: PANEL_WIDTH, height: 208 },
      order: 0,
      isDragging: false,
      isResizing: false,
      snapState: {
        snappedToBrowser: ['right', 'top'],
        snappedToPanels: []
      }
    },
    style: {
      id: 'style',
      isCollapsed: false,
      isVisible: false,
      position: positions.style,
      size: { width: PANEL_WIDTH, height: 188 },
      originalSize: { width: PANEL_WIDTH, height: 188 },
      order: 1,
      isDragging: false,
      isResizing: false,
      snapState: {
        snappedToBrowser: ['right'],
        snappedToPanels: [{
          panelId: 'properties',
          edge: 'bottom'
        }]
      }
    },
    modifiers: {
      id: 'modifiers',
      isCollapsed: false,
      isVisible: false,
      position: positions.modifiers,
      size: { width: PANEL_WIDTH, height: 400 },
      originalSize: { width: PANEL_WIDTH, height: 400 },
      order: 2,
      isDragging: false,
      isResizing: false,
      snapState: {
        snappedToBrowser: ['right'],
        snappedToPanels: [{
          panelId: 'style',
          edge: 'bottom'
        }]
      }
    }
  }
}

const defaultPanels = createDefaultPanels()

// Helper function to apply constraint-based position updates
const applyConstraintUpdates = (panels: Record<PanelId, PanelState>): Record<PanelId, PanelState> => {
  // Create constraints from current snap states
  constraintSolver.createConstraintsFromSnapState(panels)

  // Solve constraints to get new positions
  const newPositions = constraintSolver.solve({
    panels,
    viewport: {
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080
    },
    constraints: constraintSolver.getConstraints()
  })

  // Apply new positions to panels
  const updatedPanels = { ...panels }
  for (const [panelId, newPosition] of Object.entries(newPositions)) {
    if (updatedPanels[panelId as PanelId]) {
      updatedPanels[panelId as PanelId] = {
        ...updatedPanels[panelId as PanelId],
        position: newPosition
      }
    }
  }

  return updatedPanels
}

export const usePanelStore = create<PanelStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    panels: defaultPanels,
    panelOrder: ['properties', 'style', 'modifiers'],
    activePanelId: null,

    // Initialize panels with default configuration
    initializePanels: () => {
      set({ panels: createDefaultPanels() })
    },

    // Initialize panels with right-aligned layout
    initializeRightAlignedLayout: () => {
      const rightAlignedPanels = createDefaultPanels()
      set({ panels: rightAlignedPanels })
    },

    // Set panel collapsed state
    setPanelCollapsed: (id: PanelId, collapsed: boolean) => {
      set(state => {
        const targetPanel = state.panels[id]
        if (!targetPanel) return state

        // Calculate the new height
        const COLLAPSED_HEIGHT = 32
        const newHeight = collapsed ? COLLAPSED_HEIGHT : targetPanel.originalSize.height

        // Update the target panel
        const updatedPanels = {
          ...state.panels,
          [id]: {
            ...targetPanel,
            isCollapsed: collapsed,
            size: {
              ...targetPanel.size,
              height: newHeight
            }
          }
        }

        // Use constraint solver to automatically update dependent panel positions
        const finalPanels = applyConstraintUpdates(updatedPanels)

        return {
          ...state,
          panels: finalPanels
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
      set(state => {
        const targetPanel = state.panels[id]
        if (!targetPanel) return state

        // Update the target panel
        const updatedPanels = {
          ...state.panels,
          [id]: {
            ...targetPanel,
            size: {
              ...targetPanel.size,
              ...size
            },
            // Update originalSize if panel is not collapsed
            originalSize: targetPanel.isCollapsed ? targetPanel.originalSize : {
              ...targetPanel.originalSize,
              ...size
            }
          }
        }

        // Use constraint solver to automatically update dependent panel positions
        const finalPanels = applyConstraintUpdates(updatedPanels)

        return {
          ...state,
          panels: finalPanels
        }
      })
    },

    // Set panel content height (measured from content)
    setPanelContentHeight: (id: PanelId, contentHeight: number) => {
      set(state => {
        const targetPanel = state.panels[id]
        if (!targetPanel) return state

        // Calculate height difference based on content height change
        const oldContentHeight = targetPanel.contentHeight || targetPanel.size.height
        const heightDifference = contentHeight - oldContentHeight

        // Update the target panel with new content height
        const updatedPanels = {
          ...state.panels,
          [id]: {
            ...targetPanel,
            contentHeight
          }
        }

        // If content height changed significantly, use constraint solver
        if (Math.abs(heightDifference) > 5) { // 5px threshold to avoid micro adjustments
          const finalPanels = applyConstraintUpdates(updatedPanels)
          return {
            ...state,
            panels: finalPanels
          }
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
      set({ panels: createDefaultPanels() })
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
    }
  }))
)