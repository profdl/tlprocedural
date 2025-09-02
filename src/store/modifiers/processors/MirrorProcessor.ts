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
      const shapeHeight = 'h' in shape.props ? shape.props.h as number : 100
      
      // For rotated shapes, we need to work with the actual rotated center position
      // The transform gives us the top-left of the bounding box, but for rotated shapes
      // we need to get the actual center of the rotated shape
      
      // Get the center of the shape in its local coordinate system
      const localCenterX = shapeWidth / 2
      const localCenterY = shapeHeight / 2
      
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
      
      // Create the flipped shape data for proper mirroring
      const mirroredShape = createFlippedShape(inputInstance.shape, axis)
      
      // Calculate mirrored rotation
      let mirroredRotation = inputInstance.transform.rotation
      if (axis === 'x') {
        // For X-axis mirroring (vertical mirror line), flip rotation horizontally
        mirroredRotation = -inputInstance.transform.rotation
      } else if (axis === 'y') {
        // For Y-axis mirroring (horizontal mirror line), flip rotation vertically  
        mirroredRotation = Math.PI - inputInstance.transform.rotation
      }
      
      // Convert mirrored center back to top-left coordinates, accounting for rotation
      const mirroredCos = Math.cos(mirroredRotation)
      const mirroredSin = Math.sin(mirroredRotation)
      
      // Transform back from world center to local top-left coordinates
      const mirroredTopLeftX = mirroredCenterX - (localCenterX * mirroredCos - localCenterY * mirroredSin)
      const mirroredTopLeftY = mirroredCenterY - (localCenterX * mirroredSin + localCenterY * mirroredCos)
      
      // Create mirrored transform without negative scaling
      const mirroredTransform: Transform = {
        x: mirroredTopLeftX,
        y: mirroredTopLeftY,
        rotation: mirroredRotation,
        scaleX: Math.abs(inputInstance.transform.scaleX), // Use positive scale
        scaleY: Math.abs(inputInstance.transform.scaleY), // Use positive scale
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
 * Creates a flipped version of a shape for mirroring
 */
function createFlippedShape(originalShape: TLShape, axis: 'x' | 'y'): TLShape {
  const flippedShape = { ...originalShape }
  
  // Handle different shape types
  switch (originalShape.type) {
    case 'sine-wave':
      // For sine waves, we flip using metadata
      flippedShape.meta = {
        ...originalShape.meta,
        isFlippedX: axis === 'x',
        isFlippedY: axis === 'y'
      }
      break
      
    case 'triangle':
      // For triangles, we flip using metadata 
      flippedShape.meta = {
        ...originalShape.meta,
        isFlippedX: axis === 'x',
        isFlippedY: axis === 'y'
      }
      break
      
    case 'custom-draw':
      // For custom draw shapes, we need to flip the path points
      if ('segments' in originalShape.props) {
        const segments = originalShape.props.segments as any[]
        const width = ('w' in originalShape.props ? originalShape.props.w : 100) as number
        const height = ('h' in originalShape.props ? originalShape.props.h : 100) as number
        
        const flippedSegments = segments.map(segment => ({
          ...segment,
          points: segment.points?.map((point: any) => ({
            ...point,
            x: axis === 'x' ? width - point.x : point.x, // Flip X coordinate for X-axis mirror
            y: axis === 'y' ? height - point.y : point.y  // Flip Y coordinate for Y-axis mirror
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
        const height = ('h' in originalShape.props ? originalShape.props.h : 100) as number
        
        const flippedHandles = Object.fromEntries(
          Object.entries(handles).map(([key, handle]) => [
            key, 
            { 
              ...handle, 
              x: axis === 'x' ? width - handle.x : handle.x,
              y: axis === 'y' ? height - handle.y : handle.y
            }
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
        isFlippedX: axis === 'x',
        isFlippedY: axis === 'y'
      }
      break
      
    default:
      // For other shapes, add flip metadata that can be used by CSS transforms
      flippedShape.meta = {
        ...originalShape.meta,
        isFlippedX: axis === 'x',
        isFlippedY: axis === 'y'
      }
      break
  }
  
  return flippedShape
}