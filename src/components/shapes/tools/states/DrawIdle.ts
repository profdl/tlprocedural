import { StateNode, type TLPointerEventInfo } from '@tldraw/editor'

export class DrawIdle extends StateNode {
  static override id = 'idle'

  override onPointerDown(info: TLPointerEventInfo) {
    if (info.target === 'canvas') {
      this.parent.transition('creating', info)
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