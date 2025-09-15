import { useLayoutEffect, useRef, useState, useCallback } from 'react'

interface UseContentHeightOptions {
  minHeight?: number
  maxHeight?: number
  headerHeight?: number
  padding?: number
}

/**
 * Hook to measure and track the actual content height of a panel
 * Uses ResizeObserver to dynamically adjust to content changes
 */
export function useContentHeight(options: UseContentHeightOptions = {}) {
  const {
    minHeight = 100,
    maxHeight = 800,
    headerHeight = 32,
    padding = 16 // 8px top + 8px bottom
  } = options

  const contentRef = useRef<HTMLDivElement>(null)
  const [measuredHeight, setMeasuredHeight] = useState<number>(minHeight)
  const lastMeasuredHeight = useRef<number>(minHeight)

  const measureContent = useCallback(() => {
    const element = contentRef.current
    if (!element) return

    const contentHeight = element.scrollHeight
    const totalHeight = contentHeight + headerHeight + padding
    const clampedHeight = Math.max(minHeight, Math.min(maxHeight, totalHeight))

    // Only update if height changed by more than 1px to avoid micro-adjustments
    if (Math.abs(clampedHeight - lastMeasuredHeight.current) > 1) {
      lastMeasuredHeight.current = clampedHeight
      setMeasuredHeight(clampedHeight)
    }
  }, [minHeight, maxHeight, headerHeight, padding])

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return

    // Initial measurement
    measureContent()

    // Set up ResizeObserver to watch for content changes
    const resizeObserver = new ResizeObserver(() => {
      measureContent()
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [measureContent])

  return {
    contentRef,
    measuredHeight,
    isReady: measuredHeight > 0
  }
}