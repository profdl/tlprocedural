import { 
  StateNode, 
  type TLPointerEventInfo, 
  type TLClickEventInfo,
  type TLKeyboardEventInfo,
} from 'tldraw'
import { type BezierShape, type BezierPoint } from '../../BezierShape'
import { getClosestPointOnSegment, splitSegmentAtT, getAccurateBounds } from '../../utils/bezierUtils'

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
    console.log('🔷 BezierEditing.onPointerDown:', {
      target: info.target,
      targetShapeId: this.targetShapeId,
      shape: info.target === 'shape' ? info.shape?.id : null,
      currentTool: this.editor.getCurrentToolId()
    })
    
    if (!this.targetShape || !this.targetShapeId) {
      console.log('❌ BezierEditing: No target shape, returning')
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

    // Check if clicking on an existing anchor point (do nothing - let handle system manage it)
    const anchorPointIndex = this.getAnchorPointAt(shape, localPoint)
    if (anchorPointIndex !== -1) {
      console.log('🎯 BezierEditing: Clicked on anchor point', anchorPointIndex)
      return // Let TLDraw's handle system manage existing points
    }

    // Check if clicking on a control point (do nothing - let handle system manage it)
    const controlPointInfo = this.getControlPointAt(shape, localPoint)
    if (controlPointInfo) {
      console.log('🎮 BezierEditing: Clicked on control point', controlPointInfo)
      return // Let TLDraw's handle system manage control points
    }

    // Check if clicking on a path segment to add a point
    const segmentInfo = this.getSegmentAtPosition(shape, localPoint)
    if (segmentInfo) {
      console.log('➕ BezierEditing: Clicked on path segment - adding point', segmentInfo)
      this.addPointToSegment(shape, segmentInfo)
      return
    }

    // If clicking on canvas (not on shape), delay exit to check if it's a handle drag
    if (info.target === 'canvas') {
      // Small delay to see if this is the start of a handle drag operation
      // If it's a real canvas click, we'll still exit after the delay
      setTimeout(() => {
        // Check if a handle drag is in progress by seeing if the editor is in a drag state
        const isDragging = this.editor.inputs.isDragging
        if (!isDragging) {
          console.log('🚪 BezierEditing: Confirmed canvas click - exiting edit mode')
          this.exitEditMode()
        } else {
          console.log('🎮 BezierEditing: Handle drag in progress - staying in edit mode')
        }
      }, 10) // Very short delay
      return
    } else {
      // Clicked on shape but not on any interactive element - also exit edit mode
      console.log('🚪 BezierEditing: Clicked off path - exiting edit mode')
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
    const anchorPointIndex = this.getAnchorPointAt(shape, localPoint)
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

  private getAnchorPointAt(shape: BezierShape, localPoint: { x: number; y: number }): number {
    const threshold = 8 / this.editor.getZoomLevel() // 8 pixels at current zoom
    
    for (let i = 0; i < shape.props.points.length; i++) {
      const point = shape.props.points[i]
      const distance = Math.sqrt(
        Math.pow(localPoint.x - point.x, 2) + 
        Math.pow(localPoint.y - point.y, 2)
      )
      
      if (distance < threshold) {
        return i
      }
    }
    
    return -1
  }

  private getControlPointAt(shape: BezierShape, localPoint: { x: number; y: number }): { pointIndex: number; type: 'cp1' | 'cp2' } | null {
    const threshold = 8 / this.editor.getZoomLevel() // 8 pixels at current zoom
    
    for (let i = 0; i < shape.props.points.length; i++) {
      const point = shape.props.points[i]
      
      // Check cp1
      if (point.cp1) {
        const distance = Math.sqrt(
          Math.pow(localPoint.x - point.cp1.x, 2) + 
          Math.pow(localPoint.y - point.cp1.y, 2)
        )
        if (distance < threshold) {
          return { pointIndex: i, type: 'cp1' }
        }
      }
      
      // Check cp2
      if (point.cp2) {
        const distance = Math.sqrt(
          Math.pow(localPoint.x - point.cp2.x, 2) + 
          Math.pow(localPoint.y - point.cp2.y, 2)
        )
        if (distance < threshold) {
          return { pointIndex: i, type: 'cp2' }
        }
      }
    }
    
    return null
  }

  private getSegmentAtPosition(shape: BezierShape, localPoint: { x: number; y: number }): { segmentIndex: number; t: number } | null {
    const threshold = 8 / this.editor.getZoomLevel() // Increased threshold for better usability
    const points = shape.props.points

    // Check each segment using precise bezier curve distance
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      
      const result = getClosestPointOnSegment(p1, p2, localPoint)
      
      if (result.distance < threshold) {
        return { segmentIndex: i, t: result.t }
      }
    }

    // Check closing segment if the path is closed
    if (shape.props.isClosed && points.length > 2) {
      const p1 = points[points.length - 1]
      const p2 = points[0]
      const result = getClosestPointOnSegment(p1, p2, localPoint)
      
      if (result.distance < threshold) {
        return { segmentIndex: points.length - 1, t: result.t }
      }
    }

    return null
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
    if (segmentIndex === newPoints.length - 1 && shape.props.isClosed) {
      // Inserting in closing segment - update first point instead
      newPoints[0] = splitResult.rightSegment.p2
      newPoints.push(splitResult.splitPoint)
    } else {
      newPoints[insertIndex] = splitResult.rightSegment.p2
      newPoints.splice(insertIndex, 0, splitResult.splitPoint)
    }
    
    const updatedShape = this.recalculateBounds(shape, newPoints)
    this.editor.updateShape(updatedShape)
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
      const controlOffset = 100 // Default control point distance
      
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
            x: point.x - normalizedDirX * 0.3,
            y: point.y - normalizedDirY * 0.3,
          }
          cp2 = {
            x: point.x + normalizedDirX * 0.3,
            y: point.y + normalizedDirY * 0.3,
          }
        }
      } else if (prevIndex >= 0) {
        // Only has previous neighbor
        const prevPoint = shape.props.points[prevIndex]
        const dirX = point.x - prevPoint.x
        const dirY = point.y - prevPoint.y
        const length = Math.sqrt(dirX * dirX + dirY * dirY)
        
        if (length > 0) {
          const normalizedDirX = (dirX / length) * controlOffset * 0.3
          const normalizedDirY = (dirY / length) * controlOffset * 0.3
          
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
          const normalizedDirX = (dirX / length) * controlOffset * 0.3
          const normalizedDirY = (dirY / length) * controlOffset * 0.3
          
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

  private exitEditMode() {
    console.log('🚪 BezierEditing.exitEditMode called for shape:', this.targetShapeId)
    if (!this.targetShapeId) {
      console.log('❌ BezierEditing.exitEditMode: No target shape ID')
      return
    }

    // Exit edit mode
    const shape = this.editor.getShape(this.targetShapeId as any) as BezierShape
    if (shape) {
      console.log('✅ BezierEditing.exitEditMode: Shape found, updating editMode to false', {
        currentEditMode: shape.props.editMode,
        shapeId: shape.id
      })
      this.editor.updateShape({
        id: this.targetShapeId as any,
        type: 'bezier',
        props: {
          ...shape.props,
          editMode: false,
        },
      })
      console.log('✅ BezierEditing.exitEditMode: Shape updated successfully')
      
      // Select the shape to show transform controls after exiting edit mode
      this.editor.setSelectedShapes([this.targetShapeId as any])
    } else {
      console.log('❌ BezierEditing.exitEditMode: Shape not found')
    }

    // Return to select tool
    console.log('🔧 BezierEditing.exitEditMode: Switching to select tool')
    this.editor.setCurrentTool('select')
  }

  override onExit() {
    // Clean up
    this.targetShapeId = undefined
    this.targetShape = undefined
  }
}