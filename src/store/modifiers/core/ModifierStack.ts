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
  MirrorProcessor
} from '../processors'
import { findTopLevelGroup, calculateGroupBounds } from '../../../components/modifiers/utils'

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
    console.log('🔄 ModifierStack: Processing modifiers:', {
      shapeId: originalShape.id,
      shapeType: originalShape.type,
      modifierCount: modifiers.length,
      modifiers: modifiers.map(m => ({ type: m.type, enabled: m.enabled, order: m.order }))
    })

    if (modifiers.length === 0) {
      return createInitialShapeState(originalShape)
    }

    // Check if this shape is part of a group
    const parentGroup = editor ? findTopLevelGroup(originalShape, editor) : null
    
    console.log('Group detection:', {
      shapeId: originalShape.id,
      shapeType: originalShape.type,
      parentGroup: parentGroup ? { id: parentGroup.id, type: parentGroup.type } : null,
      hasEditor: !!editor
    })
    
    // Special case: if the shape itself is a group, use group processing
    if (originalShape.type === 'group' && editor) {
      console.log('Shape is a group, using group processing path')
      return ModifierStack.processGroupModifiers(originalShape, originalShape, modifiers, editor)
    }
    
    if (parentGroup && editor) {
      console.log('Using group processing path')
      return ModifierStack.processGroupModifiers(originalShape, parentGroup, modifiers, editor)
    }
    
    console.log('Using regular processing path')
    
    // Start with the original shape as initial state
    let currentState = createInitialShapeState(originalShape)
    
    // Filter to only enabled modifiers, sorted by order
    const enabledModifiers = modifiers
      .filter(modifier => modifier.enabled)
      .sort((a, b) => a.order - b.order)

    // Debug logging for multiple modifier processing
    if (enabledModifiers.length > 1) {
      console.log(`🔧 Processing ${enabledModifiers.length} modifiers for shape:`, originalShape.id)
      enabledModifiers.forEach((mod, index) => {
        console.log(`  ${index + 1}. ${mod.type} (order: ${mod.order})`)
      })
    }

    // Process each modifier in sequence
    for (const modifier of enabledModifiers) {
      const processor = ModifierStack.getProcessor(modifier.type)
      if (processor) {
        const previousInstanceCount = currentState.instances.length
        currentState = processor.process(currentState, modifier.props)
        const newInstanceCount = currentState.instances.length
        
        if (enabledModifiers.length > 1) {
          console.log(`    ${modifier.type}: ${previousInstanceCount} → ${newInstanceCount} instances`)
        }
      }
    }

    if (enabledModifiers.length > 1) {
      console.log(`✅ Final result: ${currentState.instances.length} total instances`)
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
    // Get all shapes in the group
    const groupShapeIds = editor.getShapeAndDescendantIds([group.id])
    const groupShapes = Array.from(groupShapeIds)
      .map(id => editor.getShape(id))
      .filter(Boolean) as TLShape[]
    
    // Filter out the group shape itself - we only want child shapes for bounds calculation
    const childShapes = groupShapes.filter(shape => shape.id !== group.id)
    
    console.log('Child shapes for bounds calculation:', childShapes.map(s => ({
      id: s.id,
      type: s.type,
      x: s.x,
      y: s.y,
      hasW: 'w' in s.props,
      hasH: 'h' in s.props
    })))
    
    // Calculate group bounds using top-left corner as reference
    const groupBounds = calculateGroupBounds(childShapes)
    const groupTopLeft = {
      x: groupBounds.minX,
      y: groupBounds.minY
    }
    
    console.log('Processing group modifiers:', {
      groupId: group.id,
      allGroupShapes: groupShapes.length,
      childShapes: childShapes.length,
      groupBounds,
      groupTopLeft,
      groupTransform: {
        x: group.x,
        y: group.y,
        rotation: group.rotation
      }
    })
    
    // Create initial state with child shapes in the group, not just the selected one
    const allInstances = childShapes.map((groupShape, index) => {
      console.log(`Group shape ${index}:`, {
        id: groupShape.id,
        type: groupShape.type,
        props: groupShape.props,
        x: groupShape.x,
        y: groupShape.y,
        hasW: 'w' in groupShape.props,
        hasH: 'h' in groupShape.props,
        w: 'w' in groupShape.props ? groupShape.props.w : 'N/A',
        h: 'h' in groupShape.props ? groupShape.props.h : 'N/A'
      })
      
      return {
        shape: groupShape,
        transform: {
          x: groupShape.x,
          y: groupShape.y,
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
        const previousInstanceCount = currentState.instances.length
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
        console.log('processGroupModifiers: Calling processor with groupContext:', groupContext)
        currentState = processor.process(currentState, modifier.props, groupContext)
        const newInstanceCount = currentState.instances.length
        
        console.log(`Group modifier ${modifier.type}: ${previousInstanceCount} → ${newInstanceCount} instances`)
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
      default:
        console.error(`❌ Unknown modifier type: ${type}`)
        return null
    }
  }
} 