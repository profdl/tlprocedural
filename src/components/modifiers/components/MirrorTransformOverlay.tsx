import { useMemo } from 'react'
import { track, useEditor, type TLShape, type TLShapeId } from 'tldraw'
import { MirroredShapeClone } from './MirroredShapeClone'

/**
 * Component to render CSS transform overlays for mirrored shapes
 * Extracted from ModifierRenderer.tsx
 */
export const MirrorTransformOverlay = track(() => {
  const editor = useEditor()
  
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