import type { PanelId, PanelState, TabGroupState } from '../panelStore'

export const getDisplayOrder = (
  panelOrder: PanelId[],
  panels: Record<PanelId, PanelState>,
  tabGroupOrder: string[],
  tabGroups: Record<string, TabGroupState>
): Array<{ type: 'panel' | 'tabGroup'; id: string }> => {
  const displayItems: Array<{ type: 'panel' | 'tabGroup'; id: string; order: number }> = []

  // Add individual panels with their order
  panelOrder.forEach(panelId => {
    if (panels[panelId]?.isVisible && !panels[panelId]?.tabGroupId) {
      displayItems.push({
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
      displayItems.push({
        type: 'tabGroup',
        id: tabGroupId,
        order: tabGroup.order
      })
    }
  })

  // Sort by order value for proper visual stacking (lower order = higher in stack)
  displayItems.sort((a, b) => a.order - b.order)

  // Return without the order property to match expected interface
  return displayItems.map(item => ({ type: item.type, id: item.id }))
}