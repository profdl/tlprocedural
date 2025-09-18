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
      
      // Create grid positions starting from (0,0), include the original
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
  const { groupBounds, groupTransform } = groupContext
  
  const newInstances: ShapeInstance[] = []
  
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    
    // Create grid positions starting from (0,0), include the original
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {

        // Get the group center (same pattern as individual shape center calculation)
        const groupCenterX = groupBounds.centerX
        const groupCenterY = groupBounds.centerY

        // Calculate grid offset from group center (same as individual shape logic)
        const gridOffsetX = (offsetX || 0) + (col * spacingX)
        const gridOffsetY = (offsetY || 0) + (row * spacingY)

        // Calculate clone center position with grid offset from group center
        let cloneCenterX = groupCenterX + gridOffsetX
        let cloneCenterY = groupCenterY + gridOffsetY

        // If group has rotation, apply orbital rotation around group center (same as individual shape logic)
        const groupRotation = groupTransform?.rotation || 0
        if (groupRotation !== 0) {
          // Apply orbital rotation around group center
          const cos = Math.cos(groupRotation)
          const sin = Math.sin(groupRotation)

          const rotatedOffsetX = gridOffsetX * cos - gridOffsetY * sin
          const rotatedOffsetY = gridOffsetX * sin + gridOffsetY * cos

          cloneCenterX = groupCenterX + rotatedOffsetX
          cloneCenterY = groupCenterY + rotatedOffsetY
        }

        // Calculate the relative position of this shape within the group (from group center)
        const shapeRelativeX = inputInstance.transform.x - groupCenterX
        const shapeRelativeY = inputInstance.transform.y - groupCenterY

        // Calculate the final position of this shape in the cloned group
        let finalX = cloneCenterX + shapeRelativeX
        let finalY = cloneCenterY + shapeRelativeY
        let finalRotation = inputInstance.transform.rotation
        
        
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