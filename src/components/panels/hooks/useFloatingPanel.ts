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
    bringPanelToFront,
    swapPanelPositions
  } = usePanelStore()

  const panel = panels[panelId]
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuide[]>([])
  const [, setMousePosition] = useState<{ x: number, y: number } | undefined>()
  const [isSnapping, setIsSnapping] = useState(false)
  const [magneticStrength, setMagneticStrength] = useState(0)
  const [ghostPosition, setGhostPosition] = useState<PanelPosition | null>(null)
  const [showGhost, setShowGhost] = useState(false)
  const [magneticOffset, setMagneticOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const { detectSnapping, generateSnapGuides, calculateMagneticAttraction } = useSnapDetection({
    panelId,
    enableMagneticSnap: true,
    magneticThreshold: 40
  })
  const { constrainPosition, constrainSize, getDefaultConstraints } = usePanelConstraints()

  // Store original position for snap breaking
  const originalPositionRef = useRef<PanelPosition | undefined>(undefined)
  // Throttle magnetic calculations to prevent jitter
  const lastMagneticUpdateRef = useRef<number>(0)
  const magneticThrottleMs = 16 // ~60fps

  // Handle drag events
  const handleDragStart = useCallback(() => {
    setIsDragging(true)
    setPanelDragging(panelId, true)
    bringPanelToFront(panelId)
    originalPositionRef.current = panel.position
    setGhostPosition(null)
    setShowGhost(false)
    setMagneticOffset({ x: 0, y: 0 })
    onDragStart?.()
  }, [panelId, panel.position, setPanelDragging, bringPanelToFront, onDragStart])

  const handleDrag = useCallback((e: DraggableEvent, data: DraggableData) => {
    // Update mouse position for snap intent detection
    if ('clientX' in e && 'clientY' in e && e.clientX && e.clientY) {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    // Get current drag position (don't apply to store yet)
    const currentDragPosition: PanelPosition = { x: data.x, y: data.y }

    // Constrain to viewport for calculations only
    const constrainedPosition = constrainPosition(currentDragPosition, panel.size, 10)

    // Throttle magnetic calculations to prevent jitter and improve performance
    const now = Date.now()
    const shouldUpdateMagnetic = now - lastMagneticUpdateRef.current > magneticThrottleMs

    if (shouldUpdateMagnetic) {
      lastMagneticUpdateRef.current = now

      // Check for swap scenarios first during real-time drag
      const realTimeSnapResult = detectSnapping(constrainedPosition, panel.size, true)

      // If we detect a potential swap, show different visual feedback
      if (realTimeSnapResult.swapCandidate) {
        setMagneticStrength(1.0) // Max strength for swap indication
        setMagneticOffset({ x: 0, y: 0 }) // No offset for swaps
        setGhostPosition(realTimeSnapResult.swapCandidate.targetPosition)
        setShowGhost(true)
      } else {
        // Calculate magnetic attraction based on constrained position
        const magneticAttraction = calculateMagneticAttraction(constrainedPosition, panel.size)

        // Apply visual magnetic feedback only (no position changes during drag)
        if (magneticAttraction && magneticAttraction.strength > 0.3) {
          const strength = Math.pow(magneticAttraction.strength, 0.5)
          setMagneticStrength(strength)

          // Calculate visual offset for magnetic pull effect (subtle)
          const maxOffset = 2 // Maximum 2px visual offset (reduced from 3px)
          const offsetStrength = strength * 0.4 // Slightly stronger visual feedback
          const offsetX = (magneticAttraction.targetPosition.x - constrainedPosition.x) * offsetStrength * maxOffset / 100
          const offsetY = (magneticAttraction.targetPosition.y - constrainedPosition.y) * offsetStrength * maxOffset / 100

          setMagneticOffset({ x: offsetX, y: offsetY })

          // Show ghost preview at target position when attraction is strong
          if (magneticAttraction.strength > 0.6) {
            setGhostPosition(magneticAttraction.targetPosition)
            setShowGhost(true)
          } else {
            setShowGhost(false)
          }
        } else {
          setMagneticStrength(0)
          setMagneticOffset({ x: 0, y: 0 })
          setShowGhost(false)
        }
      }
    }

    // Generate snap guides for real-time feedback
    const snapGuides = generateSnapGuides(constrainedPosition, panel.size)
    setActiveSnapGuides(snapGuides)

    // DON'T update position in store during drag - let react-rnd handle it
    // This prevents the fighting between react-rnd and our magnetic positioning
  }, [panelId, panel.size, constrainPosition, generateSnapGuides, calculateMagneticAttraction])

  const handleDragStop = useCallback((_e: DraggableEvent, data: DraggableData) => {
    setIsDragging(false)
    setActiveSnapGuides([])
    setPanelDragging(panelId, false)
    setMagneticStrength(0)
    setShowGhost(false)
    setGhostPosition(null)
    setMagneticOffset({ x: 0, y: 0 })

    // Use the final drag position from react-rnd
    const finalDragPosition: PanelPosition = { x: data.x, y: data.y }

    // Apply snapping on drop - detectSnapping now handles magnetic attraction internally
    const snapResult = detectSnapping(finalDragPosition, panel.size, false)

    // Handle swap scenarios first (highest priority)
    if (snapResult.swapCandidate) {
      console.log('Executing panel swap:', snapResult.swapCandidate)

      // Execute the swap operation
      swapPanelPositions(
        panelId,
        snapResult.swapCandidate.targetPanelId,
        snapResult.swapCandidate.targetPosition,
        snapResult.swapCandidate.currentPanelNewPosition
      )

      // Show snap animation for visual feedback
      setIsSnapping(true)
      setTimeout(() => {
        setIsSnapping(false)
      }, 350)

      // Clear mouse position and exit early - swap handles all positioning
      setMousePosition(undefined)
      onDragStop?.()
      return
    }

    // Handle normal snapping
    let finalPosition = constrainPosition(snapResult.position, panel.size, 10)

    // If we have magnetic attraction (which means we're snapping), show snap animation
    if (snapResult.magneticAttraction && snapResult.magneticAttraction.strength > 0.5) {
      setIsSnapping(true)

      // Apply smooth snap animation by setting position and letting CSS handle transition
      setTimeout(() => {
        setIsSnapping(false)
      }, 350) // Match transition duration from CSS
    }

    // Now update the position in store (only after drag is complete)
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
  }, [panelId, panel.size, detectSnapping, constrainPosition, setPanelPosition, setPanelDragging, setPanelSnapState, clearPanelSnapState, bringPanelToFront, swapPanelPositions, onDragStop])

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
    isSnapping,
    magneticStrength,
    ghostPosition,
    showGhost,
    magneticOffset,

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