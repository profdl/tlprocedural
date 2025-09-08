import { StateNode, type TLStateNodeConstructor } from '@tldraw/editor'
import { BezierIdle } from './states/BezierIdle'
import { BezierCreating } from './states/BezierCreating'
import { BezierEditing } from './states/BezierEditing'

export class BezierTool extends StateNode {
  static override id = 'bezier'
  static override initial = 'idle'
  static override isLockable = false
  static override children(): TLStateNodeConstructor[] {
    return [BezierIdle, BezierCreating, BezierEditing]
  }

  override shapeType = 'bezier'
}