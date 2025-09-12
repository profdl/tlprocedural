import { 
  StateNode, 
  type TLPointerEventInfo, 
  type TLClickEventInfo,
  type TLKeyboardEventInfo,
} from 'tldraw'
import { type BezierShape, type BezierPoint } from '../../BezierShape'
import { 
  splitSegmentAtT, 
  getAccurateBounds,
  getAnchorPointAt,
  getControlPointAt,
  getSegmentAtPosition,
  handlePointSelection
} from '../../utils/bezierUtils'
import { BEZIER_HANDLES, bezierLog } from '../../utils/bezierConstants'

export class BezierEditing extends StateNode {
  static override id = 'editing'

  private targetShapeId?: string
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

    const shape = this.editor.getShape(this.targetShapeId as any) as BezierShape
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
    const anchorPointIndex = getAnchorPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (anchorPointIndex !== -1) {
      bezierLog('Selection', 'BezierEditing detected anchor point click:', anchorPointIndex, 'shiftKey:', this.editor.inputs.shiftKey)
      const updatedShape = handlePointSelection(shape, anchorPointIndex, this.editor.inputs.shiftKey)
      this.editor.updateShape({
        ...updatedShape,
        id: shape.id
      })
      return // Selection handled, don't continue with other logic
    }

    // Check if clicking on a control point (do nothing - let handle system manage it)
    const controlPointInfo = getControlPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (controlPointInfo) {
      return // Let TLDraw's handle system manage control points
    }

    // Check for Alt+click to add point on path segment
    if (this.editor.inputs.altKey) {
      const segmentInfo = getSegmentAtPosition(shape.props.points, localPoint, this.editor.getZoomLevel(), shape.props.isClosed)
      if (segmentInfo) {
        this.addPointToSegment(shape, segmentInfo)
        return // Point added, don't continue with other logic
      }
    }

    // If clicking elsewhere, clear point selection
    this.clearPointSelection(shape)

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

