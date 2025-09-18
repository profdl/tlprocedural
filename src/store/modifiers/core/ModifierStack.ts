import type { TLShape, Editor } from 'tldraw'
import type { 
  TLModifier, 
  ShapeState, 
  ModifierProcessor
} from '../../../types/modifiers'
import { 
  createInitialShapeState
} from './ShapeStateManager'
import {
  LinearArrayProcessor,
  CircularArrayProcessor,
  GridArrayProcessor,
  MirrorProcessor,
  LSystemProcessor
} from '../processors'
import { SubdivideProcessor } from '../processors/SubdivideProcessor'
import { NoiseOffsetProcessor } from '../processors/NoiseOffsetProcessor'
import { SmoothProcessor } from '../processors/SmoothProcessor'
import { SimplifyProcessor } from '../processors/SimplifyProcessor'
import { findTopLevelGroup, getGroupPageBounds, getGroupChildShapes } from '../../../components/modifiers/utils'

/**
 * Refactored ModifierStack class
 * Processes modifiers in sequence using extracted processor modules
 */
export class ModifierStack {
  // Process a list of modifiers in sequence
  static processModifiers(
    originalShape: TLShape, 
    modifiers: TLModifier[],
    editor?: Editor
  ): ShapeState {

    if (modifiers.length === 0) {
      return createInitialShapeState(originalShape)
    }

    // Check if this shape is part of a group
    const parentGroup = editor ? findTopLevelGroup(originalShape, editor) : null
    
    
    // Special case: if the shape itself is a group, use group processing
    if (originalShape.type === 'group' && editor) {
      return ModifierStack.processGroupModifiers(originalShape, originalShape, modifiers, editor)
    }
    
    if (parentGroup && editor) {
      return ModifierStack.processGroupModifiers(originalShape, parentGroup, modifiers, editor)
    }
    
    
    // Start with the original shape as initial state
    let currentState = createInitialShapeState(originalShape)
    
    // Filter to only enabled modifiers, sorted by order
    const enabledModifiers = modifiers
      .filter(modifier => modifier.enabled)
      .sort((a, b) => a.order - b.order)


    // Process each modifier in sequence
    for (const modifier of enabledModifiers) {
      try {
        const processor = ModifierStack.getProcessor(modifier.type)
        if (processor) {
          const previousState = currentState
          currentState = processor.process(currentState, modifier.props, undefined, editor)

          // Validate the result
          if (!currentState || !currentState.instances) {
            console.warn(`Modifier ${modifier.type} (${modifier.id}) returned invalid state, reverting to previous state`)
            currentState = previousState
          }
        } else {
          console.warn(`No processor found for modifier type: ${modifier.type}`)
        }
      } catch (error) {
        console.error(`Error processing modifier ${modifier.type} (${modifier.id}):`, error)
        // Continue with the previous state instead of crashing
        console.warn(`Skipping modifier ${modifier.type} due to error`)
      }
    }


    return currentState
  }

  /**
   * Process modifiers for shapes that are part of a group
   */
  private static processGroupModifiers(
    shape: TLShape,
    group: TLShape,
    modifiers: TLModifier[],
    editor: Editor
  ): ShapeState {
    // Use TLDraw's built-in group utilities
    const childShapes = getGroupChildShapes(group, editor)
    const groupBounds = getGroupPageBounds(group, editor)
    const groupTopLeft = {
      x: groupBounds.minX,
      y: groupBounds.minY
    }
    
    
    // Create initial state with child shapes in the group, not just the selected one
    const allInstances = childShapes.map((groupShape: TLShape, index: number) => {
      // Convert child shape position from parent space to page space
      const childPageBounds = editor.getShapePageBounds(groupShape.id)
      const pageX = childPageBounds ? childPageBounds.x : groupShape.x
      const pageY = childPageBounds ? childPageBounds.y : groupShape.y

      return {
        shape: groupShape,
        transform: {
          x: pageX,
          y: pageY,
          rotation: groupShape.rotation || 0,
          scaleX: 1,
          scaleY: 1
        },
        index,
        metadata: {
          isOriginal: true,
          isGroupMember: true,
          groupId: group.id
        }
      }
    })
    
    let currentState: ShapeState = {
      originalShape: shape, // Keep the selected shape as original for compatibility
      instances: allInstances,
      metadata: { isGroupModifier: true, groupId: group.id }
    }
    
    // Filter to only enabled modifiers, sorted by order
    const enabledModifiers = modifiers
      .filter(modifier => modifier.enabled)
      .sort((a, b) => a.order - b.order)
    
    // Process each modifier in sequence with group context
    for (const modifier of enabledModifiers) {
      const processor = ModifierStack.getProcessor(modifier.type)
      if (processor) {
        const groupContext = { 
          groupCenter: { x: groupBounds.centerX, y: groupBounds.centerY },
          groupTopLeft,
          groupShapes: childShapes,
          groupBounds,
          groupTransform: {
            x: group.x,
            y: group.y,
            rotation: group.rotation || 0
          }
        }
        currentState = processor.process(currentState, modifier.props, groupContext, editor)
      }
    }
    
    return currentState
  }

  /**
   * Get the appropriate processor for a modifier type
   */
  private static getProcessor(type: string): ModifierProcessor | null {
    switch (type) {
      case 'linear-array':
        return LinearArrayProcessor
      case 'circular-array':
        return CircularArrayProcessor
      case 'grid-array':
        return GridArrayProcessor
      case 'mirror':
        return MirrorProcessor
      case 'lsystem':
        return LSystemProcessor
      // Path modifiers
      case 'subdivide':
        return SubdivideProcessor
      case 'noise-offset':
        return NoiseOffsetProcessor
      case 'smooth':
        return SmoothProcessor
      case 'simplify':
        return SimplifyProcessor
      default:
        console.error(`❌ Unknown modifier type: ${type}`)
        return null
    }
  }
} 