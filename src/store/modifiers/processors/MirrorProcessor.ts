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
  process(input: ShapeState, settings: MirrorSettings, _groupContext?: GroupContext, editor?: any): ShapeState {
    const { axis, offset } = settings
    
    
    // Support both X-axis and Y-axis mirroring
    if (axis !== 'x' && axis !== 'y') {
      return input
    }
    
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create only the mirrored copy
    input.instances.forEach(inputInstance => {
      // Unlike array modifiers, Mirror doesn't need to recreate the original position
      // The original shape will be hidden by useCloneManager, and we only create the mirror
      
      // Get shape bounds for mirroring calculations
      const shape = inputInstance.shape
      const originalWidth = 'w' in shape.props ? shape.props.w as number : 100
      const originalHeight = 'h' in shape.props ? shape.props.h as number : 100
      
      // Apply scaling to get the actual dimensions of this instance
      const scaledWidth = originalWidth * inputInstance.transform.scaleX
      const scaledHeight = originalHeight * inputInstance.transform.scaleY
      
      // Get the center position using the same pattern as other processors
      let worldCenterX: number
      let worldCenterY: number
      
      const shapeRotation = shape.rotation || 0
      if (editor && shapeRotation !== 0) {
        // For rotated shapes, use editor.getShapePageBounds() to get the visual center
        const bounds = editor.getShapePageBounds(shape.id)
        if (bounds) {
          worldCenterX = bounds.x + bounds.width / 2
          worldCenterY = bounds.y + bounds.height / 2
        } else {
          // Fallback if bounds not available
          worldCenterX = inputInstance.transform.x + scaledWidth / 2
          worldCenterY = inputInstance.transform.y + scaledHeight / 2
        }
      } else {
        // For non-rotated shapes, calculate center from top-left position
        worldCenterX = inputInstance.transform.x + scaledWidth / 2
        worldCenterY = inputInstance.transform.y + scaledHeight / 2
      }
      
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
    
    console.log(`MirrorProcessor: Created ${newInstances.length} instances (${input.instances.length} originals + mirrors) across ${axis}-axis`)
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

