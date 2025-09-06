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
  process(input: ShapeState, settings: MirrorSettings, _groupContext?: GroupContext): ShapeState {
    const { axis, offset } = settings
    
    
    // Support both X-axis and Y-axis mirroring
    if (axis !== 'x' && axis !== 'y') {
      return input
    }
    
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the original and mirrored copy
    input.instances.forEach(inputInstance => {
      // Add the original instance
      newInstances.push(inputInstance)
      
      // Get shape bounds for mirroring calculations
      const shape = inputInstance.shape
      const originalWidth = 'w' in shape.props ? shape.props.w as number : 100
      const originalHeight = 'h' in shape.props ? shape.props.h as number : 100
      
      // Apply scaling to get the actual dimensions of this instance
      const scaledWidth = originalWidth * inputInstance.transform.scaleX
      const scaledHeight = originalHeight * inputInstance.transform.scaleY
      
      // For rotated shapes, we need to work with the actual rotated center position
      // The transform gives us the top-left of the bounding box, but for rotated shapes
      // we need to get the actual center of the rotated shape
      
      // Get the center of the SCALED shape in its local coordinate system
      const localCenterX = scaledWidth / 2
      const localCenterY = scaledHeight / 2
      
      // Apply rotation to get the actual center position in world space
      const rotation = inputInstance.transform.rotation
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      
      // Transform the local center to world coordinates
      const worldCenterX = inputInstance.transform.x + (localCenterX * cos - localCenterY * sin)
      const worldCenterY = inputInstance.transform.y + (localCenterX * sin + localCenterY * cos)
      
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
      
      // Convert mirrored center back to top-left coordinates, accounting for rotation
      const mirroredCos = Math.cos(mirroredRotation)
      const mirroredSin = Math.sin(mirroredRotation)
      
      // Transform back from world center to local top-left coordinates using scaled dimensions
      const mirroredTopLeftX = mirroredCenterX - (localCenterX * mirroredCos - localCenterY * mirroredSin)
      const mirroredTopLeftY = mirroredCenterY - (localCenterX * mirroredSin + localCenterY * mirroredCos)
      
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
          isMirrored: true,
          mirrorAxis: axis,
          mirrorOffset: offset,
          sourceInstance: inputInstance.index
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

