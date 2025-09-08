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
  readonly CORNER_POINT_THRESHOLD = 3 // pixels

  override onEnter(info: TLPointerEventInfo) {
    this.info = info
    this.shapeId = createShapeId()
    this.points = []
    this.isDragging = false
    
    // Add the first point at the click location
    const point = this.editor.inputs.currentPagePoint.clone()
    this.addPoint({ x: point.x, y: point.y })
    this.startPoint = point.clone()
    this.currentPoint = point.clone()
    this.dragDistance = 0
    
    // Create initial shape with just one point
    this.updateShape()
  }

  override onPointerMove() {
    const currentPoint = this.editor.inputs.currentPagePoint.clone()
    this.currentPoint = currentPoint
    
    if (this.isDragging && this.points.length > 0) {
      // Calculate drag distance for corner point detection
      if (this.startPoint) {
        this.dragDistance = Vec.Dist(currentPoint, this.startPoint) * this.editor.getZoomLevel()
      }
      
      // Update control points of the current point being created
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
          const controlPoint2 = Vec.Add(startPoint, Vec.Mul(offset, 0.3))
          lastPoint.cp1 = undefined // No incoming handle
          lastPoint.cp2 = { x: controlPoint2.x, y: controlPoint2.y }
        } else {
          // Default: symmetric handles
          const controlPoint1 = Vec.Add(startPoint, Vec.Mul(offset, -0.3))
          const controlPoint2 = Vec.Add(startPoint, Vec.Mul(offset, 0.3))
          lastPoint.cp1 = { x: controlPoint1.x, y: controlPoint1.y }
          lastPoint.cp2 = { x: controlPoint2.x, y: controlPoint2.y }
        }
      } else {
        // Small drag distance: create corner point (no handles)
        lastPoint.cp1 = undefined
        lastPoint.cp2 = undefined
      }
      
      this.updateShape()
    } else if (this.points.length > 0) {
      // Show preview of next segment
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
      
      // Check if clicking near the first point to close the curve
      if (this.points.length > 2) {
        const firstPoint = this.points[0]
        const distToFirst = Vec.Dist(currentPoint, { x: firstPoint.x, y: firstPoint.y })
        
        if (distToFirst < 10 / this.editor.getZoomLevel()) {
          // Close the curve
          this.closeCurve()
          return
        }
      }
      
      // Add new point
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
    this.updateShapeWithPoints(this.points)
  }

  private updateShapeWithPoints(points: BezierPoint[]) {
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
    const normalizedPoints = points.map(p => ({
      x: p.x - minX,
      y: p.y - minY,
      cp1: p.cp1 ? { x: p.cp1.x - minX, y: p.cp1.y - minY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - minX, y: p.cp2.y - minY } : undefined,
    }))

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
        isClosed: false,
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

  private closeCurve() {
    if (this.points.length < 3) return
    
    // Update the shape to be closed
    const shape = this.editor.getShape(this.shapeId) as BezierShape
    if (shape) {
      this.editor.updateShape({
        id: this.shapeId,
        type: 'bezier',
        props: {
          ...shape.props,
          isClosed: true,
        },
      })
    }
    
    this.complete()
  }

  private completeCurve() {
    this.complete()
  }

  private complete() {
    if (this.points.length < 2) {
      // Delete incomplete shape
      this.editor.deleteShape(this.shapeId)
    }
    
    this.editor.setCurrentTool('select')
    
    // Select the created shape
    if (this.points.length >= 2) {
      this.editor.setSelectedShapes([this.shapeId])
    }
  }

  private cancel() {
    // Delete the shape being created
    this.editor.deleteShape(this.shapeId)
    this.parent.transition('idle')
  }

  override onExit() {
    // Clean up any preview state
  }
}