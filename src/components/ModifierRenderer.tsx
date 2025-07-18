import { useMemo } from 'react'
import { useEditor, type TLShape, type TLShapeId, track, useValue, SVGContainer } from 'tldraw'
import { StackedModifier } from './modifiers/StackedModifier'
import { useModifierStore } from '../store/modifierStore'
import type { TLModifier } from '../types/modifiers'

// Component to render actual mirrored shape content
const MirroredShapeClone = track(({ shape, originalShape, transform }: {
  shape: TLShape
  originalShape: TLShape | null
  transform: string
}) => {
  const editor = useEditor()
  
  if (!originalShape) return null
  
  // Get the shape util for the original shape type
  const shapeUtil = editor.getShapeUtil(originalShape)
  if (!shapeUtil) return null
  
  // Get screen coordinates for the mirrored shape position
  const pagePoint = { x: shape.x, y: shape.y }
  const screenPoint = editor.pageToScreen(pagePoint)
  
  // Get the camera zoom
  const camera = editor.getCamera()
  const zoom = camera.z
  
  // Get shape geometry for dimensions
  const geometry = editor.getShapeGeometry(originalShape)
  if (!geometry) return null
  
  const bounds = geometry.bounds
  
  console.log(`Positioning mirrored clone:`, {
    shapeId: shape.id,
    originalShapePos: { x: originalShape.x, y: originalShape.y },
    originalShapeRotation: originalShape.rotation,
    mirroredShapePos: { x: shape.x, y: shape.y },
    mirroredShapeRotation: shape.rotation,
    screenPoint,
    transform,
    bounds
  })
  
  try {
    // Create a shape that looks like the original but positioned at the mirrored location
    const clonedShape = {
      ...originalShape,
      x: 0, // Position relative to container
      y: 0, // Position relative to container
      id: shape.id, // Use the mirrored shape's ID
      rotation: shape.rotation // Use the mirrored shape's rotation, not the original's
    }
    
    console.log(`Created cloned shape with rotation: ${shape.rotation} (${shape.rotation * 180 / Math.PI}°)`)
    
    return (
      <div
        style={{
          position: 'absolute',
          left: screenPoint.x,
          top: screenPoint.y,
          width: bounds.width * zoom,
          height: bounds.height * zoom,
          transform,
          transformOrigin: 'center center',
          pointerEvents: 'none',
          zIndex: 999,
          // Add a subtle visual effect to distinguish mirrors
          filter: 'brightness(0.9) saturate(1.1)',
          boxShadow: '0 0 8px rgba(100, 150, 255, 0.4)'
        }}
      >
        <div
          style={{
            transform: `scale(${zoom}) rotate(${shape.rotation}rad)`,
            transformOrigin: 'center center',
            width: bounds.width,
            height: bounds.height,
          }}
        >
          {/* Render the actual shape component at relative position 0,0 */}
          <SVGContainer>
            {shapeUtil.component && shapeUtil.component(clonedShape)}
          </SVGContainer>
        </div>
      </div>
    )
  } catch (error) {
            // Display a styled indicator if shape rendering fails
    console.warn('Failed to render mirrored shape:', error)
    return (
      <div
        style={{
          position: 'absolute',
          left: screenPoint.x,
          top: screenPoint.y,
          width: bounds.width * zoom,
          height: bounds.height * zoom,
          transform,
          transformOrigin: 'center center',
          pointerEvents: 'none',
          zIndex: 999,
          backgroundColor: 'rgba(100, 150, 255, 0.6)',
          border: '2px solid rgba(50, 100, 200, 0.8)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.min(bounds.width * zoom, bounds.height * zoom) / 8}px`,
          color: 'white',
          fontWeight: 'bold',
        }}
      >
        ↔️
      </div>
    )
  }
})

