import { useMemo, useEffect } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId } from 'tldraw'
import { type CircularArraySettings } from '../../../types/modifiers'
import { 
  calculateCircularPosition, 
  getOriginalShapeId, 
  getShapeDimensions,
  applyShapeScaling,
  logShapeOperation 
} from '../utils/shapeUtils'

interface CircularArrayModifierProps {
  shape: TLShape
  settings: CircularArraySettings
  enabled: boolean
}

export function CircularArrayModifier({ shape, settings, enabled }: CircularArrayModifierProps) {
  const editor = useEditor()
  
  // Calculate positions for all clones
  const clonePositions = useMemo(() => {
    if (!enabled || settings.count < 2) return []
    
    const positions = []
    for (let i = 1; i < settings.count; i++) {
      const position = calculateCircularPosition(
        shape,
        i,
        settings.centerX,
        settings.centerY,
        settings.radius,
        settings.startAngle,
        settings.endAngle,
        settings.rotateEach,
        settings.rotateAll,
        settings.pointToCenter
      )
      positions.push({ ...position, index: i })
    }
    
    logShapeOperation('CircularArray', shape.id, {
      count: settings.count,
      radius: settings.radius,
      positions: positions.length
    })
    
    return positions
  }, [shape, settings, enabled])

  // Create and manage shape clones
  useEffect(() => {
    if (!editor) return

    // Clean up existing clones for this shape
    const existingClones = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id && s.meta?.arrayType === 'circular'
    })

    // Delete existing clones
    if (existingClones.length > 0) {
      editor.run(() => {
        editor.deleteShapes(existingClones.map((s: TLShape) => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }

    // Create new clones if enabled
    if (enabled && clonePositions.length > 0) {
      const cloneShapes: TLShapePartial[] = clonePositions.map((position) => {
        const cloneId = createShapeId()
        
        // Calculate final rotation by adding original shape rotation
        const finalRotation = (shape.rotation || 0) + position.rotation
        
        // Apply comprehensive scaling to the shape
        const scaledShape = applyShapeScaling(shape, position.scaleX, position.scaleY)
        
        logShapeOperation('CircularArray Clone', cloneId, {
          position: { x: position.x, y: position.y },
          rotation: { original: shape.rotation || 0, added: position.rotation, final: finalRotation },
          scale: { x: position.scaleX, y: position.scaleY },
          shapeType: shape.type
        })
        
        return {
          id: cloneId,
          type: shape.type,
          x: position.x,
          y: position.y,
          rotation: finalRotation,
          isLocked: true,
          opacity: (shape.opacity || 1) * 0.8,
          props: scaledShape.props,
          meta: {
            ...shape.meta,
            isArrayClone: true,
            originalShapeId: shape.id,
            arrayIndex: position.index,
            arrayType: 'circular'
          }
        }
      })

      editor.run(() => {
        editor.createShapes(cloneShapes)
      }, { history: 'ignore' })
    }

    // Cleanup function
    return () => {
      if (!editor) return
      
      const clonesToCleanup = editor.getCurrentPageShapes().filter((s: TLShape) => {
        const originalId = getOriginalShapeId(s)
        return originalId === shape.id && s.meta?.arrayType === 'circular'
      })

      if (clonesToCleanup.length > 0) {
        editor.run(() => {
          editor.deleteShapes(clonesToCleanup.map((s: TLShape) => s.id))
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
    }
  }, [editor, shape, enabled, clonePositions])

  // This component doesn't render anything visible
  return null
} 