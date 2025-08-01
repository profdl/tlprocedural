import type { TLShape } from 'tldraw'
import type { 
  ShapeState, 
  ShapeInstance, 
  Transform
} from '../../../types/modifiers'

/**
 * Creates initial ShapeState from a TLShape
 * This is the starting point for modifier processing
 */
export function createInitialShapeState(shape: TLShape): ShapeState {
  const transform: Transform = {
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation || 0,
    scaleX: 1,
    scaleY: 1
  }

  const instance: ShapeInstance = {
    shape,
    transform,
    index: 0,
    metadata: { isOriginal: true }
  }

  return {
    originalShape: shape,
    instances: [instance],
    metadata: {}
  }
}

/**
 * Converts ShapeState back to TLShape array for rendering
 * This is the final step in modifier processing
 */
export function extractShapesFromState(state: ShapeState): TLShape[] {
  console.log('extractShapesFromState called with instances:', state.instances.length)
  console.log('State metadata:', state.metadata)
  
  return state.instances.map((instance: ShapeInstance, index: number) => {
    console.log(`Processing instance ${index}:`, {
      transform: instance.transform,
      hasW: 'w' in instance.shape.props,
      hasH: 'h' in instance.shape.props,
      originalW: 'w' in instance.shape.props ? instance.shape.props.w : 'N/A',
      originalH: 'h' in instance.shape.props ? instance.shape.props.h : 'N/A',
      scaleX: instance.transform.scaleX,
      scaleY: instance.transform.scaleY,
      shapeType: instance.shape.type,
      isGroupMember: instance.metadata?.isGroupMember,
      isGroupClone: instance.metadata?.isGroupClone
    })
    
    const baseShape = {
      ...instance.shape,
      x: instance.transform.x,
      y: instance.transform.y,
      rotation: instance.transform.rotation
    }
    
    // Debug logging to see what values we're applying
    if (instance.metadata?.isMirrored && 'w' in instance.shape.props && 'h' in instance.shape.props) {
      console.log('Mirror transform:', {
        originalW: instance.shape.props.w,
        originalH: instance.shape.props.h,
        scaleX: instance.transform.scaleX,
        scaleY: instance.transform.scaleY,
        willFlipX: instance.transform.scaleX < 0,
        willFlipY: instance.transform.scaleY < 0,
        rotationTransfer: {
          originalShapeRotation: instance.shape.rotation,
          transformRotation: instance.transform.rotation,
          finalShapeRotation: instance.transform.rotation,
          rotationInDegrees: (instance.transform.rotation * 180 / Math.PI).toFixed(1) + '°'
        }
      })
    }
    
    // Handle scaling - for mirrored shapes, we don't apply negative scaling to dimensions
    if (instance.metadata?.isMirrored) {
      // For mirrored shapes, keep original dimensions and store flip info in metadata
      if ('w' in instance.shape.props && 'h' in instance.shape.props) {
        baseShape.props = {
          ...baseShape.props,
          w: instance.shape.props.w,  // Keep original width
          h: instance.shape.props.h   // Keep original height
        }
      }
      
      // Store all the transform information in metadata for CSS rendering
      baseShape.meta = {
        ...baseShape.meta,
        isFlippedX: instance.transform.scaleX < 0,
        isFlippedY: instance.transform.scaleY < 0,
        mirrorAxis: instance.metadata.mirrorAxis as string,
        scaleX: instance.transform.scaleX,
        scaleY: instance.transform.scaleY,
        isMirrored: true
      }
      
      console.log('Stored flip metadata:', {
        isFlippedX: instance.transform.scaleX < 0,
        isFlippedY: instance.transform.scaleY < 0,
        scaleX: instance.transform.scaleX,
        scaleY: instance.transform.scaleY
      })
    } else {
      // Apply comprehensive scaling to all shape types (only for positive scales)
      if (instance.transform.scaleX !== 1 || instance.transform.scaleY !== 1) {
        // Only apply scaling if both values are positive (to avoid negative dimensions)
        if (instance.transform.scaleX > 0 && instance.transform.scaleY > 0) {
          const scaledShape = applyShapeScaling(instance.shape, instance.transform.scaleX, instance.transform.scaleY)
          baseShape.props = scaledShape.props
          
          console.log(`Applied comprehensive scaling to instance ${index}:`, {
            shapeType: instance.shape.type,
            scaleX: instance.transform.scaleX,
            scaleY: instance.transform.scaleY
          })
        } else {
          console.warn(`Skipping negative scaling for instance ${index}:`, {
            scaleX: instance.transform.scaleX,
            scaleY: instance.transform.scaleY
          })
        }
      }
    }
    
    console.log(`Final shape ${index} props:`, baseShape.props)
    return baseShape
  })
}

/**
 * Applies scaling to a shape based on scale factors
 * This is a simplified version - the full implementation is in shapeUtils.ts
 */
function applyShapeScaling(shape: TLShape, scaleX: number, scaleY: number): TLShape {
  // For shapes with w/h properties (most common)
  if ('w' in shape.props && 'h' in shape.props) {
    const originalW = shape.props.w as number
    const originalH = shape.props.h as number
    
    // Ensure we don't create negative or zero dimensions
    const newW = Math.max(1, originalW * scaleX)
    const newH = Math.max(1, originalH * scaleY)
    
    return {
      ...shape,
      props: {
        ...shape.props,
        w: newW,
        h: newH
      }
    }
  }
  
  // For other shape types, return as-is
  return shape
}

/**
 * Validates a ShapeState object
 * Throws an error if the state is invalid
 */
export function validateShapeState(state: ShapeState): void {
  if (!state.originalShape) {
    throw new Error('ShapeState must have an originalShape')
  }
  
  if (!Array.isArray(state.instances)) {
    throw new Error('ShapeState instances must be an array')
  }
  
  if (state.instances.length === 0) {
    throw new Error('ShapeState must have at least one instance')
  }
  
  // Validate each instance
  state.instances.forEach((instance: ShapeInstance, index: number) => {
    if (!instance.shape) {
      throw new Error(`Instance ${index} must have a shape`)
    }
    
    if (!instance.transform) {
      throw new Error(`Instance ${index} must have a transform`)
    }
    
    // Validate transform properties
    const { x, y, rotation, scaleX, scaleY } = instance.transform
    
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new Error(`Instance ${index} transform must have numeric x, y coordinates`)
    }
    
    if (typeof rotation !== 'number') {
      throw new Error(`Instance ${index} transform must have numeric rotation`)
    }
    
    if (typeof scaleX !== 'number' || typeof scaleY !== 'number') {
      throw new Error(`Instance ${index} transform must have numeric scale values`)
    }
  })
}

/**
 * Creates a deep copy of a ShapeState
 * Useful for creating immutable updates
 */
export function cloneShapeState(state: ShapeState): ShapeState {
  return {
    originalShape: { ...state.originalShape },
    instances: state.instances.map((instance: ShapeInstance) => ({
      ...instance,
      shape: { ...instance.shape },
      transform: { ...instance.transform },
      metadata: { ...instance.metadata }
    })),
    metadata: { ...state.metadata }
  }
} 