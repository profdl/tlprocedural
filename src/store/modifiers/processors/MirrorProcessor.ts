import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  MirrorSettings,
  GroupContext
} from '../../../types/modifiers'

// Mirror Processor implementation
export const MirrorProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: MirrorSettings, groupContext?: GroupContext): ShapeState {
    const { axis, offset, mergeThreshold } = settings
    
    // Check if this is a group modifier
    if (groupContext) {
      return processGroupMirror(input, settings, groupContext)
    }
    
    console.log('🪞 Mirror processor: Processing mirror modifier')
    
    // For mirror, we want to mirror the entire current state as a group
    // This means all previous modifiers are treated as a single unit to be mirrored
    
    // Calculate the bounding box of all current instances (the "group" to mirror)
    const allInstances = input.instances
    const groupBounds = calculateGroupBounds(allInstances)
    
    console.log('🪞 Mirror processor: Group bounds for mirroring:', {
      instances: allInstances.length,
      bounds: groupBounds,
      axis,
      offset
    })
    
    // Start with all original instances
    const newInstances: ShapeInstance[] = [...allInstances]
    
    // Mirror each instance relative to the group's center
    allInstances.forEach(inputInstance => {
      console.log(`🪞 Processing instance for mirroring:`, {
        shapeId: inputInstance.shape.id,
        shapeType: inputInstance.shape.type,
        originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y },
        originalRotation: (inputInstance.transform.rotation * 180 / Math.PI).toFixed(1) + '°',
        axis
      })
      
      let mirroredTransform: Transform
      
      switch (axis) {
        case 'x': { // Horizontal mirror (flip across vertical axis)
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
        }
          
        case 'y': { // Vertical mirror (flip across horizontal axis)
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
        }
          
        case 'diagonal': { // Diagonal mirror (swap X/Y and flip both)
          const groupCenterDiag = { x: groupBounds.centerX, y: groupBounds.centerY }
          mirroredTransform = {
            x: groupCenterDiag.y + (inputInstance.transform.y - groupCenterDiag.y) + offset,
            y: groupCenterDiag.x + (inputInstance.transform.x - groupCenterDiag.x) + offset,
            rotation: Math.PI/2 - inputInstance.transform.rotation, // Adjust rotation for diagonal flip
            scaleX: -inputInstance.transform.scaleY,
            scaleY: -inputInstance.transform.scaleX
          }
          break
        }
          
        default: { // Default to horizontal mirror
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
      }
      
      // Check if mirrored position is too close to any existing instance (merge threshold)
      const shouldMerge = mergeThreshold > 0 && newInstances.some(existing => {
        const dx = existing.transform.x - mirroredTransform.x
        const dy = existing.transform.y - mirroredTransform.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance < mergeThreshold
      })
      
      console.log(`🪞 Calculated mirrored transform:`, {
        originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y },
        mirroredPosition: { x: mirroredTransform.x, y: mirroredTransform.y },
        originalRotation: (inputInstance.transform.rotation * 180 / Math.PI).toFixed(1) + '°',
        mirroredRotation: (mirroredTransform.rotation * 180 / Math.PI).toFixed(1) + '°',
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
            isGroupClone: true // Mark as a group clone operation
          }
        }
        
        newInstances.push(mirroredInstance)
      }
    })
    
    console.log(`🪞 Mirror processor: Created ${newInstances.length - allInstances.length} mirrored instances`)
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

