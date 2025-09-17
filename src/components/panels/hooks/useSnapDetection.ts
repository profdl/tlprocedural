import { useCallback, useMemo } from 'react'
import { usePanelStore, type PanelId, type PanelPosition, type PanelSize } from '../../../store/panelStore'

interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

interface SnapGuide {
  type: 'vertical' | 'horizontal'
  position: number
  start: number
  end: number
  isActive: boolean
  snapType?: 'top' | 'bottom' | 'left' | 'right' | 'browser'
  targetPanelId?: PanelId
}

interface SwapCandidate {
  targetPanelId: PanelId
  swapType: 'above-top' | 'below-bottom' | 'left-of-left' | 'right-of-right'
  targetPosition: PanelPosition
  currentPanelNewPosition: PanelPosition
}

interface SnapResult {
  position: PanelPosition
  snappedToBrowser: ('top' | 'bottom' | 'left' | 'right')[]
  snappedToPanels: Array<{
    panelId: PanelId
    edge: 'top' | 'bottom' | 'left' | 'right'
  }>
  hasCollision: boolean
  snapGuides: SnapGuide[]
  magneticAttraction?: {
    targetPosition: PanelPosition
    strength: number
    type: 'browser' | 'panel'
  } | null
  swapCandidate?: SwapCandidate | null
}

interface SnapDetectionProps {
  panelId: PanelId
  snapGap?: number
  magneticThreshold?: number
  enableMagneticSnap?: boolean
}

// Constants for collapsed panel dimensions
const COLLAPSED_PANEL_HEIGHT = 32 // Header height when collapsed

