import { BaseBoxShapeTool } from 'tldraw'

export class RectangleTool extends BaseBoxShapeTool {
  static override id = 'rectangle'
  static override initial = 'idle'
  override shapeType = 'rectangle' as const

  override onDoubleClick = () => {
    // Optional: Could implement double-click behavior
  }
}