// Process mirror for groups
function processGroupMirror(
  input: ShapeState, 
  settings: MirrorSettings, 
  groupContext: GroupContext
): ShapeState {
  const { axis, offset, mergeThreshold } = settings
  const { groupTopLeft, groupBounds, groupTransform } = groupContext
  
  const newInstances: ShapeInstance[] = []
  
  console.log('processGroupMirror called with:', {
    axis,
    offset,
    mergeThreshold,
    groupTopLeft,
    groupBounds
  })
  
  // Add all original instances first
  newInstances.push(...input.instances)
  
  // For each existing instance (which represents a shape in the group), create the mirror
  input.instances.forEach(inputInstance => {
    console.log('Processing instance for mirror:', {
      shapeId: inputInstance.shape.id,
      shapeType: inputInstance.shape.type,
      originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y },
      groupTopLeft: { x: groupTopLeft.x, y: groupTopLeft.y }
    })
    
    // Calculate the relative position of this shape within the group (from top-left)
    const shapeRelativeX = inputInstance.transform.x - groupTopLeft.x
    const shapeRelativeY = inputInstance.transform.y - groupTopLeft.y
    
    let mirroredTransform: Transform
    
    switch (axis) {
      case 'x': { // Horizontal mirror (flip across vertical axis)
        const distanceFromCenter = shapeRelativeX - (groupBounds.width / 2)
        const mirroredRelativeX = -distanceFromCenter + (groupBounds.width / 2)
        
        // Calculate the final position of this shape in the mirrored group
        let finalX = groupTopLeft.x + mirroredRelativeX
        let finalY = inputInstance.transform.y
        let finalRotation = Math.PI - inputInstance.transform.rotation // Flip rotation for horizontal mirror
        const finalScaleX = -inputInstance.transform.scaleX // Flip horizontally
        const finalScaleY = inputInstance.transform.scaleY
        
        // Apply the group's current transform to make clones move with the group
        if (groupTransform) {
          // Calculate this cloned group's center (each clone scales around its own center)
          const clonedGroupCenterX = finalX + (groupBounds.width / 2)
          const clonedGroupCenterY = finalY + (groupBounds.height / 2)
          
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
          
          console.log(`Applied group transform to mirror clone:`, {
            clonedGroupCenter: { x: clonedGroupCenterX, y: clonedGroupCenterY },
            cloneOffset: { x: cloneOffsetX, y: cloneOffsetY },
            groupRotation: groupTransform.rotation,
            finalPosition: { x: finalX, y: finalY }
          })
        }
        
        mirroredTransform = {
          x: finalX,
          y: finalY,
          rotation: finalRotation,
          scaleX: finalScaleX,
          scaleY: finalScaleY
        }
        break
      }
        
      case 'y': { // Vertical mirror (flip across horizontal axis)
        const distanceFromCenterY = shapeRelativeY - (groupBounds.height / 2)
        const mirroredRelativeY = -distanceFromCenterY + (groupBounds.height / 2)
        
        // Calculate the final position of this shape in the mirrored group
        let finalX = inputInstance.transform.x
        let finalY = groupTopLeft.y + mirroredRelativeY
        let finalRotation = -inputInstance.transform.rotation // Flip rotation for vertical mirror
        const finalScaleX = inputInstance.transform.scaleX
        const finalScaleY = -inputInstance.transform.scaleY // Flip vertically
        
        // Apply the group's current transform to make clones move with the group
        if (groupTransform) {
          // Calculate the clone's offset from the source group's original position
          const cloneOffsetX = finalX - groupTopLeft.x
          const cloneOffsetY = finalY - groupTopLeft.y
          
          // Apply group rotation to the clone offset around the source group center
          if (groupTransform.rotation !== 0) {
            const cos = Math.cos(groupTransform.rotation)
            const sin = Math.sin(groupTransform.rotation)
            const rotatedOffsetX = cloneOffsetX * cos - cloneOffsetY * sin
            const rotatedOffsetY = cloneOffsetX * sin + cloneOffsetY * cos
            
            // Apply the rotated offset to the source group's position
            finalX = groupTransform.x + rotatedOffsetX
            finalY = groupTransform.y + rotatedOffsetY
          } else {
            // No rotation, just apply position offset
            finalX = groupTransform.x + cloneOffsetX
            finalY = groupTransform.y + cloneOffsetY
          }
          
          finalRotation += groupTransform.rotation
        }
        
        mirroredTransform = {
          x: finalX,
          y: finalY,
          rotation: finalRotation,
          scaleX: finalScaleX,
          scaleY: finalScaleY
        }
        break
      }
        
      case 'diagonal': { // Diagonal mirror (swap X/Y and flip both)
        // Calculate the final position of this shape in the mirrored group
        let finalX = groupTopLeft.y + shapeRelativeY + offset
        let finalY = groupTopLeft.x + shapeRelativeX + offset
        let finalRotation = Math.PI/2 - inputInstance.transform.rotation // Adjust rotation for diagonal flip
        const finalScaleX = -inputInstance.transform.scaleY
        const finalScaleY = -inputInstance.transform.scaleX
        
        // Apply the group's current transform to make clones move with the group
        if (groupTransform) {
          // Calculate the clone's offset from the source group's original position
          const cloneOffsetX = finalX - groupTopLeft.x
          const cloneOffsetY = finalY - groupTopLeft.y
          
          // Apply group rotation to the clone offset around the source group center
          if (groupTransform.rotation !== 0) {
            const cos = Math.cos(groupTransform.rotation)
            const sin = Math.sin(groupTransform.rotation)
            const rotatedOffsetX = cloneOffsetX * cos - cloneOffsetY * sin
            const rotatedOffsetY = cloneOffsetX * sin + cloneOffsetY * cos
            
            // Apply the rotated offset to the source group's position
            finalX = groupTransform.x + rotatedOffsetX
            finalY = groupTransform.y + rotatedOffsetY
          } else {
            // No rotation, just apply position offset
            finalX = groupTransform.x + cloneOffsetX
            finalY = groupTransform.y + cloneOffsetY
          }
          
          finalRotation += groupTransform.rotation
        }
        
        mirroredTransform = {
          x: finalX,
          y: finalY,
          rotation: finalRotation,
          scaleX: finalScaleX,
          scaleY: finalScaleY
        }
        break
      }
        
      default: { // Default to horizontal mirror
        const distanceFromCenter = shapeRelativeX - (groupBounds.width / 2)
        const mirroredRelativeX = -distanceFromCenter + (groupBounds.width / 2)
        
        // Calculate the final position of this shape in the mirrored group
        let finalX = groupTopLeft.x + mirroredRelativeX
        let finalY = inputInstance.transform.y
        let finalRotation = Math.PI - inputInstance.transform.rotation // Flip rotation for horizontal mirror
        const finalScaleX = -inputInstance.transform.scaleX
        const finalScaleY = inputInstance.transform.scaleY
        
        // Apply the group's current transform to make clones move with the group
        if (groupTransform) {
          // Calculate the clone's offset from the source group's original position
          const cloneOffsetX = finalX - groupTopLeft.x
          const cloneOffsetY = finalY - groupTopLeft.y
          
          // Apply group rotation to the clone offset around the source group center
          if (groupTransform.rotation !== 0) {
            const cos = Math.cos(groupTransform.rotation)
            const sin = Math.sin(groupTransform.rotation)
            const rotatedOffsetX = cloneOffsetX * cos - cloneOffsetY * sin
            const rotatedOffsetY = cloneOffsetX * sin + cloneOffsetY * cos
            
            // Apply the rotated offset to the source group's position
            finalX = groupTransform.x + rotatedOffsetX
            finalY = groupTransform.y + rotatedOffsetY
          } else {
            // No rotation, just apply position offset
            finalX = groupTransform.x + cloneOffsetX
            finalY = groupTransform.y + cloneOffsetY
          }
          
          finalRotation += groupTransform.rotation
        }
        
        mirroredTransform = {
          x: finalX,
          y: finalY,
          rotation: finalRotation,
          scaleX: finalScaleX,
          scaleY: finalScaleY
        }
      }
    }
    
    // Check if mirrored position is too close to any existing instance (merge threshold)
    const shouldMerge = mergeThreshold > 0 && newInstances.some(existing => {
      const dx = existing.transform.x - mirroredTransform.x
      const dy = existing.transform.y - mirroredTransform.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      return distance < mergeThreshold
    })
    
    console.log(`Mirror clone calculations:`, {
      axis,
      originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y },
      mirroredPosition: { x: mirroredTransform.x, y: mirroredTransform.y },
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
          isGroupClone: true
        }
      }
      
      newInstances.push(mirroredInstance)
    }
  })
  
  return {
    ...input,
    instances: newInstances
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