export function useSnapDetection({
  panelId,
  snapGap = 8,
  magneticThreshold = 40,
  enableMagneticSnap = true
}: SnapDetectionProps) {
  // Unified threshold - no more separate browser vs panel thresholds
  const snapThreshold = magneticThreshold
  const { panels } = usePanelStore()

  // Get other panels (excluding current one)
  const otherPanels = useMemo(() => {
    return Object.values(panels).filter(panel => panel.id !== panelId)
  }, [panels, panelId])

  // Get viewport dimensions
  const viewport = useMemo(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }), [])

  // Get effective panel size (accounting for collapsed state)
  const getEffectivePanelSize = useCallback((panel: typeof panels[PanelId]): PanelSize => {
    if (panel.isCollapsed) {
      return {
        width: panel.size.width,
        height: COLLAPSED_PANEL_HEIGHT
      }
    }
    return panel.size
  }, [])

  // REMOVED: Legacy mouse-based intent detection - now using distance-based attraction

  // Collision detection helper
  const detectCollision = useCallback((rect1: Rectangle, rect2: Rectangle): boolean => {
    return !(
      rect1.x + rect1.width <= rect2.x ||
      rect2.x + rect2.width <= rect1.x ||
      rect1.y + rect1.height <= rect2.y ||
      rect2.y + rect2.height <= rect1.y
    )
  }, [])

  // Check if position would cause collisions (accounting for collapsed states)
  const hasCollisions = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): boolean => {
    const rect = { ...position, ...size }
    return otherPanels.some(panel => {
      const effectiveSize = getEffectivePanelSize(panel)
      return detectCollision(rect, {
        x: panel.position.x,
        y: panel.position.y,
        width: effectiveSize.width,
        height: effectiveSize.height
      })
    })
  }, [otherPanels, detectCollision, getEffectivePanelSize])

  // Detect swap scenarios where panel should switch places with another
  const detectSwapScenario = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): SwapCandidate | null => {
    for (const panel of otherPanels) {
      const effectiveSize = getEffectivePanelSize(panel)
      const panelRect = {
        x: panel.position.x,
        y: panel.position.y,
        width: effectiveSize.width,
        height: effectiveSize.height
      }

      // Check if trying to place above a panel that's already at the top
      if (Math.abs(panelRect.y) < 10) { // Panel is at or very near top
        const wouldBeAbove = position.y + size.height + snapGap <= panelRect.y
        if (wouldBeAbove) {
          // Check if there's horizontal overlap (would be stacked)
          const horizontalOverlap = !(position.x + size.width < panelRect.x || position.x > panelRect.x + panelRect.width)
          if (horizontalOverlap) {
            return {
              targetPanelId: panel.id,
              swapType: 'above-top',
              targetPosition: position, // Current panel goes to intended position
              currentPanelNewPosition: { // Target panel moves down
                x: panelRect.x,
                y: position.y + size.height + snapGap
              }
            }
          }
        }
      }

      // Check if trying to place below a panel that's already at the bottom
      if (Math.abs(viewport.height - (panelRect.y + panelRect.height)) < 10) { // Panel is at or very near bottom
        const wouldBeBelow = position.y >= panelRect.y + panelRect.height + snapGap
        if (wouldBeBelow) {
          const horizontalOverlap = !(position.x + size.width < panelRect.x || position.x > panelRect.x + panelRect.width)
          if (horizontalOverlap) {
            return {
              targetPanelId: panel.id,
              swapType: 'below-bottom',
              targetPosition: position,
              currentPanelNewPosition: {
                x: panelRect.x,
                y: position.y - panelRect.height - snapGap
              }
            }
          }
        }
      }

      // Check if trying to place left of a panel that's already at the left edge
      if (Math.abs(panelRect.x) < 10) { // Panel is at or very near left
        const wouldBeLeft = position.x + size.width + snapGap <= panelRect.x
        if (wouldBeLeft) {
          const verticalOverlap = !(position.y + size.height < panelRect.y || position.y > panelRect.y + panelRect.height)
          if (verticalOverlap) {
            return {
              targetPanelId: panel.id,
              swapType: 'left-of-left',
              targetPosition: position,
              currentPanelNewPosition: {
                x: position.x + size.width + snapGap,
                y: panelRect.y
              }
            }
          }
        }
      }

      // Check if trying to place right of a panel that's already at the right edge
      if (Math.abs(viewport.width - (panelRect.x + panelRect.width)) < 10) { // Panel is at or very near right
        const wouldBeRight = position.x >= panelRect.x + panelRect.width + snapGap
        if (wouldBeRight) {
          const verticalOverlap = !(position.y + size.height < panelRect.y || position.y > panelRect.y + panelRect.height)
          if (verticalOverlap) {
            return {
              targetPanelId: panel.id,
              swapType: 'right-of-right',
              targetPosition: position,
              currentPanelNewPosition: {
                x: position.x - panelRect.width - snapGap,
                y: panelRect.y
              }
            }
          }
        }
      }
    }

    return null
  }, [otherPanels, getEffectivePanelSize, viewport, snapGap])

  // Find best edge snap position to prevent collision
  const findBestEdgeSnapPosition = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): PanelPosition => {
    // Check if current position is already valid
    if (!hasCollisions(position, size)) {
      return position
    }

    const candidatePositions: Array<{
      position: PanelPosition
      distance: number
      snapType: string
    }> = []

    // For each colliding panel, find all possible edge snap positions
    for (const panel of otherPanels) {
      const effectiveSize = getEffectivePanelSize(panel)
      const panelRect = {
        x: panel.position.x,
        y: panel.position.y,
        width: effectiveSize.width,
        height: effectiveSize.height
      }

      // Calculate snap positions around this panel
      const snapPositions = [
        // Above the panel
        {
          position: { x: panelRect.x, y: panelRect.y - size.height - snapGap },
          distance: Math.abs(position.y - (panelRect.y - size.height - snapGap)),
          snapType: 'above'
        },
        // Below the panel
        {
          position: { x: panelRect.x, y: panelRect.y + panelRect.height + snapGap },
          distance: Math.abs(position.y - (panelRect.y + panelRect.height + snapGap)),
          snapType: 'below'
        },
        // Left of the panel
        {
          position: { x: panelRect.x - size.width - snapGap, y: panelRect.y },
          distance: Math.abs(position.x - (panelRect.x - size.width - snapGap)),
          snapType: 'left'
        },
        // Right of the panel
        {
          position: { x: panelRect.x + panelRect.width + snapGap, y: panelRect.y },
          distance: Math.abs(position.x - (panelRect.x + panelRect.width + snapGap)),
          snapType: 'right'
        }
      ]

      // Add valid snap positions to candidates
      for (const snap of snapPositions) {
        // Check if position is within viewport
        if (
          snap.position.x >= 0 &&
          snap.position.y >= 0 &&
          snap.position.x + size.width <= viewport.width &&
          snap.position.y + size.height <= viewport.height
        ) {
          // Check if this position doesn't cause collisions
          if (!hasCollisions(snap.position, size)) {
            candidatePositions.push(snap)
          }
        }
      }
    }

    // If no valid snap positions found, try browser edges
    if (candidatePositions.length === 0) {
      const browserSnapPositions = [
        { position: { x: 0, y: position.y }, distance: position.x, snapType: 'browser-left' },
        { position: { x: viewport.width - size.width, y: position.y }, distance: viewport.width - (position.x + size.width), snapType: 'browser-right' },
        { position: { x: position.x, y: 0 }, distance: position.y, snapType: 'browser-top' },
        { position: { x: position.x, y: viewport.height - size.height }, distance: viewport.height - (position.y + size.height), snapType: 'browser-bottom' }
      ]

      for (const snap of browserSnapPositions) {
        if (!hasCollisions(snap.position, size)) {
          candidatePositions.push(snap)
        }
      }
    }

    // Return the closest valid snap position
    if (candidatePositions.length > 0) {
      candidatePositions.sort((a, b) => a.distance - b.distance)
      return candidatePositions[0].position
    }

    // If still no valid position, constrain to viewport (last resort)
    return {
      x: Math.max(0, Math.min(position.x, viewport.width - size.width)),
      y: Math.max(0, Math.min(position.y, viewport.height - size.height))
    }
  }, [hasCollisions, viewport, otherPanels, getEffectivePanelSize, snapGap])

  // Generate snap guides for visual feedback
  const generateSnapGuides = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): SnapGuide[] => {
    const guides: SnapGuide[] = []
    const rect = { ...position, ...size }

    // Browser edge guides (using unified threshold)
    if (Math.abs(position.x) <= snapThreshold) {
      guides.push({
        type: 'vertical',
        position: 0,
        start: 0,
        end: viewport.height,
        isActive: true,
        snapType: 'browser'
      })
    }

    if (Math.abs(viewport.width - (position.x + size.width)) <= snapThreshold) {
      guides.push({
        type: 'vertical',
        position: viewport.width,
        start: 0,
        end: viewport.height,
        isActive: true,
        snapType: 'browser'
      })
    }

    if (Math.abs(position.y) <= snapThreshold) {
      guides.push({
        type: 'horizontal',
        position: 0,
        start: 0,
        end: viewport.width,
        isActive: true,
        snapType: 'browser'
      })
    }

    if (Math.abs(viewport.height - (position.y + size.height)) <= snapThreshold) {
      guides.push({
        type: 'horizontal',
        position: viewport.height,
        start: 0,
        end: viewport.width,
        isActive: true,
        snapType: 'browser'
      })
    }

    // Panel edge guides (using effective sizes for collapsed panels)
    for (const panel of otherPanels) {
      const effectiveSize = getEffectivePanelSize(panel)
      const panelRect = {
        x: panel.position.x,
        y: panel.position.y,
        width: effectiveSize.width,
        height: effectiveSize.height
      }

      // Check for potential snap to panel edges
      const horizontalOverlap = !(rect.x + rect.width < panelRect.x || rect.x > panelRect.x + panelRect.width)
      const verticalOverlap = !(rect.y + rect.height < panelRect.y || rect.y > panelRect.y + panelRect.height)

      if (horizontalOverlap) {
        // const snapIntent = getSnapIntent(panel, mousePosition)

        // Snap to top edge (dragging panel will be above target)
        if (Math.abs((rect.y + rect.height) - panelRect.y) <= snapThreshold) {
          guides.push({
            type: 'horizontal',
            position: panelRect.y,
            start: Math.min(rect.x, panelRect.x),
            end: Math.max(rect.x + rect.width, panelRect.x + panelRect.width),
            isActive: true,
            snapType: 'top',
            targetPanelId: panel.id
          })
        }

        // Snap to bottom edge (dragging panel will be below target)
        if (Math.abs(rect.y - (panelRect.y + panelRect.height)) <= snapThreshold) {
          guides.push({
            type: 'horizontal',
            position: panelRect.y + panelRect.height,
            start: Math.min(rect.x, panelRect.x),
            end: Math.max(rect.x + rect.width, panelRect.x + panelRect.width),
            isActive: true,
            snapType: 'bottom',
            targetPanelId: panel.id
          })
        }
      }

      if (verticalOverlap) {
        // Snap to left edge
        if (Math.abs((rect.x + rect.width) - panelRect.x) <= snapThreshold) {
          guides.push({
            type: 'vertical',
            position: panelRect.x,
            start: Math.min(rect.y, panelRect.y),
            end: Math.max(rect.y + rect.height, panelRect.y + panelRect.height),
            isActive: true,
            snapType: 'left',
            targetPanelId: panel.id
          })
        }

        // Snap to right edge
        if (Math.abs(rect.x - (panelRect.x + panelRect.width)) <= snapThreshold) {
          guides.push({
            type: 'vertical',
            position: panelRect.x + panelRect.width,
            start: Math.min(rect.y, panelRect.y),
            end: Math.max(rect.y + rect.height, panelRect.y + panelRect.height),
            isActive: true,
            snapType: 'right',
            targetPanelId: panel.id
          })
        }
      }
    }

    return guides
  }, [otherPanels, snapThreshold, viewport, getEffectivePanelSize])

  // Enhanced collision-aware magnetic attraction
  const calculateMagneticAttraction = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): { targetPosition: PanelPosition; strength: number; type: 'browser' | 'panel' } | null => {
    if (!enableMagneticSnap) return null

    let closestTarget: { targetPosition: PanelPosition; strength: number; type: 'browser' | 'panel' } | null = null
    let minDistance = magneticThreshold

    // Check browser edge attraction
    const panelLeft = position.x
    const panelRight = position.x + size.width
    const panelTop = position.y
    const panelBottom = position.y + size.height

    // Left edge
    const leftDist = Math.abs(panelLeft)
    if (leftDist < minDistance) {
      const targetPosition = { x: 0, y: position.y }
      // Ensure browser snap doesn't cause collisions
      if (!hasCollisions(targetPosition, size)) {
        minDistance = leftDist
        closestTarget = {
          targetPosition,
          strength: 1 - leftDist / magneticThreshold,
          type: 'browser'
        }
      }
    }

    // Right edge
    const rightDist = Math.abs(viewport.width - panelRight)
    if (rightDist < minDistance) {
      const targetPosition = { x: viewport.width - size.width, y: position.y }
      if (!hasCollisions(targetPosition, size)) {
        minDistance = rightDist
        closestTarget = {
          targetPosition,
          strength: 1 - rightDist / magneticThreshold,
          type: 'browser'
        }
      }
    }

    // Top edge
    const topDist = Math.abs(panelTop)
    if (topDist < minDistance) {
      const targetPosition = { x: position.x, y: 0 }
      if (!hasCollisions(targetPosition, size)) {
        minDistance = topDist
        closestTarget = {
          targetPosition,
          strength: 1 - topDist / magneticThreshold,
          type: 'browser'
        }
      }
    }

    // Bottom edge
    const bottomDist = Math.abs(viewport.height - panelBottom)
    if (bottomDist < minDistance) {
      const targetPosition = { x: position.x, y: viewport.height - size.height }
      if (!hasCollisions(targetPosition, size)) {
        minDistance = bottomDist
        closestTarget = {
          targetPosition,
          strength: 1 - bottomDist / magneticThreshold,
          type: 'browser'
        }
      }
    }

    // Enhanced panel attraction with collision prevention
    for (const otherPanel of otherPanels) {
      const effectiveSize = getEffectivePanelSize(otherPanel)
      const otherLeft = otherPanel.position.x
      const otherRight = otherPanel.position.x + effectiveSize.width
      const otherTop = otherPanel.position.y
      const otherBottom = otherPanel.position.y + effectiveSize.height

      // Calculate all potential snap positions around this panel
      const snapPositions = [
        // Above the panel
        {
          position: { x: otherLeft, y: otherTop - size.height - snapGap },
          distance: Math.abs(panelBottom - otherTop),
          type: 'above' as const
        },
        // Below the panel
        {
          position: { x: otherLeft, y: otherBottom + snapGap },
          distance: Math.abs(panelTop - otherBottom),
          type: 'below' as const
        },
        // Left of the panel
        {
          position: { x: otherLeft - size.width - snapGap, y: otherTop },
          distance: Math.abs(panelRight - otherLeft),
          type: 'left' as const
        },
        // Right of the panel
        {
          position: { x: otherRight + snapGap, y: otherTop },
          distance: Math.abs(panelLeft - otherRight),
          type: 'right' as const
        }
      ]

      // Check if panel is overlapping or very close to this panel
      const isOverlapping = !(panelRight < otherLeft || panelLeft > otherRight ||
                             panelBottom < otherTop || panelTop > otherBottom)
      const isCenterClose = Math.abs((panelLeft + size.width/2) - (otherLeft + effectiveSize.width/2)) < magneticThreshold &&
                           Math.abs((panelTop + size.height/2) - (otherTop + effectiveSize.height/2)) < magneticThreshold

      if (isOverlapping) {
        // Panel is overlapping - find closest edge snap position
        const validSnapPositions = snapPositions.filter(snap =>
          snap.position.x >= 0 && snap.position.y >= 0 &&
          snap.position.x + size.width <= viewport.width &&
          snap.position.y + size.height <= viewport.height &&
          !hasCollisions(snap.position, size)
        )

        if (validSnapPositions.length > 0) {
          // Sort by distance and take the closest
          validSnapPositions.sort((a, b) => a.distance - b.distance)
          const bestSnap = validSnapPositions[0]

          minDistance = bestSnap.distance
          closestTarget = {
            targetPosition: bestSnap.position,
            strength: 1.0, // Max strength when overlapping to force snap
            type: 'panel'
          }
        }
      } else if (isCenterClose) {
        // Panel is very close - use normal magnetic attraction
        snapPositions.forEach(snap => {
          if (snap.distance < minDistance) {
            // Ensure the snap position is valid (no collisions, within viewport)
            if (snap.position.x >= 0 && snap.position.y >= 0 &&
                snap.position.x + size.width <= viewport.width &&
                snap.position.y + size.height <= viewport.height &&
                !hasCollisions(snap.position, size)) {

              minDistance = snap.distance
              closestTarget = {
                targetPosition: snap.position,
                strength: 1 - snap.distance / magneticThreshold,
                type: 'panel'
              }
            }
          }
        })
      } else {
        // Normal edge-based snapping
        const horizontalOverlap = !(panelRight < otherLeft || panelLeft > otherRight)
        const verticalOverlap = !(panelBottom < otherTop || panelTop > otherBottom)

        if (horizontalOverlap) {
          // Check top/bottom snapping
          snapPositions.slice(0, 2).forEach(snap => {
            if (snap.distance < minDistance &&
                !hasCollisions(snap.position, size) &&
                snap.position.x >= 0 && snap.position.y >= 0 &&
                snap.position.x + size.width <= viewport.width &&
                snap.position.y + size.height <= viewport.height) {

              minDistance = snap.distance
              closestTarget = {
                targetPosition: snap.position,
                strength: 1 - snap.distance / magneticThreshold,
                type: 'panel'
              }
            }
          })
        }

        if (verticalOverlap) {
          // Check left/right snapping
          snapPositions.slice(2, 4).forEach(snap => {
            if (snap.distance < minDistance &&
                !hasCollisions(snap.position, size) &&
                snap.position.x >= 0 && snap.position.y >= 0 &&
                snap.position.x + size.width <= viewport.width &&
                snap.position.y + size.height <= viewport.height) {

              minDistance = snap.distance
              closestTarget = {
                targetPosition: snap.position,
                strength: 1 - snap.distance / magneticThreshold,
                type: 'panel'
              }
            }
          })
        }
      }
    }

    return closestTarget
  }, [enableMagneticSnap, magneticThreshold, viewport, otherPanels, getEffectivePanelSize, snapGap, hasCollisions])

  const detectSnapping = useCallback((
    position: PanelPosition,
    size: PanelSize,
    isRealTime = false
  ): SnapResult => {
    // Generate snap guides for visual feedback
    const snapGuides = generateSnapGuides(position, size)

    // Check for swap scenarios first (highest priority)
    const swapCandidate = !isRealTime ? detectSwapScenario(position, size) : null

    // If we have a valid swap scenario, return it
    if (swapCandidate) {
      return {
        position: swapCandidate.targetPosition,
        snappedToBrowser: [],
        snappedToPanels: [],
        hasCollision: false,
        snapGuides,
        magneticAttraction: {
          targetPosition: swapCandidate.targetPosition,
          strength: 1.0, // Max strength for swap operations
          type: 'panel'
        },
        swapCandidate
      }
    }

    // Check for collisions
    const hasCollision = hasCollisions(position, size)

    // Get magnetic attraction (this is now our primary snapping logic)
    const magneticAttraction = calculateMagneticAttraction(position, size)

    // ALWAYS prevent overlaps - this is the key fix
    let finalPosition = position
    let snappedToBrowser: ('top' | 'bottom' | 'left' | 'right')[] = []
    let snappedToPanels: Array<{
      panelId: PanelId
      edge: 'top' | 'bottom' | 'left' | 'right'
    }> = []

    // If we have any collision OR magnetic attraction, resolve it
    if (hasCollision || (magneticAttraction && magneticAttraction.strength > 0.3)) {
      if (magneticAttraction && magneticAttraction.strength > 0.3) {
        // Use magnetic attraction position if available
        finalPosition = magneticAttraction.targetPosition

        // Determine what we snapped to
        if (magneticAttraction.type === 'browser') {
          // Determine browser edge based on snap position
          if (Math.abs(finalPosition.x - 0) < 5) snappedToBrowser.push('left')
          if (Math.abs(finalPosition.x - (viewport.width - size.width)) < 5) snappedToBrowser.push('right')
          if (Math.abs(finalPosition.y - 0) < 5) snappedToBrowser.push('top')
          if (Math.abs(finalPosition.y - (viewport.height - size.height)) < 5) snappedToBrowser.push('bottom')
        } else {
          // Panel-to-panel snapping - find which panel and edge
          for (const otherPanel of otherPanels) {
            const effectiveSize = getEffectivePanelSize(otherPanel)
            const otherTop = otherPanel.position.y
            const otherBottom = otherPanel.position.y + effectiveSize.height
            const otherLeft = otherPanel.position.x
            const otherRight = otherPanel.position.x + effectiveSize.width

            // Check if we snapped above the panel
            if (Math.abs(finalPosition.y - (otherTop - size.height - snapGap)) < 5) {
              snappedToPanels.push({
                panelId: otherPanel.id,
                edge: 'top'
              })
              break
            }
            // Check if we snapped below the panel
            else if (Math.abs(finalPosition.y - (otherBottom + snapGap)) < 5) {
              snappedToPanels.push({
                panelId: otherPanel.id,
                edge: 'bottom'
              })
              break
            }
            // Check if we snapped to the left of the panel
            else if (Math.abs(finalPosition.x - (otherLeft - size.width - snapGap)) < 5) {
              snappedToPanels.push({
                panelId: otherPanel.id,
                edge: 'left'
              })
              break
            }
            // Check if we snapped to the right of the panel
            else if (Math.abs(finalPosition.x - (otherRight + snapGap)) < 5) {
              snappedToPanels.push({
                panelId: otherPanel.id,
                edge: 'right'
              })
              break
            }
          }
        }
      } else if (hasCollision && !isRealTime) {
        // No magnetic attraction but we have collision - snap to nearest panel edge
        finalPosition = findBestEdgeSnapPosition(position, size)
      }
    }

    // Double-check: ensure final position doesn't cause collisions
    if (!isRealTime && hasCollisions(finalPosition, size)) {
      finalPosition = findBestEdgeSnapPosition(finalPosition, size)
    }

    return {
      position: finalPosition,
      snappedToBrowser,
      snappedToPanels,
      hasCollision: hasCollisions(finalPosition, size),
      snapGuides,
      magneticAttraction,
      swapCandidate: null
    }
  }, [otherPanels, viewport, snapGap, generateSnapGuides, hasCollisions, findBestEdgeSnapPosition, getEffectivePanelSize, calculateMagneticAttraction, detectSwapScenario])

  // Get panels that are snapped to a specific panel
  const getPanelsSnappedTo = useCallback((targetPanelId: PanelId): Array<{
    panel: typeof panels[PanelId]
    edge: 'top' | 'bottom' | 'left' | 'right'
  }> => {
    return Object.values(panels)
      .filter(panel => panel.id !== targetPanelId && panel.snapState?.snappedToPanels?.some(snap => snap.panelId === targetPanelId))
      .map(panel => ({
        panel,
        edge: panel.snapState?.snappedToPanels?.find(snap => snap.panelId === targetPanelId)?.edge || 'bottom'
      }))
  }, [panels])

  // Get all panels snapped below a specific panel (recursively)
  const getPanelsBelowRecursive = useCallback((panelId: PanelId): PanelId[] => {
    const result: PanelId[] = []
    const visited = new Set<PanelId>()

    const findBelow = (id: PanelId) => {
      if (visited.has(id)) return
      visited.add(id)

      Object.values(panels).forEach(panel => {
        if (panel.id !== id && panel.snapState?.snappedToPanels?.some(snap =>
          snap.panelId === id && snap.edge === 'bottom'
        )) {
          result.push(panel.id)
          findBelow(panel.id)
        }
      })
    }

    findBelow(panelId)
    return result
  }, [panels])

  return {
    detectSnapping,
    generateSnapGuides,
    hasCollisions,
    findBestEdgeSnapPosition,
    detectSwapScenario,
    getPanelsSnappedTo,
    getPanelsBelowRecursive,
    calculateMagneticAttraction,
    viewport
  }
}

// Export the types for use in other components
export type { SnapGuide, SnapResult, SwapCandidate }