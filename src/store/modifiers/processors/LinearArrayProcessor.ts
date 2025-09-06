import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  LinearArraySettings,
  GroupContext
} from '../../../types/modifiers'
import { calculateLinearPosition } from '../../../components/modifiers/utils'

// Linear Array Processor implementation  
export const LinearArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: LinearArraySettings, groupContext?: GroupContext, editor?: any): ShapeState {
    const { count, offsetX, offsetY, rotation, scaleStep } = settings
    
    // If processing in group context, use group dimensions
    if (groupContext) {
      return processGroupArray(input, settings, groupContext)
    }
    
    // Start with empty instances (we'll generate new ones)
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the array
    input.instances.forEach(inputInstance => {
      // Create all array positions including the first one (i=0) which replaces the original
      for (let i = 0; i < count; i++) {
        // Use the new calculateLinearPosition function with proper transform handling
        const position = calculateLinearPosition(
          inputInstance.shape,
          i,
          offsetX,
          offsetY,
          rotation,
          scaleStep,
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
    
    console.log(`LinearArrayProcessor: Created ${newInstances.length} instances for count=${count}`)
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

// Group processing function for linear arrays
function processGroupArray(
  input: ShapeState, 
  settings: LinearArraySettings, 
  groupContext: GroupContext
): ShapeState {
  const { count, offsetX, offsetY, rotation, scaleStep } = settings
  const { groupTopLeft, groupBounds, groupShapes, groupTransform } = groupContext
  
  
  // Start with empty instances (we'll generate new ones)
  const newInstances: ShapeInstance[] = []
  
  // Use group dimensions for percentage-based offsets
  const pixelOffsetX = (offsetX / 100) * groupBounds.width
  const pixelOffsetY = (offsetY / 100) * groupBounds.height
  
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    
    for (let i = 1; i < count; i++) { // Start from i=1, skip the original (i=0)
      
      // Calculate rotation in radians for this clone
      const rotationRadians = (rotation * (i - 1) * Math.PI / 180) // Use (i-1) so first clone has no rotation
      
      // Calculate the offset from the group's top-left corner
      const offsetFromTopLeftX = pixelOffsetX * (i - 1) // Use (i-1) so first clone has no offset
      const offsetFromTopLeftY = pixelOffsetY * (i - 1)
      
      // Apply rotation to the offset around the group's top-left corner
      const cos = Math.cos(rotationRadians)
      const sin = Math.sin(rotationRadians)
      const rotatedOffsetX = offsetFromTopLeftX * cos - offsetFromTopLeftY * sin
      const rotatedOffsetY = offsetFromTopLeftX * sin + offsetFromTopLeftY * cos
      
      // Calculate the group's new top-left position
      const newGroupTopLeftX = groupTopLeft.x + rotatedOffsetX
      const newGroupTopLeftY = groupTopLeft.y + rotatedOffsetY
      
      // Calculate the relative position of this shape within the group (from top-left)
      let shapeRelativeX = inputInstance.transform.x - groupTopLeft.x
      let shapeRelativeY = inputInstance.transform.y - groupTopLeft.y
      
      // Calculate position using improved transform utilities
      const relativePosition = calculateLinearPosition(
        inputInstance.shape,
        i - 1, // Use (i-1) so first clone has no offset
        (offsetX / groupBounds.width) * 100, // Convert back to percentage based on shape
        (offsetY / groupBounds.height) * 100,
        rotation,
        scaleStep,
        count
      )
      
      // Calculate the final position of this shape in the cloned group
      let finalX = newGroupTopLeftX + shapeRelativeX
      let finalY = newGroupTopLeftY + shapeRelativeY
      let finalRotation = inputInstance.transform.rotation + relativePosition.rotation
      const finalScale = relativePosition.scaleX
      
      // For logging compatibility, create dummy rotated relative values
      const rotatedRelativeX = shapeRelativeX
      const rotatedRelativeY = shapeRelativeY
      
      // Apply the group's current transform to make clones move with the group
      if (groupTransform) {
        // Calculate the clone's offset from the source group's center
        const sourceGroupCenterX = groupTopLeft.x + (groupBounds.width / 2)
        const sourceGroupCenterY = groupTopLeft.y + (groupBounds.height / 2)
        const cloneOffsetX = finalX - sourceGroupCenterX
        const cloneOffsetY = finalY - sourceGroupCenterY
        
        // Apply the source group's transform to the clone's offset
        // This makes the clone scale around the same origin as the source group
        if (groupTransform.rotation !== 0) {
          const cos = Math.cos(groupTransform.rotation)
          const sin = Math.sin(groupTransform.rotation)
          const rotatedOffsetX = cloneOffsetX * cos - cloneOffsetY * sin
          const rotatedOffsetY = cloneOffsetX * sin + cloneOffsetY * cos
          
          // Apply the rotated offset to the source group's center
          const currentSourceGroupCenterX = groupTransform.x + (groupBounds.width / 2)
          const currentSourceGroupCenterY = groupTransform.y + (groupBounds.height / 2)
          finalX = currentSourceGroupCenterX + rotatedOffsetX
          finalY = currentSourceGroupCenterY + rotatedOffsetY
        } else {
          // No rotation, just apply position offset to the source group's center
          const currentSourceGroupCenterX = groupTransform.x + (groupBounds.width / 2)
          const currentSourceGroupCenterY = groupTransform.y + (groupBounds.height / 2)
          finalX = currentSourceGroupCenterX + cloneOffsetX
          finalY = currentSourceGroupCenterY + cloneOffsetY
        }
        
        finalRotation += groupTransform.rotation
        
      }
      
      
      // Compose the transform
      const newTransform: Transform = {
        x: finalX,
        y: finalY,
        rotation: finalRotation,
        scaleX: inputInstance.transform.scaleX * finalScale,
        scaleY: inputInstance.transform.scaleY * finalScale
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
  return {
    ...input,
    instances: newInstances
  }
} 