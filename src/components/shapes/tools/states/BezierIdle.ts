import { StateNode, type TLPointerEventInfo } from '@tldraw/editor'
import { type BezierShape } from '../../BezierShape'

export class BezierIdle extends StateNode {
  static override id = 'idle'

  override onEnter() {
    // Set crosshair cursor when entering pen tool
    this.editor.setCursor({ type: 'cross' })
  }

  override onPointerDown(info: TLPointerEventInfo) {
    console.log('🔵 BezierIdle.onPointerDown:', {
      target: info.target,
      currentTool: this.editor.getCurrentToolId(),
      shape: info.target === 'shape' ? {
        id: info.shape?.id,
        type: info.shape?.type,
        editMode: info.shape?.type === 'bezier' ? (info.shape as BezierShape).props.editMode : 'N/A'
      } : null
    })
    
    if (info.target === 'canvas') {
      console.log('🎯 BezierIdle: Transitioning to creating')
      this.parent.transition('creating', info)
    } else if (info.target === 'shape' && info.shape.type === 'bezier') {
      // If clicking on a bezier shape that's in edit mode, transition to editing
      const shape = info.shape as BezierShape
      console.log('📝 BezierIdle: Clicked on bezier shape', {
        shapeId: shape.id,
        editMode: shape.props.editMode
      })
      if (shape.props.editMode) {
        console.log('🔄 BezierIdle: Transitioning to editing')
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