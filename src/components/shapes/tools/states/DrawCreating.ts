import { 
  StateNode, 
  type TLPointerEventInfo, 
  type TLKeyboardEventInfo,
  createShapeId,
  Vec,
  type TLShapePartial
} from '@tldraw/editor'
import { type DrawShape } from '../../DrawShape'

export class DrawCreating extends StateNode {
  static override id = 'creating'

  info = {} as TLPointerEventInfo
  shapeId = createShapeId()
  segments: Array<{ type: 'move' | 'line'; x: number; y: number }> = []
  lastPoint?: Vec
  isDrawing = false

  override onEnter(info: TLPointerEventInfo) {
    this.info = info
    this.shapeId = createShapeId()
    this.segments = []
    this.isDrawing = true
    
    // Add the first point
    const point = this.editor.inputs.currentPagePoint.clone()
    this.addPoint(point, 'move')
    this.lastPoint = point
  }

  override onPointerMove() {
    if (!this.isDrawing) return
    
    const currentPoint = this.editor.inputs.currentPagePoint.clone()
    
    if (this.lastPoint && Vec.Dist(currentPoint, this.lastPoint) > 2) {
      this.addPoint(currentPoint, 'line')
      this.lastPoint = currentPoint
    }
  }

  override onPointerUp() {
    if (this.isDrawing) {
      this.isDrawing = false
      // Complete the drawing when mouse is released
      this.completePath()
    }
  }

  override onPointerDown(info: TLPointerEventInfo) {
    // This is for potential multi-segment drawing in the future
    // For now, we complete on mouse up
  }

  override onDoubleClick() {
    this.completePath()
  }

  override onKeyDown(info: TLKeyboardEventInfo) {
    switch (info.key) {
      case 'Enter':
        this.completePath()
        break
      case 'Escape':
        this.cancel()
        break
      case 'c':
        if (this.segments.length > 2) {
          this.closePath()
        }
        break
    }
  }

  private addPoint(point: Vec, type: 'move' | 'line') {
    this.segments.push({
      type,
      x: point.x,
      y: point.y,
    })
    
    this.updateShape()
  }

  private updateShape() {
    if (this.segments.length === 0) return
    
    // Calculate bounds
    const xs = this.segments.map(s => s.x)
    const ys = this.segments.map(s => s.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    
    const w = Math.max(1, maxX - minX)
    const h = Math.max(1, maxY - minY)
    
    // Normalize segments to local coordinates
    const normalizedSegments = this.segments.map(s => ({
      type: s.type,
      x: s.x - minX,
      y: s.y - minY,
    }))

    const partial: TLShapePartial<DrawShape> = {
      id: this.shapeId,
      type: 'custom-draw',
      x: minX,
      y: minY,
      props: {
        w,
        h,
        segments: normalizedSegments,
        color: '#000000',
        strokeWidth: 2,
        isClosed: false,
        smoothing: 0.5,
      },
    }

    if (this.editor.getShape(this.shapeId)) {
      this.editor.updateShape(partial)
    } else {
      this.editor.createShape(partial)
    }
  }

  private closePath() {
    if (this.segments.length < 3) return
    
    // Close the path by connecting back to start
    const firstPoint = this.segments[0]
    this.segments.push({
      type: 'line',
      x: firstPoint.x,
      y: firstPoint.y,
    })
    
    // Update the shape to be closed
    const shape = this.editor.getShape(this.shapeId) as DrawShape
    if (shape) {
      this.editor.updateShape({
        id: this.shapeId,
        type: 'custom-draw',
        props: {
          ...shape.props,
          isClosed: true,
        },
      })
    }
    
    this.complete()
  }

  private completePath() {
    this.complete()
  }

  private complete() {
    if (this.segments.length < 2) {
      this.editor.deleteShape(this.shapeId)
    }
    
    this.editor.setCurrentTool('select')
    
    if (this.segments.length >= 2) {
      this.editor.setSelectedShapes([this.shapeId])
    }
  }

  private cancel() {
    this.editor.deleteShape(this.shapeId)
    this.parent.transition('idle')
  }

  override onExit() {
    this.segments = []
    this.lastPoint = undefined
    this.isDrawing = false
  }
}