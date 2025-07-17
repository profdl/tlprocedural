import type { TLShape } from 'tldraw'
import type { 
  TLModifier, 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor 
} from '../types/modifiers'
import { applyShapeScaling } from '../components/modifiers/utils/shapeUtils'

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
  console.log('extractShapesFromState called with instances:', state.instances.length)
  
  return state.instances.map((instance, index) => {
    console.log(`Processing instance ${index}:`, {
      transform: instance.transform,
      hasW: 'w' in instance.shape.props,
      hasH: 'h' in instance.shape.props,
      originalW: 'w' in instance.shape.props ? instance.shape.props.w : 'N/A',
      originalH: 'h' in instance.shape.props ? instance.shape.props.h : 'N/A',
      scaleX: instance.transform.scaleX,
      scaleY: instance.transform.scaleY
    })
    
    const baseShape = {
      ...instance.shape,
      x: instance.transform.x,
      y: instance.transform.y,
      rotation: instance.transform.rotation
    }
    
    // Debug logging to see what values we're applying
    if (instance.metadata?.isMirrored && 'w' in instance.shape.props && 'h' in instance.shape.props) {
      console.log('Mirror transform:', {
        originalW: instance.shape.props.w,
        originalH: instance.shape.props.h,
        scaleX: instance.transform.scaleX,
        scaleY: instance.transform.scaleY,
        willFlipX: instance.transform.scaleX < 0,
        willFlipY: instance.transform.scaleY < 0,
        rotationTransfer: {
          originalShapeRotation: instance.shape.rotation,
          transformRotation: instance.transform.rotation,
          finalShapeRotation: instance.transform.rotation,
          rotationInDegrees: (instance.transform.rotation * 180 / Math.PI).toFixed(1) + '°'
        }
      })
    }
    
    // Handle scaling - for mirrored shapes, we don't apply negative scaling to dimensions
    if (instance.metadata?.isMirrored) {
      // For mirrored shapes, keep original dimensions and store flip info in metadata
      if ('w' in instance.shape.props && 'h' in instance.shape.props) {
        baseShape.props = {
          ...baseShape.props,
          w: instance.shape.props.w,  // Keep original width
          h: instance.shape.props.h   // Keep original height
        }
      }
      
      // Store all the transform information in metadata for CSS rendering
      baseShape.meta = {
        ...baseShape.meta,
        isFlippedX: instance.transform.scaleX < 0,
        isFlippedY: instance.transform.scaleY < 0,
        mirrorAxis: instance.metadata.mirrorAxis,
        scaleX: instance.transform.scaleX,
        scaleY: instance.transform.scaleY,
        isMirrored: true
      }
      
      console.log('Stored flip metadata:', {
        isFlippedX: instance.transform.scaleX < 0,
        isFlippedY: instance.transform.scaleY < 0,
        scaleX: instance.transform.scaleX,
        scaleY: instance.transform.scaleY
      })
    } else {
      // Apply comprehensive scaling to all shape types (only for positive scales)
      if (instance.transform.scaleX !== 1 || instance.transform.scaleY !== 1) {
        // Only apply scaling if both values are positive (to avoid negative dimensions)
        if (instance.transform.scaleX > 0 && instance.transform.scaleY > 0) {
          const scaledShape = applyShapeScaling(instance.shape, instance.transform.scaleX, instance.transform.scaleY)
          baseShape.props = scaledShape.props
          
          console.log(`Applied comprehensive scaling to instance ${index}:`, {
            shapeType: instance.shape.type,
            scaleX: instance.transform.scaleX,
            scaleY: instance.transform.scaleY
          })
        } else {
          console.warn(`Skipping negative scaling for instance ${index}:`, {
            scaleX: instance.transform.scaleX,
            scaleY: instance.transform.scaleY
          })
        }
      }
    }
    
    console.log(`Final shape ${index} props:`, baseShape.props)
    return baseShape
  })
}

// Main ModifierStack class
export class ModifierStack {
  // Process a list of modifiers in sequence
  static processModifiers(
    originalShape: TLShape, 
    modifiers: TLModifier[]
  ): ShapeState {
    console.log('ModifierStack.processModifiers called with:', {
      shapeId: originalShape.id,
      shapeType: originalShape.type,
      modifierCount: modifiers.length,
      modifiers: modifiers.map(m => ({ type: m.type, enabled: m.enabled, order: m.order }))
    })
    
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
      case 'mirror':
        return MirrorProcessor
      default:
        console.warn(`No processor found for modifier type: ${modifierType}`)
        return null
    }
  }
}

