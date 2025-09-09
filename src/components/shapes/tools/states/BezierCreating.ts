import { 
  StateNode, 
  type TLPointerEventInfo, 
  type TLKeyboardEventInfo,
  createShapeId,
  Vec,
  type TLShapePartial
} from '@tldraw/editor'
import { type BezierShape, type BezierPoint } from '../../BezierShape'

export class BezierCreating extends StateNode {
  static override id = 'creating'

  info = {} as TLPointerEventInfo
  shapeId = createShapeId()
  points: BezierPoint[] = []
  isDragging = false
  startPoint?: Vec
  currentPoint?: Vec
  dragDistance = 0
  isHoveringStart = false
  isSnappedToStart = false
  originalPreviewPoint?: Vec
  isCreatingFirstPoint = false
  initialDragOccurred = false
  readonly CORNER_POINT_THRESHOLD = 3 // pixels
  readonly SNAP_THRESHOLD = 12 // pixels for entering snap zone
  readonly RELEASE_THRESHOLD = 15 // pixels for exiting snap zone

  override onEnter(info: TLPointerEventInfo) {
    this.info = info
    this.shapeId = createShapeId()
    this.points = []
    this.isDragging = false
    this.isHoveringStart = false
    this.isSnappedToStart = false
    this.originalPreviewPoint = undefined
    this.isCreatingFirstPoint = false
    this.initialDragOccurred = false
    
    // Set initial cursor
    this.editor.setCursor({ type: 'cross' })
    
    // If we're entering from a canvas click, immediately create the first point
    if (info.target === 'canvas') {
      const point = this.editor.inputs.currentPagePoint.clone()
      this.addPoint({ x: point.x, y: point.y })
      this.isDragging = true
      this.startPoint = point.clone()
      this.currentPoint = point.clone()
      this.dragDistance = 0
      this.initialDragOccurred = false
    } else {
      // Fallback - defer first point creation for other entry scenarios
      this.isCreatingFirstPoint = true
      const point = this.editor.inputs.currentPagePoint.clone()
      this.startPoint = point.clone()
      this.currentPoint = point.clone()
      this.dragDistance = 0
    }
  }

  override onPointerMove() {
    const currentPoint = this.editor.inputs.currentPagePoint.clone()
    
    // Check proximity to start point for snapping/hovering
    let hoveringStart = false
    let shouldSnapToStart = false
    
    if (this.points.length > 2) {
      const firstPoint = this.points[0]
      const distToFirst = Vec.Dist(currentPoint, { x: firstPoint.x, y: firstPoint.y })
      const snapThreshold = this.SNAP_THRESHOLD / this.editor.getZoomLevel()
      const releaseThreshold = this.RELEASE_THRESHOLD / this.editor.getZoomLevel()
      
      hoveringStart = distToFirst < 10 / this.editor.getZoomLevel()
      
      // Snap logic
      if (!this.isSnappedToStart && distToFirst < snapThreshold) {
        // Enter snap zone
        shouldSnapToStart = true
        this.isSnappedToStart = true
        this.originalPreviewPoint = currentPoint.clone()
        this.currentPoint = new Vec(firstPoint.x, firstPoint.y)
      } else if (this.isSnappedToStart && this.originalPreviewPoint) {
        // Check if we should release the snap
        const distFromOriginalSnap = Vec.Dist(currentPoint, this.originalPreviewPoint)
        if (distFromOriginalSnap > releaseThreshold) {
          // Release snap
          this.isSnappedToStart = false
          this.originalPreviewPoint = undefined
          this.currentPoint = currentPoint
        } else {
          // Stay snapped
          shouldSnapToStart = true
          this.currentPoint = new Vec(firstPoint.x, firstPoint.y)
        }
      } else {
        this.currentPoint = currentPoint
      }
    } else {
      this.currentPoint = currentPoint
    }
    
    // Update cursor based on state
    let cursorType = 'cross'
    if (this.isSnappedToStart) {
      cursorType = 'pointer' // Could use a different cursor to indicate snapping
    } else if (hoveringStart) {
      cursorType = 'pointer'
    }
    
    if (this.isHoveringStart !== hoveringStart || shouldSnapToStart) {
      this.isHoveringStart = hoveringStart
      this.editor.setCursor({ type: cursorType as any })
    }
    
    if (this.isDragging) {
      // Calculate drag distance for corner point detection
      if (this.startPoint) {
        this.dragDistance = Vec.Dist(currentPoint, this.startPoint) * this.editor.getZoomLevel()
      }
      
      if (this.points.length === 1 && !this.initialDragOccurred) {
        // Handle first point dragging - special case to ensure edit mode is active
        this.handleFirstPointDrag(currentPoint)
      } else if (this.points.length > 0) {
        // Handle normal point dragging
        this.handleNormalPointDrag(currentPoint)
      }
      
      this.updateShape()
    } else if (this.points.length > 0 && !hoveringStart && !this.isSnappedToStart) {
      // Show preview of next segment (but not when hovering over start point or snapped)
      this.showPreview()
    } else if (this.points.length > 0 && this.isSnappedToStart) {
      // Show preview snapped to start point
      this.showPreview()
    }
  }

