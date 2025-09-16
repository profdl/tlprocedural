import { useCallback, useRef, useState } from 'react'
import { type DraggableData, type ResizableDelta } from 'react-rnd'

// Import the DraggableEvent type from react-draggable (which react-rnd uses)
import type { DraggableEvent } from 'react-draggable'
import { usePanelStore, type PanelId, type PanelPosition, type PanelSize } from '../../../store/panelStore'
import { useSnapDetection, type SnapGuide } from './useSnapDetection'
import { usePanelConstraints } from './usePanelConstraints'

interface UseFloatingPanelProps {
  panelId: PanelId
  onDragStart?: () => void
  onDragStop?: () => void
  onResizeStart?: () => void
  onResizeStop?: () => void
}

export function useFloatingPanel({
  panelId,
  onDragStart,
  onDragStop,
  onResizeStart,
  onResizeStop
}: UseFloatingPanelProps) {
  const {
    panels,
    setPanelPosition,
    setPanelSize,
    setPanelDragging,
    setPanelResizing,
    setPanelSnapState,
    clearPanelSnapState,
    bringPanelToFront
  } = usePanelStore()

  const panel = panels[panelId]
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuide[]>([])
  const [mousePosition, setMousePosition] = useState<{ x: number, y: number } | undefined>()

  const { detectSnapping, generateSnapGuides } = useSnapDetection({ panelId, mousePosition })
  const { constrainPosition, constrainSize, getDefaultConstraints } = usePanelConstraints()

  // Store original position for snap breaking
  const originalPositionRef = useRef<PanelPosition | undefined>(undefined)

  // Handle drag events
  const handleDragStart = useCallback(() => {
    setIsDragging(true)
    setPanelDragging(panelId, true)
    bringPanelToFront(panelId)
    originalPositionRef.current = panel.position
    onDragStart?.()
  }, [panelId, panel.position, setPanelDragging, bringPanelToFront, onDragStart])

  const handleDrag = useCallback((e: DraggableEvent, data: DraggableData) => {
    // Update mouse position for snap intent detection
    if ('clientX' in e && 'clientY' in e && e.clientX && e.clientY) {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    // Real-time position update during drag
    const newPosition: PanelPosition = { x: data.x, y: data.y }

    // Constrain to viewport
    const constrainedPosition = constrainPosition(newPosition, panel.size, 10)

    // Generate snap guides for real-time feedback
    const snapGuides = generateSnapGuides(constrainedPosition, panel.size)
    setActiveSnapGuides(snapGuides)

    // Apply soft snapping during drag (visual feedback only)
    // const snapResult = detectSnapping(constrainedPosition, panel.size, true)

    // Update position in store for real-time snapping detection
    setPanelPosition(panelId, constrainedPosition)
  }, [panelId, panel.size.width, panel.size.height, constrainPosition, setPanelPosition, generateSnapGuides])

  const handleDragStop = useCallback((_e: DraggableEvent, data: DraggableData) => {
    setIsDragging(false)
    setActiveSnapGuides([])
    setPanelDragging(panelId, false)

    const newPosition: PanelPosition = { x: data.x, y: data.y }

    // Apply hard snapping on drop (with collision prevention)
    const snapResult = detectSnapping(newPosition, panel.size, false)

    // Apply snapped position
    const finalPosition = constrainPosition(snapResult.position, panel.size, 10)
    setPanelPosition(panelId, finalPosition)

    // Check if we snapped to the top of another panel - bring to front
    const topSnap = snapResult.snappedToPanels.find(snap => snap.edge === 'top')
    if (topSnap) {
      // Bring the dragged panel to front
      bringPanelToFront(panelId)
    }

    // Update snap state in store based on final position
    // This will determine if the panel is snapped to others for height change repositioning
    // Check if the panel snapped to another panel or browser edge
    if (snapResult.snappedToPanels.length > 0 || snapResult.snappedToBrowser.length > 0) {
      setPanelSnapState(panelId, {
        snappedToBrowser: snapResult.snappedToBrowser,
        snappedToPanels: snapResult.snappedToPanels
      })
    } else {
      // Panel was moved away from snap positions - clear snap state
      clearPanelSnapState(panelId)
    }

    // Clear mouse position
    setMousePosition(undefined)

    onDragStop?.()
  }, [panelId, panel.size, detectSnapping, constrainPosition, setPanelPosition, setPanelDragging, setPanelSnapState, clearPanelSnapState, bringPanelToFront, onDragStop])

  // Handle resize events
  const handleResizeStart = useCallback(() => {
    setIsResizing(true)
    setPanelResizing(panelId, true)
    bringPanelToFront(panelId)
    onResizeStart?.()
  }, [panelId, setPanelResizing, bringPanelToFront, onResizeStart])

  const handleResize = useCallback((
    _e: MouseEvent | TouchEvent,
    direction: string,
    ref: HTMLElement,
    _delta: ResizableDelta,
    position: PanelPosition
  ) => {
    const newSize: PanelSize = {
      width: ref.offsetWidth,
      height: ref.offsetHeight
    }

    // Get constraints for this panel type
    const panelType = panelId as 'properties' | 'style' | 'modifiers'
    const constraints = getDefaultConstraints(panelType)

    // Constrain size
    const constrainedSize = constrainSize(newSize, position, constraints, 10)

    // Update size in store
    setPanelSize(panelId, constrainedSize)

    // Update position if resizing from top or left
    if (direction.includes('n') || direction.includes('w')) {
      const constrainedPosition = constrainPosition(position, constrainedSize, 10)
      setPanelPosition(panelId, constrainedPosition)
    }
  }, [panelId, getDefaultConstraints, constrainSize, constrainPosition, setPanelSize, setPanelPosition])

  const handleResizeStop = useCallback((
    _e: MouseEvent | TouchEvent,
    direction: string,
    ref: HTMLElement,
    _delta: ResizableDelta,
    position: PanelPosition
  ) => {
    setIsResizing(false)
    setPanelResizing(panelId, false)

    // Final size and position update
    const finalSize: PanelSize = {
      width: ref.offsetWidth,
      height: ref.offsetHeight
    }

    const panelType = panelId as 'properties' | 'style' | 'modifiers'
    const constraints = getDefaultConstraints(panelType)
    const constrainedSize = constrainSize(finalSize, position, constraints, 10)

    setPanelSize(panelId, constrainedSize)

    if (direction.includes('n') || direction.includes('w')) {
      const constrainedPosition = constrainPosition(position, constrainedSize, 10)
      setPanelPosition(panelId, constrainedPosition)
    }

    onResizeStop?.()
  }, [panelId, getDefaultConstraints, constrainSize, constrainPosition, setPanelSize, setPanelPosition, setPanelResizing, onResizeStop])

  // Bring panel to front when clicked
  const handlePanelClick = useCallback(() => {
    bringPanelToFront(panelId)
  }, [panelId, bringPanelToFront])

  return {
    // Panel state
    panel,
    isDragging,
    isResizing,
    activeSnapGuides,

    // Event handlers
    handleDragStart,
    handleDrag,
    handleDragStop,
    handleResizeStart,
    handleResize,
    handleResizeStop,
    handlePanelClick,

    // Constraints
    constraints: getDefaultConstraints(panelId as 'properties' | 'style' | 'modifiers')
  }
}