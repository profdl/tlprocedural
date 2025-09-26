import { useEditor, useValue } from 'tldraw'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { ShapeTree } from './layers/ShapeTree'
import './layers/layers-panel.css'

export function LayersPanelContent() {
  const editor = useEditor()

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  // Get all shape IDs on the current page (reversed so front shapes appear at top)
  const shapeIds = useValue(
    'shapeIds',
    () => {
      const pageId = editor.getCurrentPageId()
      const sortedIds = editor.getSortedChildIdsForParent(pageId)
      // Reverse the order so front-most shapes appear at the top of the layer panel
      return [...sortedIds].reverse()
    },
    [editor]
  )

  // Get the current selection for highlighting
  const selectedShapeIds = useValue(
    'selectedShapeIds',
    () => editor.getSelectedShapeIds(),
    [editor]
  )

  // Handle drag end event to reorder shapes
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = shapeIds.indexOf(active.id as string)
    const newIndex = shapeIds.indexOf(over.id as string)

    if (oldIndex === -1 || newIndex === -1) return

    // Calculate how many positions to move
    const positionsToMove = Math.abs(newIndex - oldIndex)
    const movingUp = newIndex < oldIndex // Moving up in the layer panel (toward front in z-order)

    // Apply the reordering using TLDraw's layer methods
    // Since our layer panel is reversed (front shapes at top), moving up = bring forward
    for (let i = 0; i < positionsToMove; i++) {
      if (movingUp) {
        // Moving up in layer panel = bringing forward in z-order
        editor.bringForward([active.id as string])
      } else {
        // Moving down in layer panel = sending backward in z-order
        editor.sendBackward([active.id as string])
      }
    }
  }

  return (
    <div className="layers-panel">
      <div className="layers-panel__content">
        {shapeIds.length === 0 ? (
          <div className="layers-panel__empty">
            <span>No shapes on canvas</span>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={shapeIds} strategy={verticalListSortingStrategy}>
              <ShapeTree
                shapeIds={shapeIds}
                selectedIds={selectedShapeIds}
                depth={0}
              />
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}