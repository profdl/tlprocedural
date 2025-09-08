import { StateNode, type TLPointerEventInfo, type TLStateNodeConstructor } from '@tldraw/editor'
import { type BezierShape, type BezierPoint } from '../BezierShape'

export class RemovePointIdle extends StateNode {
  static override id = 'idle'

  override onPointerDown(info: TLPointerEventInfo) {
    console.log('RemovePointTool - onPointerDown called, target:', info.target, 'shape type:', info.target === 'shape' ? info.shape.type : 'N/A')
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

      console.log('Checking for point to remove at local position:', localPoint)

      // Check if clicking on an anchor point
      const anchorPointIndex = this.getAnchorPointAt(shape, localPoint)
      if (anchorPointIndex !== -1) {
        if (shape.props.points.length > 2) {
          console.log('Removing point at index:', anchorPointIndex)
          this.removePointFromShape(shape, anchorPointIndex)
        } else {
          console.log('Cannot remove point - minimum 2 points required')
        }
      } else {
        console.log('No anchor point found near click position')
      }
    }
  }

  private getAnchorPointAt(shape: BezierShape, localPoint: { x: number; y: number }): number {
    const threshold = 10 // pixels
    
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

  private removePointFromShape(shape: BezierShape, pointIndex: number) {
    if (shape.props.points.length <= 2) return // Minimum 2 points

    const newPoints = [...shape.props.points]
    newPoints.splice(pointIndex, 1)
    
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

export class RemovePointTool extends StateNode {
  static override id = 'remove-point'
  static override initial = 'idle'
  static override children(): TLStateNodeConstructor[] {
    return [RemovePointIdle]
  }

  override onEnter() {
    console.log('RemovePointTool activated!')
    // Clear selection to avoid transform controls interfering
    this.editor.setSelectedShapes([])
  }

  override onExit() {
    console.log('RemovePointTool deactivated')
  }
}