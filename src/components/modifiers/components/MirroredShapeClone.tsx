import { track, useEditor, type TLShape, SVGContainer } from 'tldraw'

interface MirroredShapeCloneProps {
  shape: TLShape
  originalShape: TLShape | null
  transform: string
}

/**
 * Component to render actual mirrored shape content
 * Extracted from ModifierRenderer.tsx
 */
export const MirroredShapeClone = track(({ shape, originalShape, transform }: MirroredShapeCloneProps) => {
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