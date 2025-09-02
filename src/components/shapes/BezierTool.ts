import { BaseBoxShapeTool } from 'tldraw'

export class BezierTool extends BaseBoxShapeTool {
  static override id = 'bezier'
  static override initial = 'idle'
  override shapeType = 'bezier' as const
}