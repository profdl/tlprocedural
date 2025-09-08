import { 
  StateNode, 
  type TLPointerEventInfo, 
  type TLClickEventInfo,
  type TLKeyboardEventInfo,
} from '@tldraw/editor'
import { type BezierShape, type BezierPoint } from '../../BezierShape'

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

    // Check if clicking on an existing anchor point (do nothing - let handle system manage it)
    const anchorPointIndex = this.getAnchorPointAt(shape, localPoint)
    if (anchorPointIndex !== -1) {
      return // Let TLDraw's handle system manage existing points
    }

    // Check if clicking on a path segment to add a point
    const segmentInfo = this.getSegmentAtPosition(shape, localPoint)
    if (segmentInfo) {
      this.addPointToSegment(shape, segmentInfo.segmentIndex, localPoint)
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

    // Check if double-clicking on an anchor point to remove it
    const anchorPointIndex = this.getAnchorPointAt(shape, localPoint)
    if (anchorPointIndex !== -1 && shape.props.points.length > 2) {
      this.removePoint(shape, anchorPointIndex)
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

  private getSegmentAtPosition(shape: BezierShape, localPoint: { x: number; y: number }): { segmentIndex: number } | null {
    const threshold = 5 / this.editor.getZoomLevel()
    const points = shape.props.points

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      
      // Simple line distance check (could be enhanced for bezier curves)
      const distToSegment = this.distanceToLineSegment(localPoint, p1, p2)
      
      if (distToSegment < threshold) {
        return { segmentIndex: i }
      }
    }

    // Check closing segment if the path is closed
    if (shape.props.isClosed && points.length > 2) {
      const p1 = points[points.length - 1]
      const p2 = points[0]
      const distToSegment = this.distanceToLineSegment(localPoint, p1, p2)
      
      if (distToSegment < threshold) {
        return { segmentIndex: points.length - 1 }
      }
    }

    return null
  }

  private distanceToLineSegment(
    point: { x: number; y: number }, 
    lineStart: { x: number; y: number }, 
    lineEnd: { x: number; y: number }
  ): number {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    
    if (lenSq === 0) {
      return Math.sqrt(A * A + B * B)
    }

    let t = Math.max(0, Math.min(1, dot / lenSq))
    const projectionX = lineStart.x + t * C
    const projectionY = lineStart.y + t * D
    
    return Math.sqrt(
      Math.pow(point.x - projectionX, 2) + 
      Math.pow(point.y - projectionY, 2)
    )
  }

  private addPointToSegment(shape: BezierShape, segmentIndex: number, localPoint: { x: number; y: number }) {
    const newPoints = [...shape.props.points]
    const newPoint: BezierPoint = {
      x: localPoint.x,
      y: localPoint.y
      // TODO: Calculate appropriate control points for smooth insertion
    }

    // Insert the new point after the segment start
    newPoints.splice(segmentIndex + 1, 0, newPoint)
    
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

  private recalculateBounds(shape: BezierShape, points: BezierPoint[]): BezierShape {
    // Calculate bounds from all points including control points
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

    // Normalize points to new bounds
    const normalizedPoints = points.map(p => ({
      x: p.x - minX,
      y: p.y - minY,
      cp1: p.cp1 ? { x: p.cp1.x - minX, y: p.cp1.y - minY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - minX, y: p.cp2.y - minY } : undefined,
    }))

    return {
      ...shape,
      x: shape.x + minX,
      y: shape.y + minY,
      props: {
        ...shape.props,
        w,
        h,
        points: normalizedPoints,
      }
    }
  }

  private exitEditMode() {
    if (!this.targetShapeId) return

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
      
      // Force transform controls to update by briefly clearing and restoring selection
      setTimeout(() => {
        this.editor.setSelectedShapes([])
        this.editor.setSelectedShapes([this.targetShapeId as any])
      }, 10)
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