  override onPointerUp() {
    if (this.isDragging) {
      this.isDragging = false
      this.startPoint = undefined
    }
  }

  override onPointerDown(info: TLPointerEventInfo) {
    if (info.target === 'canvas') {
      const currentPoint = this.editor.inputs.currentPagePoint.clone()
      
      // Handle first point creation
      if (this.isCreatingFirstPoint) {
        // Create the first point and start dragging it immediately
        this.addPoint({ x: currentPoint.x, y: currentPoint.y })
        this.isCreatingFirstPoint = false
        this.isDragging = true
        this.startPoint = currentPoint.clone()
        this.dragDistance = 0
        this.initialDragOccurred = false // Mark that this is the initial first point drag
        return
      }
      
      // Check if we're currently snapped to start - if so, close immediately
      if (this.isSnappedToStart && this.points.length > 2) {
        this.closeCurve()
        return
      }
      
      // Check if clicking near the first point to close the curve (fallback for edge cases)
      if (this.points.length > 2 && !this.isSnappedToStart) {
        const firstPoint = this.points[0]
        const distToFirst = Vec.Dist(currentPoint, { x: firstPoint.x, y: firstPoint.y })
        
        if (distToFirst < 10 / this.editor.getZoomLevel()) {
          // Close the curve immediately (no drag)
          this.closeCurve()
          return
        }
      }
      
      // Add new point (normal case)
      this.addPoint({ x: currentPoint.x, y: currentPoint.y })
      this.isDragging = true
      this.startPoint = currentPoint.clone()
      this.dragDistance = 0
    }
  }

  override onDoubleClick() {
    // Finish the curve without closing
    this.completeCurve()
  }

  override onKeyDown(info: TLKeyboardEventInfo) {
    switch (info.key) {
      case 'Enter':
        this.completeCurve()
        break
      case 'Escape':
        this.cancel()
        break
      case 'c':
        if (this.points.length > 2) {
          this.closeCurve()
        }
        break
    }
  }

  private handleFirstPointDrag(currentPoint: Vec) {
    const firstPoint = this.points[0]
    const startPoint = this.startPoint!
    
    // Only create handles if drag distance exceeds threshold
    if (this.dragDistance > this.CORNER_POINT_THRESHOLD) {
      // Calculate control points for curve
      let offset = Vec.Sub(currentPoint, startPoint)
      const isAltPressed = this.editor.inputs.altKey
      const isShiftPressed = this.editor.inputs.shiftKey
      
      // Apply angle constraint if Shift is pressed
      if (isShiftPressed) {
        offset = this.constrainAngle(offset)
      }
      
      if (isAltPressed) {
        // Alt key: create asymmetric handles - only outgoing handle for first point
        const controlPoint2 = Vec.Add(startPoint, offset)
        firstPoint.cp1 = undefined // No incoming handle for first point
        firstPoint.cp2 = { x: controlPoint2.x, y: controlPoint2.y }
      } else {
        // Default: symmetric handles
        const controlPoint1 = Vec.Add(startPoint, Vec.Neg(offset))
        const controlPoint2 = Vec.Add(startPoint, offset)
        firstPoint.cp1 = { x: controlPoint1.x, y: controlPoint1.y }
        firstPoint.cp2 = { x: controlPoint2.x, y: controlPoint2.y }
      }
      
      this.initialDragOccurred = true
    } else {
      // Small drag distance: create corner point (no handles)
      firstPoint.cp1 = undefined
      firstPoint.cp2 = undefined
    }
  }