// Linear Array Processor implementation
const LinearArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: any): ShapeState {
    console.log('LinearArrayProcessor.process called with settings:', settings)
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
          scaleX: inputInstance.transform.scaleX * (1 + (scaleStep - 1) * i),
          scaleY: inputInstance.transform.scaleY * (1 + (scaleStep - 1) * i)
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
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, pointToCenter } = settings
    
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
        
        const x = centerPointX + Math.cos(angle) * radius
        const y = centerPointY + Math.sin(angle) * radius
        
        // Calculate base rotation for pointing away from center
        let baseRotation = 0
        if (pointToCenter) {
          // Calculate the angle from center to this position, then add 180° to point away
          const angleFromCenter = Math.atan2(y - centerPointY, x - centerPointX)
          baseRotation = angleFromCenter + Math.PI // Add 180° (π radians) to point away
        }
        
        // Calculate additional rotations: rotateAll applies to all, rotateEach applies per clone
        const rotateAllRadians = (rotateAll || 0) * Math.PI / 180
        const rotateEachRadians = (rotateEach || 0) * i * Math.PI / 180
        const totalRotationRadians = baseRotation + rotateAllRadians + rotateEachRadians
        const finalRotation = inputInstance.transform.rotation + totalRotationRadians
        
        const newTransform: Transform = {
          x: x,
          y: y,
          rotation: finalRotation, // Apply all rotations
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

// Mirror Processor implementation
const MirrorProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: any): ShapeState {
    const { axis, offset, mergeThreshold } = settings
    
    const newInstances: ShapeInstance[] = []
    
    // Add all original instances first
    newInstances.push(...input.instances)
    
    // Group instances by their source modifier to handle arrays as units
    const instanceGroups = new Map<string, ShapeInstance[]>()
    
    input.instances.forEach(instance => {
      // Group instances that were created by the same modifier operation
      const groupKey = instance.metadata?.sourceInstance !== undefined 
        ? `modifier-${instance.metadata.sourceInstance}` 
        : 'original'
      
      if (!instanceGroups.has(groupKey)) {
        instanceGroups.set(groupKey, [])
      }
      instanceGroups.get(groupKey)!.push(instance)
    })
    
    console.log(`🪞 Mirror processor: Found ${instanceGroups.size} groups to mirror:`, 
      Array.from(instanceGroups.keys()).map(key => 
        `${key} (${instanceGroups.get(key)?.length} instances)`
      )
    )
    
    // Process each group as a unit
    instanceGroups.forEach((groupInstances, groupKey) => {
      // Calculate the bounding box of the entire group
      const groupBounds = calculateGroupBounds(groupInstances)
      
      console.log(`🪞 Mirroring group "${groupKey}":`, {
        instances: groupInstances.length,
        bounds: groupBounds,
        axis,
        offset
      })
      
      // Mirror each instance in the group relative to the group's center
      groupInstances.forEach(inputInstance => {
        console.log(`🪞 Processing instance for mirroring:`, {
          inputRotation: inputInstance.transform.rotation,
          inputRotationDegrees: (inputInstance.transform.rotation * 180 / Math.PI).toFixed(1) + '°',
          axis,
          position: { x: inputInstance.transform.x, y: inputInstance.transform.y }
        })
        
        let mirroredTransform: Transform
        
        switch (axis) {
          case 'x': // Horizontal mirror (flip across vertical axis)
            const groupCenterX = groupBounds.centerX
            const mirrorLineX = groupCenterX + offset
            const distanceFromCenter = inputInstance.transform.x - groupCenterX
            const mirroredX = mirrorLineX - distanceFromCenter
            
            mirroredTransform = {
              x: mirroredX,
              y: inputInstance.transform.y,
              rotation: Math.PI - inputInstance.transform.rotation, // Flip rotation for horizontal mirror
              scaleX: -inputInstance.transform.scaleX, // Flip horizontally
              scaleY: inputInstance.transform.scaleY
            }
            break
            
          case 'y': // Vertical mirror (flip across horizontal axis)
            const groupCenterY = groupBounds.centerY
            const mirrorLineY = groupCenterY + offset
            const distanceFromCenterY = inputInstance.transform.y - groupCenterY
            const mirroredY = mirrorLineY - distanceFromCenterY
            
            mirroredTransform = {
              x: inputInstance.transform.x,
              y: mirroredY,
              rotation: -inputInstance.transform.rotation, // Flip rotation for vertical mirror
              scaleX: inputInstance.transform.scaleX,
              scaleY: -inputInstance.transform.scaleY // Flip vertically
            }
            break
            
          case 'diagonal': // Diagonal mirror (swap X/Y and flip both)
            const groupCenterDiag = { x: groupBounds.centerX, y: groupBounds.centerY }
            mirroredTransform = {
              x: groupCenterDiag.y + (inputInstance.transform.y - groupCenterDiag.y) + offset,
              y: groupCenterDiag.x + (inputInstance.transform.x - groupCenterDiag.x) + offset,
              rotation: Math.PI/2 - inputInstance.transform.rotation, // Adjust rotation for diagonal flip
              scaleX: -inputInstance.transform.scaleY,
              scaleY: -inputInstance.transform.scaleX
            }
            break
            
          default:
            // Default to horizontal mirror
            const defGroupCenterX = groupBounds.centerX
            const defMirrorLineX = defGroupCenterX + offset
            const defDistanceFromCenter = inputInstance.transform.x - defGroupCenterX
            const defMirroredX = defMirrorLineX - defDistanceFromCenter
            
            mirroredTransform = {
              x: defMirroredX,
              y: inputInstance.transform.y,
              rotation: Math.PI - inputInstance.transform.rotation, // Flip rotation for horizontal mirror
              scaleX: -inputInstance.transform.scaleX,
              scaleY: inputInstance.transform.scaleY
            }
        }
        
        // Check if mirrored position is too close to any existing instance (merge threshold)
        const shouldMerge = mergeThreshold > 0 && newInstances.some(existing => {
          const dx = existing.transform.x - mirroredTransform.x
          const dy = existing.transform.y - mirroredTransform.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          return distance < mergeThreshold
        })
        
        console.log(`🪞 Calculated mirrored transform:`, {
          inputRotation: inputInstance.transform.rotation,
          outputRotation: mirroredTransform.rotation,
          inputRotationDegrees: (inputInstance.transform.rotation * 180 / Math.PI).toFixed(1) + '°',
          outputRotationDegrees: (mirroredTransform.rotation * 180 / Math.PI).toFixed(1) + '°',
          axis,
          shouldMerge
        })
        
        if (!shouldMerge) {
          const mirroredInstance: ShapeInstance = {
            shape: { ...inputInstance.shape },
            transform: mirroredTransform,
            index: newInstances.length,
            metadata: {
              ...inputInstance.metadata,
              mirrorAxis: axis,
              sourceInstance: inputInstance.index,
              isMirrored: true,
              originalGroup: groupKey, // Track which group this came from
              mirrorOfGroup: true // Mark as a group mirror operation
            }
          }
          
          newInstances.push(mirroredInstance)
        }
      })
    })
    
    // After processing all groups, reverse the order of mirrored instances within each group
    // to match the expected mirror behavior (first becomes last, etc.)
    const originalInstanceCount = input.instances.length
    const mirroredInstances = newInstances.slice(originalInstanceCount)
    
    // Group mirrored instances by their original group
    const mirroredGroups = new Map<string, ShapeInstance[]>()
    mirroredInstances.forEach(instance => {
      const groupKey = instance.metadata?.originalGroup || 'unknown'
      if (!mirroredGroups.has(groupKey)) {
        mirroredGroups.set(groupKey, [])
      }
      mirroredGroups.get(groupKey)!.push(instance)
    })
    
    // Reverse the order within each mirrored group
    mirroredGroups.forEach((instances, groupKey) => {
      instances.reverse()
      console.log(`🪞 Reversed order for mirrored group "${groupKey}": ${instances.length} instances`)
    })
    
    // Rebuild the final instances array with original + reversed mirrored groups
    const finalInstances = [
      ...input.instances, // Original instances first
      ...Array.from(mirroredGroups.values()).flat() // Then reversed mirrored instances
    ]
    
    return {
      ...input,
      instances: finalInstances
    }
  }
}

// Helper function to calculate the bounding box of a group of instances
function calculateGroupBounds(instances: ShapeInstance[]): {
  minX: number, maxX: number, minY: number, maxY: number, 
  centerX: number, centerY: number, width: number, height: number
} {
  if (instances.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0, width: 0, height: 0 }
  }
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  
  instances.forEach(instance => {
    // Estimate shape bounds (this could be improved with actual shape geometry)
    const shapeWidth = 'w' in instance.shape.props ? (instance.shape.props.w as number) : 100
    const shapeHeight = 'h' in instance.shape.props ? (instance.shape.props.h as number) : 100
    
    const left = instance.transform.x
    const right = instance.transform.x + shapeWidth
    const top = instance.transform.y
    const bottom = instance.transform.y + shapeHeight
    
    minX = Math.min(minX, left)
    maxX = Math.max(maxX, right)
    minY = Math.min(minY, top)
    maxY = Math.max(maxY, bottom)
  })
  
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const width = maxX - minX
  const height = maxY - minY
  
  return { minX, maxX, minY, maxY, centerX, centerY, width, height }
} 