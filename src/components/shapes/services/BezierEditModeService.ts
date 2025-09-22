import { type Editor } from 'tldraw'
import { type BezierPoint, type BezierShape } from '../BezierShape'
import { BezierState } from './BezierState'
import { BezierBounds } from './BezierBounds'
import { bezierLog } from '../utils/bezierConstants'

/**
 * Service for managing global bezier edit mode interactions
 * Extracted from TldrawCanvas.tsx for better organization and maintainability
 */
export class BezierEditModeService {
  private editor: Editor
  private lastClickTime = 0
  private lastClickPosition = { x: 0, y: 0 }
  private readonly DOUBLE_CLICK_THRESHOLD = 300 // ms
  private readonly DOUBLE_CLICK_DISTANCE = 5 // pixels
  private cleanupFunctions: (() => void)[] = []

  constructor(editor: Editor) {
    this.editor = editor
    this.initialize()
  }

  /**
   * Initialize the service with event listeners
   */
  private initialize() {
    const container = this.editor.getContainer()

    const handlePointerDown = (e: PointerEvent) => this.handlePointerDown(e)
    const handleKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e)

    container.addEventListener('pointerdown', handlePointerDown, { capture: false })
    container.addEventListener('keydown', handleKeyDown, { capture: false })

    // Store cleanup functions
    this.cleanupFunctions.push(() => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: false })
      container.removeEventListener('keydown', handleKeyDown, { capture: false })
    })

    bezierLog('Service', 'BezierEditModeService initialized')
  }

  /**
   * Handle pointer down events for bezier edit mode
   */
  private handlePointerDown(e: PointerEvent) {
    // Find any bezier shape currently in edit mode
    const editingBezierShape = this.findEditingBezierShape()

    if (!editingBezierShape) {
      return // No shape in edit mode, nothing to do
    }

    // Convert screen coordinates to page coordinates
    const screenPoint = { x: e.clientX, y: e.clientY }
    const pagePoint = this.editor.screenToPage(screenPoint)

    // Check if clicking on the editing shape or its handles
    const shapesAtPointer = this.editor.getShapesAtPoint(pagePoint)
    const clickingOnEditingShape = shapesAtPointer.some(shape => shape.id === editingBezierShape.id)

    // Get interaction context
    const interactionContext = this.getInteractionContext(editingBezierShape, pagePoint)

    // Handle double-click detection
    const isDoubleClick = this.detectDoubleClick(e)

    if (isDoubleClick && interactionContext.clickingOnAnchorPoint) {
      this.handleDoubleClickOnAnchor(editingBezierShape, pagePoint, interactionContext)
      return
    }

    // Handle single click interactions
    if (interactionContext.clickingOnAnchorPoint && !isDoubleClick) {
      this.handleAnchorPointSelection(editingBezierShape, pagePoint, interactionContext, e)
      return
    }

    // Handle point addition via hover preview or direct segment click
    if (clickingOnEditingShape && !interactionContext.clickingOnHandle && !interactionContext.clickingOnAnchorPoint) {
      // Try hover preview first (if available)
      if (this.handleHoverPreviewClick(editingBezierShape, pagePoint)) {
        return // Point was added
      }

      // Try direct segment click if no hover preview
      if (this.handleDirectSegmentClick(editingBezierShape, pagePoint)) {
        return // Point was added
      }

      // Clear point selection if clicking on shape but not on interactive elements
      this.clearPointSelection(editingBezierShape)
      return
    }

    // Exit edit mode if clicking outside shape and handles
    if (!clickingOnEditingShape && !interactionContext.clickingOnHandle) {
      this.exitEditMode(editingBezierShape)
    }
  }

  /**
   * Handle keyboard events for bezier edit mode
   */
  private handleKeyDown(e: KeyboardEvent) {
    const editingBezierShape = this.findEditingBezierShape()
    if (!editingBezierShape) return

    const bezierProps = editingBezierShape.props as {
      editMode?: boolean
      selectedPointIndices?: number[]
      points?: BezierPoint[]
    }

    if (!bezierProps.editMode) return

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        this.handlePointDeletion(editingBezierShape, bezierProps)
        e.preventDefault()
        break
      case 'Escape':
      case 'Enter':
        this.exitEditMode(editingBezierShape)
        break
    }
  }

  /**
   * Find the bezier shape currently in edit mode
   */
  private findEditingBezierShape(): BezierShape | null {
    const allShapes = this.editor.getCurrentPageShapes()
    return allShapes.find(shape =>
      shape.type === 'bezier' && 'editMode' in shape.props && shape.props.editMode
    ) as BezierShape | null
  }

  /**
   * Get interaction context for a point on the bezier shape
   */
  private getInteractionContext(shape: BezierShape, pagePoint: { x: number; y: number }) {
    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) {
      return { clickingOnHandle: false, clickingOnAnchorPoint: false, localPoint: { x: 0, y: 0 }, anchorPointIndex: -1 }
    }

    // Convert to local coordinates
    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    const threshold = 8 / this.editor.getZoomLevel() // 8 pixels at current zoom
    const points = shape.props.points || []

    let clickingOnHandle = false
    let clickingOnAnchorPoint = false
    let anchorPointIndex = -1

    // Check anchor points and control points
    for (let i = 0; i < points.length; i++) {
      const point = points[i]

      // Check anchor point
      const anchorDist = Math.sqrt(
        Math.pow(localPoint.x - point.x, 2) + Math.pow(localPoint.y - point.y, 2)
      )
      if (anchorDist < threshold) {
        clickingOnHandle = true
        clickingOnAnchorPoint = true
        anchorPointIndex = i
        break
      }

      // Check control points
      if (point.cp1) {
        const cp1Dist = Math.sqrt(
          Math.pow(localPoint.x - point.cp1.x, 2) + Math.pow(localPoint.y - point.cp1.y, 2)
        )
        if (cp1Dist < threshold) {
          clickingOnHandle = true
          break
        }
      }
      if (point.cp2) {
        const cp2Dist = Math.sqrt(
          Math.pow(localPoint.x - point.cp2.x, 2) + Math.pow(localPoint.y - point.cp2.y, 2)
        )
        if (cp2Dist < threshold) {
          clickingOnHandle = true
          break
        }
      }
    }

    return { clickingOnHandle, clickingOnAnchorPoint, localPoint, anchorPointIndex }
  }

  /**
   * Detect double-click events
   */
  private detectDoubleClick(e: PointerEvent): boolean {
    const currentTime = Date.now()
    const currentPosition = { x: e.clientX, y: e.clientY }

    const isDoubleClick =
      currentTime - this.lastClickTime < this.DOUBLE_CLICK_THRESHOLD &&
      Math.abs(currentPosition.x - this.lastClickPosition.x) < this.DOUBLE_CLICK_DISTANCE &&
      Math.abs(currentPosition.y - this.lastClickPosition.y) < this.DOUBLE_CLICK_DISTANCE

    this.lastClickTime = currentTime
    this.lastClickPosition = currentPosition

    return isDoubleClick
  }

  /**
   * Handle double-click on anchor point to toggle point type
   */
  private handleDoubleClickOnAnchor(
    shape: BezierShape,
    _pagePoint: { x: number; y: number },
    context: ReturnType<typeof this.getInteractionContext>
  ) {
    if (context.anchorPointIndex === -1) return

    const newPoints = [...shape.props.points]
    const targetPoint = newPoints[context.anchorPointIndex]
    const hasControlPoints = targetPoint.cp1 || targetPoint.cp2

    if (hasControlPoints) {
      // Convert smooth to corner (remove control points)
      newPoints[context.anchorPointIndex] = {
        x: targetPoint.x,
        y: targetPoint.y,
      }
    } else {
      // Convert corner to smooth (add control points)
      const controlOffset = 100
      let cp1: { x: number; y: number } | undefined
      let cp2: { x: number; y: number } | undefined

      // Calculate control points based on neighbors
      const points = shape.props.points
      const i = context.anchorPointIndex
      const prevIndex = i === 0 ? (shape.props.isClosed ? points.length - 1 : -1) : i - 1
      const nextIndex = i === points.length - 1 ? (shape.props.isClosed ? 0 : -1) : i + 1

      if (prevIndex >= 0 && nextIndex >= 0) {
        const prevPoint = points[prevIndex]
        const nextPoint = points[nextIndex]
        const dirX = nextPoint.x - prevPoint.x
        const dirY = nextPoint.y - prevPoint.y
        const length = Math.sqrt(dirX * dirX + dirY * dirY)

        if (length > 0) {
          const normalizedDirX = (dirX / length) * controlOffset
          const normalizedDirY = (dirY / length) * controlOffset

          cp1 = {
            x: targetPoint.x - normalizedDirX * 0.3,
            y: targetPoint.y - normalizedDirY * 0.3,
          }
          cp2 = {
            x: targetPoint.x + normalizedDirX * 0.3,
            y: targetPoint.y + normalizedDirY * 0.3,
          }
        }
      }

      if (!cp1 || !cp2) {
        cp1 = { x: targetPoint.x - controlOffset, y: targetPoint.y }
        cp2 = { x: targetPoint.x + controlOffset, y: targetPoint.y }
      }

      newPoints[context.anchorPointIndex] = {
        x: targetPoint.x,
        y: targetPoint.y,
        cp1,
        cp2,
      }
    }

    // Update the shape
    this.editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...shape.props,
        points: newPoints,
      },
    })

    bezierLog('DoubleClick', 'Toggled point type for anchor', context.anchorPointIndex)
  }

  /**
   * Handle anchor point selection with shift key support
   */
  private handleAnchorPointSelection(
    shape: BezierShape,
    _pagePoint: { x: number; y: number },
    context: ReturnType<typeof this.getInteractionContext>,
    e: PointerEvent
  ) {
    if (context.anchorPointIndex === -1) return

    const currentSelected = shape.props.selectedPointIndices || []
    let newSelected: number[]

    if (e.shiftKey) {
      // Shift-click: toggle selection
      if (currentSelected.includes(context.anchorPointIndex)) {
        newSelected = currentSelected.filter(idx => idx !== context.anchorPointIndex)
      } else {
        newSelected = [...currentSelected, context.anchorPointIndex]
      }
    } else {
      // Regular click: select only this point
      newSelected = [context.anchorPointIndex]
    }

    // Update the shape with new selection
    this.editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...shape.props,
        selectedPointIndices: newSelected
      }
    })

    bezierLog('Selection', 'Updated point selection:', newSelected)
  }

  /**
   * Handle clicking on hover preview to add points
   */
  private handleHoverPreviewClick(shape: BezierShape, pagePoint: { x: number; y: number }): boolean {
    const hoverPoint = shape.props.hoverPoint
    const hoverSegmentIndex = shape.props.hoverSegmentIndex

    if (!hoverPoint || typeof hoverSegmentIndex !== 'number') {
      return false
    }

    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return false

    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Check if clicking near the hover preview point
    const distanceToHoverPoint = Math.sqrt(
      Math.pow(localPoint.x - hoverPoint.x, 2) +
      Math.pow(localPoint.y - hoverPoint.y, 2)
    )

    const clickThreshold = 12 / this.editor.getZoomLevel()

    if (distanceToHoverPoint < clickThreshold) {
      this.addPointAtHoverPreview(shape, hoverPoint, hoverSegmentIndex)
      return true
    }

    return false
  }

  /**
   * Handle direct clicking on path segments to add points
   */
  private handleDirectSegmentClick(shape: BezierShape, pagePoint: { x: number; y: number }): boolean {
    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return false

    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Use BezierState service to find segment at position
    const segmentInfo = BezierState.getSegmentAtPosition(
      shape.props.points,
      localPoint,
      this.editor.getZoomLevel(),
      shape.props.isClosed
    )

    if (segmentInfo) {
      // Add point using BezierState service
      const updatedShape = BezierState.addPointToSegment(shape, segmentInfo.segmentIndex, segmentInfo.t)
      // Recalculate bounds after addition
      const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)

      this.editor.updateShape(finalShape)
      bezierLog('PointAdd', 'Added point at segment', segmentInfo.segmentIndex, 'using direct click')
      return true
    }

    return false
  }

  /**
   * Add a point at the hover preview location
   */
  private addPointAtHoverPreview(shape: BezierShape, hoverPoint: BezierPoint, segmentIndex: number) {
    const newPoints = [...shape.props.points]

    // Insert the new point
    const insertIndex = segmentIndex + 1
    if (segmentIndex === newPoints.length - 1 && shape.props.isClosed) {
      newPoints.push(hoverPoint)
    } else {
      newPoints.splice(insertIndex, 0, hoverPoint)
    }

    // Recalculate bounds using BezierBounds service
    const updatedShape = { ...shape, props: { ...shape.props, points: newPoints } }
    const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, newPoints)

    // Update shape and clear hover preview
    this.editor.updateShape({
      ...finalShape,
      props: {
        ...finalShape.props,
        hoverPoint: undefined,
        hoverSegmentIndex: undefined
      }
    })

    bezierLog('PointAdd', 'Added point at hover preview, segment:', segmentIndex)
  }

  /**
   * Clear point selection
   */
  private clearPointSelection(shape: BezierShape) {
    const hasSelection = shape.props.selectedPointIndices && shape.props.selectedPointIndices.length > 0
    if (hasSelection) {
      this.editor.updateShape({
        id: shape.id,
        type: 'bezier',
        props: {
          ...shape.props,
          selectedPointIndices: []
        },
      })
    }
  }

  /**
   * Handle point deletion via keyboard
   */
  private handlePointDeletion(shape: BezierShape, props: { selectedPointIndices?: number[]; points?: BezierPoint[] }) {
    const selectedIndices = props.selectedPointIndices || []
    const currentPoints = props.points || []

    if (selectedIndices.length === 0) return

    // Don't allow deletion if it would leave less than 2 points
    if (currentPoints.length - selectedIndices.length < 2) {
      return
    }

    // Use BezierState service for point deletion
    const updatedShape = BezierState.deleteSelectedPoints(shape)
    // Recalculate bounds after deletion
    const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)

    this.editor.updateShape(finalShape)

    bezierLog('Delete', 'Deleted selected points:', selectedIndices)
  }

  /**
   * Exit edit mode for the shape
   */
  private exitEditMode(shape: BezierShape) {
    this.editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...shape.props,
        editMode: false,
        selectedPointIndices: []
      },
    })

    // Select the shape to show transform controls
    this.editor.setSelectedShapes([shape.id])

    bezierLog('EditMode', 'Exited edit mode for shape:', shape.id)
  }

  /**
   * Cleanup the service and remove event listeners
   */
  destroy() {
    this.cleanupFunctions.forEach(cleanup => cleanup())
    this.cleanupFunctions = []
    bezierLog('Service', 'BezierEditModeService destroyed')
  }
}