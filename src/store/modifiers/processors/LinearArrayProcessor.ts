import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  LinearArraySettings,
  GroupContext
} from '../../../types/modifiers'
import { calculateLinearPosition, getShapeDimensions, degreesToRadians } from '../../../components/modifiers/utils'

// Linear Array Processor implementation  
export const LinearArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: LinearArraySettings, groupContext?: GroupContext, editor?: import('tldraw').Editor): ShapeState {
    const { count, offsetX, offsetY, rotationIncrement, rotateAll, scaleStep } = settings
    
    // If processing in group context, use group dimensions
    if (groupContext) {
      return processGroupArray(input, settings, groupContext)
    }
    
    // Start with empty instances (we'll generate new ones)
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the array
    input.instances.forEach(inputInstance => {
      // Create array positions starting from i=0, include the original
      for (let i = 0; i < count; i++) {
        // Get shape dimensions for offset calculation
        const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(inputInstance.shape)
        
        // Convert percentage offsets to pixel values
        const pixelOffsetX = (offsetX / 100) * shapeWidth * i
        const pixelOffsetY = (offsetY / 100) * shapeHeight * i

        // Calculate incremental and uniform rotation for this index
        const incrementalRotationRadians = degreesToRadians(rotationIncrement * i)
        const uniformRotationRadians = degreesToRadians(rotateAll)
        const totalRotationRadians = incrementalRotationRadians + uniformRotationRadians

        const progress = count > 1 ? i / (count - 1) : 0
        // Convert percentage scaleStep to decimal (50% -> 0.5, 100% -> 1.0)
        const scaleStepDecimal = scaleStep / 100
        const interpolatedScale = 1 + (scaleStepDecimal - 1) * progress
        
        // Get the proper visual center of the source shape, accounting for rotation
        let sourceCenterX = inputInstance.transform.x + shapeWidth / 2
        let sourceCenterY = inputInstance.transform.y + shapeHeight / 2

        // For rotated shapes, we need to use the actual visual center
        // But only for original shapes, not instances from previous modifiers
        const sourceRotation = inputInstance.transform.rotation || 0
        const isFromPreviousModifier = inputInstance.metadata?.linearArrayIndex !== undefined ||
                                      inputInstance.metadata?.circularArrayIndex !== undefined ||
                                      inputInstance.metadata?.gridArrayIndex !== undefined ||
                                      inputInstance.metadata?.sourceInstance !== undefined

        if (editor && sourceRotation !== 0 && !isFromPreviousModifier) {
          const bounds = editor.getShapePageBounds(inputInstance.shape.id)
          if (bounds) {
            sourceCenterX = bounds.x + bounds.width / 2
            sourceCenterY = bounds.y + bounds.height / 2
          }
        }

        // Calculate base clone position with linear offset from source center
        let cloneCenterX = sourceCenterX + pixelOffsetX
        let cloneCenterY = sourceCenterY + pixelOffsetY

        // If source shape is rotated, apply orbital rotation around source center
        if (sourceRotation !== 0) {
          // Apply orbital rotation around source center
          const offsetX = pixelOffsetX
          const offsetY = pixelOffsetY

          const cos = Math.cos(sourceRotation)
          const sin = Math.sin(sourceRotation)

          const rotatedOffsetX = offsetX * cos - offsetY * sin
          const rotatedOffsetY = offsetX * sin + offsetY * cos

          cloneCenterX = sourceCenterX + rotatedOffsetX
          cloneCenterY = sourceCenterY + rotatedOffsetY
        }

        // Convert back to top-left position for the clone
        const finalX = cloneCenterX - shapeWidth / 2
        const finalY = cloneCenterY - shapeHeight / 2

        const newTransform: Transform = {
          x: finalX,
          y: finalY,
          rotation: inputInstance.transform.rotation + totalRotationRadians,
          scaleX: inputInstance.transform.scaleX * interpolatedScale,
          scaleY: inputInstance.transform.scaleY * interpolatedScale
        }
        
        const newInstance: ShapeInstance = {
          shape: { ...inputInstance.shape },
          transform: newTransform,
          index: newInstances.length,
          metadata: {
            ...inputInstance.metadata,
            arrayIndex: newInstances.length, // Use sequential index for clone mapping
            sourceInstance: inputInstance.index,
            linearArrayIndex: i // Store linear-specific index separately
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

// Group processing function for linear arrays
function processGroupArray(
  input: ShapeState,
  settings: LinearArraySettings,
  groupContext: GroupContext
): ShapeState {
  const { count, offsetX, offsetY, rotationIncrement, rotateAll, scaleStep } = settings
  const { groupTopLeft, groupBounds, groupTransform } = groupContext
  
  
  // Start with empty instances (we'll generate new ones)
  const newInstances: ShapeInstance[] = []
  
  // Use group dimensions for percentage-based offsets
  const pixelOffsetX = (offsetX / 100) * groupBounds.width
  const pixelOffsetY = (offsetY / 100) * groupBounds.height
  
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    
    for (let i = 0; i < count; i++) { // Start from i=0, include the original
      
      // Calculate incremental and uniform rotation for this clone
      const incrementalRotationRadians = (rotationIncrement * i * Math.PI / 180) // Use i so first clone (i=0) has no rotation
      const uniformRotationRadians = degreesToRadians(rotateAll)
      const totalRotationRadians = incrementalRotationRadians + uniformRotationRadians

      // Calculate the offset from the group's top-left corner
      const offsetFromTopLeftX = pixelOffsetX * i // Use i so first clone (i=0) has no offset
      const offsetFromTopLeftY = pixelOffsetY * i
      
      // Apply rotation to the offset around the group's top-left corner
      const cos = Math.cos(incrementalRotationRadians)
      const sin = Math.sin(incrementalRotationRadians)
      const rotatedOffsetX = offsetFromTopLeftX * cos - offsetFromTopLeftY * sin
      const rotatedOffsetY = offsetFromTopLeftX * sin + offsetFromTopLeftY * cos
      
      // Calculate the group's new top-left position
      const newGroupTopLeftX = groupTopLeft.x + rotatedOffsetX
      const newGroupTopLeftY = groupTopLeft.y + rotatedOffsetY
      
      // Calculate the relative position of this shape within the group (from top-left)
      const shapeRelativeX = inputInstance.transform.x - groupTopLeft.x
      const shapeRelativeY = inputInstance.transform.y - groupTopLeft.y
      
      // Calculate position using improved transform utilities
      const relativePosition = calculateLinearPosition(
        inputInstance.shape,
        i, // Use i so first clone (i=0) has no offset
        (offsetX / groupBounds.width) * 100, // Convert back to percentage based on shape
        (offsetY / groupBounds.height) * 100,
        rotationIncrement,
        rotateAll,
        scaleStep,
        count,
        undefined // No editor available in group context
      )
      
      // Calculate the final position of this shape in the cloned group
      let finalX = newGroupTopLeftX + shapeRelativeX
      let finalY = newGroupTopLeftY + shapeRelativeY
      let finalRotation = inputInstance.transform.rotation + totalRotationRadians
      const finalScale = relativePosition.scaleX
      
      
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
          arrayIndex: newInstances.length, // Use sequential index for clone mapping
          sourceInstance: inputInstance.index,
          linearArrayIndex: i, // Store linear-specific index separately
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