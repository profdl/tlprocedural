import { useEffect, useCallback } from 'react'
import { type Editor } from 'tldraw'
import { type BezierShape, type BezierPoint } from '../BezierShape'
import { getSegmentAtPosition } from '../utils/bezierUtils'
import { BEZIER_THRESHOLDS } from '../utils/bezierConstants'

interface HoverPreviewPoint {
  x: number
  y: number
  cp1?: { x: number; y: number }
  cp2?: { x: number; y: number }
}

interface UseBezierHoverProps {
  shape: BezierShape
  editor: Editor | null
  editMode: boolean
}

/**
 * Custom hook for managing bezier shape hover preview functionality
 * Handles Alt+hover preview for point addition
 */
export function useBezierHover({ shape, editor, editMode }: UseBezierHoverProps) {
  
  const getSegmentAtPositionForHover = useCallback((
    points: BezierPoint[], 
    localPoint: { x: number; y: number }
  ): { segmentIndex: number; t: number } | null => {
    if (!editor) return null
    
    // For hover, we use slightly different thresholds than click detection
    const anchorThreshold = BEZIER_THRESHOLDS.ANCHOR_POINT_HOVER / editor.getZoomLevel()

    // First check if we're near an anchor point - if so, don't show segment hover
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      const distance = Math.sqrt(
        Math.pow(localPoint.x - point.x, 2) + 
        Math.pow(localPoint.y - point.y, 2)
      )
      
      if (distance < anchorThreshold) {
        return null // Don't show segment hover near anchor points
      }
    }

    // Use shared utility for segment detection
    return getSegmentAtPosition(points, localPoint, editor.getZoomLevel(), shape.props.isClosed)
  }, [editor, shape.props.isClosed])

  const updateHoverPreview = useCallback((segmentInfo: { segmentIndex: number; t: number }) => {
    if (!editor) return
    
    const { segmentIndex, t } = segmentInfo
    const points = shape.props.points
    const p1 = points[segmentIndex]
    const p2 = segmentIndex === points.length - 1 && shape.props.isClosed 
      ? points[0] 
      : points[segmentIndex + 1]

    // Lightweight preview - just calculate the point position without control points
    let previewX: number, previewY: number
    
    if (p1.cp2 && p2.cp1) {
      // Cubic bezier
      const x = Math.pow(1-t, 3) * p1.x + 3 * Math.pow(1-t, 2) * t * p1.cp2.x + 3 * (1-t) * Math.pow(t, 2) * p2.cp1.x + Math.pow(t, 3) * p2.x
      const y = Math.pow(1-t, 3) * p1.y + 3 * Math.pow(1-t, 2) * t * p1.cp2.y + 3 * (1-t) * Math.pow(t, 2) * p2.cp1.y + Math.pow(t, 3) * p2.y
      previewX = x
      previewY = y
    } else if (p1.cp2) {
      // Quadratic bezier using p1.cp2
      const x = Math.pow(1-t, 2) * p1.x + 2 * (1-t) * t * p1.cp2.x + Math.pow(t, 2) * p2.x
      const y = Math.pow(1-t, 2) * p1.y + 2 * (1-t) * t * p1.cp2.y + Math.pow(t, 2) * p2.y
      previewX = x
      previewY = y
    } else if (p2.cp1) {
      // Quadratic bezier using p2.cp1
      const x = Math.pow(1-t, 2) * p1.x + 2 * (1-t) * t * p2.cp1.x + Math.pow(t, 2) * p2.x
      const y = Math.pow(1-t, 2) * p1.y + 2 * (1-t) * t * p2.cp1.y + Math.pow(t, 2) * p2.y
      previewX = x
      previewY = y
    } else {
      // Linear interpolation
      previewX = p1.x + (p2.x - p1.x) * t
      previewY = p1.y + (p2.y - p1.y) * t
    }

    // Simple preview point without control points for performance
    const simplePreviewPoint: HoverPreviewPoint = {
      x: previewX,
      y: previewY
    }

    // Get current shape state to preserve selection and other properties
    const currentShape = editor.getShape(shape.id) as BezierShape
    if (!currentShape) return

    editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...currentShape.props,
        hoverPoint: simplePreviewPoint,
        hoverSegmentIndex: segmentIndex
      }
    })
  }, [editor, shape.id, shape.props.points, shape.props.isClosed])

  const clearHoverPreview = useCallback(() => {
    if (!editor || !shape.props.hoverPoint) return
    
    // Get current shape state to preserve selection and other properties
    const currentShape = editor.getShape(shape.id) as BezierShape
    if (!currentShape) return

    editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...currentShape.props,
        hoverPoint: undefined,
        hoverSegmentIndex: undefined
      }
    })
  }, [editor, shape.id, shape.props.hoverPoint])

  // Simplified hover preview - only shows when Alt key is held for point addition
  useEffect(() => {
    if (!editMode || !editor) return
    
    const currentTool = editor.getCurrentToolId()
    if (currentTool !== 'select') {
      clearHoverPreview()
      return
    }

    let animationId: number
    let lastHoverSegment: number | null = null

    const updateHoverPreviewOnMove = () => {
      const currentTool = editor.getCurrentToolId()
      if (currentTool !== 'select') {
        clearHoverPreview()
        return
      }

      // Only show preview when Alt key is held (for point addition)
      if (!editor.inputs.altKey) {
        if (lastHoverSegment !== null) {
          clearHoverPreview()
          lastHoverSegment = null
        }
        animationId = requestAnimationFrame(updateHoverPreviewOnMove)
        return
      }

      // Don't update during active interactions
      if (editor.inputs.isDragging || editor.inputs.isPointing) {
        animationId = requestAnimationFrame(updateHoverPreviewOnMove)
        return
      }

      const pagePoint = editor.inputs.currentPagePoint
      if (!pagePoint) {
        animationId = requestAnimationFrame(updateHoverPreviewOnMove)
        return
      }

      const shapePageBounds = editor.getShapePageBounds(shape.id)
      if (!shapePageBounds) {
        animationId = requestAnimationFrame(updateHoverPreviewOnMove)
        return
      }

      const localPoint = {
        x: pagePoint.x - shapePageBounds.x,
        y: pagePoint.y - shapePageBounds.y
      }

      const segmentInfo = getSegmentAtPositionForHover(shape.props.points, localPoint)
      if (segmentInfo) {
        // Always update preview when Alt is held - both segment changes and position changes along same segment
        updateHoverPreview(segmentInfo)
        lastHoverSegment = segmentInfo.segmentIndex
      } else {
        if (lastHoverSegment !== null) {
          clearHoverPreview()
          lastHoverSegment = null
        }
      }

      if (editMode && currentTool === 'select') {
        animationId = requestAnimationFrame(updateHoverPreviewOnMove)
      }
    }

    animationId = requestAnimationFrame(updateHoverPreviewOnMove)

    return () => {
      cancelAnimationFrame(animationId)
      clearHoverPreview()
    }
  }, [
    editMode, 
    editor, 
    shape.id, 
    shape.props.points, 
    getSegmentAtPositionForHover, 
    updateHoverPreview, 
    clearHoverPreview
  ])

  // Return any utilities that might be needed by the component
  return {
    // Currently no return values needed, but we could expose utilities here if needed
  }
}