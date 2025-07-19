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

/**
 * Refactored ModifierStack class
 * Processes modifiers in sequence using extracted processor modules
 */
export class ModifierStack {
  // Process a list of modifiers in sequence
  static processModifiers(
    originalShape: TLShape, 
    modifiers: TLModifier[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _editor?: Editor
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