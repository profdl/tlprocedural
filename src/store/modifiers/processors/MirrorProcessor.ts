import type {
  ShapeState,
  ShapeInstance,
  Transform,
  ModifierProcessor,
  MirrorSettings
} from '../../../types/modifiers'
import { getShapeVisualCenter } from '../../../components/modifiers/utils/transformUtils'

// Mirror Processor implementation - Clean slate
export const MirrorProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: MirrorSettings, groupContext?: any, editor?: any): ShapeState {
    const { axis, offset } = settings
    
    
    // Support both X-axis and Y-axis mirroring
    if (axis !== 'x' && axis !== 'y') {
      return input
    }
    
    const newInstances: ShapeInstance[] = []

    // Create mirrored copies of ALL instances (don't keep originals)
    input.instances.forEach(inputInstance => {
      // Create a temporary shape with the transformed position and rotation for visual center calculation
      const transformedShape = {
        ...inputInstance.shape,
        x: inputInstance.transform.x,
        y: inputInstance.transform.y,
        rotation: inputInstance.transform.rotation
      }

      // Get the correct visual center accounting for rotation
      const { x: worldCenterX, y: worldCenterY } = getShapeVisualCenter(transformedShape, editor)

      // Get shape dimensions for later calculations
      const originalWidth = 'w' in transformedShape.props ? transformedShape.props.w as number : 100
      const originalHeight = 'h' in transformedShape.props ? transformedShape.props.h as number : 100
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
      const mirroredShape = {
        ...inputInstance.shape,
        meta: {
          ...inputInstance.shape.meta,
          isFlippedX: axis === 'x' ? !(inputInstance.shape.meta?.isFlippedX === true) : (inputInstance.shape.meta?.isFlippedX === true),
          isFlippedY: axis === 'y' ? !(inputInstance.shape.meta?.isFlippedY === true) : (inputInstance.shape.meta?.isFlippedY === true),
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
          targetRotation: mirroredRotation // Store rotation for extractShapesFromState
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

