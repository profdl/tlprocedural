import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  MirrorSettings,
  GroupContext
} from '../../../types/modifiers'

// Mirror Processor implementation - Clean slate
export const MirrorProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: MirrorSettings, _groupContext?: GroupContext, _editor?: any): ShapeState {
    const { axis, offset } = settings
    
    
    // Support both X-axis and Y-axis mirroring
    if (axis !== 'x' && axis !== 'y') {
      return input
    }
    
    const newInstances: ShapeInstance[] = []
    
    // Keep all original instances (treat Linear Array output as a single entity)
    input.instances.forEach(inputInstance => {
      // First, add the original instance unchanged
      newInstances.push({
        ...inputInstance,
        index: newInstances.length,
        metadata: {
          ...inputInstance.metadata,
          arrayIndex: newInstances.length
        }
      })
    })
    
    // Now create mirrored copies of ALL instances as a single unit
    input.instances.forEach(inputInstance => {
      // Get shape bounds for mirroring calculations
      const shape = inputInstance.shape
      const originalWidth = 'w' in shape.props ? shape.props.w as number : 100
      const originalHeight = 'h' in shape.props ? shape.props.h as number : 100
      
      // Apply scaling to get the actual dimensions of this instance
      const scaledWidth = originalWidth * inputInstance.transform.scaleX
      const scaledHeight = originalHeight * inputInstance.transform.scaleY
      
      // Get the center position using the transform directly
      // Since we're processing already-transformed instances from Linear Array,
      // we use the transform position, not the original shape position
      const worldCenterX = inputInstance.transform.x + scaledWidth / 2
      const worldCenterY = inputInstance.transform.y + scaledHeight / 2
      
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
      
      // Create mirrored transform
      const mirroredTransform: Transform = {
        x: mirroredTopLeftX,
        y: mirroredTopLeftY,
        rotation: mirroredRotation,
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
          sourceInstance: inputInstance.index
        }
      }
      
      newInstances.push(mirroredInstance)
    })
    
    console.log(`MirrorProcessor: Created ${newInstances.length} instances (${input.instances.length} originals + ${input.instances.length} mirrors) across ${axis}-axis`)
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