  override onDoubleClick(_info: TLClickEventInfo) {
    if (!this.targetShape || !this.targetShapeId) return

    const shape = this.editor.getShape(this.targetShapeId as any) as BezierShape
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
    const anchorPointIndex = getAnchorPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (anchorPointIndex !== -1) {
      this.togglePointType(shape, anchorPointIndex)
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
    const newPoints = [...shape.props.points]
    const p1 = newPoints[segmentIndex]
    const p2 = segmentIndex === newPoints.length - 1 && shape.props.isClosed 
      ? newPoints[0] 
      : newPoints[segmentIndex + 1]

    // Use bezier.js to split the segment at the precise t value for smooth insertion
    const splitResult = splitSegmentAtT(p1, p2, t)
    
    // Update the original points with new control points
    newPoints[segmentIndex] = splitResult.leftSegment.p1
    
    // Insert the new point with calculated control points
    const insertIndex = segmentIndex + 1
    let newPointIndex: number
    
    if (segmentIndex === newPoints.length - 1 && shape.props.isClosed) {
      // Inserting in closing segment - update first point instead
      newPoints[0] = splitResult.rightSegment.p2
      newPoints.push(splitResult.splitPoint)
      newPointIndex = newPoints.length - 1
    } else {
      newPoints[insertIndex] = splitResult.rightSegment.p2
      newPoints.splice(insertIndex, 0, splitResult.splitPoint)
      newPointIndex = insertIndex
    }
    
    // Update the shape with new points and select the newly added point
    const updatedShape = this.recalculateBounds(shape, newPoints)
    const finalShape = {
      ...updatedShape,
      props: {
        ...updatedShape.props,
        selectedPointIndices: [newPointIndex] // Auto-select the new point
      }
    }
    
    this.editor.updateShape(finalShape)
    bezierLog('PointAdd', 'New point added at index', newPointIndex, 'using Alt+click')
  }

  private removePoint(shape: BezierShape, pointIndex: number) {
    if (shape.props.points.length <= 2) return // Minimum 2 points

    const newPoints = [...shape.props.points]
    newPoints.splice(pointIndex, 1)
    
    const updatedShape = this.recalculateBounds(shape, newPoints)
    this.editor.updateShape(updatedShape)
  }

  private togglePointType(shape: BezierShape, pointIndex: number) {
    const newPoints = [...shape.props.points]
    const point = newPoints[pointIndex]
    
    // Check if the point currently has control points (smooth) or not (corner)
    const hasControlPoints = point.cp1 || point.cp2
    
    if (hasControlPoints) {
      // Convert smooth point to corner point (remove control points)
      newPoints[pointIndex] = {
        x: point.x,
        y: point.y,
      }
    } else {
      // Convert corner point to smooth point (add control points)
      // Calculate default control point positions based on neighboring points
      const controlOffset = BEZIER_HANDLES.DEFAULT_CONTROL_OFFSET
      
      let cp1: { x: number; y: number } | undefined
      let cp2: { x: number; y: number } | undefined
      
      // Get neighboring points to determine control point directions
      const prevIndex = pointIndex === 0 ? (shape.props.isClosed ? shape.props.points.length - 1 : -1) : pointIndex - 1
      const nextIndex = pointIndex === shape.props.points.length - 1 ? (shape.props.isClosed ? 0 : -1) : pointIndex + 1
      
      if (prevIndex >= 0 && nextIndex >= 0) {
        // Point has both neighbors - create symmetric control points
        const prevPoint = shape.props.points[prevIndex]
        const nextPoint = shape.props.points[nextIndex]
        
        // Calculate direction vector from previous to next point
        const dirX = nextPoint.x - prevPoint.x
        const dirY = nextPoint.y - prevPoint.y
        const length = Math.sqrt(dirX * dirX + dirY * dirY)
        
        if (length > 0) {
          // Normalize and scale the direction vector
          const normalizedDirX = (dirX / length) * controlOffset
          const normalizedDirY = (dirY / length) * controlOffset
          
          cp1 = {
            x: point.x - normalizedDirX * BEZIER_HANDLES.CONTROL_POINT_SCALE,
            y: point.y - normalizedDirY * BEZIER_HANDLES.CONTROL_POINT_SCALE,
          }
          cp2 = {
            x: point.x + normalizedDirX * BEZIER_HANDLES.CONTROL_POINT_SCALE,
            y: point.y + normalizedDirY * BEZIER_HANDLES.CONTROL_POINT_SCALE,
          }
        }
      } else if (prevIndex >= 0) {
        // Only has previous neighbor
        const prevPoint = shape.props.points[prevIndex]
        const dirX = point.x - prevPoint.x
        const dirY = point.y - prevPoint.y
        const length = Math.sqrt(dirX * dirX + dirY * dirY)
        
        if (length > 0) {
          const normalizedDirX = (dirX / length) * controlOffset * BEZIER_HANDLES.CONTROL_POINT_SCALE
          const normalizedDirY = (dirY / length) * controlOffset * BEZIER_HANDLES.CONTROL_POINT_SCALE
          
          cp1 = {
            x: point.x - normalizedDirX,
            y: point.y - normalizedDirY,
          }
          cp2 = {
            x: point.x + normalizedDirX,
            y: point.y + normalizedDirY,
          }
        }
      } else if (nextIndex >= 0) {
        // Only has next neighbor
        const nextPoint = shape.props.points[nextIndex]
        const dirX = nextPoint.x - point.x
        const dirY = nextPoint.y - point.y
        const length = Math.sqrt(dirX * dirX + dirY * dirY)
        
        if (length > 0) {
          const normalizedDirX = (dirX / length) * controlOffset * BEZIER_HANDLES.CONTROL_POINT_SCALE
          const normalizedDirY = (dirY / length) * controlOffset * BEZIER_HANDLES.CONTROL_POINT_SCALE
          
          cp1 = {
            x: point.x - normalizedDirX,
            y: point.y - normalizedDirY,
          }
          cp2 = {
            x: point.x + normalizedDirX,
            y: point.y + normalizedDirY,
          }
        }
      }
      
      // If we couldn't calculate based on neighbors, use default horizontal control points
      if (!cp1 || !cp2) {
        cp1 = { x: point.x - controlOffset, y: point.y }
        cp2 = { x: point.x + controlOffset, y: point.y }
      }
      
      newPoints[pointIndex] = {
        x: point.x,
        y: point.y,
        cp1,
        cp2,
      }
    }
    
    const updatedShape = this.recalculateBounds(shape, newPoints)
    this.editor.updateShape(updatedShape)
  }

  private recalculateBounds(shape: BezierShape, points: BezierPoint[]): BezierShape {
    // Use bezier.js for accurate bounds calculation
    const bounds = getAccurateBounds(points, shape.props.isClosed)
    
    const w = Math.max(1, bounds.maxX - bounds.minX)
    const h = Math.max(1, bounds.maxY - bounds.minY)

    // Normalize points to new bounds
    const normalizedPoints = points.map(p => ({
      x: p.x - bounds.minX,
      y: p.y - bounds.minY,
      cp1: p.cp1 ? { x: p.cp1.x - bounds.minX, y: p.cp1.y - bounds.minY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - bounds.minX, y: p.cp2.y - bounds.minY } : undefined,
    }))

    const updatedShape = {
      ...shape,
      x: shape.x + bounds.minX,
      y: shape.y + bounds.minY,
      props: {
        ...shape.props,
        w,
        h,
        points: normalizedPoints,
      }
    }


    return updatedShape
  }

  private clearPointSelection(shape: BezierShape) {
    if (shape.props.selectedPointIndices && shape.props.selectedPointIndices.length > 0) {
      this.editor.updateShape({
        id: shape.id,
        type: 'bezier',
        props: {
          ...shape.props,
          selectedPointIndices: []
        }
      })
    }
  }



  private exitEditMode() {
    if (!this.targetShapeId) {
      return
    }

    // Exit edit mode
    const shape = this.editor.getShape(this.targetShapeId as any) as BezierShape
    if (shape) {
      this.editor.updateShape({
        id: this.targetShapeId as any,
        type: 'bezier',
        props: {
          ...shape.props,
          editMode: false,
        },
      })
      
      // Select the shape to show transform controls after exiting edit mode
      this.editor.setSelectedShapes([this.targetShapeId as any])
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