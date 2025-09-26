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

    const activeId = active.id as string
    const overId = over.id as string

    // Get the shapes to understand their current hierarchy
    const activeShape = editor.getShape(activeId)
    const overShape = editor.getShape(overId)

    if (!activeShape || !overShape) return

    // Determine the operation based on the drop target
    const activeParentId = activeShape.parentId
    const overParentId = overShape.parentId

    // Check if we're dropping over a group handle (special handling for group operations)
    if (over.data.current?.type === 'group-drop-zone') {
      // Drop into group: reparent the shape to the group
      const targetGroupId = over.data.current.groupId
      const targetGroup = editor.getShape(targetGroupId)

      if (targetGroup && targetGroup.type === 'group' && activeParentId !== targetGroupId) {
        // Move shape into the group
        editor.reparentShapes([activeShape], targetGroupId)
        return
      }
    }

    // Check if we're dropping over the page root (ungrouping)
    if (over.data.current?.type === 'page-drop-zone') {
      // Move shape to page root (ungroup if it was in a group)
      const pageId = editor.getCurrentPageId()
      if (activeParentId !== pageId) {
        editor.reparentShapes([activeShape], pageId)
        return
      }
    }

    // Handle reordering within the same parent
    if (activeParentId === overParentId) {
      // Get all siblings in the same parent
      const siblings = editor.getSortedChildIdsForParent(activeParentId)
      const reversedSiblings = [...siblings].reverse() // Match our reversed display order

      const oldIndex = reversedSiblings.indexOf(activeId)
      const newIndex = reversedSiblings.indexOf(overId)

      if (oldIndex === -1 || newIndex === -1) return

      // Calculate how many positions to move
      const positionsToMove = Math.abs(newIndex - oldIndex)
      const movingUp = newIndex < oldIndex // Moving up in the layer panel (toward front in z-order)

      // Apply the reordering using TLDraw's layer methods
      for (let i = 0; i < positionsToMove; i++) {
        if (movingUp) {
          editor.bringForward([activeId])
        } else {
          editor.sendBackward([activeId])
        }
      }
    } else {
      // Cross-parent operation: move to the same parent as the drop target
      editor.reparentShapes([activeShape], overParentId)

      // Then reorder within the new parent if needed
      const newSiblings = editor.getSortedChildIdsForParent(overParentId)
      const reversedNewSiblings = [...newSiblings].reverse()
      const targetIndex = reversedNewSiblings.indexOf(overId)
      const newShapeIndex = reversedNewSiblings.indexOf(activeId)

      if (targetIndex !== -1 && newShapeIndex !== -1 && targetIndex !== newShapeIndex) {
        const positionsToMove = Math.abs(targetIndex - newShapeIndex)
        const movingUp = targetIndex < newShapeIndex

        for (let i = 0; i < positionsToMove; i++) {
          if (movingUp) {
            editor.bringForward([activeId])
          } else {
            editor.sendBackward([activeId])
          }
        }
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