  private handleNormalPointDrag(currentPoint: Vec) {
    const lastPoint = this.points[this.points.length - 1]
    const startPoint = this.startPoint!
    
    // Only create handles if drag distance exceeds threshold
    if (this.dragDistance > this.CORNER_POINT_THRESHOLD) {
      // Calculate control points for curve
      let offset = Vec.Sub(currentPoint, startPoint)
      const isAltPressed = this.editor.inputs.altKey
      const isShiftPressed = this.editor.inputs.shiftKey
      
      // Apply angle constraint if Shift is pressed
      if (isShiftPressed) {
        offset = this.constrainAngle(offset)
      }
      
      if (isAltPressed) {
        // Alt key: create asymmetric handles - only outgoing handle
        const controlPoint2 = Vec.Add(startPoint, offset)
        lastPoint.cp1 = undefined // No incoming handle
        lastPoint.cp2 = { x: controlPoint2.x, y: controlPoint2.y }
      } else {
        // Default: symmetric handles
        const controlPoint1 = Vec.Add(startPoint, Vec.Neg(offset))
        const controlPoint2 = Vec.Add(startPoint, offset)
        lastPoint.cp1 = { x: controlPoint1.x, y: controlPoint1.y }
        lastPoint.cp2 = { x: controlPoint2.x, y: controlPoint2.y }
      }
      
      // Mark that initial drag occurred for first point
      if (this.points.length === 1) {
        this.initialDragOccurred = true
      }
    } else {
      // Small drag distance: create corner point (no handles)
      lastPoint.cp1 = undefined
      lastPoint.cp2 = undefined
    }
  }


  private constrainAngle(offset: Vec): Vec {
    // Constrain to 45-degree increments (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
    const angle = Math.atan2(offset.y, offset.x)
    const constrainedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
    const magnitude = Vec.Len(offset)
    
    return new Vec(
      Math.cos(constrainedAngle) * magnitude,
      Math.sin(constrainedAngle) * magnitude
    )
  }

  private addPoint(point: { x: number; y: number }) {
    this.points.push({
      x: point.x,
      y: point.y,
    })
    
    this.updateShape()
  }

  private updateShape() {
    // Force edit mode when creating/dragging the first point or during any drag operation
    const forceEditMode = (this.points.length === 1 && !this.initialDragOccurred) || this.isDragging
    
    // During drag operations, show preview of the curve being formed
    if (this.isDragging && this.points.length > 0 && this.currentPoint) {
      // Create preview points that include the current drag position
      const previewPoints = [...this.points]
      
      // Only add preview segment for subsequent points (not the first point)
      // For first point drag, we just show the single point with its handles (no preview line)
      if (this.points.length > 1) {
        // Add a preview point at the current mouse position
        previewPoints.push({
          x: this.currentPoint.x,
          y: this.currentPoint.y,
        })
      }
      
      this.updateShapeWithPointsAndClosed(previewPoints, false, forceEditMode)
    } else {
      // Normal update without preview
      this.updateShapeWithPointsAndClosed(this.points, false, forceEditMode)
    }
  }

  private updateShapeWithPoints(points: BezierPoint[]) {
    this.updateShapeWithPointsAndClosed(points, false)
  }

  private updateShapeWithPointsAndClosed(points: BezierPoint[], isClosed: boolean, forceEditMode?: boolean) {
    console.log('updateShapeWithPointsAndClosed: input points.length =', points.length, 'isClosed =', isClosed)
    if (points.length === 0) return
    
    // Calculate bounds
    const allPoints = points.flatMap(p => [
      { x: p.x, y: p.y },
      ...(p.cp1 ? [p.cp1] : []),
      ...(p.cp2 ? [p.cp2] : [])
    ])
    
    const xs = allPoints.map(p => p.x)
    const ys = allPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    
    const w = Math.max(1, maxX - minX)
    const h = Math.max(1, maxY - minY)
    
    // Normalize points to local coordinates
    console.log('Before normalization: input points =', points.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`))
    const normalizedPoints = points.map(p => ({
      x: p.x - minX,
      y: p.y - minY,
      cp1: p.cp1 ? { x: p.cp1.x - minX, y: p.cp1.y - minY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - minX, y: p.cp2.y - minY } : undefined,
    }))
    console.log('After normalization: normalized points =', normalizedPoints.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`))
    console.log('Final points being set in shape:', normalizedPoints.length)

