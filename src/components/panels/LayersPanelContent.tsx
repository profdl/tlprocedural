import { useEditor, useValue } from 'tldraw'
import { ShapeTree } from './layers/ShapeTree'
import './layers/layers-panel.css'

export function LayersPanelContent() {
  const editor = useEditor()

  // Get all shape IDs on the current page
  const shapeIds = useValue(
    'shapeIds',
    () => {
      const pageId = editor.getCurrentPageId()
      return editor.getSortedChildIdsForParent(pageId)
    },
    [editor]
  )

  // Get the current selection for highlighting
  const selectedShapeIds = useValue(
    'selectedShapeIds',
    () => editor.getSelectedShapeIds(),
    [editor]
  )

  return (
    <div className="layers-panel">
      <div className="layers-panel__content">
        {shapeIds.length === 0 ? (
          <div className="layers-panel__empty">
            <span>No shapes on canvas</span>
          </div>
        ) : (
          <ShapeTree
            shapeIds={shapeIds}
            selectedIds={selectedShapeIds}
            depth={0}
          />
        )}
      </div>
    </div>
  )
}