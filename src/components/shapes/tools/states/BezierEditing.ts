import {
  StateNode,
  type TLPointerEventInfo,
  type TLKeyboardEventInfo,
  type TLShapeId,
} from 'tldraw'
import { type BezierShape } from '../../BezierShape'
import { BezierState } from '../../services/BezierState'
import { BezierBounds } from '../../services/BezierBounds'
import { bezierLog } from '../../utils/bezierConstants'

export class BezierEditing extends StateNode {
  static override id = 'editing'

  private targetShapeId?: TLShapeId
  private targetShape?: BezierShape

  override onEnter(info: TLPointerEventInfo & { target: 'shape'; shape: BezierShape }) {
    // Store the shape we're editing
    this.targetShapeId = info.shape.id
    this.targetShape = info.shape
    
    // Ensure the shape is in edit mode
    if (!info.shape.props.editMode) {
      this.editor.updateShape({
        id: info.shape.id,
        type: 'bezier',
        props: {
          ...info.shape.props,
          editMode: true,
        },
      })
    }
  }


  override onPointerDown(info: TLPointerEventInfo) {
    if (!this.targetShape || !this.targetShapeId) {
      return
    }

    const shape = this.editor.getShape(this.targetShapeId!) as BezierShape
    if (!shape || !shape.props.editMode) return

    // Convert page point to local shape coordinates
    const pagePoint = this.editor.inputs.currentPagePoint.clone()
    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return

    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Check if clicking on an existing anchor point - handle selection directly
    const anchorPointIndex = BezierState.getAnchorPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (anchorPointIndex !== -1) {
      bezierLog('Selection', 'BezierEditing detected anchor point click:', anchorPointIndex, 'shiftKey:', this.editor.inputs.shiftKey)
      BezierState.handlePointSelection(shape, anchorPointIndex, this.editor.inputs.shiftKey, this.editor)
      return // Selection handled, don't continue with other logic
    }

    // Check if clicking on a control point (do nothing - let handle system manage it)
    const controlPointInfo = BezierState.getControlPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (controlPointInfo) {
      return // Let TLDraw's handle system manage control points
    }

    // Check for Alt+click to add point on path segment
    if (this.editor.inputs.altKey) {
      const segmentInfo = BezierState.getSegmentAtPosition(shape.props.points, localPoint, this.editor.getZoomLevel(), shape.props.isClosed)
      if (segmentInfo) {
        this.addPointToSegment(shape, segmentInfo)
        return // Point added, don't continue with other logic
      }
    }

    // If clicking elsewhere, clear point selection
    BezierState.clearPointSelection(shape, this.editor)

    // If clicking on canvas (not on shape), delay exit to check if it's a handle drag
    if (info.target === 'canvas') {
      // Small delay to see if this is the start of a handle drag operation
      // If it's a real canvas click, we'll still exit after the delay
      setTimeout(() => {
        // Check if a handle drag is in progress by seeing if the editor is in a drag state
        const isDragging = this.editor.inputs.isDragging
        if (!isDragging) {
          this.exitEditMode()
        }
      }, 10) // Very short delay
      return
    } else {
      // Clicked on shape but not on any interactive element - exit edit mode
      this.exitEditMode()
    }
  }

  override onDoubleClick() {
    if (!this.targetShape || !this.targetShapeId) return

    const shape = this.editor.getShape(this.targetShapeId!) as BezierShape
    if (!shape || !shape.props.editMode) return

    // Convert page point to local shape coordinates
    const pagePoint = this.editor.inputs.currentPagePoint.clone()
    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return

    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Check if double-clicking on an anchor point to toggle its type
    const anchorPointIndex = BezierState.getAnchorPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (anchorPointIndex !== -1) {
      BezierState.togglePointType(shape, anchorPointIndex, this.editor)
    }
  }

  override onKeyDown(info: TLKeyboardEventInfo) {
    switch (info.key) {
      case 'Escape':
        this.exitEditMode()
        break
      case 'Enter':
        this.exitEditMode()
        break
    }
  }





  private addPointToSegment(shape: BezierShape, segmentInfo: { segmentIndex: number; t: number }) {
    const { segmentIndex, t } = segmentInfo
    // Use BezierState service for point addition
    const updatedShape = BezierState.addPointToSegment(shape, segmentIndex, t)
    // Recalculate bounds after addition
    const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)
    
    this.editor.updateShape(finalShape)
    bezierLog('PointAdd', 'New point added at segment', segmentIndex, 'using Alt+click')
  }




  private exitEditMode() {
    if (!this.targetShapeId) {
      return
    }

    // Use BezierState service to exit edit mode
    const shape = this.editor.getShape(this.targetShapeId!) as BezierShape
    if (shape) {
      BezierState.exitEditMode(shape, this.editor)
    }

    // Return to select tool
    this.editor.setCurrentTool('select')
  }

  override onExit() {
    // Clean up
    this.targetShapeId = undefined
    this.targetShape = undefined
  }
}