    const partial: TLShapePartial<BezierShape> = {
      id: this.shapeId,
      type: 'bezier',
      x: minX,
      y: minY,
      props: {
        w,
        h,
        points: normalizedPoints,
        color: this.editor.getStyleForNextShape('color' as any) || '#000000',
        strokeWidth: 2,
        fill: false,
        isClosed: isClosed,
        editMode: forceEditMode !== undefined ? forceEditMode : !isClosed, // Show handles during creation, hide when closed
      },
    }

    if (this.editor.getShape(this.shapeId)) {
      this.editor.updateShape(partial)
    } else {
      this.editor.createShape(partial)
    }
  }


  private showPreview() {
    if (this.points.length === 0 || !this.currentPoint) return
    
    // Create a temporary points array with the preview segment
    const previewPoints = [...this.points]
    
    // Add a preview point at the current mouse position (without control points for a straight line)
    previewPoints.push({
      x: this.currentPoint.x,
      y: this.currentPoint.y,
    })
    
    // Update the shape with the preview
    this.updateShapeWithPoints(previewPoints)
  }

  private closeCurveWithExistingPoints() {
    if (this.points.length < 3) return
    
    // Use existing points array directly (control points already set during drag)
    this.updateShapeWithPointsAndClosed(this.points, true)
    
    this.editor.setCurrentTool('select')
    this.editor.setSelectedShapes([this.shapeId])
    
    // Force transform controls to update properly for the closed shape
    setTimeout(() => {
      this.editor.setSelectedShapes([])
      this.editor.setSelectedShapes([this.shapeId])
    }, 50)
  }

  private closeCurve() {
    if (this.points.length < 3) return
    
    // Add smooth closing handles before closing the curve
    this.addSmoothClosingHandles()
    
    // Use the actual user-created points directly (not from shape which includes preview)
    this.updateShapeWithPointsAndClosed(this.points, true)
    
    this.editor.setCurrentTool('select')
    this.editor.setSelectedShapes([this.shapeId])
    
    // Force transform controls to update properly for the closed shape
    setTimeout(() => {
      this.editor.setSelectedShapes([])
      this.editor.setSelectedShapes([this.shapeId])
    }, 50)
  }

  private addSmoothClosingHandles() {
    const firstPoint = this.points[0]
    const lastPoint = this.points[this.points.length - 1]
    
    // If the first point has an outgoing handle (cp2), create a mirrored incoming handle (cp1)
    if (firstPoint.cp2) {
      const mirroredHandle = {
        x: firstPoint.x - (firstPoint.cp2.x - firstPoint.x),
        y: firstPoint.y - (firstPoint.cp2.y - firstPoint.y)
      }
      firstPoint.cp1 = mirroredHandle
    }
    
    // If the last point has an incoming handle (cp1), create a mirrored outgoing handle (cp2)
    // This handle should point toward the first point to create a smooth closure
    if (lastPoint.cp1) {
      const mirroredHandle = {
        x: lastPoint.x - (lastPoint.cp1.x - lastPoint.x),
        y: lastPoint.y - (lastPoint.cp1.y - lastPoint.y)
      }
      lastPoint.cp2 = mirroredHandle
    }
  }

  private completeCurve() {
    this.complete()
  }

  private complete() {
    if (this.points.length < 2) {
      // Delete incomplete shape
      this.editor.deleteShape(this.shapeId)
    } else {
      // Disable edit mode when completing the curve
      const shape = this.editor.getShape(this.shapeId) as BezierShape
      if (shape) {
        this.editor.updateShape({
          id: this.shapeId,
          type: 'bezier',
          props: {
            ...shape.props,
            editMode: false,
          },
        })
      }
    }
    
    this.editor.setCurrentTool('select')
    
    // Select the created shape and ensure transform controls are properly initialized
    if (this.points.length >= 2) {
      this.editor.setSelectedShapes([this.shapeId])
      
      // Force transform controls to initialize properly for the newly completed shape
      setTimeout(() => {
        this.editor.setSelectedShapes([])
        this.editor.setSelectedShapes([this.shapeId])
      }, 10)
    }
  }

  private cancel() {
    // Delete the shape being created
    this.editor.deleteShape(this.shapeId)
    this.parent.transition('idle')
  }

  override onExit() {
    // Reset cursor to default
    this.editor.setCursor({ type: 'default' })
    // Clean up any preview state
  }
}