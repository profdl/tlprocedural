import {
  StateNode,
  type TLPointerEventInfo,
  type TLKeyboardEventInfo,
  createShapeId,
  Vec,
  type TLShapePartial
} from '@tldraw/editor'
import { type BezierShape, type BezierPoint } from '../../BezierShape'
import { DEFAULT_SHAPE_PROPS } from '../../constants/defaultShapeProps'

export class DrawCreating extends StateNode {
  static override id = 'creating'

  info = {} as TLPointerEventInfo
  shapeId = createShapeId()
  points: BezierPoint[] = []
  lastPoint?: Vec
  isDrawing = false
  private readonly MIN_DISTANCE = 2 // Minimum distance between points
  private readonly SMOOTHING_FACTOR = 0.3 // How much smoothing to apply

  override onEnter(info: TLPointerEventInfo) {
    this.info = info
    this.shapeId = createShapeId()
    this.points = []
    this.isDrawing = true

    // Add the first point
    const point = this.editor.inputs.currentPagePoint.clone()
    this.addPoint(point)
    this.lastPoint = point
  }

  override onPointerMove() {
    if (!this.isDrawing) return

    const currentPoint = this.editor.inputs.currentPagePoint.clone()

    if (this.lastPoint && Vec.Dist(currentPoint, this.lastPoint) > this.MIN_DISTANCE) {
      this.addPoint(currentPoint)
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

  override onPointerDown() {
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
        if (this.points.length > 2) {
          this.closePath()
        }
        break
    }
  }

  private addPoint(point: Vec) {
    const bezierPoint: BezierPoint = {
      x: point.x,
      y: point.y,
    }

    this.points.push(bezierPoint)
    this.generateSmoothControlPoints()
    this.updateShape()
  }

  private updateShape() {
    if (this.points.length === 0) return

    // Calculate bounds
    const xs = this.points.map(p => p.x)
    const ys = this.points.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)

    const w = Math.max(1, maxX - minX)
    const h = Math.max(1, maxY - minY)

    // Normalize points to local coordinates
    const normalizedPoints = this.points.map(p => ({
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
        isClosed: false,
        ...DEFAULT_SHAPE_PROPS,
      },
    }

    if (this.editor.getShape(this.shapeId)) {
      this.editor.updateShape(partial)
    } else {
      this.editor.createShape(partial)
    }
  }

  private closePath() {
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

  private completePath() {
    this.complete()
  }

  private complete() {
    if (this.points.length < 2) {
      this.editor.deleteShape(this.shapeId)
    }

    this.editor.setCurrentTool('select')

    if (this.points.length >= 2) {
      this.editor.setSelectedShapes([this.shapeId])
    }
  }

  private cancel() {
    this.editor.deleteShape(this.shapeId)
    this.parent.transition('idle')
  }

  override onExit() {
    this.points = []
    this.lastPoint = undefined
    this.isDrawing = false
  }

  // Generate smooth control points for natural curves
  private generateSmoothControlPoints() {
    if (this.points.length < 2) return

    for (let i = 0; i < this.points.length; i++) {
      const current = this.points[i]
      const prev = this.points[i - 1]
      const next = this.points[i + 1]

      // Skip first and last points for open paths
      if (!prev || !next) {
        // For endpoints, create minimal control points
        if (i === 0 && next) {
          const dx = next.x - current.x
          const dy = next.y - current.y
          current.cp2 = {
            x: current.x + dx * this.SMOOTHING_FACTOR,
            y: current.y + dy * this.SMOOTHING_FACTOR
          }
        } else if (i === this.points.length - 1 && prev) {
          const dx = current.x - prev.x
          const dy = current.y - prev.y
          current.cp1 = {
            x: current.x - dx * this.SMOOTHING_FACTOR,
            y: current.y - dy * this.SMOOTHING_FACTOR
          }
        }
        continue
      }

      // Calculate tangent direction
      const tangentX = next.x - prev.x
      const tangentY = next.y - prev.y
      const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY)

      if (tangentLength === 0) continue

      // Normalize tangent
      const normalizedTangentX = tangentX / tangentLength
      const normalizedTangentY = tangentY / tangentLength

      // Calculate control point distances
      const prevDistance = Math.sqrt(
        (current.x - prev.x) ** 2 + (current.y - prev.y) ** 2
      )
      const nextDistance = Math.sqrt(
        (next.x - current.x) ** 2 + (next.y - current.y) ** 2
      )

      // Create control points
      const cp1Distance = prevDistance * this.SMOOTHING_FACTOR
      const cp2Distance = nextDistance * this.SMOOTHING_FACTOR

      current.cp1 = {
        x: current.x - normalizedTangentX * cp1Distance,
        y: current.y - normalizedTangentY * cp1Distance
      }

      current.cp2 = {
        x: current.x + normalizedTangentX * cp2Distance,
        y: current.y + normalizedTangentY * cp2Distance
      }
    }
  }
}