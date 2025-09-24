import { useEffect, useRef, useCallback } from 'react'
import { usePanelStore, type PanelId } from '../../../store/panelStore'

interface UseDynamicPanelHeightOptions {
  panelId: PanelId
  minHeight?: number
  padding?: number
}

/**
 * Hook to measure and update panel content height dynamically
 * Automatically updates the panel store when content height changes
 */
export function useDynamicPanelHeight({
  panelId,
  minHeight = 60,
  padding = 16
}: UseDynamicPanelHeightOptions) {
  const contentRef = useRef<HTMLDivElement>(null)
  const { setPanelContentHeight } = usePanelStore()
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const measureAndUpdateHeight = useCallback(() => {
    if (!contentRef.current) return

    // Get the actual content height
    const contentElement = contentRef.current
    const contentHeight = contentElement.scrollHeight + padding

    // Apply minimum height constraint
    const finalHeight = Math.max(contentHeight, minHeight)

    // Update the panel store with the new height
    setPanelContentHeight(panelId, finalHeight)
  }, [panelId, setPanelContentHeight, minHeight, padding])

  useEffect(() => {
    if (!contentRef.current) return

    // Create ResizeObserver to watch for content changes
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use requestAnimationFrame to avoid layout thrashing
        requestAnimationFrame(measureAndUpdateHeight)
      }
    })

    // Start observing the content element
    resizeObserverRef.current.observe(contentRef.current)

    // Measure initial height
    measureAndUpdateHeight()

    // Cleanup on unmount
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
    }
  }, [measureAndUpdateHeight])

  return {
    contentRef,
    measureHeight: measureAndUpdateHeight
  }
}