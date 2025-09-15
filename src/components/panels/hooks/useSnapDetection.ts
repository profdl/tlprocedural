import { useCallback, useMemo } from 'react'
import { usePanelStore, type PanelId, type PanelPosition, type PanelSize } from '../../../store/panelStore'

interface SnapResult {
  position: PanelPosition
  snappedToBrowser: ('top' | 'bottom' | 'left' | 'right')[]
  snappedToPanels: Array<{
    panelId: PanelId
    edge: 'top' | 'bottom' | 'left' | 'right'
  }>
}

interface SnapDetectionProps {
  panelId: PanelId
  browserSnapThreshold?: number
  panelSnapThreshold?: number
}

export function useSnapDetection({
  panelId,
  browserSnapThreshold = 20,
  panelSnapThreshold = 15
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

  const detectSnapping = useCallback((
    position: PanelPosition,
    size: PanelSize
  ): SnapResult => {
    let snappedPosition = { ...position }
    const snappedToBrowser: ('top' | 'bottom' | 'left' | 'right')[] = []
    const snappedToPanels: Array<{
      panelId: PanelId
      edge: 'top' | 'bottom' | 'left' | 'right'
    }> = []

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
          // Snap to top of other panel
          if (Math.abs(panelBottom - otherTop) <= panelSnapThreshold) {
            snappedPosition.y = otherTop - size.height
            snappedToPanels.push({
              panelId: otherPanel.id,
              edge: 'top'
            })
          }
          // Snap to bottom of other panel
          else if (Math.abs(panelTop - otherBottom) <= panelSnapThreshold) {
            snappedPosition.y = otherBottom
            snappedToPanels.push({
              panelId: otherPanel.id,
              edge: 'bottom'
            })
          }
        }

        // Check vertical alignment for horizontal snapping
        const verticalOverlap = !(panelBottom < otherTop || panelTop > otherBottom)

        if (verticalOverlap) {
          // Snap to left of other panel
          if (Math.abs(panelRight - otherLeft) <= panelSnapThreshold) {
            snappedPosition.x = otherLeft - size.width
            snappedToPanels.push({
              panelId: otherPanel.id,
              edge: 'left'
            })
          }
          // Snap to right of other panel
          else if (Math.abs(panelLeft - otherRight) <= panelSnapThreshold) {
            snappedPosition.x = otherRight
            snappedToPanels.push({
              panelId: otherPanel.id,
              edge: 'right'
            })
          }
        }
      }
    }

    return {
      position: snappedPosition,
      snappedToBrowser,
      snappedToPanels
    }
  }, [otherPanels, viewport, browserSnapThreshold, panelSnapThreshold])

  return {
    detectSnapping,
    viewport
  }
}