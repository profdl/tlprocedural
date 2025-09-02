import { BaseBoxShapeTool } from 'tldraw'

export class LineTool extends BaseBoxShapeTool {
  static override id = 'custom-line'
  static override initial = 'idle'
  override shapeType = 'custom-line' as const
}