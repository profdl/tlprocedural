import type { PanelId, PanelState, PanelStackState } from '../panelStore'
import { calculateStackedLayout } from './layoutCalculations'

export interface PanelOperations {
  setPanelCollapsed: (
    id: PanelId,
    collapsed: boolean,
    panels: Record<PanelId, PanelState>,
    panelOrder: PanelId[],
    viewportHeight: number
  ) => Record<PanelId, PanelState> | null

  setPanelVisible: (
    id: PanelId,
    visible: boolean,
    panels: Record<PanelId, PanelState>
  ) => Record<PanelId, PanelState> | null

  setPanelContentHeight: (
    id: PanelId,
    contentHeight: number,
    panels: Record<PanelId, PanelState>,
    panelOrder: PanelId[],
    viewportHeight: number
  ) => Record<PanelId, PanelState> | null

  setActivePanel: (
    id: PanelId | null,
    panels: Record<PanelId, PanelState>
  ) => { panels: Record<PanelId, PanelState>; activePanelId: PanelId | null }

  setPanelDragging: (
    id: PanelId,
    isDragging: boolean,
    panels: Record<PanelId, PanelState>
  ) => Record<PanelId, PanelState> | null

  setPanelStackState: (
    id: PanelId,
    stackState: PanelStackState,
    panels: Record<PanelId, PanelState>
  ) => Record<PanelId, PanelState> | null

  clearPanelStackState: (
    id: PanelId,
    panels: Record<PanelId, PanelState>
  ) => Record<PanelId, PanelState> | null

  reorderPanels: (
    fromIndex: number,
    toIndex: number,
    panelOrder: PanelId[],
    panels: Record<PanelId, PanelState>,
    viewportHeight: number
  ) => {
    newOrder: PanelId[]
    updatedPanels: Record<PanelId, PanelState>
  }

  insertPanelAt: (
    panelId: PanelId,
    index: number,
    panelOrder: PanelId[]
  ) => PanelId[] | null
}

export const createPanelOperations = (): PanelOperations => ({
  setPanelCollapsed: (id, collapsed, panels, panelOrder, viewportHeight) => {
    const targetPanel = panels[id]
    if (!targetPanel) return null

    // Update collapsed state
    const updatedPanels = {
      ...panels,
      [id]: {
        ...targetPanel,
        isCollapsed: collapsed
      }
    }

    // Recalculate layout with new collapsed state
    const { positions, calculatedHeights } = calculateStackedLayout(panelOrder, updatedPanels, viewportHeight)

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

    return updatedPanels
  },

  setPanelVisible: (id, visible, panels) => {
    const targetPanel = panels[id]
    if (!targetPanel) return null

    return {
      ...panels,
      [id]: {
        ...targetPanel,
        isVisible: visible
      }
    }
  },

  setPanelContentHeight: (id, contentHeight, panels, panelOrder, viewportHeight) => {
    const targetPanel = panels[id]
    if (!targetPanel) return null

    // Update the target panel with new content height
    const updatedPanels = {
      ...panels,
      [id]: {
        ...targetPanel,
        contentHeight
      }
    }

    // Recalculate layout if content height changed significantly
    const oldContentHeight = targetPanel.contentHeight || targetPanel.size.height
    const heightDifference = Math.abs(contentHeight - oldContentHeight)

    if (heightDifference > 5) {
      const { positions, calculatedHeights } = calculateStackedLayout(panelOrder, updatedPanels, viewportHeight)

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

    return updatedPanels
  },

  setActivePanel: (id, panels) => {
    // Update order to bring active panel to front
    if (id) {
      const maxOrder = Math.max(...Object.values(panels).map(p => p.order))

      const updatedPanels = {
        ...panels,
        [id]: {
          ...panels[id],
          order: maxOrder + 1
        }
      }

      return { panels: updatedPanels, activePanelId: id }
    }

    return { panels, activePanelId: id }
  },

  setPanelDragging: (id, isDragging, panels) => {
    const targetPanel = panels[id]
    if (!targetPanel) return null

    return {
      ...panels,
      [id]: {
        ...targetPanel,
        isDragging
      }
    }
  },

  setPanelStackState: (id, stackState, panels) => {
    const targetPanel = panels[id]
    if (!targetPanel) return null

    return {
      ...panels,
      [id]: {
        ...targetPanel,
        stackState
      }
    }
  },

  clearPanelStackState: (id, panels) => {
    const targetPanel = panels[id]
    if (!targetPanel) return null

    return {
      ...panels,
      [id]: {
        ...targetPanel,
        stackState: {
          isReordering: false
        }
      }
    }
  },

  reorderPanels: (fromIndex, toIndex, panelOrder, panels, viewportHeight) => {
    const newOrder = [...panelOrder]
    const [movedPanel] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, movedPanel)

    // Recalculate positions based on new order
    const { positions, calculatedHeights } = calculateStackedLayout(newOrder, panels, viewportHeight)
    const updatedPanels = { ...panels }

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
      newOrder,
      updatedPanels
    }
  },

  insertPanelAt: (panelId, index, panelOrder) => {
    const currentIndex = panelOrder.indexOf(panelId)
    if (currentIndex === -1) return null

    const newOrder = [...panelOrder]
    newOrder.splice(currentIndex, 1)
    newOrder.splice(index, 0, panelId)

    return newOrder
  }
})