import { useMemo, useEffect } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId } from 'tldraw'
import { 
  type LinearArraySettings,
  type CircularArraySettings,
  type GridArraySettings
} from '../../types/modifiers'

interface LinearArrayModifierProps {
  shape: TLShape
  settings: LinearArraySettings
  enabled: boolean
}

interface CircularArrayModifierProps {
  shape: TLShape
  settings: CircularArraySettings
  enabled: boolean
}

interface GridArrayModifierProps {
  shape: TLShape
  settings: GridArraySettings
  enabled: boolean
}

type ArrayModifierProps = LinearArrayModifierProps | CircularArrayModifierProps | GridArrayModifierProps

interface ArrayPosition {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  index: number
}

// Calculate array positions based on settings
function calculateArrayPositions(
  originalShape: TLShape,
  settings: LinearArraySettings
): ArrayPosition[] {
  const positions: ArrayPosition[] = []
  
  // Get shape dimensions for center calculations
  let shapeWidth = 100  // default fallback
  let shapeHeight = 100 // default fallback
  
  if ('w' in originalShape.props && 'h' in originalShape.props) {
    shapeWidth = originalShape.props.w as number
    shapeHeight = originalShape.props.h as number
  }
  
  for (let i = 1; i < settings.count; i++) {
    // Calculate position relative to original shape
    const offsetX = settings.offsetX * i
    const offsetY = settings.offsetY * i
    
    // Apply spacing as a multiplier to the offset
    const spacedOffsetX = offsetX * settings.spacing
    const spacedOffsetY = offsetY * settings.spacing
    
    // Calculate the final position (top-left of the shape)
    const finalX = originalShape.x + spacedOffsetX
    const finalY = originalShape.y + spacedOffsetY
    
    // Calculate rotation in radians for this clone
    const rotationRadians = settings.rotation * i * Math.PI / 180
    
    // Calculate scale with step
    const scaleX = Math.pow(settings.scaleStep, i)
    const scaleY = Math.pow(settings.scaleStep, i)
    
    // Debug logging to verify calculations
    console.log(`Array clone ${i}:`, {
      rotationDegrees: settings.rotation * i,
      rotationRadians: rotationRadians,
      finalPosition: { x: finalX, y: finalY },
      originalPos: { x: originalShape.x, y: originalShape.y },
      offset: { x: offsetX, y: offsetY },
      spacedOffset: { x: spacedOffsetX, y: spacedOffsetY },
      scale: { x: scaleX, y: scaleY },
      spacing: settings.spacing,
      scaleStep: settings.scaleStep,
      shapeDimensions: { w: shapeWidth, h: shapeHeight }
    })
    
    positions.push({
      x: finalX,
      y: finalY,
      rotation: rotationRadians,
      scaleX,
      scaleY,
      index: i
    })
  }
  
  return positions
}

// Calculate circular array positions based on settings
function calculateCircularArrayPositions(
  originalShape: TLShape,
  settings: CircularArraySettings
): ArrayPosition[] {
  const positions: ArrayPosition[] = []
  const centerX = originalShape.x + (settings.centerX || 0)
  const centerY = originalShape.y + (settings.centerY || 0)
  
  const totalAngle = settings.endAngle - settings.startAngle
  const angleStep = totalAngle / (settings.count - 1)
  
  for (let i = 1; i < settings.count; i++) {
    const angle = (settings.startAngle + (angleStep * (i - 1))) * Math.PI / 180
    
    const x = centerX + Math.cos(angle) * settings.radius
    const y = centerY + Math.sin(angle) * settings.radius
    
    positions.push({
      x,
      y,
      rotation: 0, // No rotation for circular arrays by default
      scaleX: 1,
      scaleY: 1,
      index: i
    })
  }
  
  return positions
}

// Calculate grid array positions based on settings
function calculateGridArrayPositions(
  originalShape: TLShape,
  settings: GridArraySettings
): ArrayPosition[] {
  const positions: ArrayPosition[] = []
  let index = 1
  
  for (let row = 0; row < settings.rows; row++) {
    for (let col = 0; col < settings.columns; col++) {
      // Skip the original position (0,0)
      if (row === 0 && col === 0) continue
      
      const x = originalShape.x + (settings.offsetX || 0) + (col * settings.spacingX)
      const y = originalShape.y + (settings.offsetY || 0) + (row * settings.spacingY)
      
      positions.push({
        x,
        y,
        rotation: 0, // No rotation for grid arrays by default
        scaleX: 1,
        scaleY: 1,
        index: index++
      })
    }
  }
  
  return positions
}

