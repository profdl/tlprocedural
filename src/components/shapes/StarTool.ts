import { BaseBoxShapeTool } from 'tldraw'

export class StarTool extends BaseBoxShapeTool {
  static override id = 'star'
  static override initial = 'idle'
  override shapeType = 'star' as const

  override onDoubleClick = () => {
    // Optional: Could implement double-click behavior
  }
}