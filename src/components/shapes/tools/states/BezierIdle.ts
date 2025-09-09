import { StateNode, type TLPointerEventInfo } from '@tldraw/editor'
import { type BezierShape } from '../../BezierShape'

export class BezierIdle extends StateNode {
  static override id = 'idle'

  override onEnter() {
    // Set crosshair cursor when entering pen tool
    this.editor.setCursor({ type: 'cross' })
  }

  override onPointerDown(info: TLPointerEventInfo) {
    if (info.target === 'canvas') {
      this.parent.transition('creating', info)
    } else if (info.target === 'shape' && info.shape.type === 'bezier') {
      // If clicking on a bezier shape that's in edit mode, transition to editing
      const shape = info.shape as BezierShape
      if (shape.props.editMode) {
        this.parent.transition('editing', info)
      }
    }
  }

  override onCancel() {
    this.editor.setCurrentTool('select')
  }

  override onComplete() {
    this.editor.setCurrentTool('select')
  }

  override onInterrupt() {
    this.editor.setCurrentTool('select')
  }
}