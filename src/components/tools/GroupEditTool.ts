import { StateNode, TLClickEventInfo, TLKeyboardEventInfo } from 'tldraw'
import type { Editor, TLShapeId } from 'tldraw'
import { getCustomShapeFromRegistry } from '../providers/CustomShapesRegistry'

interface GroupEditState {
  customShapeId: string
  instanceShapeId: TLShapeId
  shapeIds: TLShapeId[]
}

type ShapeUpdate = Parameters<Editor['updateShapes']>[0][number]

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
    const metaCustomShapeId = hitShape.meta?.customShapeId
    const customShapeId = typeof metaCustomShapeId === 'string' ? metaCustomShapeId : null

    if (!isCustomShapeInstance || !customShapeId) {
      return
    }

    // Get the custom shape definition to check if it's multi-shape
    const customShape = getCustomShapeFromRegistry(customShapeId)

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
  private enterGroupEditMode(instanceShapeId: TLShapeId, customShapeId: string) {
    const editor = this.editor

    // Find all shapes that belong to this custom shape instance
    const allShapes = editor.getCurrentPageShapes()
    const representativeShape = allShapes.find(shape => shape.id === instanceShapeId)
    const instanceId = typeof representativeShape?.meta?.instanceId === 'string'
      ? representativeShape.meta.instanceId
      : null

    if (!instanceId) {
      console.warn('No instance metadata found for shape:', instanceShapeId)
      return
    }

    const instanceShapes = allShapes.filter(shape =>
      shape.meta?.customShapeId === customShapeId && shape.meta?.instanceId === instanceId
    )

    if (instanceShapes.length === 0) {
      console.warn('No instance shapes found for custom shape:', customShapeId)
      return
    }

    // Update metadata to indicate group edit mode
    const shapeUpdates: ShapeUpdate[] = instanceShapes.map(shape => ({
      id: shape.id,
      type: shape.type,
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
    const shapeIds = instanceShapes.map(shape => shape.id as TLShapeId)
    this.setGroupEditState(customShapeId, instanceShapeId, shapeIds)

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

    const { customShapeId, shapeIds } = groupEditState
    const editor = this.editor

    // Update metadata to exit group edit mode
    const shapeUpdates: ShapeUpdate[] = []

    shapeIds.forEach(shapeId => {
      const shape = editor.getShape(shapeId)
      if (!shape) return

      shapeUpdates.push({
        id: shape.id,
        type: shape.type,
        meta: {
          ...shape.meta,
          groupEditMode: false,
          groupEditInstanceId: undefined
        }
      })
    })

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
   * Store group edit state in the editor's instance state
   */
  private setGroupEditState(customShapeId: string, instanceShapeId: TLShapeId, shapeIds: TLShapeId[]) {
    const instanceState = this.editor.getInstanceState()
    const nextState: GroupEditState = {
      customShapeId,
      instanceShapeId,
      shapeIds
    }

    this.editor.updateInstanceState({
      ...instanceState,
      groupEditState: nextState
    })
  }

  /**
   * Get the current group edit state
   */
  private getGroupEditState(): GroupEditState | null {
    const instanceState = this.editor.getInstanceState() as unknown as { groupEditState?: GroupEditState | null }
    return instanceState.groupEditState ?? null
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
