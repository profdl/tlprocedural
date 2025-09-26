import React, { useCallback, useRef, useState, useEffect } from 'react'
import { usePanelStore, type PanelId } from '../../../store/panelStore'

interface UseResizableProps {
  panelId: PanelId
  isResizable?: boolean
  onResizeStart?: () => void
  onResize?: (height: number) => void
  onResizeEnd?: (height: number) => void
  panelElementRef?: React.RefObject<HTMLElement>
}

interface ResizeState {
  isResizing: boolean
  startY: number
  startHeight: number
  currentHeight: number
}

export function useResizable({
  panelId,
  isResizable = true,
  onResizeStart,
  onResize,
  onResizeEnd,
  panelElementRef
}: UseResizableProps) {
  const {
    panels,
    setPanelUserDefinedHeight,
    viewportHeight
  } = usePanelStore()

  const panel = panels[panelId]
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    startY: 0,
    startHeight: 0,
    currentHeight: 0
  })

  const resizeHandleRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const currentHeightRef = useRef<number>(0)

  // Calculate height constraints
  const getHeightConstraints = useCallback(() => {
    const minHeight = 100 // Minimum panel height
    const maxHeight = viewportHeight - 200 // Leave space for other panels
    return { minHeight, maxHeight }
  }, [viewportHeight])

  // Apply height changes directly to DOM for smooth performance
  const applyHeightToDom = useCallback((height: number) => {
    if (panelElementRef?.current) {
      // Apply height directly to the panel element for immediate visual feedback
      panelElementRef.current.style.height = `${height}px`
      panelElementRef.current.style.transition = 'none' // Disable transitions during resize
    }
  }, [panelElementRef])

  // Throttled update function using requestAnimationFrame
  const throttledUpdate = useCallback((height: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      currentHeightRef.current = height
      applyHeightToDom(height)
      onResize?.(height)

      setResizeState(prev => ({
        ...prev,
        currentHeight: height
      }))
    })
  }, [applyHeightToDom, onResize])

  // Handle mouse down on resize handle
  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    if (!panel || !isResizable || event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    const startY = event.clientY
    const startHeight = panel.userDefinedHeight || panel.size.height
    currentHeightRef.current = startHeight

    setResizeState({
      isResizing: true,
      startY,
      startHeight,
      currentHeight: startHeight
    })

    onResizeStart?.()

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY
      const newHeight = startHeight + deltaY
      const { minHeight, maxHeight } = getHeightConstraints()
      const constrainedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight))

      // Use throttled update for smooth performance - no store updates during drag
      throttledUpdate(constrainedHeight)
    }

    const handleMouseUp = () => {
      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      const finalHeight = currentHeightRef.current || startHeight

      // Restore transition and update store only once at the end
      if (panelElementRef?.current) {
        panelElementRef.current.style.transition = ''
      }

      // Update the panel store with the final height (only once)
      setPanelUserDefinedHeight(panelId, finalHeight)

      setResizeState({
        isResizing: false,
        startY: 0,
        startHeight: 0,
        currentHeight: 0
      })

      onResizeEnd?.(finalHeight)

      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // Set global cursor and disable text selection while resizing
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [
    panel,
    isResizable,
    panelId,
    setPanelUserDefinedHeight,
    getHeightConstraints,
    onResizeStart,
    onResizeEnd,
    throttledUpdate,
    panelElementRef
  ])

  // Calculate current panel height (including resize preview)
  const getCurrentHeight = useCallback(() => {
    if (resizeState.isResizing) {
      return currentHeightRef.current
    }
    return panel?.userDefinedHeight || panel?.size.height || 200
  }, [resizeState.isResizing, panel])

  // Cleanup effect for animation frames
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Get resize handle props
  const getResizeHandleProps = useCallback(() => {
    if (!isResizable) return null

    return {
      ref: resizeHandleRef,
      onMouseDown: handleResizeStart,
      style: {
        cursor: resizeState.isResizing ? 'ns-resize' : 'ns-resize'
      }
    }
  }, [isResizable, handleResizeStart, resizeState.isResizing])

  if (!panel) return null

  return {
    // State
    isResizing: resizeState.isResizing,
    currentHeight: getCurrentHeight(),

    // Methods
    getResizeHandleProps,
    getHeightConstraints,

    // Refs
    resizeHandleRef
  }
}