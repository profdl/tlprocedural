import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  LinearArraySettings,
  GroupContext
} from '../../../types/modifiers'

// Linear Array Processor implementation
export const LinearArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: LinearArraySettings, groupContext?: GroupContext): ShapeState {
    console.log('LinearArrayProcessor.process called with settings:', settings)
    console.log('LinearArrayProcessor groupContext:', groupContext)
    const { count, offsetX, offsetY, rotation, scaleStep } = settings
    
    // If processing in group context, use group dimensions
    if (groupContext) {
      console.log('LinearArrayProcessor: Using group processing path')
      return processGroupArray(input, settings, groupContext)
    }
    
    console.log('LinearArrayProcessor: Using regular processing path')
    
    // Start with empty instances (we'll generate new ones)
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the array
    input.instances.forEach(inputInstance => {
      // Add the original instance first
      newInstances.push(inputInstance)
      
      // Get shape dimensions for center calculations
      const shapeWidth = 'w' in inputInstance.shape.props ? (inputInstance.shape.props.w as number) : 100
      const shapeHeight = 'h' in inputInstance.shape.props ? (inputInstance.shape.props.h as number) : 100
      
      // Calculate the center of the original shape
      const originalCenterX = inputInstance.transform.x + shapeWidth / 2
      const originalCenterY = inputInstance.transform.y + shapeHeight / 2
      
      console.log('LinearArrayProcessor: Center-based rotation calculation:', {
        originalCenter: { x: originalCenterX, y: originalCenterY },
        shapeDimensions: { width: shapeWidth, height: shapeHeight },
        originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y }
      })
      
      // Create array copies
      for (let i = 1; i < count; i++) {
        // Convert percentage offsets to pixel values based on shape width
        const pixelOffsetX = (offsetX / 100) * shapeWidth
        const pixelOffsetY = (offsetY / 100) * shapeHeight
        
        // Calculate rotation in radians for this clone
        const rotationRadians = (rotation * i * Math.PI / 180)
        
        // Calculate the offset from the original center
        const offsetFromCenterX = pixelOffsetX * i
        const offsetFromCenterY = pixelOffsetY * i
        
        // Apply rotation to the offset around the center
        const cos = Math.cos(rotationRadians)
        const sin = Math.sin(rotationRadians)
        
        const rotatedOffsetX = offsetFromCenterX * cos - offsetFromCenterY * sin
        const rotatedOffsetY = offsetFromCenterX * sin + offsetFromCenterY * cos
        
        // Calculate the final center position after rotation
        const finalCenterX = originalCenterX + rotatedOffsetX
        const finalCenterY = originalCenterY + rotatedOffsetY
        
        // IMPORTANT: Compensate for tldraw's rotation behavior
        // tldraw rotates around the top-left corner, so we need to adjust the position
        // to make it appear as if it's rotating around the center
        
        // Calculate how much the center moves when rotating around top-left
        const centerOffsetX = (shapeWidth / 2) * (cos - 1) - (shapeHeight / 2) * sin
        const centerOffsetY = (shapeWidth / 2) * sin + (shapeHeight / 2) * (cos - 1)
        
        // Adjust the final position to compensate for tldraw's rotation behavior
        const finalX = finalCenterX - shapeWidth / 2 - centerOffsetX
        const finalY = finalCenterY - shapeHeight / 2 - centerOffsetY
        
        console.log(`LinearArrayProcessor: Clone ${i} calculation:`, {
          rotationDegrees: rotation * i,
          rotationRadians,
          offsetFromCenter: { x: offsetFromCenterX, y: offsetFromCenterY },
          rotatedOffset: { x: rotatedOffsetX, y: rotatedOffsetY },
          finalCenter: { x: finalCenterX, y: finalCenterY },
          centerOffset: { x: centerOffsetX, y: centerOffsetY },
          finalPosition: { x: finalX, y: finalY }
        })
        
        // Calculate scale using linear interpolation from original (1.0) to final scale
        const progress = i / (count - 1) // 0 for first clone, 1 for last clone
        const interpolatedScale = 1 + (scaleStep - 1) * progress
        
        const newTransform: Transform = {
          x: finalX,
          y: finalY,
          rotation: inputInstance.transform.rotation + rotationRadians,
          scaleX: inputInstance.transform.scaleX * interpolatedScale,
          scaleY: inputInstance.transform.scaleY * interpolatedScale
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

// Group processing function for linear arrays
function processGroupArray(
  input: ShapeState, 
  settings: LinearArraySettings, 
  groupContext: GroupContext
): ShapeState {
  const { count, offsetX, offsetY, rotation, scaleStep } = settings
  const { groupTopLeft, groupBounds, groupShapes, groupTransform } = groupContext
  
  console.log('processGroupArray called with:', {
    count,
    offsetX,
    offsetY,
    rotation,
    scaleStep,
    groupTopLeft,
    groupBounds,
    groupShapesCount: groupShapes.length
  })
  
  console.log('Group bounds details:', {
    minX: groupBounds.minX,
    maxX: groupBounds.maxX,
    minY: groupBounds.minY,
    maxY: groupBounds.maxY,
    width: groupBounds.width,
    height: groupBounds.height,
    centerX: groupBounds.centerX,
    centerY: groupBounds.centerY
  })
  
  // Start with empty instances (we'll generate new ones)
  const newInstances: ShapeInstance[] = []
  
  // Use group dimensions for percentage-based offsets
  const pixelOffsetX = (offsetX / 100) * groupBounds.width
  const pixelOffsetY = (offsetY / 100) * groupBounds.height
  
  console.log('Group-based offsets:', {
    pixelOffsetX,
    pixelOffsetY,
    groupWidth: groupBounds.width,
    groupHeight: groupBounds.height
  })
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    console.log('Processing instance for array:', {
      shapeId: inputInstance.shape.id,
      shapeType: inputInstance.shape.type,
      originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y },
      groupTopLeft: { x: groupTopLeft.x, y: groupTopLeft.y }
    })
    
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
      
      // Calculate scale using linear interpolation from original (1.0) to final scale
      const progress = (i - 1) / (count - 1) // Use (i-1) so first clone has scale 1
      const interpolatedScale = 1 + (scaleStep - 1) * progress
      
      // SCALE the relative vector BEFORE rotation
      shapeRelativeX *= interpolatedScale
      shapeRelativeY *= interpolatedScale
      
      // Now rotate the scaled relative vector
      const rotatedRelativeX = shapeRelativeX * cos - shapeRelativeY * sin
      const rotatedRelativeY = shapeRelativeX * sin + shapeRelativeY * cos
      
      // Calculate the final position of this shape in the cloned group
      let finalX = newGroupTopLeftX + rotatedRelativeX
      let finalY = newGroupTopLeftY + rotatedRelativeY
      let finalRotation = inputInstance.transform.rotation + rotationRadians
      const finalScale = interpolatedScale
      
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
        
        console.log(`Applied group transform to clone ${i}:`, {
          cloneOffset: { x: cloneOffsetX, y: cloneOffsetY },
          groupRotation: groupTransform.rotation,
          finalPosition: { x: finalX, y: finalY }
        })
      }
      
      console.log(`Clone ${i} calculations:`, {
        rotationRadians,
        offsetFromTopLeft: { x: offsetFromTopLeftX, y: offsetFromTopLeftY },
        rotatedOffset: { x: rotatedOffsetX, y: rotatedOffsetY },
        newGroupTopLeft: { x: newGroupTopLeftX, y: newGroupTopLeftY },
        shapeRelative: { x: shapeRelativeX, y: shapeRelativeY },
        rotatedRelative: { x: rotatedRelativeX, y: rotatedRelativeY },
        finalPosition: { x: finalX, y: finalY },
        finalScale
      })
      
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