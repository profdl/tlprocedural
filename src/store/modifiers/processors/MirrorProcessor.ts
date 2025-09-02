import type { 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  MirrorSettings,
  GroupContext
} from '../../../types/modifiers'
import type { TLShape } from 'tldraw'

// Mirror Processor implementation - Clean slate
export const MirrorProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: MirrorSettings, _groupContext?: GroupContext): ShapeState {
    const { axis, offset } = settings
    
    console.log('🪞 Mirror processor: Starting implementation for axis:', axis, 'offset:', offset)
    
    // Support both X-axis and Y-axis mirroring
    if (axis !== 'x' && axis !== 'y') {
      console.log('🪞 Mirror processor: Only X and Y axis mirroring implemented')
      return input
    }
    
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the original and mirrored copy
    input.instances.forEach(inputInstance => {
      // Add the original instance
      newInstances.push(inputInstance)
      
      // Get shape bounds for mirroring calculations
      const shape = inputInstance.shape
      const shapeWidth = 'w' in shape.props ? shape.props.w as number : 100
      
      // Calculate mirrored position
      // For X-axis mirroring, we flip horizontally around the shape's center + offset
      const shapeCenterX = inputInstance.transform.x + shapeWidth / 2
      const mirrorLineX = shapeCenterX + offset // When offset=0, mirror line is at shape center
      
      // Calculate the mirrored center position, then adjust for shape width
      const mirroredCenterX = mirrorLineX + (mirrorLineX - shapeCenterX)
      const mirroredX = mirroredCenterX - shapeWidth / 2
      
      // Create the flipped shape data for proper mirroring
      const mirroredShape = createFlippedShape(inputInstance.shape)
      
      // Create mirrored transform without negative scaling
      const mirroredTransform: Transform = {
        x: mirroredX,
        y: inputInstance.transform.y, // Y position stays the same for X-axis mirror
        rotation: inputInstance.transform.rotation,
        scaleX: Math.abs(inputInstance.transform.scaleX), // Use positive scale
        scaleY: inputInstance.transform.scaleY,
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
    
    console.log('🪞 Mirror processor: Generated', newInstances.length, 'instances from', input.instances.length, 'input instances')
    
    return {
      ...input,
      instances: newInstances
    }
  }
}

/**
 * Creates a horizontally flipped version of a shape for mirroring
 */
function createFlippedShape(originalShape: TLShape): TLShape {
  const flippedShape = { ...originalShape }
  
  // Handle different shape types
  switch (originalShape.type) {
    case 'sine-wave':
      // For sine waves, we flip using metadata
      flippedShape.meta = {
        ...originalShape.meta,
        isFlippedX: true
      }
      break
      
    case 'triangle':
      // For triangles, we flip using metadata 
      flippedShape.meta = {
        ...originalShape.meta,
        isFlippedX: true
      }
      break
      
    case 'custom-draw':
      // For custom draw shapes, we need to flip the path points
      if ('segments' in originalShape.props) {
        const segments = originalShape.props.segments as any[]
        const width = ('w' in originalShape.props ? originalShape.props.w : 100) as number
        
        const flippedSegments = segments.map(segment => ({
          ...segment,
          points: segment.points?.map((point: any) => ({
            ...point,
            x: width - point.x // Flip X coordinate
          }))
        }))
        
        flippedShape.props = {
          ...originalShape.props,
          segments: flippedSegments
        }
      }
      break
      
    case 'custom-line':
      // For custom lines, flip the handles
      if ('handles' in originalShape.props) {
        const handles = originalShape.props.handles as Record<string, any>
        const width = ('w' in originalShape.props ? originalShape.props.w : 100) as number
        
        const flippedHandles = Object.fromEntries(
          Object.entries(handles).map(([key, handle]) => [
            key, 
            { ...handle, x: width - handle.x }
          ])
        )
        
        flippedShape.props = {
          ...originalShape.props,
          handles: flippedHandles
        }
      }
      break
      
    case 'circle':
    case 'polygon':
    case 'bezier':
      // For custom shapes, add flip metadata that can be used by CSS transforms
      flippedShape.meta = {
        ...originalShape.meta,
        isFlippedX: true
      }
      break
      
    default:
      // For other shapes, add flip metadata that can be used by CSS transforms
      flippedShape.meta = {
        ...originalShape.meta,
        isFlippedX: true
      }
      break
  }
  
  return flippedShape
}