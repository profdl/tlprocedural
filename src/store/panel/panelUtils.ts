import type { PanelId, PanelState } from '../panelStore'
import { calculateStackedLayout, PANEL_WIDTH, TOP_MARGIN, PANEL_GAP } from './layoutCalculations'

export const DEFAULT_PANEL_ORDER: PanelId[] = ['layers', 'properties', 'style', 'modifiers']

// Default panel configurations for stacked layout
export const createDefaultPanels = (viewportHeight: number = 1080): Record<PanelId, PanelState> => {
  const defaultPanels = {
    layers: {
      id: 'layers' as PanelId,
      isCollapsed: false,
      isVisible: true,
      position: { y: TOP_MARGIN },
      size: { width: PANEL_WIDTH, height: 250 },
      originalSize: { width: PANEL_WIDTH, height: 250 },
      order: 0,
      isDragging: false
    },
    properties: {
      id: 'properties' as PanelId,
      isCollapsed: false,
      isVisible: true,
      position: { y: TOP_MARGIN + 250 + PANEL_GAP },
      size: { width: PANEL_WIDTH, height: 320 },
      originalSize: { width: PANEL_WIDTH, height: 320 },
      order: 1,
      isDragging: false
    },
    style: {
      id: 'style' as PanelId,
      isCollapsed: false,
      isVisible: true,
      position: { y: TOP_MARGIN + 250 + PANEL_GAP + 320 + PANEL_GAP },
      size: { width: PANEL_WIDTH, height: 164 },
      originalSize: { width: PANEL_WIDTH, height: 164 },
      order: 2,
      isDragging: false
    },
    modifiers: {
      id: 'modifiers' as PanelId,
      isCollapsed: false,
      isVisible: true,
      position: { y: TOP_MARGIN + 250 + PANEL_GAP + 320 + PANEL_GAP + 164 + PANEL_GAP },
      size: { width: PANEL_WIDTH, height: 200 },
      originalSize: { width: PANEL_WIDTH, height: 200 },
      order: 3,
      isDragging: false
    }
  }

  // Calculate proper layout
  const { positions, calculatedHeights } = calculateStackedLayout(DEFAULT_PANEL_ORDER, defaultPanels, viewportHeight)

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
