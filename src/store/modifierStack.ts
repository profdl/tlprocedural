import type { TLShape, Editor } from 'tldraw'
import type { 
  TLModifier, 
  ShapeState, 
  ShapeInstance, 
  Transform,
  ModifierProcessor,
  LinearArraySettings,
  CircularArraySettings,
  GridArraySettings,
  MirrorSettings,
  GroupContext
} from '../types/modifiers'
import { applyShapeScaling, findTopLevelGroup } from '../components/modifiers/utils/shapeUtils'

// Helper function to create initial ShapeState from a TLShape
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

// Helper function to convert ShapeState back to TLShape array for rendering
export function extractShapesFromState(state: ShapeState): TLShape[] {
  console.log('extractShapesFromState called with instances:', state.instances.length)
  console.log('State metadata:', state.metadata)
  
  return state.instances.map((instance, index) => {
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

// Main ModifierStack class
export class ModifierStack {
  // Process a list of modifiers in sequence
  static processModifiers(
    originalShape: TLShape, 
    modifiers: TLModifier[],
    editor?: Editor
  ): ShapeState {
    console.log('ModifierStack.processModifiers called with:', {
      shapeId: originalShape.id,
      shapeType: originalShape.type,
      modifierCount: modifiers.length,
      modifiers: modifiers.map(m => ({ type: m.type, enabled: m.enabled, order: m.order }))
    })
    
    // Check if this shape is part of a group
    const parentGroup = editor ? findTopLevelGroup(originalShape, editor) : null
    
    console.log('Group detection:', {
      shapeId: originalShape.id,
      shapeType: originalShape.type,
      parentGroup: parentGroup ? { id: parentGroup.id, type: parentGroup.type } : null,
      hasEditor: !!editor
    })
    
    // Special case: if the shape itself is a group, use group processing
    if (originalShape.type === 'group' && editor) {
      console.log('Shape is a group, using group processing path')
      return this.processGroupModifiers(originalShape, originalShape, modifiers, editor)
    }
    
    if (parentGroup && editor) {
      console.log('Using group processing path')
      return this.processGroupModifiers(originalShape, parentGroup, modifiers, editor)
    }
    
    console.log('Using regular processing path')
    
    // Start with the original shape as initial state
    let currentState = createInitialShapeState(originalShape)
    
    // Filter to only enabled modifiers, sorted by order
    const enabledModifiers = modifiers
      .filter(modifier => modifier.enabled)
      .sort((a, b) => a.order - b.order)

    // Debug logging for multiple modifier processing
    if (enabledModifiers.length > 1) {
      console.log(`🔧 Processing ${enabledModifiers.length} modifiers for shape:`, originalShape.id)
      enabledModifiers.forEach((mod, index) => {
        console.log(`  ${index + 1}. ${mod.type} (order: ${mod.order})`)
      })
    }

    // Process each modifier in sequence
    for (const modifier of enabledModifiers) {
      const processor = ModifierStack.getProcessor(modifier.type)
      if (processor) {
        const previousInstanceCount = currentState.instances.length
        currentState = processor.process(currentState, modifier.props)
        const newInstanceCount = currentState.instances.length
        
        if (enabledModifiers.length > 1) {
          console.log(`    ${modifier.type}: ${previousInstanceCount} → ${newInstanceCount} instances`)
        }
      }
    }

    if (enabledModifiers.length > 1) {
      console.log(`✅ Final result: ${currentState.instances.length} total instances`)
    }

    return currentState
  }
  
  // Process modifiers for shapes that are part of a group
  private static processGroupModifiers(
    shape: TLShape,
    group: TLShape,
    modifiers: TLModifier[],
    editor: Editor
  ): ShapeState {
    // Get all shapes in the group
    const groupShapeIds = editor.getShapeAndDescendantIds([group.id])
    const groupShapes = Array.from(groupShapeIds)
      .map(id => editor.getShape(id))
      .filter(Boolean) as TLShape[]
    
    // Filter out the group shape itself - we only want child shapes for bounds calculation
    const childShapes = groupShapes.filter(shape => shape.id !== group.id)
    
    console.log('Child shapes for bounds calculation:', childShapes.map(s => ({
      id: s.id,
      type: s.type,
      x: s.x,
      y: s.y,
      hasW: 'w' in s.props,
      hasH: 'h' in s.props
    })))
    
    // Calculate group bounds using top-left corner as reference
    const groupBounds = this.calculateGroupBoundsFromShapes(childShapes)
    const groupTopLeft = {
      x: groupBounds.minX,
      y: groupBounds.minY
    }
    
    console.log('Group bounds vs group position:', {
      groupPosition: { x: group.x, y: group.y, rotation: group.rotation },
      calculatedBounds: groupBounds,
      calculatedTopLeft: groupTopLeft,
      boundsMatchesPosition: {
        x: Math.abs(group.x - groupBounds.minX) < 1,
        y: Math.abs(group.y - groupBounds.minY) < 1
      }
    })
    
    console.log('Processing group modifiers:', {
      groupId: group.id,
      allGroupShapes: groupShapes.length,
      childShapes: childShapes.length,
      groupBounds,
      groupTopLeft,
      groupTransform: {
        x: group.x,
        y: group.y,
        rotation: group.rotation
      }
    })
    
    // Create initial state with child shapes in the group, not just the selected one
    const allInstances: ShapeInstance[] = childShapes.map((groupShape, index) => {
      console.log(`Group shape ${index}:`, {
        id: groupShape.id,
        type: groupShape.type,
        props: groupShape.props,
        x: groupShape.x,
        y: groupShape.y,
        hasW: 'w' in groupShape.props,
        hasH: 'h' in groupShape.props,
        w: 'w' in groupShape.props ? groupShape.props.w : 'N/A',
        h: 'h' in groupShape.props ? groupShape.props.h : 'N/A'
      })
      
      const transform: Transform = {
        x: groupShape.x,
        y: groupShape.y,
        rotation: groupShape.rotation || 0,
        scaleX: 1,
        scaleY: 1
      }
      
      return {
        shape: groupShape,
        transform,
        index,
        metadata: { 
          isOriginal: true,
          isGroupMember: true,
          groupId: group.id
        }
      }
    })
    
    let currentState: ShapeState = {
      originalShape: shape, // Keep the selected shape as original for compatibility
      instances: allInstances,
      metadata: { isGroupModifier: true, groupId: group.id }
    }
    
    // Filter to only enabled modifiers, sorted by order
    const enabledModifiers = modifiers
      .filter(modifier => modifier.enabled)
      .sort((a, b) => a.order - b.order)
    
    // Process each modifier in sequence with group context
    for (const modifier of enabledModifiers) {
      const processor = ModifierStack.getProcessor(modifier.type)
      if (processor) {
        const previousInstanceCount = currentState.instances.length
        const groupContext = { 
          groupCenter: { x: groupBounds.centerX, y: groupBounds.centerY }, // Keep for compatibility
          groupTopLeft, // Add top-left reference
          groupShapes: childShapes, // Use child shapes instead of all group shapes
          groupBounds,
          groupTransform: { // Add current group transform
            x: group.x,
            y: group.y,
            rotation: group.rotation || 0
          }
        }
        console.log('processGroupModifiers: Calling processor with groupContext:', groupContext)
        currentState = processor.process(currentState, modifier.props, groupContext)
        const newInstanceCount = currentState.instances.length
        
        console.log(`Group modifier ${modifier.type}: ${previousInstanceCount} → ${newInstanceCount} instances`)
      }
    }
    
    return currentState
  }
  
  // Calculate group bounds from TLShape array
  private static calculateGroupBoundsFromShapes(shapes: TLShape[]) {
    if (shapes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 }
    
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    
    shapes.forEach(shape => {
      const bounds = this.getShapeBounds(shape)
      minX = Math.min(minX, bounds.minX)
      maxX = Math.max(maxX, bounds.maxX)
      minY = Math.min(minY, bounds.minY)
      maxY = Math.max(maxY, bounds.maxY)
    })
    
    const width = maxX - minX
    const height = maxY - minY
    const centerX = minX + width / 2
    const centerY = minY + height / 2
    
    return { minX, maxX, minY, maxY, width, height, centerX, centerY }
  }
  
  private static getShapeBounds(shape: TLShape) {
    console.log('getShapeBounds called for shape:', {
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      props: shape.props
    })
    
    if ('w' in shape.props && 'h' in shape.props) {
      const w = shape.props.w as number
      const h = shape.props.h as number
      const bounds = {
        minX: shape.x,
        maxX: shape.x + w,
        minY: shape.y,
        maxY: shape.y + h
      }
      console.log('Shape has w/h props, bounds:', bounds)
      return bounds
    }
    
    // Try to get bounds from other shape properties
    if (shape.type === 'group') {
      // For groups, we need to calculate bounds from child shapes
      // This is a fallback - ideally we'd have the child shapes here
      console.log('Shape is a group, using fallback bounds - this might be causing positioning issues!')
      console.log('Group shape position:', { x: shape.x, y: shape.y })
      return {
        minX: shape.x,
        maxX: shape.x + 200, // Larger fallback for groups
        minY: shape.y,
        maxY: shape.y + 200
      }
    }
    
    // For other shape types, try to estimate bounds
    let estimatedWidth = 100
    let estimatedHeight = 100
    
    if (shape.type === 'text' && 'fontSize' in shape.props) {
      // Estimate text bounds based on font size
      const fontSize = shape.props.fontSize as number
      estimatedWidth = fontSize * 10 // Rough estimate
      estimatedHeight = fontSize * 1.2
    } else if (shape.type === 'draw' && 'segments' in shape.props) {
      // For draw shapes, estimate based on segments
      const segments = shape.props.segments as Array<{ points?: Array<{ x: number; y: number }> }>
      if (segments && segments.length > 0) {
        // Calculate bounds from segment points
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
        segments.forEach(segment => {
          if (segment.points) {
            segment.points.forEach((point: { x: number; y: number }) => {
              minX = Math.min(minX, point.x)
              maxX = Math.max(maxX, point.x)
              minY = Math.min(minY, point.y)
              maxY = Math.max(maxY, point.y)
            })
          }
        })
        if (minX !== Infinity) {
          estimatedWidth = maxX - minX
          estimatedHeight = maxY - minY
        }
      }
    }
    
    const bounds = {
      minX: shape.x,
      maxX: shape.x + estimatedWidth,
      minY: shape.y,
      maxY: shape.y + estimatedHeight
    }
    
    console.log('Using estimated bounds for shape type:', shape.type, bounds)
    return bounds
  }

  private static getProcessor(modifierType: string): ModifierProcessor | null {
    switch (modifierType) {
      case 'linear-array':
        return LinearArrayProcessor
      case 'circular-array':
        return CircularArrayProcessor
      case 'grid-array':
        return GridArrayProcessor
      case 'mirror':
        return MirrorProcessor
      default:
        console.warn(`No processor found for modifier type: ${modifierType}`)
        return null
    }
  }
  

}

function processGroupArray(
  input: ShapeState, 
  settings: LinearArraySettings, 
  groupContext: GroupContext
): ShapeState {
  const { count, offsetX, offsetY, rotation, scaleStep } = settings
  const { groupTopLeft, groupBounds, groupShapes, groupTransform } = groupContext
  
  console.log('processGroupArray called with:', {
    count,
    offsetX,
    offsetY,
    rotation,
    scaleStep,
    groupTopLeft,
    groupBounds,
    groupShapesCount: groupShapes.length
  })
  
  console.log('Group bounds details:', {
    minX: groupBounds.minX,
    maxX: groupBounds.maxX,
    minY: groupBounds.minY,
    maxY: groupBounds.maxY,
    width: groupBounds.width,
    height: groupBounds.height,
    centerX: groupBounds.centerX,
    centerY: groupBounds.centerY
  })
  
  // Start with empty instances (we'll generate new ones)
  const newInstances: ShapeInstance[] = []
  
  // Use group dimensions for percentage-based offsets
  const pixelOffsetX = (offsetX / 100) * groupBounds.width
  const pixelOffsetY = (offsetY / 100) * groupBounds.height
  
  console.log('Group-based offsets:', {
    pixelOffsetX,
    pixelOffsetY,
    groupWidth: groupBounds.width,
    groupHeight: groupBounds.height
  })
  
  // For each existing instance (which represents a shape in the group), create the array
  input.instances.forEach(inputInstance => {
    console.log('Processing instance for array:', {
      shapeId: inputInstance.shape.id,
      shapeType: inputInstance.shape.type,
      originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y },
      groupTopLeft: { x: groupTopLeft.x, y: groupTopLeft.y }
    })
    
    for (let i = 1; i < count; i++) { // Start from i=1, skip the original (i=0)
      
      // Calculate rotation in radians for this clone
      const rotationRadians = (rotation * (i - 1) * Math.PI / 180) // Use (i-1) so first clone has no rotation
      
      // Calculate the offset from the group's top-left corner
      const offsetFromTopLeftX = pixelOffsetX * (i - 1) // Use (i-1) so first clone has no offset
      const offsetFromTopLeftY = pixelOffsetY * (i - 1)
      
      // Apply rotation to the offset around the group's top-left corner
      const cos = Math.cos(rotationRadians)
      const sin = Math.sin(rotationRadians)
      const rotatedOffsetX = offsetFromTopLeftX * cos - offsetFromTopLeftY * sin
      const rotatedOffsetY = offsetFromTopLeftX * sin + offsetFromTopLeftY * cos
      
      // Calculate the group's new top-left position
      const newGroupTopLeftX = groupTopLeft.x + rotatedOffsetX
      const newGroupTopLeftY = groupTopLeft.y + rotatedOffsetY
      
      // Calculate the relative position of this shape within the group (from top-left)
      let shapeRelativeX = inputInstance.transform.x - groupTopLeft.x
      let shapeRelativeY = inputInstance.transform.y - groupTopLeft.y
      
      // Calculate scale using linear interpolation from original (1.0) to final scale
      const progress = (i - 1) / (count - 1) // Use (i-1) so first clone has scale 1
      const interpolatedScale = 1 + (scaleStep - 1) * progress
      
      // SCALE the relative vector BEFORE rotation
      shapeRelativeX *= interpolatedScale
      shapeRelativeY *= interpolatedScale
      
      // Now rotate the scaled relative vector
      const rotatedRelativeX = shapeRelativeX * cos - shapeRelativeY * sin
      const rotatedRelativeY = shapeRelativeX * sin + shapeRelativeY * cos
      
      // Calculate the final position of this shape in the cloned group
      let finalX = newGroupTopLeftX + rotatedRelativeX
      let finalY = newGroupTopLeftY + rotatedRelativeY
      let finalRotation = inputInstance.transform.rotation + rotationRadians
      const finalScale = interpolatedScale
      
      // Apply the group's current transform to make clones move with the group
      if (groupTransform) {
        // Calculate the source group's center
        const sourceGroupCenterX = groupTransform.x + (groupBounds.width / 2)
        const sourceGroupCenterY = groupTransform.y + (groupBounds.height / 2)
        
        // Calculate the clone's offset from the source group center
        const cloneOffsetX = finalX - groupTopLeft.x
        const cloneOffsetY = finalY - groupTopLeft.y
        
        // Apply group rotation to the clone offset around the source group center
        if (groupTransform.rotation !== 0) {
          const cos = Math.cos(groupTransform.rotation)
          const sin = Math.sin(groupTransform.rotation)
          const rotatedOffsetX = cloneOffsetX * cos - cloneOffsetY * sin
          const rotatedOffsetY = cloneOffsetX * sin + cloneOffsetY * cos
          
          finalX = sourceGroupCenterX + rotatedOffsetX - (groupBounds.width / 2)
          finalY = sourceGroupCenterY + rotatedOffsetY - (groupBounds.height / 2)
        } else {
          // No rotation, just apply position offset
          finalX = groupTransform.x + cloneOffsetX
          finalY = groupTransform.y + cloneOffsetY
        }
        
        finalRotation += groupTransform.rotation
        
        console.log(`Applied group transform to clone ${i}:`, {
          sourceGroupCenter: { x: sourceGroupCenterX, y: sourceGroupCenterY },
          cloneOffset: { x: cloneOffsetX, y: cloneOffsetY },
          groupRotation: groupTransform.rotation,
          finalPosition: { x: finalX, y: finalY }
        })
      }
      
      console.log(`Clone ${i} calculations:`, {
        rotationRadians,
        offsetFromTopLeft: { x: offsetFromTopLeftX, y: offsetFromTopLeftY },
        rotatedOffset: { x: rotatedOffsetX, y: rotatedOffsetY },
        newGroupTopLeft: { x: newGroupTopLeftX, y: newGroupTopLeftY },
        shapeRelative: { x: shapeRelativeX, y: shapeRelativeY },
        rotatedRelative: { x: rotatedRelativeX, y: rotatedRelativeY },
        finalPosition: { x: finalX, y: finalY },
        finalScale
      })
      
      // Compose the transform
      const newTransform: Transform = {
        x: finalX,
        y: finalY,
        rotation: finalRotation,
        scaleX: inputInstance.transform.scaleX * finalScale,
        scaleY: inputInstance.transform.scaleY * finalScale
      }
      
      const newInstance: ShapeInstance = {
        shape: { ...inputInstance.shape },
        transform: newTransform,
        index: newInstances.length,
        metadata: {
          ...inputInstance.metadata,
          arrayIndex: i,
          sourceInstance: inputInstance.index,
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

// Linear Array Processor implementation
const LinearArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: LinearArraySettings, groupContext?: GroupContext): ShapeState {
    console.log('LinearArrayProcessor.process called with settings:', settings)
    console.log('LinearArrayProcessor groupContext:', groupContext)
    const { count, offsetX, offsetY, rotation, scaleStep } = settings
    
    // If processing in group context, use group dimensions
    if (groupContext) {
      console.log('LinearArrayProcessor: Using group processing path')
      return processGroupArray(input, settings, groupContext)
    }
    
    console.log('LinearArrayProcessor: Using regular processing path')
    
    // Start with empty instances (we'll generate new ones)
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the array
    input.instances.forEach(inputInstance => {
      // Add the original instance first
      newInstances.push(inputInstance)
      
      // Get shape dimensions for center calculations
      const shapeWidth = 'w' in inputInstance.shape.props ? (inputInstance.shape.props.w as number) : 100
      const shapeHeight = 'h' in inputInstance.shape.props ? (inputInstance.shape.props.h as number) : 100
      
      // Calculate the center of the original shape
      const originalCenterX = inputInstance.transform.x + shapeWidth / 2
      const originalCenterY = inputInstance.transform.y + shapeHeight / 2
      
      console.log('LinearArrayProcessor: Center-based rotation calculation:', {
        originalCenter: { x: originalCenterX, y: originalCenterY },
        shapeDimensions: { width: shapeWidth, height: shapeHeight },
        originalPosition: { x: inputInstance.transform.x, y: inputInstance.transform.y }
      })
      
      // Create array copies
      for (let i = 1; i < count; i++) {
        // Convert percentage offsets to pixel values based on shape width
        const pixelOffsetX = (offsetX / 100) * shapeWidth
        const pixelOffsetY = (offsetY / 100) * shapeHeight
        
        // Calculate rotation in radians for this clone
        const rotationRadians = (rotation * i * Math.PI / 180)
        
        // Calculate the offset from the original center
        const offsetFromCenterX = pixelOffsetX * i
        const offsetFromCenterY = pixelOffsetY * i
        
        // Apply rotation to the offset around the center
        const cos = Math.cos(rotationRadians)
        const sin = Math.sin(rotationRadians)
        
        const rotatedOffsetX = offsetFromCenterX * cos - offsetFromCenterY * sin
        const rotatedOffsetY = offsetFromCenterX * sin + offsetFromCenterY * cos
        
        // Calculate the final center position after rotation
        const finalCenterX = originalCenterX + rotatedOffsetX
        const finalCenterY = originalCenterY + rotatedOffsetY
        
        // IMPORTANT: Compensate for tldraw's rotation behavior
        // tldraw rotates around the top-left corner, so we need to adjust the position
        // to make it appear as if it's rotating around the center
        
        // Calculate how much the center moves when rotating around top-left
        const centerOffsetX = (shapeWidth / 2) * (cos - 1) - (shapeHeight / 2) * sin
        const centerOffsetY = (shapeWidth / 2) * sin + (shapeHeight / 2) * (cos - 1)
        
        // Adjust the final position to compensate for tldraw's rotation behavior
        const finalX = finalCenterX - shapeWidth / 2 - centerOffsetX
        const finalY = finalCenterY - shapeHeight / 2 - centerOffsetY
        
        console.log(`LinearArrayProcessor: Clone ${i} calculation:`, {
          rotationDegrees: rotation * i,
          rotationRadians,
          offsetFromCenter: { x: offsetFromCenterX, y: offsetFromCenterY },
          rotatedOffset: { x: rotatedOffsetX, y: rotatedOffsetY },
          finalCenter: { x: finalCenterX, y: finalCenterY },
          centerOffset: { x: centerOffsetX, y: centerOffsetY },
          finalPosition: { x: finalX, y: finalY }
        })
        
        // Calculate scale using linear interpolation from original (1.0) to final scale
        const progress = i / (count - 1) // 0 for first clone, 1 for last clone
        const interpolatedScale = 1 + (scaleStep - 1) * progress
        
        const newTransform: Transform = {
          x: finalX,
          y: finalY,
          rotation: inputInstance.transform.rotation + rotationRadians,
          scaleX: inputInstance.transform.scaleX * interpolatedScale,
          scaleY: inputInstance.transform.scaleY * interpolatedScale
        }
        
        const newInstance: ShapeInstance = {
          shape: { ...inputInstance.shape },
          transform: newTransform,
          index: newInstances.length,
          metadata: {
            ...inputInstance.metadata,
            arrayIndex: i,
            sourceInstance: inputInstance.index
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

// Circular Array Processor implementation
const CircularArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: CircularArraySettings): ShapeState {
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, pointToCenter } = settings
    
    const newInstances: ShapeInstance[] = []
    
          // For each existing instance, create the circular array
      input.instances.forEach(inputInstance => {
        // Get shape dimensions to calculate offset
        const shapeWidth = 'w' in inputInstance.shape.props ? (inputInstance.shape.props.w as number) : 100
        const shapeHeight = 'h' in inputInstance.shape.props ? (inputInstance.shape.props.h as number) : 100
        
        // Calculate the offset needed to move the array center so the original shape becomes the first position
        const firstAngle = startAngle * Math.PI / 180
        let offsetX = Math.cos(firstAngle) * radius
        let offsetY = Math.sin(firstAngle) * radius
        
        // If pointToCenter is enabled, we need to adjust the offset to account for the rotation
        if (pointToCenter) {
          // When pointing to center, the shape rotates to face the center
          // We need to adjust the offset so the original shape aligns exactly with the first clone position
          const angleFromCenter = Math.atan2(offsetY, offsetX)
          // Calculate the offset needed to compensate for the rotation effect
          // The shape will rotate to point toward center, so we need to offset in the opposite direction
          const additionalOffsetX = Math.cos(angleFromCenter + Math.PI)   - shapeWidth 
          const additionalOffsetY = Math.sin(angleFromCenter + Math.PI) - shapeHeight
          offsetX += additionalOffsetX
          offsetY += additionalOffsetY
        }
        
        // Calculate center point relative to the instance, offset so original becomes first position
        const centerPointX = inputInstance.transform.x + (centerX || 0) - offsetX
        const centerPointY = inputInstance.transform.y + (centerY || 0) - offsetY
      
      const totalAngle = endAngle - startAngle
      const angleStep = totalAngle / (count - 1)
      
      // Create circular array copies (including the original at the first position)
      for (let i = 0; i < count; i++) {
        const angle = (startAngle + (angleStep * i)) * Math.PI / 180
        
        // For the first instance (i=0), position it at the start angle in the circle
        if (i === 0) {
          const x = centerPointX + Math.cos(angle) * radius
          const y = centerPointY + Math.sin(angle) * radius
          
          // Calculate base rotation for pointing away from center
          let baseRotation = 0
          if (pointToCenter) {
            // Calculate the angle from center to this position, then add 180° to point away
            const angleFromCenter = Math.atan2(y - centerPointY, x - centerPointX)
            baseRotation = angleFromCenter + Math.PI // Add 180° (π radians) to point away
          }
          
          // Calculate additional rotations: rotateAll applies to all, rotateEach applies per clone
          const rotateAllRadians = (rotateAll || 0) * Math.PI / 180
          const rotateEachRadians = (rotateEach || 0) * i * Math.PI / 180
          const totalRotationRadians = baseRotation + rotateAllRadians + rotateEachRadians
          const finalRotation = inputInstance.transform.rotation + totalRotationRadians
          
          const newTransform: Transform = {
            x: x,
            y: y,
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
              arrayIndex: i,
              sourceInstance: inputInstance.index,
              isFirstClone: true // Mark this as the first clone to hide it
            }
          }
          
          newInstances.push(newInstance)
          continue
        }
        
        // For other instances, calculate circular positions
        const x = centerPointX + Math.cos(angle) * radius
        const y = centerPointY + Math.sin(angle) * radius
        
        // Calculate base rotation for pointing away from center
        let baseRotation = 0
        if (pointToCenter) {
          // Calculate the angle from center to this position, then add 180° to point away
          const angleFromCenter = Math.atan2(y - centerPointY, x - centerPointX)
          baseRotation = angleFromCenter + Math.PI // Add 180° (π radians) to point away
        }
        
        // Calculate additional rotations: rotateAll applies to all, rotateEach applies per clone
        const rotateAllRadians = (rotateAll || 0) * Math.PI / 180
        const rotateEachRadians = (rotateEach || 0) * i * Math.PI / 180
        const totalRotationRadians = baseRotation + rotateAllRadians + rotateEachRadians
        const finalRotation = inputInstance.transform.rotation + totalRotationRadians
        
        const newTransform: Transform = {
          x: x,
          y: y,
          rotation: finalRotation, // Apply all rotations
          scaleX: inputInstance.transform.scaleX,
          scaleY: inputInstance.transform.scaleY
        }
        
        const newInstance: ShapeInstance = {
          shape: { ...inputInstance.shape },
          transform: newTransform,
          index: newInstances.length,
          metadata: {
            ...inputInstance.metadata,
            arrayIndex: i,
            sourceInstance: inputInstance.index
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

// Grid Array Processor implementation
const GridArrayProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: GridArraySettings): ShapeState {
    const { rows, columns, spacingX, spacingY, offsetX, offsetY } = settings
    
    const newInstances: ShapeInstance[] = []
    
    // For each existing instance, create the grid array
    input.instances.forEach(inputInstance => {
      // Create grid positions
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          // Skip the original position (0,0) - we'll add it first
          if (row === 0 && col === 0) {
            newInstances.push(inputInstance)
            continue
          }
          
          const newTransform: Transform = {
            x: inputInstance.transform.x + (offsetX || 0) + (col * spacingX),
            y: inputInstance.transform.y + (offsetY || 0) + (row * spacingY),
            rotation: inputInstance.transform.rotation,
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
              gridPosition: { row, col }
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

// Mirror Processor implementation
const MirrorProcessor: ModifierProcessor = {
  process(input: ShapeState, settings: MirrorSettings): ShapeState {
    const { axis, offset, mergeThreshold } = settings
    
    const newInstances: ShapeInstance[] = []
    
    // Add all original instances first
    newInstances.push(...input.instances)
    
    // Group instances by their source modifier to handle arrays as units
    const instanceGroups = new Map<string, ShapeInstance[]>()
    
    input.instances.forEach(instance => {
      // Group instances that were created by the same modifier operation
      const groupKey = instance.metadata?.sourceInstance !== undefined 
        ? `modifier-${instance.metadata.sourceInstance}` 
        : 'original'
      
      if (!instanceGroups.has(groupKey)) {
        instanceGroups.set(groupKey, [])
      }
      instanceGroups.get(groupKey)!.push(instance)
    })
    
    console.log(`🪞 Mirror processor: Found ${instanceGroups.size} groups to mirror:`, 
      Array.from(instanceGroups.keys()).map(key => 
        `${key} (${instanceGroups.get(key)?.length} instances)`
      )
    )
    
    // Process each group as a unit
    instanceGroups.forEach((groupInstances, groupKey) => {
      // Calculate the bounding box of the entire group
      const groupBounds = calculateGroupBounds(groupInstances)
      
      console.log(`🪞 Mirroring group "${groupKey}":`, {
        instances: groupInstances.length,
        bounds: groupBounds,
        axis,
        offset
      })
      
      // Mirror each instance in the group relative to the group's center
      groupInstances.forEach(inputInstance => {
        console.log(`🪞 Processing instance for mirroring:`, {
          inputRotation: inputInstance.transform.rotation,
          inputRotationDegrees: (inputInstance.transform.rotation * 180 / Math.PI).toFixed(1) + '°',
          axis,
          position: { x: inputInstance.transform.x, y: inputInstance.transform.y }
        })
        
        let mirroredTransform: Transform
        
        switch (axis) {
          case 'x': { // Horizontal mirror (flip across vertical axis)
            const groupCenterX = groupBounds.centerX
            const mirrorLineX = groupCenterX + offset
            const distanceFromCenter = inputInstance.transform.x - groupCenterX
            const mirroredX = mirrorLineX - distanceFromCenter
            
            mirroredTransform = {
              x: mirroredX,
              y: inputInstance.transform.y,
              rotation: Math.PI - inputInstance.transform.rotation, // Flip rotation for horizontal mirror
              scaleX: -inputInstance.transform.scaleX, // Flip horizontally
              scaleY: inputInstance.transform.scaleY
            }
            break
          }
            
          case 'y': { // Vertical mirror (flip across horizontal axis)
            const groupCenterY = groupBounds.centerY
            const mirrorLineY = groupCenterY + offset
            const distanceFromCenterY = inputInstance.transform.y - groupCenterY
            const mirroredY = mirrorLineY - distanceFromCenterY
            
            mirroredTransform = {
              x: inputInstance.transform.x,
              y: mirroredY,
              rotation: -inputInstance.transform.rotation, // Flip rotation for vertical mirror
              scaleX: inputInstance.transform.scaleX,
              scaleY: -inputInstance.transform.scaleY // Flip vertically
            }
            break
          }
            
          case 'diagonal': { // Diagonal mirror (swap X/Y and flip both)
            const groupCenterDiag = { x: groupBounds.centerX, y: groupBounds.centerY }
            mirroredTransform = {
              x: groupCenterDiag.y + (inputInstance.transform.y - groupCenterDiag.y) + offset,
              y: groupCenterDiag.x + (inputInstance.transform.x - groupCenterDiag.x) + offset,
              rotation: Math.PI/2 - inputInstance.transform.rotation, // Adjust rotation for diagonal flip
              scaleX: -inputInstance.transform.scaleY,
              scaleY: -inputInstance.transform.scaleX
            }
            break
          }
            
          default: { // Default to horizontal mirror
            const defGroupCenterX = groupBounds.centerX
            const defMirrorLineX = defGroupCenterX + offset
            const defDistanceFromCenter = inputInstance.transform.x - defGroupCenterX
            const defMirroredX = defMirrorLineX - defDistanceFromCenter
            
            mirroredTransform = {
              x: defMirroredX,
              y: inputInstance.transform.y,
              rotation: Math.PI - inputInstance.transform.rotation, // Flip rotation for horizontal mirror
              scaleX: -inputInstance.transform.scaleX,
              scaleY: inputInstance.transform.scaleY
            }
          }
        }
        
        // Check if mirrored position is too close to any existing instance (merge threshold)
        const shouldMerge = mergeThreshold > 0 && newInstances.some(existing => {
          const dx = existing.transform.x - mirroredTransform.x
          const dy = existing.transform.y - mirroredTransform.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          return distance < mergeThreshold
        })
        
        console.log(`🪞 Calculated mirrored transform:`, {
          inputRotation: inputInstance.transform.rotation,
          outputRotation: mirroredTransform.rotation,
          inputRotationDegrees: (inputInstance.transform.rotation * 180 / Math.PI).toFixed(1) + '°',
          outputRotationDegrees: (mirroredTransform.rotation * 180 / Math.PI).toFixed(1) + '°',
          axis,
          shouldMerge
        })
        
        if (!shouldMerge) {
          const mirroredInstance: ShapeInstance = {
            shape: { ...inputInstance.shape },
            transform: mirroredTransform,
            index: newInstances.length,
            metadata: {
              ...inputInstance.metadata,
              mirrorAxis: axis,
              sourceInstance: inputInstance.index,
              isMirrored: true,
              originalGroup: groupKey, // Track which group this came from
              mirrorOfGroup: true // Mark as a group mirror operation
            }
          }
          
          newInstances.push(mirroredInstance)
        }
      })
    })
    
    // After processing all groups, reverse the order of mirrored instances within each group
    // to match the expected mirror behavior (first becomes last, etc.)
    const originalInstanceCount = input.instances.length
    const mirroredInstances = newInstances.slice(originalInstanceCount)
    
    // Group mirrored instances by their original group
    const mirroredGroups = new Map<string, ShapeInstance[]>()
    mirroredInstances.forEach(instance => {
      const groupKey = (instance.metadata?.originalGroup as string) || 'unknown'
      if (!mirroredGroups.has(groupKey)) {
        mirroredGroups.set(groupKey, [])
      }
      mirroredGroups.get(groupKey)!.push(instance)
    })
    
    // Reverse the order within each mirrored group
    mirroredGroups.forEach((instances, groupKey) => {
      instances.reverse()
      console.log(`🪞 Reversed order for mirrored group "${groupKey}": ${instances.length} instances`)
    })
    
    // Rebuild the final instances array with original + reversed mirrored groups
    const finalInstances = [
      ...input.instances, // Original instances first
      ...Array.from(mirroredGroups.values()).flat() // Then reversed mirrored instances
    ]
    
    return {
      ...input,
      instances: finalInstances
    }
  }
}

// Helper function to calculate the bounding box of a group of instances
function calculateGroupBounds(instances: ShapeInstance[]): {
  minX: number, maxX: number, minY: number, maxY: number, 
  centerX: number, centerY: number, width: number, height: number
} {
  if (instances.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerY: 0, width: 0, height: 0 }
  }
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  
  instances.forEach(instance => {
    // Estimate shape bounds (this could be improved with actual shape geometry)
    const shapeWidth = 'w' in instance.shape.props ? (instance.shape.props.w as number) : 100
    const shapeHeight = 'h' in instance.shape.props ? (instance.shape.props.h as number) : 100
    
    const left = instance.transform.x
    const right = instance.transform.x + shapeWidth
    const top = instance.transform.y
    const bottom = instance.transform.y + shapeHeight
    
    minX = Math.min(minX, left)
    maxX = Math.max(maxX, right)
    minY = Math.min(minY, top)
    maxY = Math.max(maxY, bottom)
  })
  
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const width = maxX - minX
  const height = maxY - minY
  
  return { minX, maxX, minY, maxY, centerX, centerY, width, height }
} 