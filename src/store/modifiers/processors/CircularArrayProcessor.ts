import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  CircularArraySettings,
  GroupContext
} from '../../../types/modifiers'
import { calculateCircularPosition, getShapeDimensions } from '../../../components/modifiers/utils'

// Circular Array Processor implementation
export const CircularArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: CircularArraySettings, groupContext?: GroupContext, editor?: any): ShapeState {
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToTangent } = settings
    
    const newInstances: ShapeInstance[] = []
    
    // Check if this is a group modifier
    if (groupContext) {
      return processGroupCircularArray(input, settings, groupContext, editor)
    }
    
    // For each existing instance, create the circular array
    input.instances.forEach(inputInstance => {
      // Create all array positions including the first one (i=0) which replaces the original
      for (let i = 0; i < count; i++) {
        // Use calculateCircularPosition directly with the actual shape (like LinearArrayProcessor)
        const position = calculateCircularPosition(
          inputInstance.shape,
          i,
          centerX || 0,
          centerY || 0,
          radius,
          startAngle,
          endAngle,
          rotateEach || 0,
          rotateAll || 0,
          alignToTangent || false,
          count,
          editor
        )
        
        const newTransform: Transform = {
          x: position.x,
          y: position.y,
          rotation: inputInstance.transform.rotation + position.rotation,
          scaleX: inputInstance.transform.scaleX * position.scaleX,
          scaleY: inputInstance.transform.scaleY * position.scaleY
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
    
    console.log(`CircularArrayProcessor: Created ${newInstances.length} instances for count=${count}`)
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

// Process circular array for groups
function processGroupCircularArray(
  input: ShapeState, 
  settings: CircularArraySettings, 
  groupContext: GroupContext,
  editor?: any
): ShapeState {
  const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToTangent } = settings
  const { groupTransform } = groupContext
  
  const newInstances: ShapeInstance[] = []
  
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    
    for (let i = 0; i < count; i++) { // Create all array positions including the first one (i=0) which replaces the original
      
      // Use the improved circular position calculation directly
      const basePosition = calculateCircularPosition(
        inputInstance.shape,
        i,
        centerX || 0,
        centerY || 0,
        radius,
        startAngle,
        endAngle,
        rotateEach || 0,
        rotateAll || 0,
        alignToTangent || false,
        count,
        editor
      )
      
      // Use the calculated position directly - no manual rotation compensation needed
      let finalX = basePosition.x
      let finalY = basePosition.y
      let finalRotation = inputInstance.transform.rotation + basePosition.rotation
      
      // Apply group transformations if needed
      if (groupTransform) {
        finalRotation += groupTransform.rotation
      }

      // Compose the transform
      const newTransform: Transform = {
        x: finalX,
        y: finalY,
        rotation: finalRotation,
        scaleX: inputInstance.transform.scaleX * basePosition.scaleX,
        scaleY: inputInstance.transform.scaleY * basePosition.scaleY
      }
      
      const newInstance: ShapeInstance = {
        shape: { ...inputInstance.shape },
        transform: newTransform,
        index: newInstances.length,
        metadata: {
          ...inputInstance.metadata,
          arrayIndex: i,
          sourceInstance: inputInstance.index,
          isGroupClone: true
        }
      }
      
      newInstances.push(newInstance)
    }
  })
  
  console.log(`CircularArrayProcessor (Group): Created ${newInstances.length} instances for count=${count}`)
  
  return {
    ...input,
    instances: newInstances
  }
} 