import { useCallback, useRef, useState } from 'react'
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
  mergeTargetId?: PanelId | string
  mergeTargetType?: 'panel' | 'tabGroup'
  isMergeZone?: boolean
}

interface DropZoneIndicator {
  y: number
  isActive: boolean
  isMergeZone?: boolean
}

interface MergeZone {
  targetId: PanelId | string
  targetType: 'panel' | 'tabGroup'
  bounds: DOMRect
}

export function useStackedPanel({
  panelId,
  onDragStart,
  onDragEnd
}: UseStackedPanelProps) {
  const {
    panels,
    panelOrder,
    tabGroups,
    tabGroupOrder,
    setPanelDragging,
    setPanelStackState,
    clearPanelStackState,
    reorderPanels,
    setActivePanel,
    calculatePanelPositions,
    mergeIntoTabGroup
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

  // Refs to track current merge state during drag operations
  const isMergeZoneRef = useRef<boolean>(false)
  const mergeTargetIdRef = useRef<PanelId | string | undefined>(undefined)
  const mergeTargetTypeRef = useRef<'panel' | 'tabGroup' | undefined>(undefined)


  // Calculate drop zones between panels
  const calculateDropZones = useCallback(() => {
    // When dragging, exclude the dragged panel from the visible panels list
    const visiblePanels = panelOrder.filter(id =>
      panels[id]?.isVisible && (!dragState.isDragging || id !== panelId)
    )
    const dropZones: Array<{ y: number; index: number }> = []

    let currentY = 8 // TOP_MARGIN

    // Add drop zone at the top
    dropZones.push({ y: currentY - 4, index: 0 })

    visiblePanels.forEach((id, index) => {
      const panelHeight = panels[id]?.isCollapsed ? 28 : panels[id]?.size.height || 200
      currentY += panelHeight

      // Add drop zone between panels
      if (index < visiblePanels.length - 1) {
        dropZones.push({ y: currentY + 4, index: index + 1 })
      }

      currentY += 0 // PANEL_GAP
    })

    // Add drop zone at the bottom
    dropZones.push({ y: currentY, index: visiblePanels.length })

    return dropZones
  }, [panelOrder, panels, dragState.isDragging, panelId])

  // Calculate merge zones for tab group creation
  const calculateMergeZones = useCallback((): MergeZone[] => {
    const mergeZones: MergeZone[] = []
    const visiblePanels = panelOrder.filter(id => panels[id]?.isVisible && !panels[id]?.tabGroupId)

    // Calculate panel X position based on right positioning
    // Panels are positioned with right: 8px, width: 280px
    const panelRight = 8
    const panelWidth = 280
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
    const panelLeft = windowWidth - panelRight - panelWidth

    // Add merge zones for individual panels (excluding the dragged panel)
    visiblePanels.forEach(id => {
      if (id !== panelId) {
        const targetPanel = panels[id]
        if (targetPanel) {
          // Create a merge zone over the panel header area
          const headerHeight = Math.min(48, targetPanel.isCollapsed ? 28 : 48)
          mergeZones.push({
            targetId: id,
            targetType: 'panel',
            bounds: new DOMRect(
              panelLeft, // Correct X position from left edge
              targetPanel.position.y,
              panelWidth,
              headerHeight
            )
          })
        }
      }
    })

    // Add merge zones for tab groups
    tabGroupOrder.forEach(groupId => {
      const tabGroup = tabGroups[groupId]
      if (tabGroup) {
        const headerHeight = Math.min(48, tabGroup.isCollapsed ? 28 : 48)
        mergeZones.push({
          targetId: groupId,
          targetType: 'tabGroup',
          bounds: new DOMRect(
            panelLeft, // Correct X position from left edge
            tabGroup.position.y,
            panelWidth,
            headerHeight
          )
        })
      }
    })

    // Debug logging to see what merge zones are being created
    if (mergeZones.length > 0) {
      console.log('Merge zones created for', panelId, ':', mergeZones.map(zone => ({
        targetId: zone.targetId,
        bounds: {
          x: zone.bounds.x,
          y: zone.bounds.y,
          width: zone.bounds.width,
          height: zone.bounds.height,
          right: zone.bounds.x + zone.bounds.width,
          bottom: zone.bounds.y + zone.bounds.height
        }
      })))
    }

    return mergeZones
  }, [panelOrder, panels, tabGroupOrder, tabGroups, panelId])

  // Detect if drag position is over a merge zone
  const detectMergeZone = useCallback((dragX: number, dragY: number): MergeZone | null => {
    const mergeZones = calculateMergeZones()

    for (const zone of mergeZones) {
      const { bounds } = zone
      if (
        dragX >= bounds.x &&
        dragX <= bounds.x + bounds.width &&
        dragY >= bounds.y &&
        dragY <= bounds.y + bounds.height
      ) {
        // Debug logging to verify merge zone detection
        console.log('Merge zone detected!', {
          targetId: zone.targetId,
          mouseX: dragX,
          mouseY: dragY,
          bounds: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            right: bounds.x + bounds.width,
            bottom: bounds.y + bounds.height
          }
        })
        return zone
      }
    }

    return null
  }, [calculateMergeZones])

  // Find the insert index based on current drag position
  const findInsertIndex = useCallback((dragY: number): number => {
    const dropZones = calculateDropZones()
    const visiblePanelsExcludingDragged = panelOrder.filter(id =>
      panels[id]?.isVisible && id !== panelId
    )


    for (let i = 0; i < dropZones.length; i++) {
      if (dragY <= dropZones[i].y) {
        const dropZoneIndex = dropZones[i].index

        // Convert the drop zone index back to the original panelOrder index
        let originalIndex = dropZoneIndex

        if (dropZoneIndex < visiblePanelsExcludingDragged.length) {
          // Find the panel at this position in the filtered list
          const targetPanelId = visiblePanelsExcludingDragged[dropZoneIndex]
          originalIndex = panelOrder.indexOf(targetPanelId)
        } else {
          // Dropping at the end
          originalIndex = panelOrder.length
        }

        return originalIndex
      }
    }

    return panelOrder.length
  }, [calculateDropZones, panelId, panelOrder, panels])

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
      const currentX = moveEvent.clientX
      const dragOffset = currentY - startY
      const dragY = initialPanelY + dragOffset

      // Check for merge zone first - use actual mouse coordinates
      const mergeZone = detectMergeZone(currentX, currentY)

      if (mergeZone) {
        // In merge zone - show merge indicator
        // Update refs for handleMouseUp to access
        isMergeZoneRef.current = true
        mergeTargetIdRef.current = mergeZone.targetId
        mergeTargetTypeRef.current = mergeZone.targetType
        insertIndexRef.current = undefined

        setDragState(prev => ({
          ...prev,
          currentY,
          dragOffset,
          mergeTargetId: mergeZone.targetId,
          mergeTargetType: mergeZone.targetType,
          isMergeZone: true,
          insertIndex: undefined
        }))

        setPanelStackState(panelId, {
          isReordering: false // No reorder indicators in merge mode
        })
      } else {
        // Normal reorder mode
        const insertIndex = findInsertIndex(dragY)
        const currentIndex = panelOrder.indexOf(panelId)

        const finalInsertIndex = insertIndex !== currentIndex ? insertIndex : undefined

        // Update refs for handleMouseUp to access
        isMergeZoneRef.current = false
        mergeTargetIdRef.current = undefined
        mergeTargetTypeRef.current = undefined
        insertIndexRef.current = finalInsertIndex

        setDragState(prev => ({
          ...prev,
          currentY,
          dragOffset,
          insertIndex: finalInsertIndex,
          mergeTargetId: undefined,
          mergeTargetType: undefined,
          isMergeZone: false
        }))

        setPanelStackState(panelId, {
          isReordering: true,
          insertIndex: finalInsertIndex
        })
      }
    }

    const handleMouseUp = () => {
      const insertIndex = insertIndexRef.current
      const currentIndex = panelOrder.indexOf(panelId)

      // Check if we're in a merge zone using refs (not stale dragState)
      if (isMergeZoneRef.current && mergeTargetIdRef.current) {
        // Perform merge operation
        if (mergeTargetTypeRef.current === 'tabGroup') {
          // Merging with a tab group - add panel to existing tab group
          const targetTabGroup = tabGroups[mergeTargetIdRef.current]
          if (targetTabGroup) {
            // Find any panel in the tab group to use as merge target
            const firstPanelInGroup = targetTabGroup.panelIds[0]
            if (firstPanelInGroup) {
              console.log('Merging into existing tab group:', mergeTargetIdRef.current, 'via panel:', firstPanelInGroup)
              mergeIntoTabGroup(firstPanelInGroup, panelId)
            }
          }
        } else if (mergeTargetTypeRef.current === 'panel') {
          // Merging with another panel
          console.log('Creating new tab group by merging panels:', mergeTargetIdRef.current, 'and', panelId)
          mergeIntoTabGroup(mergeTargetIdRef.current as PanelId, panelId)
        }
      } else if (insertIndex !== undefined && insertIndex !== currentIndex) {
        // Perform reorder if needed - insertIndex is now already correctly calculated
        reorderPanels(currentIndex, insertIndex)
      }

      // Reset drag state
      setDragState({
        isDragging: false,
        startY: 0,
        currentY: 0,
        dragOffset: 0,
        mergeTargetId: undefined,
        mergeTargetType: undefined,
        isMergeZone: false
      })

      // Reset refs
      insertIndexRef.current = undefined
      isMergeZoneRef.current = false
      mergeTargetIdRef.current = undefined
      mergeTargetTypeRef.current = undefined

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
    tabGroups,
    setPanelDragging,
    setPanelStackState,
    clearPanelStackState,
    reorderPanels,
    setActivePanel,
    calculatePanelPositions,
    findInsertIndex,
    detectMergeZone,
    mergeIntoTabGroup,
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
    if (!dragState.isDragging) {
      return []
    }

    // Show merge zone indicator if in merge mode
    if (dragState.isMergeZone && dragState.mergeTargetId) {
      const mergeZones = calculateMergeZones()
      const targetZone = mergeZones.find(zone => zone.targetId === dragState.mergeTargetId)

      if (targetZone) {
        return [{
          y: targetZone.bounds.y + targetZone.bounds.height / 2,
          isActive: true,
          isMergeZone: true
        }]
      }
    }

    // Show reorder drop zone indicator
    if (dragState.insertIndex !== undefined) {
      const dropZones = calculateDropZones()
      const targetZone = dropZones.find(zone => zone.index === dragState.insertIndex)

      if (targetZone) {
        return [{
          y: targetZone.y,
          isActive: true,
          isMergeZone: false
        }]
      }
    }

    return []
  }, [dragState, calculateDropZones, calculateMergeZones])

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