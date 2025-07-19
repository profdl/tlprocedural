import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  GridArraySettings,
  GroupContext
} from '../../../types/modifiers'

// Grid Array Processor implementation
export const GridArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: GridArraySettings, groupContext?: GroupContext): ShapeState {
    const { rows, columns, spacingX, spacingY, offsetX, offsetY } = settings
    
    // Check if this is a group modifier
    if (groupContext) {
      return processGroupGridArray(input, settings, groupContext)
    }
    
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

// Process grid array for groups
function processGroupGridArray(
  input: ShapeState, 
  settings: GridArraySettings, 
  groupContext: GroupContext
): ShapeState {
  const { rows, columns, spacingX, spacingY, offsetX, offsetY } = settings
  const { groupTopLeft, groupBounds, groupTransform } = groupContext
  
  const newInstances: ShapeInstance[] = []
  
  console.log('processGroupGridArray called with:', {
    rows,
    columns,
    spacingX,
    spacingY,
    offsetX,
    offsetY,
    groupTopLeft,
    groupBounds
  })
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    console.log('Processing instance for grid array:', {
      shapeId: inputInstance.shape.id,
      shapeType: inputInstance.shape.type,
      originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y },
      groupTopLeft: { x: groupTopLeft.x, y: groupTopLeft.y }
    })
    
    // Create grid positions
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        // Skip the original position (0,0) - we'll add it first
        if (row === 0 && col === 0) {
          continue
        }
        
        // Calculate the offset from the group's top-left corner
        const offsetFromTopLeftX = (offsetX || 0) + (col * spacingX)
        const offsetFromTopLeftY = (offsetY || 0) + (row * spacingY)
        
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
          
          console.log(`Applied group transform to grid clone (${row},${col}):`, {
            clonedGroupCenter: { x: clonedGroupCenterX, y: clonedGroupCenterY },
            cloneOffset: { x: cloneOffsetX, y: cloneOffsetY },
            groupRotation: groupTransform.rotation,
            finalPosition: { x: finalX, y: finalY }
          })
        }
        
        console.log(`Grid clone (${row},${col}) calculations:`, {
          offsetFromTopLeft: { x: offsetFromTopLeftX, y: offsetFromTopLeftY },
          newGroupTopLeft: { x: newGroupTopLeftX, y: newGroupTopLeftY },
          shapeRelative: { x: shapeRelativeX, y: shapeRelativeY },
          finalPosition: { x: finalX, y: finalY }
        })
        
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
            arrayIndex: row * columns + col,
            sourceInstance: inputInstance.index,
            gridPosition: { row, col },
            isGroupClone: true
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