import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  CircularArraySettings,
  GroupContext
} from '../../../types/modifiers'

// Circular Array Processor implementation
export const CircularArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: CircularArraySettings, groupContext?: GroupContext): ShapeState {
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, pointToCenter } = settings
    
    const newInstances: ShapeInstance[] = []
    
    // Check if this is a group modifier
    if (groupContext) {
      return processGroupCircularArray(input, settings, groupContext)
    }
    
    // For each existing instance, create the circular array
    input.instances.forEach(inputInstance => {
      // Get shape dimensions to calculate offset
      const shapeWidth = 'w' in inputInstance.shape.props ? (inputInstance.shape.props.w as number) : 100
      const shapeHeight = 'h' in inputInstance.shape.props ? (inputInstance.shape.props.h as number) : 100
      
      // Calculate the offset needed to move the array center so the original shape becomes the first position
      const firstAngle = startAngle * Math.PI / 180
      let offsetX = Math.cos(firstAngle) * radius
      let offsetY = Math.sin(firstAngle) * radius
      
      // If pointToCenter is enabled, we need to adjust the offset to account for the rotation
      if (pointToCenter) {
        // When pointing to center, the shape rotates to face the center
        // We need to adjust the offset so the original shape aligns exactly with the first clone position
        const angleFromCenter = Math.atan2(offsetY, offsetX)
        // Calculate the offset needed to compensate for the rotation effect
        // The shape will rotate to point toward center, so we need to offset in the opposite direction
        const additionalOffsetX = Math.cos(angleFromCenter + Math.PI)   - shapeWidth 
        const additionalOffsetY = Math.sin(angleFromCenter + Math.PI) - shapeHeight
        offsetX += additionalOffsetX
        offsetY += additionalOffsetY
      }
      
      // Calculate center point relative to the instance, offset so original becomes first position
      const centerPointX = inputInstance.transform.x + (centerX || 0) - offsetX
      const centerPointY = inputInstance.transform.y + (centerY || 0) - offsetY
      
      const totalAngle = endAngle - startAngle
      const angleStep = totalAngle / (count - 1)
      
      // Create circular array copies (including the original at the first position)
      for (let i = 0; i < count; i++) {
        const angle = (startAngle + (angleStep * i)) * Math.PI / 180
        
        // For the first instance (i=0), position it at the start angle in the circle
        if (i === 0) {
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
            rotation: finalRotation,
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
              sourceInstance: inputInstance.index,
              isFirstClone: true // Mark this as the first clone to hide it
            }
          }
          
          newInstances.push(newInstance)
          continue
        }
        
        // For other instances, calculate circular positions
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

// Process circular array for groups
function processGroupCircularArray(
  input: ShapeState, 
  settings: CircularArraySettings, 
  groupContext: GroupContext
): ShapeState {
  const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, pointToCenter } = settings
  const { groupTopLeft, groupBounds, groupTransform } = groupContext
  
  const newInstances: ShapeInstance[] = []
  
  console.log('processGroupCircularArray called with:', {
    count,
    radius,
    startAngle,
    endAngle,
    centerX,
    centerY,
    groupTopLeft,
    groupBounds
  })
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    console.log('Processing instance for circular array:', {
      shapeId: inputInstance.shape.id,
      shapeType: inputInstance.shape.type,
      originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y },
      groupTopLeft: { x: groupTopLeft.x, y: groupTopLeft.y }
    })
    
    // Calculate the offset needed to move the array center so the original shape becomes the first position
    const firstAngle = startAngle * Math.PI / 180
    const offsetX = Math.cos(firstAngle) * radius
    const offsetY = Math.sin(firstAngle) * radius
    
    // Calculate center point relative to the group's top-left corner
    const centerPointX = groupTopLeft.x + (centerX || 0) - offsetX
    const centerPointY = groupTopLeft.y + (centerY || 0) - offsetY
    
    const totalAngle = endAngle - startAngle
    const angleStep = totalAngle / (count - 1)
    
    for (let i = 1; i < count; i++) { // Start from i=1, skip the original (i=0)
      const angle = (startAngle + (angleStep * i)) * Math.PI / 180
      
      // Calculate the offset from the group's top-left corner
      const offsetFromTopLeftX = Math.cos(angle) * radius
      const offsetFromTopLeftY = Math.sin(angle) * radius
      
      // Calculate the group's new top-left position
      const newGroupTopLeftX = groupTopLeft.x + offsetFromTopLeftX
      const newGroupTopLeftY = groupTopLeft.y + offsetFromTopLeftY
      
      // Calculate the relative position of this shape within the group (from top-left)
      const shapeRelativeX = inputInstance.transform.x - groupTopLeft.x
      const shapeRelativeY = inputInstance.transform.y - groupTopLeft.y
      
      // Calculate the final position of this shape in the cloned group
      let finalX = newGroupTopLeftX + shapeRelativeX
      let finalY = newGroupTopLeftY + shapeRelativeY
      let finalRotation = inputInstance.transform.rotation
      
      // Calculate base rotation for pointing away from center
      if (pointToCenter) {
        const angleFromCenter = Math.atan2(finalY - centerPointY, finalX - centerPointX)
        finalRotation += angleFromCenter + Math.PI // Add 180° (π radians) to point away
      }
      
      // Calculate additional rotations: rotateAll applies to all, rotateEach applies per clone
      const rotateAllRadians = (rotateAll || 0) * Math.PI / 180
      const rotateEachRadians = (rotateEach || 0) * i * Math.PI / 180
      finalRotation += rotateAllRadians + rotateEachRadians
      
      // Apply the group's current transform to make clones move with the group
      if (groupTransform) {
        // Calculate this cloned group's center (each clone scales around its own center)
        const clonedGroupCenterX = newGroupTopLeftX + (groupBounds.width / 2)
        const clonedGroupCenterY = newGroupTopLeftY + (groupBounds.height / 2)
        
        // Calculate the clone's offset from the source group's center
        const sourceGroupCenterX = groupTopLeft.x + (groupBounds.width / 2)
        const sourceGroupCenterY = groupTopLeft.y + (groupBounds.height / 2)
        const cloneOffsetX = finalX - sourceGroupCenterX
        const cloneOffsetY = finalY - sourceGroupCenterY
        
        // Apply group rotation to the clone offset around the source group center
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
        
        console.log(`Applied group transform to circular clone ${i}:`, {
          clonedGroupCenter: { x: clonedGroupCenterX, y: clonedGroupCenterY },
          cloneOffset: { x: cloneOffsetX, y: cloneOffsetY },
          groupRotation: groupTransform.rotation,
          finalPosition: { x: finalX, y: finalY }
        })
      }
      
      console.log(`Circular clone ${i} calculations:`, {
        angle: (angle * 180 / Math.PI).toFixed(1) + '°',
        offsetFromTopLeft: { x: offsetFromTopLeftX, y: offsetFromTopLeftY },
        newGroupTopLeft: { x: newGroupTopLeftX, y: newGroupTopLeftY },
        shapeRelative: { x: shapeRelativeX, y: shapeRelativeY },
        finalPosition: { x: finalX, y: finalY },
        finalRotation: (finalRotation * 180 / Math.PI).toFixed(1) + '°'
      })
      
      // Compose the transform
      const newTransform: Transform = {
        x: finalX,
        y: finalY,
        rotation: finalRotation,
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