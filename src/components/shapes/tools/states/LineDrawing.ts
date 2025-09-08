import { 
  StateNode, 
  type TLPointerEventInfo, 
  type TLKeyboardEventInfo,
  createShapeId,
  Vec,
  type TLShapePartial,
  snapAngle
} from '@tldraw/editor'
import { type LineShape } from '../../LineShape'

export class LineDrawing extends StateNode {
  static override id = 'drawing'

  info = {} as TLPointerEventInfo
  shapeId = createShapeId()
  startPoint?: Vec
  isConstrainingAngle = false

  override onEnter(info: TLPointerEventInfo) {
    this.info = info
    this.shapeId = createShapeId()
    this.startPoint = this.editor.inputs.currentPagePoint.clone()
    this.isConstrainingAngle = this.editor.inputs.shiftKey
    
    // Create initial line shape
    this.createInitialShape()
  }

  override onPointerMove() {
    if (!this.startPoint) return
    
    let endPoint = this.editor.inputs.currentPagePoint.clone()
    
    // Apply angle constraint if Shift is held
    if (this.isConstrainingAngle) {
      const angle = Vec.Angle(this.startPoint, endPoint)
      const snappedAngle = snapAngle(angle, 8) // Snap to 45-degree increments
      const distance = Vec.Dist(this.startPoint, endPoint)
      endPoint = Vec.Add(this.startPoint, Vec.FromAngle(snappedAngle, distance))
    }
    
    this.updateShape(endPoint)
  }

  override onPointerUp() {
    // Complete the line
    this.completeLine()
  }

  override onKeyDown(info: TLKeyboardEventInfo) {
    if (info.key === 'Shift') {
      this.isConstrainingAngle = true
    } else if (info.key === 'Escape') {
      this.cancel()
    }
  }

  override onKeyUp(info: TLKeyboardEventInfo) {
    if (info.key === 'Shift') {
      this.isConstrainingAngle = false
    }
  }

  private createInitialShape() {
    if (!this.startPoint) return
    
    const partial: TLShapePartial<LineShape> = {
      id: this.shapeId,
      type: 'custom-line',
      x: this.startPoint.x,
      y: this.startPoint.y,
      props: {
        w: 1,
        h: 1,
        color: '#000000',
        strokeWidth: 2,
        dash: 'solid',
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
      },
    }

    this.editor.createShape(partial)
  }

  private updateShape(endPoint: Vec) {
    if (!this.startPoint) return
    
    const minX = Math.min(this.startPoint.x, endPoint.x)
    const minY = Math.min(this.startPoint.y, endPoint.y)
    const maxX = Math.max(this.startPoint.x, endPoint.x)
    const maxY = Math.max(this.startPoint.y, endPoint.y)
    
    const w = Math.max(1, maxX - minX)
    const h = Math.max(1, maxY - minY)
    
    // Convert to local coordinates
    const startX = this.startPoint.x - minX
    const startY = this.startPoint.y - minY
    const endX = endPoint.x - minX
    const endY = endPoint.y - minY

    const partial: TLShapePartial<LineShape> = {
      id: this.shapeId,
      type: 'custom-line',
      x: minX,
      y: minY,
      props: {
        w,
        h,
        startX,
        startY,
        endX,
        endY,
      },
    }

    this.editor.updateShape(partial)
  }

  private completeLine() {
    if (!this.startPoint) return
    
    const endPoint = this.editor.inputs.currentPagePoint.clone()
    const distance = Vec.Dist(this.startPoint, endPoint)
    
    // Only complete if the line has some length
    if (distance < 2) {
      this.cancel()
      return
    }
    
    this.updateShape(endPoint)
    this.editor.setCurrentTool('select')
    this.editor.setSelectedShapes([this.shapeId])
  }

  private cancel() {
    this.editor.deleteShape(this.shapeId)
    this.parent.transition('idle')
  }

  override onExit() {
    this.startPoint = undefined
  }
}