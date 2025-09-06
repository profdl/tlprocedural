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
    
    // Calculate the geometric center of the linear array entity
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    input.instances.forEach(inst => {
      const { width, height } = getShapeDimensions(inst.shape)
      const left = inst.transform.x
      const right = inst.transform.x + width
      const top = inst.transform.y
      const bottom = inst.transform.y + height
      
      minX = Math.min(minX, left)
      maxX = Math.max(maxX, right)
      minY = Math.min(minY, top)
      maxY = Math.max(maxY, bottom)
    })
    
    // The true center of the linear array entity
    const entityCenterX = (minX + maxX) / 2
    const entityCenterY = (minY + maxY) / 2
    
    // Create a reference shape at the entity center for circular positioning
    const referenceShape = {
      ...input.instances[0].shape,
      x: entityCenterX,
      y: entityCenterY,
      rotation: 0
    }
    
    // Calculate circular positions once for the group center
    // Use alignToTangent=false for positioning to keep positions consistent
    const circularPositions: any[] = []
    for (let i = 0; i < count; i++) {
      const position = calculateCircularPosition(
        referenceShape,
        i, // Use i directly, not i + 1
        centerX || 0,
        centerY || 0,
        radius,
        startAngle,
        endAngle,
        rotateEach || 0,
        rotateAll || 0,
        alignToTangent || false, // Use alignToTangent directly from settings
        count,
        editor
      )
      
      circularPositions.push(position)
    }
    
    // For each existing instance, create the circular array
    input.instances.forEach(inputInstance => {
      // Calculate this instance's offset from the entity center
      const offsetFromCenterX = inputInstance.transform.x - entityCenterX
      const offsetFromCenterY = inputInstance.transform.y - entityCenterY
      
      for (let i = 0; i < count; i++) {
        const circularPos = circularPositions[i]
        
        // Calculate final position without rotation compensation
        // The rotation will be applied by useCloneManager using editor.rotateShapesBy()
        const finalX = circularPos.x + offsetFromCenterX
        const finalY = circularPos.y + offsetFromCenterY
        
        const newTransform: Transform = {
          x: finalX,
          y: finalY,
          rotation: inputInstance.transform.rotation + circularPos.rotation,
          scaleX: inputInstance.transform.scaleX * circularPos.scaleX,
          scaleY: inputInstance.transform.scaleY * circularPos.scaleY
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