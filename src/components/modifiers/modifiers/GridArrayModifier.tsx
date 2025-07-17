import { useMemo, useEffect } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId } from 'tldraw'
import { type GridArraySettings } from '../../../types/modifiers'
import { 
  calculateGridPosition, 
  getOriginalShapeId, 
  getShapeDimensions,
  applyShapeScaling,
  logShapeOperation 
} from '../utils/shapeUtils'

interface GridArrayModifierProps {
  shape: TLShape
  settings: GridArraySettings
  enabled: boolean
}

export function GridArrayModifier({ shape, settings, enabled }: GridArrayModifierProps) {
  const editor = useEditor()
  
  // Calculate positions for all clones
  const clonePositions = useMemo(() => {
    if (!enabled || settings.rows < 1 || settings.columns < 1) return []
    
    const positions = []
    let index = 1
    
    for (let row = 0; row < settings.rows; row++) {
      for (let col = 0; col < settings.columns; col++) {
        // Skip the original position (0,0)
        if (row === 0 && col === 0) continue
        
        const position = calculateGridPosition(
          shape,
          row,
          col,
          settings.offsetX,
          settings.offsetY,
          settings.spacingX,
          settings.spacingY
        )
        positions.push({ ...position, index: index++ })
      }
    }
    
    logShapeOperation('GridArray', shape.id, {
      rows: settings.rows,
      columns: settings.columns,
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
      return originalId === shape.id && s.meta?.arrayType === 'grid'
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
        
        logShapeOperation('GridArray Clone', cloneId, {
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
            arrayType: 'grid'
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
        return originalId === shape.id && s.meta?.arrayType === 'grid'
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