// Component to render CSS transform overlays for mirrored shapes
const MirrorTransformOverlay = track(() => {
  const editor = useEditor()
  
  // Track camera changes for responsive positioning
  // const camera = editor.getCamera() // Unused for now
  
  // Get all shapes that are mirrored clones, but deduplicate to avoid double processing
  const mirroredShapes = useMemo(() => {
    const shapes = editor.getCurrentPageShapes().filter((shape: TLShape) => 
      shape.meta?.isMirrored && shape.meta?.isArrayClone
    )
    // Deduplicate by shape ID to prevent double rendering
    const seen = new Set()
    return shapes.filter(shape => {
      if (seen.has(shape.id)) return false
      seen.add(shape.id)
      return true
    })
  }, [editor])
  
  if (mirroredShapes.length === 0) return null
  
  return (
    <>
      {mirroredShapes.map((shape: TLShape) => {
        // Determine transform based on the mirror axis
        let transform = ''
        
        if (shape.meta.isFlippedX && !shape.meta.isFlippedY) {
          // Horizontal flip
          transform = 'scaleX(-1)'
        } else if (shape.meta.isFlippedY && !shape.meta.isFlippedX) {
          // Vertical flip  
          transform = 'scaleY(-1)'
        } else if (shape.meta.isFlippedX && shape.meta.isFlippedY) {
          // Both directions
          transform = 'scaleX(-1) scaleY(-1)'
        }
        
        // Get the original shape to clone its appearance
        const originalShapeId = shape.meta.originalShapeId as TLShapeId
        const foundShape = originalShapeId ? editor.getShape(originalShapeId) : undefined
        const originalShape = foundShape ? (foundShape as TLShape) : null
        
        // Only log occasionally to reduce spam
        if (Math.random() < 0.05) {
          console.log(`Rendering mirrored clone of ${originalShape?.type} with transform: ${transform}`)
        }
        
        return (
          <MirroredShapeClone
            key={`mirror-clone-${shape.id}`}
            shape={shape}
            originalShape={originalShape}
            transform={transform}
          />
        )
      })}
    </>
  )
})

// Main modifier renderer component
export function ModifierRenderer() {
  const editor = useEditor()
  const store = useModifierStore()
  
  // Get all shapes and their modifiers
  const shapesWithModifiers = useValue(
    'shapes-with-modifiers',
    () => {
      const allShapes = editor.getCurrentPageShapes()
      console.log('ModifierRenderer: All shapes:', allShapes.length)
      
      const shapesWithMods = allShapes
        .map(shape => {
          const modifiers = store.getModifiersForShape(shape.id)
          return {
            shape,
            modifiers,
            // Create a stable key for memoization that includes shape position, style properties, and modifier properties
            modifiersKey: `${modifiers.map(m => `${m.id}-${m.enabled}-${JSON.stringify(m.props)}`).join('|')}-${shape.x}-${shape.y}-${shape.rotation}-${JSON.stringify(shape.props)}`
          }
        })
        .filter(item => item.modifiers.length > 0)
      
      console.log('ModifierRenderer: Shapes with modifiers:', shapesWithMods.length)
      shapesWithMods.forEach(item => {
        console.log(`Shape ${item.shape.id} has ${item.modifiers.length} modifiers:`, item.modifiers.map((m: TLModifier) => m.type))
      })
      
      return shapesWithMods
    },
    [editor, store] // Track both editor and store changes
  )
  
  // Use StackedModifier approach - one component per shape processes all modifiers
  return (
    <div className="modifier-renderer">
      {shapesWithModifiers.flatMap(({ shape, modifiers, modifiersKey }) => {
        if (shape.type === 'group' && editor) {
          // Get all child shapes in the group
          const childShapeIds = editor.getShapeAndDescendantIds([shape.id])
          const childShapes = Array.from(childShapeIds)
            .map((id: TLShapeId) => editor.getShape(id))
            .filter(Boolean) as TLShape[]
          // Render a StackedModifier for each child
          return childShapes.map(childShape => (
            <StackedModifier
              key={`stacked-${childShape.id}-${modifiersKey}`}
              shape={childShape}
              modifiers={modifiers}
            />
          ))
        } else {
          return (
            <StackedModifier
              key={`stacked-${shape.id}-${modifiersKey}`}
              shape={shape}
              modifiers={modifiers}
            />
          )
        }
      })}
    </div>
  )
}

// Helper component to integrate with tldraw's UI zones
export function ModifierOverlay() {
  return (
    <div 
      className="modifier-overlay"
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000, // Above canvas but below UI
      }}
    >
      <ModifierRenderer />
      <MirrorTransformOverlay />
    </div>
  )
} 