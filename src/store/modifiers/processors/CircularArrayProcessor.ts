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
    const circularPositions = []
    for (let i = 0; i < count; i++) {
      const position = calculateCircularPosition(
        referenceShape,
        i + 1,
        centerX || 0,
        centerY || 0,
        radius,
        startAngle,
        endAngle,
        rotateEach || 0,
        rotateAll || 0,
        false, // Always false for positioning - we'll handle tangent rotation separately
        count,
        editor
      )
      
      // Calculate tangent rotation separately if needed
      const totalAngle = endAngle - startAngle
      const angleStep = totalAngle / (count - 1)
      const angle = (startAngle + (angleStep * i)) * Math.PI / 180
      
      let tangentRotation = 0
      if (alignToTangent) {
        tangentRotation = angle + Math.PI / 2
      }
      
      // Add tangent rotation to the position rotation
      position.rotation += tangentRotation
      
      circularPositions.push(position)
    }
    
    // For each existing instance, create the circular array
    input.instances.forEach(inputInstance => {
      // Calculate this instance's offset from the entity center
      const offsetFromCenterX = inputInstance.transform.x - entityCenterX
      const offsetFromCenterY = inputInstance.transform.y - entityCenterY
      
      for (let i = 0; i < count; i++) {
        const circularPos = circularPositions[i]
        
        // Apply the circular position's rotation to the offset
        const cos = Math.cos(circularPos.rotation)
        const sin = Math.sin(circularPos.rotation)
        const rotatedOffsetX = offsetFromCenterX * cos - offsetFromCenterY * sin
        const rotatedOffsetY = offsetFromCenterX * sin + offsetFromCenterY * cos
        
        // Calculate final position
        const finalX = circularPos.x + rotatedOffsetX
        const finalY = circularPos.y + rotatedOffsetY
        
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
            sourceInstance: inputInstance.index,
            isFirstClone: i === 0 // Mark the first clone
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
  groupContext: GroupContext,
  editor?: any
): ShapeState {
  const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToTangent } = settings
  const { groupTopLeft, groupBounds, groupTransform } = groupContext
  
  const newInstances: ShapeInstance[] = []
  
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    
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
      
      
      // Calculate rotation: if aligning to tangent, use tangent as base rotation, otherwise use source rotation
      if (alignToTangent) {
        // Tangent direction is perpendicular to radius (angle + 90°)
        finalRotation = angle + Math.PI / 2
      }
      
      // Add additional rotations on top of base rotation
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
        
      }
      
      
      // Use the improved circular position calculation
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
      
      // Apply group transformations to the base position
      finalX = basePosition.x
      finalY = basePosition.y
      // Don't overwrite finalRotation - it was already calculated above with proper composition

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
  
  return {
    ...input,
    instances: newInstances
  }
} 