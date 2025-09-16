import type {
  ShapeState,
  ShapeInstance,
  Transform,
  ModifierProcessor,
  MirrorSettings,
  GroupContext
} from '../../../types/modifiers'
import type { Editor } from 'tldraw'
import { getShapeDimensions } from '../../../components/modifiers/utils'

// Mirror Processor implementation - Clean slate
export const MirrorProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: MirrorSettings, _groupContext?: GroupContext, editor?: Editor): ShapeState {
    const { axis, offset } = settings
    
    
    // Support both X-axis and Y-axis mirroring
    if (axis !== 'x' && axis !== 'y') {
      return input
    }
    
    const newInstances: ShapeInstance[] = []

    // Create mirrored copies of ALL instances (no original preservation)
    input.instances.forEach(inputInstance => {
      // Check if this instance is from a previous modifier
      const isFromPreviousModifier = inputInstance.metadata?.linearArrayIndex !== undefined ||
                                    inputInstance.metadata?.circularArrayIndex !== undefined ||
                                    inputInstance.metadata?.gridArrayIndex !== undefined ||
                                    inputInstance.metadata?.sourceInstance !== undefined

      // Get the correct visual center accounting for rotation and modifier stacking
      let worldCenterX: number, worldCenterY: number

      // For original shapes from canvas, try to get actual visual bounds
      if (!isFromPreviousModifier && editor) {
        try {
          const bounds = editor.getShapePageBounds(inputInstance.shape.id)
          if (bounds) {
            worldCenterX = bounds.x + bounds.width / 2
            worldCenterY = bounds.y + bounds.height / 2
          } else {
            // Fallback to transform calculation
            const { width, height } = getShapeDimensions(inputInstance.shape)
            worldCenterX = inputInstance.transform.x + width / 2
            worldCenterY = inputInstance.transform.y + height / 2
          }
        } catch {
          // Fallback for any errors
          const { width, height } = getShapeDimensions(inputInstance.shape)
          worldCenterX = inputInstance.transform.x + width / 2
          worldCenterY = inputInstance.transform.y + height / 2
        }
      } else {
        // For instances from previous modifiers, use transform position directly
        const { width, height } = getShapeDimensions(inputInstance.shape)
        const scaledWidth = width * inputInstance.transform.scaleX
        const scaledHeight = height * inputInstance.transform.scaleY
        worldCenterX = inputInstance.transform.x + scaledWidth / 2
        worldCenterY = inputInstance.transform.y + scaledHeight / 2
      }

      // Get shape dimensions for later calculations
      const { width: originalWidth, height: originalHeight } = getShapeDimensions(inputInstance.shape)
      const scaledWidth = originalWidth * inputInstance.transform.scaleX
      const scaledHeight = originalHeight * inputInstance.transform.scaleY
      
      let mirroredCenterX = worldCenterX
      let mirroredCenterY = worldCenterY
      
      if (axis === 'x') {
        // Mirror across Y-axis (vertical line) at X = offset
        // For offset=0, this mirrors across X=0 (the Y-axis)
        mirroredCenterX = 2 * offset - worldCenterX
      } else if (axis === 'y') {
        // Mirror across X-axis (horizontal line) at Y = offset  
        // For offset=0, this mirrors across Y=0 (the X-axis)
        mirroredCenterY = 2 * offset - worldCenterY
      }
      
      // Create mirrored shape with proper flip metadata for FlippableShapeUtil-based shapes
      // Ensure only JSON-serializable values in meta
      const mirroredShape = {
        ...inputInstance.shape,
        meta: {
          ...inputInstance.shape.meta,
          isFlippedX: axis === 'x' ? !(inputInstance.shape.meta?.isFlippedX === true) : !!(inputInstance.shape.meta?.isFlippedX),
          isFlippedY: axis === 'y' ? !(inputInstance.shape.meta?.isFlippedY === true) : !!(inputInstance.shape.meta?.isFlippedY),
        }
      }
      
      // Mirror the rotation - rotate in opposite direction for true mirror effect
      const mirroredRotation = -inputInstance.transform.rotation
      
      // Convert mirrored center back to top-left coordinates
      // For shapes, the position represents the top-left corner, so we need to adjust from center
      const mirroredTopLeftX = mirroredCenterX - scaledWidth / 2
      const mirroredTopLeftY = mirroredCenterY - scaledHeight / 2
      
      // Preserve the original scale values - flipping is handled by metadata
      const mirroredScaleX = inputInstance.transform.scaleX
      const mirroredScaleY = inputInstance.transform.scaleY
      
      // Create mirrored transform (rotation will be applied via useCloneManager)
      const mirroredTransform: Transform = {
        x: mirroredTopLeftX,
        y: mirroredTopLeftY,
        rotation: 0, // Don't set rotation in transform - will be applied by useCloneManager
        scaleX: mirroredScaleX,
        scaleY: mirroredScaleY,
      }
      
      // Create mirrored shape instance
      const mirroredInstance: ShapeInstance = {
        shape: mirroredShape,
        transform: mirroredTransform,
        index: newInstances.length,
        metadata: {
          ...inputInstance.metadata,
          arrayIndex: newInstances.length, // Use sequential index for clone mapping
          isMirrored: true,
          mirrorAxis: axis,
          mirrorOffset: offset,
          sourceInstance: inputInstance.index,
          targetRotation: mirroredRotation, // Store rotation for extractShapesFromState
          positionCorrected: inputInstance.metadata?.positionCorrected // Preserve position correction flag
        }
      }
      
      newInstances.push(mirroredInstance)
    })
    
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

