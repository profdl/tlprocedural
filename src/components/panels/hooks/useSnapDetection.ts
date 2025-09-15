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
}

interface SnapDetectionProps {
  panelId: PanelId
  browserSnapThreshold?: number
  panelSnapThreshold?: number
  snapGap?: number
}

export function useSnapDetection({
  panelId,
  browserSnapThreshold = 20,
  panelSnapThreshold = 15,
  snapGap = 8
}: SnapDetectionProps) {
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

  // Collision detection helper
  const detectCollision = useCallback((rect1: Rectangle, rect2: Rectangle): boolean => {
    return !(
      rect1.x + rect1.width <= rect2.x ||
      rect2.x + rect2.width <= rect1.x ||
      rect1.y + rect1.height <= rect2.y ||
      rect2.y + rect2.height <= rect1.y
    )
  }, [])

  // Check if position would cause collisions
  const hasCollisions = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): boolean => {
    const rect = { ...position, ...size }
    return otherPanels.some(panel =>
      detectCollision(rect, {
        x: panel.position.x,
        y: panel.position.y,
        width: panel.size.width,
        height: panel.size.height
      })
    )
  }, [otherPanels, detectCollision])

  // Find the nearest valid (non-colliding) position
  const findNearestValidPosition = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): PanelPosition => {
    // Check if current position is already valid
    if (!hasCollisions(position, size)) {
      return position
    }

    // Find the closest panel we're colliding with
    const rect = { ...position, ...size }
    let closestPanel = null
    let minDistance = Infinity

    for (const panel of otherPanels) {
      const panelRect = {
        x: panel.position.x,
        y: panel.position.y,
        width: panel.size.width,
        height: panel.size.height
      }

      if (detectCollision(rect, panelRect)) {
        // Calculate distance to panel center
        const distance = Math.sqrt(
          Math.pow(position.x - panel.position.x, 2) +
          Math.pow(position.y - panel.position.y, 2)
        )

        if (distance < minDistance) {
          minDistance = distance
          closestPanel = panel
        }
      }
    }

    if (!closestPanel) return position

    // Calculate potential positions around the closest panel
    const target = closestPanel
    const candidatePositions = [
      // Above
      {
        x: target.position.x,
        y: target.position.y - size.height - snapGap,
        priority: 1 // Prefer vertical stacking
      },
      // Below
      {
        x: target.position.x,
        y: target.position.y + target.size.height + snapGap,
        priority: 1
      },
      // Left
      {
        x: target.position.x - size.width - snapGap,
        y: target.position.y,
        priority: 2
      },
      // Right
      {
        x: target.position.x + target.size.width + snapGap,
        y: target.position.y,
        priority: 2
      }
    ]

    // Sort by priority and distance to original position
    candidatePositions.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority

      const distA = Math.sqrt(Math.pow(a.x - position.x, 2) + Math.pow(a.y - position.y, 2))
      const distB = Math.sqrt(Math.pow(b.x - position.x, 2) + Math.pow(b.y - position.y, 2))
      return distA - distB
    })

    // Find the first valid position
    for (const candidate of candidatePositions) {
      // Check if position is within viewport
      if (
        candidate.x >= 0 &&
        candidate.y >= 0 &&
        candidate.x + size.width <= viewport.width &&
        candidate.y + size.height <= viewport.height
      ) {
        // Check if this position doesn't cause new collisions
        if (!hasCollisions(candidate, size)) {
          return candidate
        }
      }
    }

    // If no valid position found, return constrained to viewport
    return {
      x: Math.max(0, Math.min(position.x, viewport.width - size.width)),
      y: Math.max(0, Math.min(position.y, viewport.height - size.height))
    }
  }, [hasCollisions, otherPanels, detectCollision, snapGap, viewport])

  // Generate snap guides for visual feedback
  const generateSnapGuides = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): SnapGuide[] => {
    const guides: SnapGuide[] = []
    const rect = { ...position, ...size }

    // Browser edge guides
    if (Math.abs(position.x) <= browserSnapThreshold) {
      guides.push({
        type: 'vertical',
        position: 0,
        start: 0,
        end: viewport.height,
        isActive: true
      })
    }

    if (Math.abs(viewport.width - (position.x + size.width)) <= browserSnapThreshold) {
      guides.push({
        type: 'vertical',
        position: viewport.width,
        start: 0,
        end: viewport.height,
        isActive: true
      })
    }

    if (Math.abs(position.y) <= browserSnapThreshold) {
      guides.push({
        type: 'horizontal',
        position: 0,
        start: 0,
        end: viewport.width,
        isActive: true
      })
    }

    if (Math.abs(viewport.height - (position.y + size.height)) <= browserSnapThreshold) {
      guides.push({
        type: 'horizontal',
        position: viewport.height,
        start: 0,
        end: viewport.width,
        isActive: true
      })
    }

    // Panel edge guides
    for (const panel of otherPanels) {
      const panelRect = {
        x: panel.position.x,
        y: panel.position.y,
        width: panel.size.width,
        height: panel.size.height
      }

      // Check for potential snap to panel edges
      const horizontalOverlap = !(rect.x + rect.width < panelRect.x || rect.x > panelRect.x + panelRect.width)
      const verticalOverlap = !(rect.y + rect.height < panelRect.y || rect.y > panelRect.y + panelRect.height)

      if (horizontalOverlap) {
        // Snap to top edge
        if (Math.abs((rect.y + rect.height) - panelRect.y) <= panelSnapThreshold) {
          guides.push({
            type: 'horizontal',
            position: panelRect.y,
            start: Math.min(rect.x, panelRect.x),
            end: Math.max(rect.x + rect.width, panelRect.x + panelRect.width),
            isActive: true
          })
        }

        // Snap to bottom edge
        if (Math.abs(rect.y - (panelRect.y + panelRect.height)) <= panelSnapThreshold) {
          guides.push({
            type: 'horizontal',
            position: panelRect.y + panelRect.height,
            start: Math.min(rect.x, panelRect.x),
            end: Math.max(rect.x + rect.width, panelRect.x + panelRect.width),
            isActive: true
          })
        }
      }

      if (verticalOverlap) {
        // Snap to left edge
        if (Math.abs((rect.x + rect.width) - panelRect.x) <= panelSnapThreshold) {
          guides.push({
            type: 'vertical',
            position: panelRect.x,
            start: Math.min(rect.y, panelRect.y),
            end: Math.max(rect.y + rect.height, panelRect.y + panelRect.height),
            isActive: true
          })
        }

        // Snap to right edge
        if (Math.abs(rect.x - (panelRect.x + panelRect.width)) <= panelSnapThreshold) {
          guides.push({
            type: 'vertical',
            position: panelRect.x + panelRect.width,
            start: Math.min(rect.y, panelRect.y),
            end: Math.max(rect.y + rect.height, panelRect.y + panelRect.height),
            isActive: true
          })
        }
      }
    }

    return guides
  }, [otherPanels, browserSnapThreshold, panelSnapThreshold, viewport])

  const detectSnapping = useCallback((
    position: PanelPosition,
    size: PanelSize,
    isRealTime = false
  ): SnapResult => {
    let snappedPosition = { ...position }
    const snappedToBrowser: ('top' | 'bottom' | 'left' | 'right')[] = []
    const snappedToPanels: Array<{
      panelId: PanelId
      edge: 'top' | 'bottom' | 'left' | 'right'
    }> = []

    // Generate snap guides
    const snapGuides = generateSnapGuides(position, size)

    // Check for collisions first
    const hasCollision = hasCollisions(position, size)

    // If we have a collision, find the nearest valid position
    if (hasCollision && !isRealTime) {
      snappedPosition = findNearestValidPosition(position, size)
      return {
        position: snappedPosition,
        snappedToBrowser,
        snappedToPanels,
        hasCollision: true,
        snapGuides
      }
    }

    // Panel bounds
    const panelLeft = position.x
    const panelRight = position.x + size.width
    const panelTop = position.y
    const panelBottom = position.y + size.height

    // Browser edge snapping (higher priority)
    // Left edge
    if (Math.abs(panelLeft) <= browserSnapThreshold) {
      snappedPosition.x = 0
      snappedToBrowser.push('left')
    }
    // Right edge
    else if (Math.abs(viewport.width - panelRight) <= browserSnapThreshold) {
      snappedPosition.x = viewport.width - size.width
      snappedToBrowser.push('right')
    }

    // Top edge
    if (Math.abs(panelTop) <= browserSnapThreshold) {
      snappedPosition.y = 0
      snappedToBrowser.push('top')
    }
    // Bottom edge
    else if (Math.abs(viewport.height - panelBottom) <= browserSnapThreshold) {
      snappedPosition.y = viewport.height - size.height
      snappedToBrowser.push('bottom')
    }

    // Panel-to-panel snapping (if not snapped to browser edges)
    if (snappedToBrowser.length === 0) {
      for (const otherPanel of otherPanels) {
        const otherLeft = otherPanel.position.x
        const otherRight = otherPanel.position.x + otherPanel.size.width
        const otherTop = otherPanel.position.y
        const otherBottom = otherPanel.position.y + otherPanel.size.height

        // Check horizontal alignment for vertical snapping
        const horizontalOverlap = !(panelRight < otherLeft || panelLeft > otherRight)

        if (horizontalOverlap) {
          // Snap to top of other panel (with gap)
          if (Math.abs(panelBottom - otherTop) <= panelSnapThreshold) {
            snappedPosition.y = otherTop - size.height - snapGap
            snappedToPanels.push({
              panelId: otherPanel.id,
              edge: 'top'
            })
            break
          }
          // Snap to bottom of other panel (with gap)
          else if (Math.abs(panelTop - otherBottom) <= panelSnapThreshold) {
            snappedPosition.y = otherBottom + snapGap
            snappedToPanels.push({
              panelId: otherPanel.id,
              edge: 'bottom'
            })
            break
          }
        }

        // Check vertical alignment for horizontal snapping
        const verticalOverlap = !(panelBottom < otherTop || panelTop > otherBottom)

        if (verticalOverlap) {
          // Snap to left of other panel (with gap)
          if (Math.abs(panelRight - otherLeft) <= panelSnapThreshold) {
            snappedPosition.x = otherLeft - size.width - snapGap
            snappedToPanels.push({
              panelId: otherPanel.id,
              edge: 'left'
            })
            break
          }
          // Snap to right of other panel (with gap)
          else if (Math.abs(panelLeft - otherRight) <= panelSnapThreshold) {
            snappedPosition.x = otherRight + snapGap
            snappedToPanels.push({
              panelId: otherPanel.id,
              edge: 'right'
            })
            break
          }
        }
      }
    }

    return {
      position: snappedPosition,
      snappedToBrowser,
      snappedToPanels,
      hasCollision,
      snapGuides
    }
  }, [otherPanels, viewport, browserSnapThreshold, panelSnapThreshold, snapGap, generateSnapGuides, hasCollisions, findNearestValidPosition])

  return {
    detectSnapping,
    generateSnapGuides,
    hasCollisions,
    findNearestValidPosition,
    viewport
  }
}

// Export the types for use in other components
export type { SnapGuide, SnapResult }