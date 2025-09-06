import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  GridArraySettings,
  GroupContext
} from '../../../types/modifiers'
import { calculateGridPosition } from '../../../components/modifiers/utils'

// Grid Array Processor implementation
export const GridArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: GridArraySettings, groupContext?: GroupContext, editor?: any): ShapeState {
    const { rows, columns, spacingX, spacingY, offsetX, offsetY } = settings
    
    // Check if this is a group modifier
    if (groupContext) {
      return processGroupGridArray(input, settings, groupContext, editor)
    }
    
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the grid array
    input.instances.forEach(inputInstance => {
      // Create grid positions including (0,0) which replaces the original
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          // Use calculateGridPosition to properly handle rotated shapes
          const position = calculateGridPosition(
            inputInstance.shape,
            row,
            col,
            offsetX || 0,
            offsetY || 0,
            spacingX,
            spacingY,
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
              arrayIndex: row * columns + col,
              sourceInstance: inputInstance.index,
              gridPosition: { row, col }
            }
          }
          
          newInstances.push(newInstance)
        }
      }
    })
    
    console.log(`GridArrayProcessor: Created ${newInstances.length} instances for ${rows}x${columns} grid`)
    
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
  groupContext: GroupContext,
  editor?: any
): ShapeState {
  const { rows, columns, spacingX, spacingY, offsetX, offsetY } = settings
  const { groupTopLeft, groupBounds, groupTransform } = groupContext
  
  const newInstances: ShapeInstance[] = []
  
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    
    // Create grid positions
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        
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
  
  console.log(`GridArrayProcessor (Group): Created ${newInstances.length} instances for ${rows}x${columns} grid`)
  
  return {
    ...input,
    instances: newInstances
  }
} 