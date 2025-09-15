import { useCallback, useMemo } from 'react'
import { type PanelPosition, type PanelSize } from '../../../store/panelStore'

interface PanelConstraints {
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}

interface ViewportBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export function usePanelConstraints() {
  // Get viewport dimensions
  const viewport = useMemo(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }), [])

  // Calculate viewport bounds with padding
  const getViewportBounds = useCallback((padding = 0): ViewportBounds => ({
    left: padding,
    top: padding,
    right: viewport.width - padding,
    bottom: viewport.height - padding
  }), [viewport])

  // Constrain position to viewport bounds
  const constrainPosition = useCallback((
    position: PanelPosition,
    size: PanelSize,
    padding = 0
  ): PanelPosition => {
    const bounds = getViewportBounds(padding)

    return {
      x: Math.max(bounds.left, Math.min(position.x, bounds.right - size.width)),
      y: Math.max(bounds.top, Math.min(position.y, bounds.bottom - size.height))
    }
  }, [getViewportBounds])

  // Constrain size to viewport and panel constraints
  const constrainSize = useCallback((
    size: PanelSize,
    position: PanelPosition,
    constraints: PanelConstraints,
    padding = 0
  ): PanelSize => {
    const bounds = getViewportBounds(padding)

    // Maximum size based on viewport and position
    const maxWidthFromViewport = bounds.right - position.x
    const maxHeightFromViewport = bounds.bottom - position.y

    return {
      width: Math.max(
        constraints.minWidth,
        Math.min(size.width, constraints.maxWidth, maxWidthFromViewport)
      ),
      height: Math.max(
        constraints.minHeight,
        Math.min(size.height, constraints.maxHeight, maxHeightFromViewport)
      )
    }
  }, [getViewportBounds])

  // Get default constraints for different panel types
  const getDefaultConstraints = useCallback((panelType: 'properties' | 'style' | 'modifiers'): PanelConstraints => {
    const baseConstraints: PanelConstraints = {
      minWidth: 280,
      minHeight: 100,
      maxWidth: 600,
      maxHeight: viewport.height - 40
    }

    switch (panelType) {
      case 'properties':
        return {
          ...baseConstraints,
          minHeight: 150,
          maxHeight: 400
        }

      case 'style':
        return {
          ...baseConstraints,
          minHeight: 200,
          maxHeight: 500
        }

      case 'modifiers':
        return {
          ...baseConstraints,
          minHeight: 250,
          maxHeight: viewport.height - 40 // Modifiers panel can be tallest
        }

      default:
        return baseConstraints
    }
  }, [viewport.height])

  // Handle window resize to reposition panels
  const repositionOnResize = useCallback((
    panels: Record<string, { position: PanelPosition; size: PanelSize }>,
    newViewport: { width: number; height: number }
  ): Record<string, { position: PanelPosition; size: PanelSize }> => {
    const repositioned: Record<string, { position: PanelPosition; size: PanelSize }> = {}

    Object.entries(panels).forEach(([id, panel]) => {
      // Constrain position to new viewport
      const constrainedPosition = {
        x: Math.max(0, Math.min(panel.position.x, newViewport.width - panel.size.width)),
        y: Math.max(0, Math.min(panel.position.y, newViewport.height - panel.size.height))
      }

      // Constrain size to new viewport
      const constrainedSize = {
        width: Math.min(panel.size.width, newViewport.width - constrainedPosition.x),
        height: Math.min(panel.size.height, newViewport.height - constrainedPosition.y)
      }

      repositioned[id] = {
        position: constrainedPosition,
        size: constrainedSize
      }
    })

    return repositioned
  }, [])

  return {
    viewport,
    getViewportBounds,
    constrainPosition,
    constrainSize,
    getDefaultConstraints,
    repositionOnResize
  }
}