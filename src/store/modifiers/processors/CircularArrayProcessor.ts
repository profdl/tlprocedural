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
        // Calculate the angle for this position on the circle
        const totalAngle = endAngle - startAngle
        const angleStep = count > 1 ? totalAngle / (count - 1) : 0
        const angle = (startAngle + (angleStep * i)) * Math.PI / 180
        
        // Calculate circular offset from center (this is an offset, not absolute position)
        const circularOffsetX = (centerX || 0) + Math.cos(angle) * radius
        const circularOffsetY = (centerY || 0) + Math.sin(angle) * radius
        
        // Calculate rotation components
        let circularRotation = 0
        if (alignToTangent) {
          circularRotation += angle + Math.PI / 2
        }
        if (rotateAll) {
          circularRotation += (rotateAll * Math.PI / 180)
        }
        if (rotateEach) {
          circularRotation += (rotateEach * i * Math.PI / 180)
        }
        
        // Apply the circular offset to the already-transformed instance position (like GridArray does)
        const newTransform: Transform = {
          x: inputInstance.transform.x + circularOffsetX,
          y: inputInstance.transform.y + circularOffsetY,
          rotation: inputInstance.transform.rotation + circularRotation, // Preserve + add circular rotation
          scaleX: inputInstance.transform.scaleX,
          scaleY: inputInstance.transform.scaleY
        }
        
        const newInstance: ShapeInstance = {
          shape: { ...inputInstance.shape },
          transform: newTransform,
          index: newInstances.length,
          metadata: {
            ...inputInstance.metadata,
            arrayIndex: newInstances.length, // Use sequential index for clone mapping (like GridArray)
            sourceInstance: inputInstance.index,
            circularArrayIndex: i // Store circular-specific index separately
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
          arrayIndex: newInstances.length, // Use sequential index for clone mapping (like GridArray)
          sourceInstance: inputInstance.index,
          circularArrayIndex: i, // Store circular-specific index separately
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