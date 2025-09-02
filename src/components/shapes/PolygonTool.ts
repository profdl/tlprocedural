import { BaseBoxShapeTool } from 'tldraw'

export class PolygonTool extends BaseBoxShapeTool {
  static override id = 'polygon'
  static override initial = 'idle'
  override shapeType = 'polygon' as const

  override onDoubleClick = () => {
    // Optional: Could implement double-click to change number of sides
  }
}