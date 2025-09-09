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
  isClosingDrag = false
  closingDragStart?: Vec
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
    this.isClosingDrag = false
    this.closingDragStart = undefined
    this.initialDragOccurred = false
    
    // Set initial cursor
    this.editor.setCursor({ type: 'cross' })
    
    // Defer first point creation - wait for user click/drag
    this.isCreatingFirstPoint = true
    const point = this.editor.inputs.currentPagePoint.clone()
    this.startPoint = point.clone()
    this.currentPoint = point.clone()
    this.dragDistance = 0
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
      
      if (this.isClosingDrag) {
        // Handle closing drag - update control points for smooth closure
        this.handleClosingDrag(currentPoint)
      } else if (this.points.length === 1 && !this.initialDragOccurred) {
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
      if (this.isClosingDrag) {
        // Finalize the closing drag and close the curve
        this.finalizeClosingDrag()
      }
      
      this.isDragging = false
      this.isClosingDrag = false
      this.startPoint = undefined
      this.closingDragStart = undefined
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
      
      // Check if we're currently snapped to start - if so, enter closing drag mode
      if (this.isSnappedToStart && this.points.length > 2) {
        this.isClosingDrag = true
        this.isDragging = true
        this.closingDragStart = currentPoint.clone()
        this.startPoint = currentPoint.clone()
        this.dragDistance = 0
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

  private handleClosingDrag(currentPoint: Vec) {
    if (this.points.length < 3 || !this.closingDragStart) return
    
    const firstPoint = this.points[0]
    const lastPoint = this.points[this.points.length - 1]
    const startPoint = this.closingDragStart
    
    // Only create handles if drag distance exceeds threshold
    if (this.dragDistance > this.CORNER_POINT_THRESHOLD) {
      let offset = Vec.Sub(currentPoint, startPoint)
      const isAltPressed = this.editor.inputs.altKey
      const isShiftPressed = this.editor.inputs.shiftKey
      
      // Apply angle constraint if Shift is pressed
      if (isShiftPressed) {
        offset = this.constrainAngle(offset)
      }
      
      // Set outgoing handle for last point (pointing towards first point)
      const lastPointOutgoing = Vec.Add(firstPoint, offset)
      lastPoint.cp2 = { x: lastPointOutgoing.x, y: lastPointOutgoing.y }
      
      if (isAltPressed) {
        // Alt key: asymmetric closure - no incoming handle for first point
        firstPoint.cp1 = undefined
      } else {
        // Default: symmetric closure - create incoming handle for first point
        const firstPointIncoming = Vec.Add(firstPoint, Vec.Neg(offset))
        firstPoint.cp1 = { x: firstPointIncoming.x, y: firstPointIncoming.y }
      }
    } else {
      // Small drag distance: create corner closure (no handles)
      lastPoint.cp2 = undefined
      firstPoint.cp1 = undefined
    }
  }

  private finalizeClosingDrag() {
    // The control points have already been set during handleClosingDrag
    // Now we just need to close the curve properly
    this.closeCurveWithExistingPoints()
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
    
    // Get the actual points from the current shape (which includes preview point)
    const currentShape = this.editor.getShape(this.shapeId) as BezierShape
    if (!currentShape) return
    
    // Convert the shape's normalized points back to page coordinates
    const shapePoints = currentShape.props.points.map(p => ({
      x: p.x + currentShape.x,
      y: p.y + currentShape.y,
      cp1: p.cp1 ? { x: p.cp1.x + currentShape.x, y: p.cp1.y + currentShape.y } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x + currentShape.x, y: p.cp2.y + currentShape.y } : undefined,
    }))
    
    console.log('closeCurve: Starting with actual shape points.length =', shapePoints.length)
    
    // First: Close the curve with all actual points 
    this.updateShapeWithPointsAndClosed(shapePoints, true)
    console.log('closeCurve: After first update (close)')
    
    // Then: After a brief delay, remove exactly one point (the last one)
    setTimeout(() => {
      console.log('closeCurve: setTimeout callback - shapePoints.length =', shapePoints.length)
      const closedPoints = shapePoints.slice(0, -1)
      console.log('closeCurve: After slice - closedPoints.length =', closedPoints.length)
      this.updateShapeWithPointsAndClosed(closedPoints, true)
      console.log('closeCurve: After final update')
    }, 50)
    
    this.editor.setCurrentTool('select')
    this.editor.setSelectedShapes([this.shapeId])
    
    // Force transform controls to update properly for the closed shape
    setTimeout(() => {
      this.editor.setSelectedShapes([])
      this.editor.setSelectedShapes([this.shapeId])
    }, 50)
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