// Generate a unique ID for array clone shapes
function generateArrayCloneId(originalId: string, index: number): any {
  return createShapeId()
}

// Check if a shape is an array clone
function isArrayClone(shape: TLShape): boolean {
  return !!(shape.meta?.isArrayClone)
}

// Extract original shape ID from array clone metadata
function getOriginalShapeId(shape: TLShape): string | null {
  const originalId = shape.meta?.originalShapeId
  return typeof originalId === 'string' ? originalId : null
}

// Create native tldraw shape clones
function createNativeShapeClones(
  editor: any,
  originalShape: TLShape,
  positions: ArrayPosition[]
): TLShapePartial[] {
  return positions.map((position, index) => {
    const cloneId = generateArrayCloneId(originalShape.id, position.index)
    
    // Calculate final rotation by adding original shape rotation to array rotation
    const finalRotation = (originalShape.rotation || 0) + position.rotation
    
    // Get original dimensions
    let originalWidth = 100
    let originalHeight = 100
    if ('w' in originalShape.props && 'h' in originalShape.props) {
      originalWidth = originalShape.props.w as number
      originalHeight = originalShape.props.h as number
    }
    
    // Calculate scaled dimensions
    const scaledWidth = originalWidth * position.scaleX
    const scaledHeight = originalHeight * position.scaleY
    
    // Debug logging for both positioning and scaling
    console.log(`Creating clone ${position.index}:`, {
      originalRotation: originalShape.rotation || 0,
      arrayRotation: position.rotation,
      finalRotation: finalRotation,
      finalRotationDegrees: (finalRotation * 180 / Math.PI).toFixed(1) + '°',
      position: { x: position.x, y: position.y },
      originalDimensions: { w: originalWidth, h: originalHeight },
      scaledDimensions: { w: scaledWidth, h: scaledHeight },
      scaleFactors: { x: position.scaleX, y: position.scaleY }
    })
    
    // Create the clone shape with all original properties
    const cloneShape: TLShapePartial = {
      id: cloneId,
      type: originalShape.type,
      x: position.x,
      y: position.y,
      rotation: finalRotation, // Use radians directly
      isLocked: true, // Make array clones non-interactive
      opacity: (originalShape.opacity || 1) * 0.8, // Slightly more transparent
      props: {
        ...originalShape.props
      },
      meta: {
        ...originalShape.meta,
        isArrayClone: true,
        originalShapeId: originalShape.id,
        arrayIndex: position.index
      }
    }

    // Handle scaling for different shape types
    if ('w' in originalShape.props && 'h' in originalShape.props) {
      cloneShape.props = {
        ...cloneShape.props,
        w: scaledWidth,
        h: scaledHeight
      }
      
      console.log(`Applied scaling to clone ${position.index}: ${originalWidth}x${originalHeight} -> ${scaledWidth}x${scaledHeight}`)
    }

    return cloneShape
  })
}

