import { useEditor, useValue } from 'tldraw'
import { useGroupEditMode } from './hooks/useGroupEditMode'
import type { TLShape, Box } from 'tldraw'

interface ShapeInEdit {
  id: string
  bounds: Box
  shape: TLShape
}

/**
 * Component that renders visual indicators for shapes in group edit mode
 * Shows a colored outline around shapes that are part of a group being edited
 */
export function GroupEditIndicator() {
  const editor = useEditor()
  const { currentGroupEditState } = useGroupEditMode()

  // Get all shapes in both custom group edit mode and native TLDraw group edit mode
  const shapesInGroupEdit = useValue(
    'shapes-in-group-edit',
    () => {
      const allShapes = editor.getCurrentPageShapes()
      const shapesInEdit: ShapeInEdit[] = []

      // Add shapes from custom group edit mode (keyboard shortcut triggered)
      if (currentGroupEditState) {
        currentGroupEditState.shapeIds.forEach(id => {
          const shape = editor.getShape(id)
          if (!shape) return

          const bounds = editor.getShapePageBounds(id)
          if (!bounds) return

          shapesInEdit.push({ id, bounds, shape })
        })
      }

      // Add shapes in native TLDraw group edit mode (double-click triggered)
      allShapes.forEach(shape => {
        if (shape.meta?.nativeGroupEdit === true) {
          const bounds = editor.getShapePageBounds(shape.id)
          if (bounds) {
            // Avoid duplicates from custom group edit mode
            const alreadyAdded = shapesInEdit.some(item => item.id === shape.id)
            if (!alreadyAdded) {
              shapesInEdit.push({ id: shape.id, bounds, shape })
            }
          }
        }
      })

      return shapesInEdit
    },
    [editor, currentGroupEditState]
  )

  // Show indicators if we have shapes in either custom or native group edit mode
  const hasShapesInEdit = shapesInGroupEdit.length > 0
  const isInNativeGroupEdit = shapesInGroupEdit.some(item => item.shape.meta?.nativeGroupEdit === true)

  if (!hasShapesInEdit) {
    return null
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
      {shapesInGroupEdit.map(({ id, bounds }) => {
        // Convert page bounds to screen coordinates
        const topLeft = editor.pageToScreen({ x: bounds.x, y: bounds.y })
        const bottomRight = editor.pageToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height })

        return (
          <div
            key={id}
            className="absolute border-2 border-blue-500 rounded-sm"
            style={{
              left: topLeft.x - 4,
              top: topLeft.y - 4,
              width: (bottomRight.x - topLeft.x) + 8,
              height: (bottomRight.y - topLeft.y) + 8,
              boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3), 0 0 8px rgba(59, 130, 246, 0.2)',
              background: 'rgba(59, 130, 246, 0.05)',
              transition: 'all 0.2s ease',
              pointerEvents: 'none'
            }}
          />
        )
      })}

      {/* Group edit mode indicator text */}
      <div
        className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm font-medium shadow-lg"
        style={{ zIndex: 1001 }}
      >
        {isInNativeGroupEdit
          ? 'Group Edit Mode - Double-click outside or press ESC to exit'
          : 'Group Edit Mode - Press ESC to exit or double-click on multi-shape groups'}
      </div>
    </div>
  )
}
