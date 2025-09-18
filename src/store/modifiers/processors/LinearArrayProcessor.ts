import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  LinearArraySettings,
  GroupContext
} from '../../../types/modifiers'
import { getShapeDimensions, degreesToRadians } from '../../../components/modifiers/utils'

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
  const { groupBounds, groupTransform } = groupContext
  
  
  // Start with empty instances (we'll generate new ones)
  const newInstances: ShapeInstance[] = []
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {

    for (let i = 0; i < count; i++) { // Start from i=0, include the original

      // Use group dimensions for percentage-based offsets (same as individual shape logic)
      const pixelOffsetX = (offsetX / 100) * groupBounds.width * i
      const pixelOffsetY = (offsetY / 100) * groupBounds.height * i

      // Calculate incremental and uniform rotation for this index (same as individual shape logic)
      const incrementalRotationRadians = degreesToRadians(rotationIncrement * i)
      const uniformRotationRadians = degreesToRadians(rotateAll)
      const totalRotationRadians = incrementalRotationRadians + uniformRotationRadians

      // Calculate scaling (same as individual shape logic)
      const progress = count > 1 ? i / (count - 1) : 0
      const scaleStepDecimal = scaleStep / 100
      const interpolatedScale = 1 + (scaleStepDecimal - 1) * progress

      // Get the group center (same pattern as individual shape center calculation)
      const groupCenterX = groupBounds.centerX
      const groupCenterY = groupBounds.centerY

      // Calculate base clone center position with linear offset from group center (same as individual shape logic)
      let cloneCenterX = groupCenterX + pixelOffsetX
      let cloneCenterY = groupCenterY + pixelOffsetY

      // If group has rotation, apply orbital rotation around group center (same as individual shape logic)
      const groupRotation = groupTransform?.rotation || 0
      if (groupRotation !== 0) {
        // Apply orbital rotation around group center
        const offsetX = pixelOffsetX
        const offsetY = pixelOffsetY

        const cos = Math.cos(groupRotation)
        const sin = Math.sin(groupRotation)

        const rotatedOffsetX = offsetX * cos - offsetY * sin
        const rotatedOffsetY = offsetX * sin + offsetY * cos

        cloneCenterX = groupCenterX + rotatedOffsetX
        cloneCenterY = groupCenterY + rotatedOffsetY
      }

      // Calculate the relative position of this shape within the group (from group center)
      const shapeRelativeX = inputInstance.transform.x - groupCenterX
      const shapeRelativeY = inputInstance.transform.y - groupCenterY

      // Apply scaling to the relative position
      const scaledRelativeX = shapeRelativeX * interpolatedScale
      const scaledRelativeY = shapeRelativeY * interpolatedScale

      // Calculate the final position of this shape in the cloned group
      let finalX = cloneCenterX + scaledRelativeX
      let finalY = cloneCenterY + scaledRelativeY
      let finalRotation = inputInstance.transform.rotation + totalRotationRadians
      
      // Compose the transform
      const newTransform: Transform = {
        x: finalX,
        y: finalY,
        rotation: finalRotation,
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