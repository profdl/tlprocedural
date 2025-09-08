import { StateNode, type TLStateNodeConstructor } from '@tldraw/editor'
import { DrawIdle } from './states/DrawIdle'
import { DrawCreating } from './states/DrawCreating'

export class DrawTool extends StateNode {
  static override id = 'custom-draw'
  static override initial = 'idle'
  static override isLockable = false
  static override children(): TLStateNodeConstructor[] {
    return [DrawIdle, DrawCreating]
  }

  override shapeType = 'custom-draw'
}