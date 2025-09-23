import { StateNode, TLClickEventInfo, TLKeyboardEventInfo } from 'tldraw'

/**
 * Tool for handling group edit mode on custom shape instances
 * Detects double-clicks on multi-shape custom shape instances and enters group edit mode
 */
export class GroupEditTool extends StateNode {
  static override id = 'group-edit'

  override onDoubleClick(info: TLClickEventInfo) {
    const hitShape = info.shape

    if (!hitShape) {
      return
    }

    // Check if this is a custom shape instance
    const isCustomShapeInstance = hitShape.meta?.isCustomShapeInstance === true
    const customShapeId = hitShape.meta?.customShapeId as string

    if (!isCustomShapeInstance || !customShapeId) {
      return
    }

    // Get the custom shape definition to check if it's multi-shape
    const customShapes = this.getCustomShapes()
    const customShape = customShapes?.find(shape => shape.id === customShapeId)

    if (!customShape || customShape.shapeType !== 'multi-shape') {
      // For single shapes, let the default editing behavior handle it
      return
    }

    // This is a multi-shape custom shape instance - enter group edit mode
    this.enterGroupEditMode(hitShape.id, customShapeId)
  }

  override onKeyDown(info: TLKeyboardEventInfo) {
    if (info.key === 'Escape') {
      // Exit group edit mode
      this.exitGroupEditMode()
    }
  }

  /**
   * Enter group edit mode for a multi-shape custom shape instance
   */
  private enterGroupEditMode(instanceShapeId: string, customShapeId: string) {
    const editor = this.editor

    // Find all shapes that belong to this custom shape instance
    const allShapes = editor.getCurrentPageShapes()
    const instanceShapes = allShapes.filter(shape =>
      shape.meta?.customShapeId === customShapeId &&
      shape.meta?.instanceId === allShapes.find(s => s.id === instanceShapeId)?.meta?.instanceId
    )

    if (instanceShapes.length === 0) {
      console.warn('No instance shapes found for custom shape:', customShapeId)
      return
    }

    // Update metadata to indicate group edit mode
    const shapeUpdates = instanceShapes.map(shape => ({
      ...shape,
      meta: {
        ...shape.meta,
        groupEditMode: true,
        groupEditInstanceId: instanceShapeId
      }
    }))

    editor.run(() => {
      editor.updateShapes(shapeUpdates)
      // Select all shapes in the group for easier editing
      editor.setSelectedShapes(instanceShapes.map(s => s.id))
    }, { history: 'record-preserveRedoStack' })

    // Store the current group edit state
    this.setGroupEditState(customShapeId, instanceShapeId, instanceShapes.map(s => s.id))

    console.log('Entered group edit mode for custom shape:', customShapeId)
  }

  /**
   * Exit group edit mode
   */
  private exitGroupEditMode() {
    const groupEditState = this.getGroupEditState()

    if (!groupEditState) {
      return
    }

    const { customShapeId, instanceShapeId, shapeIds } = groupEditState
    const editor = this.editor

    // Update metadata to exit group edit mode
    const shapeUpdates = shapeIds.map(shapeId => {
      const shape = editor.getShape(shapeId)
      if (!shape) return null

      return {
        ...shape,
        meta: {
          ...shape.meta,
          groupEditMode: false,
          groupEditInstanceId: undefined
        }
      }
    }).filter(Boolean)

    if (shapeUpdates.length > 0) {
      editor.run(() => {
        editor.updateShapes(shapeUpdates)
        // Clear selection
        editor.setSelectedShapes([])
      }, { history: 'record-preserveRedoStack' })
    }

    // Clear the group edit state
    this.clearGroupEditState()

    console.log('Exited group edit mode for custom shape:', customShapeId)
  }

  /**
   * Get custom shapes from the global state
   * This should be connected to the useCustomShapes hook
   */
  private getCustomShapes() {
    // TODO: Connect to the actual custom shapes store
    // For now, we'll access it through a global reference
    return (window as any).__customShapes || []
  }

  /**
   * Store group edit state in the editor's instance state
   */
  private setGroupEditState(customShapeId: string, instanceShapeId: string, shapeIds: string[]) {
    const instanceState = this.editor.getInstanceState()
    this.editor.updateInstanceState({
      ...instanceState,
      groupEditState: {
        customShapeId,
        instanceShapeId,
        shapeIds
      }
    })
  }

  /**
   * Get the current group edit state
   */
  private getGroupEditState() {
    const instanceState = this.editor.getInstanceState()
    return (instanceState as any).groupEditState || null
  }

  /**
   * Clear the group edit state
   */
  private clearGroupEditState() {
    const instanceState = this.editor.getInstanceState()
    this.editor.updateInstanceState({
      ...instanceState,
      groupEditState: null
    })
  }
}