// Main Linear Array Modifier Component
export function LinearArrayModifier({ 
  shape, 
  settings, 
  enabled 
}: LinearArrayModifierProps) {
  const editor = useEditor()
  
  // Calculate all array positions
  const arrayPositions = useMemo(() => {
    if (!enabled || settings.count <= 1) return []
    return calculateArrayPositions(shape, settings)
  }, [shape, settings, enabled])

  // Create and manage native shape clones
  useEffect(() => {
    if (!editor) return

    // Clean up existing clones for this shape
    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id
    })

    // Delete existing clones
    if (existingClones.length > 0) {
      editor.run(() => {
        editor.deleteShapes(existingClones.map((s: TLShape) => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }

    // Create new clones if enabled and count > 1
    if (enabled && settings.count > 1 && arrayPositions.length > 0) {
      const cloneShapes = createNativeShapeClones(editor, shape, arrayPositions)
      
      editor.run(() => {
        editor.createShapes(cloneShapes)
      }, { history: 'ignore' })
    }

    // Cleanup function
    return () => {
      if (!editor) return
      
      const clonesToCleanup = editor.getCurrentPageShapes().filter((s: TLShape) => {
        const originalId = getOriginalShapeId(s)
        return originalId === shape.id
      })

      if (clonesToCleanup.length > 0) {
        editor.run(() => {
          editor.deleteShapes(clonesToCleanup.map((s: TLShape) => s.id))
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
    }
  }, [editor, shape, arrayPositions, enabled, settings.count])

  // Update existing clones when original shape changes
  useEffect(() => {
    if (!editor || !enabled || settings.count <= 1) return

    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id
    })

    if (existingClones.length > 0) {
      const updatedClones = existingClones.map((clone: TLShape) => {
        const arrayIndex = clone.meta?.arrayIndex as number
        const position = arrayPositions.find(p => p.index === arrayIndex)
        
        if (!position) return null

        // Calculate final rotation consistently
        const finalRotation = (shape.rotation || 0) + position.rotation

        return {
          id: clone.id,
          type: shape.type,
          x: position.x,
          y: position.y,
          rotation: finalRotation, // Use radians directly
          opacity: (shape.opacity || 1) * 0.8,
          props: {
            ...shape.props,
            ...(('w' in shape.props && 'h' in shape.props) ? {
              w: shape.props.w * position.scaleX,
              h: shape.props.h * position.scaleY
            } : {})
          }
        }
      }).filter(Boolean) as TLShapePartial[]

      if (updatedClones.length > 0) {
        editor.run(() => {
          editor.updateShapes(updatedClones)
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
    }
  }, [editor, shape, arrayPositions, enabled, settings])

  // This component doesn't render anything visible - the shapes are managed directly in the editor
  return null
}

// Circular Array Modifier Component
export function CircularArrayModifier({ 
  shape, 
  settings, 
  enabled 
}: CircularArrayModifierProps) {
  const editor = useEditor()
  
  // Calculate positions for circular array
  const arrayPositions = useMemo(() => {
    if (!enabled) return []
    return calculateCircularArrayPositions(shape, settings)
  }, [shape, settings, enabled])
  
  // Create and manage clones using the same logic as linear array
  useEffect(() => {
    if (!enabled || arrayPositions.length === 0) {
      // Remove any existing clones for this shape
      const allShapes = editor.getCurrentPageShapes()
      const clonesToDelete = allShapes.filter(s => 
        isArrayClone(s) && getOriginalShapeId(s) === shape.id
      )
      
      if (clonesToDelete.length > 0) {
        editor.run(() => {
          editor.deleteShapes(clonesToDelete.map(s => s.id))
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
      return
    }
    
    // Create native shapes for tldraw
    const allShapes = editor.getCurrentPageShapes()
    const existingClones = allShapes.filter(s => 
      isArrayClone(s) && getOriginalShapeId(s) === shape.id
    )
    
    // Calculate which clones need to be created, updated, or deleted
    const targetCloneCount = arrayPositions.length
    const currentCloneCount = existingClones.length
    
    if (currentCloneCount < targetCloneCount) {
      // Create missing clones
      const newPositions = arrayPositions.slice(currentCloneCount)
      const newClones = createNativeShapeClones(editor, shape, newPositions)
      
      editor.run(() => {
        editor.createShapes(newClones)
      }, { ignoreShapeLock: true, history: 'ignore' })
      
    } else if (currentCloneCount > targetCloneCount) {
      // Delete excess clones
      const clonesToDelete = existingClones.slice(targetCloneCount)
      
      editor.run(() => {
        editor.deleteShapes(clonesToDelete.map(s => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }
    
    // Update existing clones positions
    if (targetCloneCount > 0) {
      const clonesToUpdate = allShapes
        .filter(s => isArrayClone(s) && getOriginalShapeId(s) === shape.id)
        .slice(0, targetCloneCount)
      
      const updatedClones = clonesToUpdate.map((clone, index) => {
        const position = arrayPositions[index]
        if (!position) return null
        
        // Calculate final rotation (circular arrays typically don't add rotation, but keep consistent)
        const finalRotation = (shape.rotation || 0) + position.rotation
        
        return {
          id: clone.id,
          x: position.x,
          y: position.y,
          rotation: finalRotation // Use radians directly
        }
      }).filter(Boolean) as TLShapePartial[]

      if (updatedClones.length > 0) {
        editor.run(() => {
          editor.updateShapes(updatedClones)
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
    }
  }, [editor, shape, arrayPositions, enabled, settings])

  return null
}

// Grid Array Modifier Component
export function GridArrayModifier({ 
  shape, 
  settings, 
  enabled 
}: GridArrayModifierProps) {
  const editor = useEditor()
  
  // Calculate positions for grid array
  const arrayPositions = useMemo(() => {
    if (!enabled) return []
    return calculateGridArrayPositions(shape, settings)
  }, [shape, settings, enabled])
  
  // Create and manage clones using the same logic as linear array
  useEffect(() => {
    if (!enabled || arrayPositions.length === 0) {
      // Remove any existing clones for this shape
      const allShapes = editor.getCurrentPageShapes()
      const clonesToDelete = allShapes.filter(s => 
        isArrayClone(s) && getOriginalShapeId(s) === shape.id
      )
      
      if (clonesToDelete.length > 0) {
        editor.run(() => {
          editor.deleteShapes(clonesToDelete.map(s => s.id))
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
      return
    }
    
    // Create native shapes for tldraw
    const allShapes = editor.getCurrentPageShapes()
    const existingClones = allShapes.filter(s => 
      isArrayClone(s) && getOriginalShapeId(s) === shape.id
    )
    
    // Calculate which clones need to be created, updated, or deleted
    const targetCloneCount = arrayPositions.length
    const currentCloneCount = existingClones.length
    
    if (currentCloneCount < targetCloneCount) {
      // Create missing clones
      const newPositions = arrayPositions.slice(currentCloneCount)
      const newClones = createNativeShapeClones(editor, shape, newPositions)
      
      editor.run(() => {
        editor.createShapes(newClones)
      }, { ignoreShapeLock: true, history: 'ignore' })
      
    } else if (currentCloneCount > targetCloneCount) {
      // Delete excess clones
      const clonesToDelete = existingClones.slice(targetCloneCount)
      
      editor.run(() => {
        editor.deleteShapes(clonesToDelete.map(s => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }
    
    // Update existing clones positions
    if (targetCloneCount > 0) {
      const clonesToUpdate = allShapes
        .filter(s => isArrayClone(s) && getOriginalShapeId(s) === shape.id)
        .slice(0, targetCloneCount)
      
      const updatedClones = clonesToUpdate.map((clone, index) => {
        const position = arrayPositions[index]
        if (!position) return null
        
        // Calculate final rotation (grid arrays typically don't add rotation, but keep consistent)
        const finalRotation = (shape.rotation || 0) + position.rotation
        
        return {
          id: clone.id,
          x: position.x,
          y: position.y,
          rotation: finalRotation // Use radians directly
        }
      }).filter(Boolean) as TLShapePartial[]

      if (updatedClones.length > 0) {
        editor.run(() => {
          editor.updateShapes(updatedClones)
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
    }
  }, [editor, shape, arrayPositions, enabled, settings])

  return null
}

// Helper to apply linear array modifier to a shape (for programmatic use)
export function applyLinearArrayModifier(
  shape: TLShape, 
  settings: LinearArraySettings
): TLShape[] {
  const results = [shape] // Start with original
  
  // Get shape dimensions for center calculations
  let shapeWidth = 100  // default fallback
  let shapeHeight = 100 // default fallback
  
  if ('w' in shape.props && 'h' in shape.props) {
    shapeWidth = shape.props.w as number
    shapeHeight = shape.props.h as number
  }
  
  for (let i = 1; i < settings.count; i++) {
    // Calculate position relative to original shape
    const offsetX = settings.offsetX * i
    const offsetY = settings.offsetY * i
    
    // Apply spacing as a multiplier to the offset
    const spacedOffsetX = offsetX * settings.spacing
    const spacedOffsetY = offsetY * settings.spacing
    
    // Calculate the final position (top-left of the shape)
    const finalX = shape.x + spacedOffsetX
    const finalY = shape.y + spacedOffsetY
    
    // Calculate rotation in radians for this clone
    const rotationRadians = settings.rotation * i * Math.PI / 180
    
    // Calculate final rotation by adding original shape rotation to array rotation
    const finalRotation = (shape.rotation || 0) + rotationRadians
    
    // Create modified copy
    const copy = {
      ...shape,
      id: generateArrayCloneId(shape.id, i),
      x: finalX,
      y: finalY,
      rotation: finalRotation, // Use radians directly
      isLocked: true,
      meta: {
        ...shape.meta,
        isArrayClone: true,
        originalShapeId: shape.id,
        arrayIndex: i
      }
    }
    
    // Apply scaling if shape supports it
    if ('w' in shape.props && 'h' in shape.props) {
      const scaleStep = settings.scaleStep
      const scale = Math.pow(scaleStep, i)
      copy.props = {
        ...copy.props,
        w: shape.props.w * scale,
        h: shape.props.h * scale
      }
    }
    
    results.push(copy)
  }
  
  return results
}

// Export the LinearArraySettings type for convenience
export type { LinearArraySettings }

// Export utility functions for external use
export { isArrayClone, getOriginalShapeId } 