import { BaseBoxShapeTool } from 'tldraw'

export class CircleTool extends BaseBoxShapeTool {
  static override id = 'circle'
  static override initial = 'idle'
  override shapeType = 'circle' as const

  override onDoubleClick = () => {
    // Optional: Could implement double-click behavior
  }
}