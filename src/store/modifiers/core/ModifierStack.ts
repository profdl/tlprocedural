import type { TLShape, Editor } from 'tldraw'
import type { TLModifier } from '../../../types/modifiers'
import { TransformComposer, type VirtualModifierState } from './TransformComposer'
import { findTopLevelGroup, getGroupPageBounds, getGroupChildShapes } from '../../../components/modifiers/utils'

/**
 * ModifierStack using efficient matrix-based transform composition
 * Dramatically improves performance by using virtual instances
 */
export class ModifierStack {
  /**
   * Process modifiers using the new efficient TransformComposer
   * Returns virtual instances instead of creating intermediate shapes
   */
  static processModifiers(
    originalShape: TLShape,
    modifiers: TLModifier[],
    editor?: Editor
  ): VirtualModifierState {

    // Check if this shape is part of a group for context
    const parentGroup = editor ? findTopLevelGroup(originalShape, editor) : null
    let groupContext = undefined

    if (parentGroup && editor) {
      // Build group context for processing
      const childShapes = getGroupChildShapes(parentGroup, editor)
      const groupBounds = getGroupPageBounds(parentGroup, editor)

      groupContext = {
        groupCenter: { x: groupBounds.centerX, y: groupBounds.centerY },
        groupTopLeft: { x: groupBounds.minX, y: groupBounds.minY },
        groupShapes: childShapes,
        groupBounds: {
          minX: groupBounds.minX,
          maxX: groupBounds.maxX,
          minY: groupBounds.minY,
          maxY: groupBounds.maxY,
          width: groupBounds.width,
          height: groupBounds.height,
          centerX: groupBounds.centerX,
          centerY: groupBounds.centerY
        },
        groupTransform: {
          x: parentGroup.x,
          y: parentGroup.y,
          rotation: parentGroup.rotation || 0
        }
      }
    }

    // Use the new TransformComposer for efficient processing
    return TransformComposer.processModifiers(originalShape, modifiers, groupContext)
  }

} 