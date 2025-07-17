import type { TLShape } from 'tldraw'
import type { 
  TLModifier, 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor 
} from '../types/modifiers'

// Helper function to create initial ShapeState from a TLShape
export function createInitialShapeState(shape: TLShape): ShapeState {
  const transform: Transform = {
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation || 0,
    scaleX: 1,
    scaleY: 1
  }

  const instance: ShapeInstance = {
    shape,
    transform,
    index: 0,
    metadata: { isOriginal: true }
  }

  return {
    originalShape: shape,
    instances: [instance],
    metadata: {}
  }
}

// Helper function to convert ShapeState back to TLShape array for rendering
export function extractShapesFromState(state: ShapeState): TLShape[] {
  return state.instances.map(instance => ({
    ...instance.shape,
    x: instance.transform.x,
    y: instance.transform.y,
    rotation: instance.transform.rotation
  }))
}

// Main ModifierStack class
export class ModifierStack {
  // Process a list of modifiers in sequence
  static processModifiers(
    originalShape: TLShape, 
    modifiers: TLModifier[]
  ): ShapeState {
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

  // Get the appropriate processor for a modifier type
  private static getProcessor(modifierType: string): ModifierProcessor | null {
    switch (modifierType) {
      case 'linear-array':
        return LinearArrayProcessor
      case 'circular-array':
        return CircularArrayProcessor
      case 'grid-array':
        return GridArrayProcessor
      default:
        console.warn(`No processor found for modifier type: ${modifierType}`)
        return null
    }
  }
}

// Linear Array Processor implementation
const LinearArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: any): ShapeState {
    const { count, offsetX, offsetY, rotation, spacing, scaleStep } = settings
    
    // Start with empty instances (we'll generate new ones)
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the array
    input.instances.forEach(inputInstance => {
      // Add the original instance first
      newInstances.push(inputInstance)
      
      // Create array copies
      for (let i = 1; i < count; i++) {
        const newTransform: Transform = {
          x: inputInstance.transform.x + (offsetX * i * spacing),
          y: inputInstance.transform.y + (offsetY * i * spacing),
          rotation: inputInstance.transform.rotation + (rotation * i * Math.PI / 180),
          scaleX: inputInstance.transform.scaleX * Math.pow(scaleStep, i),
          scaleY: inputInstance.transform.scaleY * Math.pow(scaleStep, i)
        }
        
        const newInstance: ShapeInstance = {
          shape: { ...inputInstance.shape },
          transform: newTransform,
          index: newInstances.length,
          metadata: {
            ...inputInstance.metadata,
            arrayIndex: i,
            sourceInstance: inputInstance.index
          }
        }
        
        newInstances.push(newInstance)
      }
    })
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

// Circular Array Processor implementation
const CircularArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: any): ShapeState {
    const { count, radius, startAngle, endAngle, centerX, centerY } = settings
    
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the circular array
    input.instances.forEach(inputInstance => {
      // Add the original instance first
      newInstances.push(inputInstance)
      
      // Calculate center point relative to the instance
      const centerPointX = inputInstance.transform.x + (centerX || 0)
      const centerPointY = inputInstance.transform.y + (centerY || 0)
      
      const totalAngle = endAngle - startAngle
      const angleStep = totalAngle / (count - 1)
      
      // Create circular array copies
      for (let i = 1; i < count; i++) {
        const angle = (startAngle + (angleStep * (i - 1))) * Math.PI / 180
        
        const newTransform: Transform = {
          x: centerPointX + Math.cos(angle) * radius,
          y: centerPointY + Math.sin(angle) * radius,
          rotation: inputInstance.transform.rotation, // Keep original rotation
          scaleX: inputInstance.transform.scaleX,
          scaleY: inputInstance.transform.scaleY
        }
        
        const newInstance: ShapeInstance = {
          shape: { ...inputInstance.shape },
          transform: newTransform,
          index: newInstances.length,
          metadata: {
            ...inputInstance.metadata,
            arrayIndex: i,
            sourceInstance: inputInstance.index
          }
        }
        
        newInstances.push(newInstance)
      }
    })
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

// Grid Array Processor implementation
const GridArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: any): ShapeState {
    const { rows, columns, spacingX, spacingY, offsetX, offsetY } = settings
    
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the grid array
    input.instances.forEach(inputInstance => {
      // Create grid positions
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          // Skip the original position (0,0) - we'll add it first
          if (row === 0 && col === 0) {
            newInstances.push(inputInstance)
            continue
          }
          
          const newTransform: Transform = {
            x: inputInstance.transform.x + (offsetX || 0) + (col * spacingX),
            y: inputInstance.transform.y + (offsetY || 0) + (row * spacingY),
            rotation: inputInstance.transform.rotation,
            scaleX: inputInstance.transform.scaleX,
            scaleY: inputInstance.transform.scaleY
          }
          
          const newInstance: ShapeInstance = {
            shape: { ...inputInstance.shape },
            transform: newTransform,
            index: newInstances.length,
            metadata: {
              ...inputInstance.metadata,
              arrayIndex: row * columns + col,
              sourceInstance: inputInstance.index,
              gridPosition: { row, col }
            }
          }
          
          newInstances.push(newInstance)
        }
      }
    })
    
    return {
      ...input,
      instances: newInstances
    }
  }
} 