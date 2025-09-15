import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  GridArraySettings,
  GroupContext
} from '../../../types/modifiers'
import { getShapeDimensions } from '../../../components/modifiers/utils'

// Grid Array Processor implementation
export const GridArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: GridArraySettings, groupContext?: GroupContext, editor?: import('tldraw').Editor): ShapeState {
    const { rows, columns, spacingX, spacingY, offsetX, offsetY } = settings
    
    // Check if this is a group modifier
    if (groupContext) {
      return processGroupGridArray(input, settings, groupContext)
    }
    
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the grid array
    input.instances.forEach((inputInstance) => {
      // Get shape dimensions for center calculation
      const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(inputInstance.shape)
      
      // Create grid positions including (0,0) which replaces the original
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          // Calculate grid position offset
          const gridOffsetX = (offsetX || 0) + (col * spacingX)
          const gridOffsetY = (offsetY || 0) + (row * spacingY)
          
          // When source shape is rotated, we need to calculate from its center
          // not from the top-left corner which moves when rotated
          let baseX = inputInstance.transform.x
          let baseY = inputInstance.transform.y
          let positionCorrected = inputInstance.metadata?.positionCorrected === true
          
          // Only correct for rotation if this is the original shape from the canvas,
          // not an already-transformed instance from a previous modifier
          // We can detect this by checking if there are no modifier-specific indices
          const isFromPreviousModifier = inputInstance.metadata?.linearArrayIndex !== undefined || 
                                        inputInstance.metadata?.circularArrayIndex !== undefined || 
                                        inputInstance.metadata?.gridArrayIndex !== undefined ||
                                        inputInstance.metadata?.sourceInstance !== undefined
          const hasRotation = inputInstance.transform.rotation !== 0
          
          if (editor && hasRotation && !positionCorrected && !isFromPreviousModifier) {
            // Get the visual center of the rotated original shape
            const bounds = editor.getShapePageBounds(inputInstance.shape.id)
            if (bounds) {
              // Calculate from center, then convert back to top-left for positioning
              const centerX = bounds.x + bounds.width / 2
              const centerY = bounds.y + bounds.height / 2
              baseX = centerX - shapeWidth / 2
              baseY = centerY - shapeHeight / 2
              positionCorrected = true
            }
          }
          
          // Apply grid offset to the corrected base position
          const newTransform: Transform = {
            x: baseX + gridOffsetX,
            y: baseY + gridOffsetY,
            rotation: inputInstance.transform.rotation, // Preserve rotation from Linear Array
            scaleX: inputInstance.transform.scaleX,
            scaleY: inputInstance.transform.scaleY
          }
          
          const newInstance: ShapeInstance = {
            shape: { ...inputInstance.shape },
            transform: newTransform,
            index: newInstances.length,
            metadata: {
              ...inputInstance.metadata,
              arrayIndex: newInstances.length, // Use the sequential index for clone mapping
              sourceInstance: inputInstance.index,
              gridPosition: { row, col },
              gridArrayIndex: row * columns + col, // Store grid-specific index separately
              positionCorrected: positionCorrected // Mark if position was corrected for rotation
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
  
  
  return {
    ...input,
    instances: newInstances
  }
} 