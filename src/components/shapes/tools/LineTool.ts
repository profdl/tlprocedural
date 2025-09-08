import { StateNode, type TLStateNodeConstructor } from '@tldraw/editor'
import { LineIdle } from './states/LineIdle'
import { LineDrawing } from './states/LineDrawing'

export class LineTool extends StateNode {
  static override id = 'custom-line'
  static override initial = 'idle'
  static override isLockable = false
  static override children(): TLStateNodeConstructor[] {
    return [LineIdle, LineDrawing]
  }

  override shapeType = 'custom-line'
}