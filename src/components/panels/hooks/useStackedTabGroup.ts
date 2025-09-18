import { useCallback, useRef, useState } from 'react'
import { usePanelStore } from '../../../store/panelStore'

interface UseStackedTabGroupProps {
  tabGroupId: string
  onDragStart?: () => void
  onDragEnd?: () => void
}

interface DragState {
  isDragging: boolean
  startY: number
  currentY: number
  dragOffset: number
  insertIndex?: number
}

interface DropZoneIndicator {
  y: number
  isActive: boolean
}

export function useStackedTabGroup({
  tabGroupId,
  onDragStart,
  onDragEnd
}: UseStackedTabGroupProps) {
  const {
    tabGroups,
    tabGroupOrder,
    panelOrder,
    panels,
    setTabGroupDragging,
    setTabGroupStackState,
    clearTabGroupStackState,
    reorderTabGroups,
    calculatePanelPositions
  } = usePanelStore()

  const tabGroup = tabGroups[tabGroupId]
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startY: 0,
    currentY: 0,
    dragOffset: 0
  })

  const dragElementRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const insertIndexRef = useRef<number | undefined>(undefined)

  // Calculate drop zones between panels and tab groups
  const calculateDropZones = useCallback(() => {
    const dropZones: Array<{ y: number; index: number }> = []
    let currentY = 8 // TOP_MARGIN

    // Add drop zone at the top
    dropZones.push({ y: currentY - 4, index: 0 })

    // Add individual panels
    const visiblePanels = panelOrder.filter(id => panels[id]?.isVisible && !panels[id]?.tabGroupId)
    visiblePanels.forEach((panelId, index) => {
      const panel = panels[panelId]
      if (panel) {
        const panelHeight = panel.isCollapsed ? 28 : panel.size.height
        currentY += panelHeight

        // Add drop zone after this panel
        dropZones.push({ y: currentY + 4, index: index + 1 })
      }
    })

    // Add tab groups
    tabGroupOrder.forEach((groupId, index) => {
      const group = tabGroups[groupId]
      if (group && groupId !== tabGroupId) { // Don't include self in drop zones
        const groupHeight = group.isCollapsed ? 28 : group.size.height
        currentY += groupHeight

        // Add drop zone after this tab group
        dropZones.push({ y: currentY + 4, index: visiblePanels.length + index + 1 })
      }
    })

    // Add final drop zone at the bottom
    dropZones.push({ y: currentY, index: visiblePanels.length + tabGroupOrder.length })

    return dropZones
  }, [tabGroupOrder, tabGroups, panelOrder, panels, tabGroupId])

  // Find the insert index based on current drag position
  const findInsertIndex = useCallback((dragY: number): number => {
    const dropZones = calculateDropZones()

    for (let i = 0; i < dropZones.length; i++) {
      if (dragY <= dropZones[i].y) {
        return dropZones[i].index
      }
    }

    return dropZones[dropZones.length - 1]?.index || 0
  }, [calculateDropZones])

  // Handle mouse down on drag handle
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!tabGroup || event.button !== 0) return

    const startY = event.clientY
    const initialTabGroupY = tabGroup.position.y

    setDragState({
      isDragging: true,
      startY,
      currentY: startY,
      dragOffset: 0
    })

    setTabGroupDragging(tabGroupId, true)
    onDragStart?.()

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentY = moveEvent.clientY
      const dragOffset = currentY - startY
      const dragY = initialTabGroupY + dragOffset

      const insertIndex = findInsertIndex(dragY)
      const currentIndex = tabGroupOrder.indexOf(tabGroupId)

      const finalInsertIndex = insertIndex !== currentIndex ? insertIndex : undefined
      insertIndexRef.current = finalInsertIndex

      setDragState(prev => ({
        ...prev,
        currentY,
        dragOffset,
        insertIndex: finalInsertIndex
      }))

      setTabGroupStackState(tabGroupId, {
        isReordering: true,
        insertIndex: finalInsertIndex
      })
    }

    const handleMouseUp = () => {
      const insertIndex = insertIndexRef.current
      const currentIndex = tabGroupOrder.indexOf(tabGroupId)

      // Perform reorder if needed
      if (insertIndex !== undefined && insertIndex !== currentIndex) {
        // Adjust insert index if moving down (account for removal)
        const adjustedIndex = insertIndex > currentIndex ? insertIndex - 1 : insertIndex
        reorderTabGroups(currentIndex, adjustedIndex)
      }

      // Reset drag state
      setDragState({
        isDragging: false,
        startY: 0,
        currentY: 0,
        dragOffset: 0
      })
      insertIndexRef.current = undefined

      setTabGroupDragging(tabGroupId, false)
      clearTabGroupStackState(tabGroupId)
      onDragEnd?.()

      // Recalculate positions after reorder
      setTimeout(() => {
        calculatePanelPositions()
      }, 0)

      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [
    tabGroup,
    tabGroupId,
    tabGroupOrder,
    setTabGroupDragging,
    setTabGroupStackState,
    clearTabGroupStackState,
    reorderTabGroups,
    calculatePanelPositions,
    findInsertIndex,
    onDragStart,
    onDragEnd
  ])

  // Handle container click to bring to front (if needed)
  const handleContainerClick = useCallback(() => {
    // Could implement focus logic here if needed
  }, [])

  // Calculate current container style based on drag state
  const getContainerStyle = useCallback(() => {
    if (!dragState.isDragging) {
      return {
        transform: 'none',
        zIndex: tabGroup?.order || 0
      }
    }

    return {
      transform: `translateY(${dragState.dragOffset}px)`,
      zIndex: 1000
    }
  }, [dragState, tabGroup?.order])

  // Get drop zone indicators for rendering
  const getDropZoneIndicators = useCallback((): DropZoneIndicator[] => {
    if (!dragState.isDragging || dragState.insertIndex === undefined) {
      return []
    }

    const dropZones = calculateDropZones()
    const targetZone = dropZones.find(zone => zone.index === dragState.insertIndex)

    if (!targetZone) return []

    return [{
      y: targetZone.y,
      isActive: true
    }]
  }, [dragState, calculateDropZones])

  if (!tabGroup) return null

  return {
    // Tab group state
    tabGroup,
    dragState,

    // Refs
    dragElementRef,
    containerRef,

    // Event handlers
    handleMouseDown,
    handleContainerClick,

    // Style calculations
    getContainerStyle,
    getDropZoneIndicators,

    // Tab group order info
    currentIndex: tabGroupOrder.indexOf(tabGroupId),
    isFirst: tabGroupOrder.indexOf(tabGroupId) === 0,
    isLast: tabGroupOrder.indexOf(tabGroupId) === tabGroupOrder.length - 1
  }
}