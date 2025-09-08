import { StateNode, type TLPointerEventInfo, type TLStateNodeConstructor } from '@tldraw/editor'
import { type BezierShape, type BezierPoint } from '../BezierShape'

export class AddPointIdle extends StateNode {
  static override id = 'idle'

  override onPointerDown(info: TLPointerEventInfo) {
    console.log('AddPointTool - onPointerDown called, target:', info.target, 'shape type:', info.target === 'shape' ? info.shape.type : 'N/A')
    console.log('Full info object:', Object.keys(info))
    
    // Try different ways to get the page point
    let pagePoint = info.currentPagePoint || this.editor.inputs.currentPagePoint
    
    // If still no point, try getting from editor inputs
    if (!pagePoint) {
      const inputs = this.editor.inputs
      console.log('Editor inputs:', Object.keys(inputs))
      pagePoint = inputs.currentPagePoint
    }
    
    console.log('Attempting to get page point:', pagePoint)
    
    if (!pagePoint || typeof pagePoint.x !== 'number' || typeof pagePoint.y !== 'number') {
      console.log('Invalid page point:', pagePoint)
      return
    }
    
    console.log('Valid page point:', pagePoint)
    
    const hitShape = this.editor.getShapeAtPoint(pagePoint, { 
      hitInside: true,
      margin: 0,
    })
    
    console.log('Hit shape:', hitShape?.type || 'none')
    
    if (hitShape && hitShape.type === 'bezier') {
      const shape = hitShape as BezierShape
      
      // Only work with shapes in edit mode
      if (!shape.props.editMode) {
        console.log('Shape not in edit mode. Double-click to enter edit mode first.')
        return
      }

      // Get local coordinates
      const shapePageBounds = this.editor.getShapePageBounds(shape.id)
      if (!shapePageBounds) return

      const localPoint = {
        x: pagePoint.x - shapePageBounds.x,
        y: pagePoint.y - shapePageBounds.y
      }

      console.log('Adding point at local position:', localPoint)

      // Find the best segment to insert the point
      const segmentIndex = this.findNearestSegment(shape.props.points, localPoint)
      if (segmentIndex !== -1) {
        console.log('Found segment at index:', segmentIndex)
        this.addPointToShape(shape, segmentIndex, localPoint)
      } else {
        console.log('No suitable segment found for point addition')
      }
    }
  }

  private findNearestSegment(points: BezierPoint[], localPoint: { x: number; y: number }): number {
    let minDistance = Infinity
    let nearestIndex = -1
    const threshold = 10 // pixels

    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.distanceToLineSegment(localPoint, points[i], points[i + 1])
      if (distance < threshold && distance < minDistance) {
        minDistance = distance
        nearestIndex = i
      }
    }

    return nearestIndex
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

  private addPointToShape(shape: BezierShape, segmentIndex: number, localPoint: { x: number; y: number }) {
    const newPoints = [...shape.props.points]
    const newPoint: BezierPoint = {
      x: localPoint.x,
      y: localPoint.y
    }

    // Insert the new point after the segment start
    newPoints.splice(segmentIndex + 1, 0, newPoint)
    
    const updatedShape = this.recalculateShapeBounds(shape, newPoints)
    this.editor.updateShape(updatedShape)
  }

  private recalculateShapeBounds(shape: BezierShape, points: BezierPoint[]): BezierShape {
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

  override onCancel() {
    this.editor.setCurrentTool('select')
  }
}

export class AddPointTool extends StateNode {
  static override id = 'add-point'
  static override initial = 'idle'
  static override children(): TLStateNodeConstructor[] {
    return [AddPointIdle]
  }

  override onEnter() {
    console.log('AddPointTool activated!')
    // Clear selection to avoid transform controls interfering
    this.editor.setSelectedShapes([])
  }

  override onExit() {
    console.log('AddPointTool deactivated')
  }
}