import { BaseBoxShapeTool } from 'tldraw'

export class DrawTool extends BaseBoxShapeTool {
  static override id = 'custom-draw'
  static override initial = 'idle'
  override shapeType = 'custom-draw' as const
}