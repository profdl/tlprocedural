import { StateNode, type TLEventHandlers, createShapeId } from 'tldraw'
import type { CustomArrowShape } from './ArrowShape'

export class CustomArrowTool extends StateNode {
  static override id = 'custom-arrow'
  static override initial = 'idle'

  override onEnter = () => {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onExit = () => {
    this.editor.setCursor({ type: 'default', rotation: 0 })
  }

  override onKeyDown: TLEventHandlers['onKeyDown'] = (info) => {
    if (info.key === 'Escape') {
      this.editor.setCurrentTool('select')
    }
  }

  override onPointerDown: TLEventHandlers['onPointerDown'] = (info) => {
    if (info.target === 'canvas') {
      const { currentPagePoint } = this.editor.inputs
      
      const arrowShape: CustomArrowShape = {
        id: createShapeId(),
        typeName: 'shape',
        type: 'custom-arrow',
        x: currentPagePoint.x,
        y: currentPagePoint.y,
        rotation: 0,
        index: this.editor.getHighestIndexForParent(this.editor.getCurrentPageId()),
        parentId: this.editor.getCurrentPageId(),
        props: {
          w: 150,
          h: 80,
          color: '#000000',
          fillColor: '#000000',
          strokeWidth: 2,
          fill: true,
        },
        meta: {},
        opacity: 1,
        isLocked: false,
      }

      this.editor.createShape(arrowShape)
      this.editor.setSelectedShapes([arrowShape.id])
      this.editor.setCurrentTool('select')
    }
  }
}