import { useCallback, useRef, useState, useEffect } from 'react'
import { usePanelStore, type PanelId } from '../../../store/panelStore'

interface UseStackedPanelProps {
  panelId: PanelId
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

export function useStackedPanel({
  panelId,
  onDragStart,
  onDragEnd
}: UseStackedPanelProps) {
  const {
    panels,
    panelOrder,
    setPanelDragging,
    setPanelStackState,
    clearPanelStackState,
    reorderPanels,
    setActivePanel,
    calculatePanelPositions,
    viewportHeight,
    setViewportHeight
  } = usePanelStore()

  const panel = panels[panelId]
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startY: 0,
    currentY: 0,
    dragOffset: 0
  })

  const dragElementRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const insertIndexRef = useRef<number | undefined>(undefined)

  // Monitor viewport height changes
  useEffect(() => {
    const handleResize = () => {
      const newHeight = window.innerHeight
      if (newHeight !== viewportHeight) {
        setViewportHeight(newHeight)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [viewportHeight, setViewportHeight])

  // Calculate drop zones between panels
  const calculateDropZones = useCallback(() => {
    const visiblePanels = panelOrder.filter(id => panels[id]?.isVisible)
    const dropZones: Array<{ y: number; index: number }> = []

    let currentY = 8 // TOP_MARGIN

    // Add drop zone at the top
    dropZones.push({ y: currentY - 4, index: 0 })

    visiblePanels.forEach((id, index) => {
      const panelHeight = panels[id]?.isCollapsed ? 32 : panels[id]?.size.height || 200
      currentY += panelHeight

      // Add drop zone between panels
      if (index < visiblePanels.length - 1) {
        dropZones.push({ y: currentY + 4, index: index + 1 })
      }

      currentY += 8 // PANEL_GAP
    })

    // Add drop zone at the bottom
    dropZones.push({ y: currentY, index: visiblePanels.length })

    return dropZones
  }, [panelOrder, panels])

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
    if (!panel || event.button !== 0) return

    const startY = event.clientY
    const initialPanelY = panel.position.y

    setDragState({
      isDragging: true,
      startY,
      currentY: startY,
      dragOffset: 0
    })

    setPanelDragging(panelId, true)
    setActivePanel(panelId)
    onDragStart?.()

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentY = moveEvent.clientY
      const dragOffset = currentY - startY
      const dragY = initialPanelY + dragOffset

      const insertIndex = findInsertIndex(dragY)
      const currentIndex = panelOrder.indexOf(panelId)

      const finalInsertIndex = insertIndex !== currentIndex ? insertIndex : undefined
      insertIndexRef.current = finalInsertIndex

      setDragState(prev => ({
        ...prev,
        currentY,
        dragOffset,
        insertIndex: finalInsertIndex
      }))

      setPanelStackState(panelId, {
        isReordering: true,
        insertIndex: finalInsertIndex
      })
    }

    const handleMouseUp = () => {
      const insertIndex = insertIndexRef.current
      const currentIndex = panelOrder.indexOf(panelId)

      // Perform reorder if needed
      if (insertIndex !== undefined && insertIndex !== currentIndex) {
        // Adjust insert index if moving down (account for removal)
        const adjustedIndex = insertIndex > currentIndex ? insertIndex - 1 : insertIndex
        reorderPanels(currentIndex, adjustedIndex)
      }

      // Reset drag state
      setDragState({
        isDragging: false,
        startY: 0,
        currentY: 0,
        dragOffset: 0
      })
      insertIndexRef.current = undefined

      setPanelDragging(panelId, false)
      clearPanelStackState(panelId)
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
    panel,
    panelId,
    panelOrder,
    setPanelDragging,
    setPanelStackState,
    clearPanelStackState,
    reorderPanels,
    setActivePanel,
    calculatePanelPositions,
    findInsertIndex,
    onDragStart,
    onDragEnd
  ])

  // Handle panel click to bring to front
  const handlePanelClick = useCallback(() => {
    setActivePanel(panelId)
  }, [panelId, setActivePanel])

  // Calculate current panel style based on drag state
  const getPanelStyle = useCallback(() => {
    if (!dragState.isDragging) {
      return {
        transform: 'none',
        zIndex: panel?.order || 0
      }
    }

    return {
      transform: `translateY(${dragState.dragOffset}px)`,
      zIndex: 1000
    }
  }, [dragState, panel?.order])

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

  if (!panel) return null

  return {
    // Panel state
    panel,
    dragState,

    // Refs
    dragElementRef,
    panelRef,

    // Event handlers
    handleMouseDown,
    handlePanelClick,

    // Style calculations
    getPanelStyle,
    getDropZoneIndicators,

    // Panel order info
    currentIndex: panelOrder.indexOf(panelId),
    isFirst: panelOrder.indexOf(panelId) === 0,
    isLast: panelOrder.indexOf(panelId) === panelOrder.length - 1
  }
}