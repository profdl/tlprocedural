import { useMemo, useEffect } from 'react'
import { useEditor, type TLShape, type TLShapePartial, createShapeId } from 'tldraw'
import { type MirrorSettings } from '../../../types/modifiers'
import { 
  getOriginalShapeId, 
  getShapeDimensions,
  applyShapeScaling,
  logShapeOperation 
} from '../utils/shapeUtils'

interface MirrorModifierProps {
  shape: TLShape
  settings: MirrorSettings
  enabled: boolean
}

export function MirrorModifier({ shape, settings, enabled }: MirrorModifierProps) {
  const editor = useEditor()
  
  // Calculate mirror position and properties
  const mirrorShape = useMemo(() => {
    if (!enabled) return null
    
    const { width: shapeWidth, height: shapeHeight } = getShapeDimensions(shape)
    const cloneId = createShapeId()
    
    let mirrorX = shape.x
    let mirrorY = shape.y
    let scaleX = 1
    let scaleY = 1
    let mirrorAxis = 'x'
    
    // Calculate mirror position and scaling based on axis
    switch (settings.axis) {
      case 'x':
        // Horizontal mirror - flip across vertical line
        mirrorX = shape.x + shapeWidth + settings.offset
        scaleX = -1
        mirrorAxis = 'x'
        break
        
      case 'y':
        // Vertical mirror - flip across horizontal line
        mirrorY = shape.y + shapeHeight + settings.offset
        scaleY = -1
        mirrorAxis = 'y'
        break
        
      case 'diagonal':
        // Diagonal mirror - flip across diagonal line
        mirrorX = shape.x + shapeWidth + settings.offset
        mirrorY = shape.y + shapeHeight + settings.offset
        scaleX = -1
        scaleY = -1
        mirrorAxis = 'diagonal'
        break
    }
    
    // Apply scaling to create the mirrored shape
    const scaledShape = applyShapeScaling(shape, scaleX, scaleY)
    
    logShapeOperation('MirrorModifier', shape.id, {
      axis: settings.axis,
      offset: settings.offset,
      originalPosition: { x: shape.x, y: shape.y },
      mirrorPosition: { x: mirrorX, y: mirrorY },
      scale: { x: scaleX, y: scaleY }
    })
    
    return {
      id: cloneId,
      type: shape.type,
      x: mirrorX,
      y: mirrorY,
      rotation: shape.rotation,
      isLocked: true,
      opacity: (shape.opacity || 1) * 0.8,
      props: scaledShape.props,
      meta: {
        ...shape.meta,
        isArrayClone: true,
        originalShapeId: shape.id,
        arrayIndex: 1,
        arrayType: 'mirror',
        isMirrored: true,
        mirrorAxis: mirrorAxis,
        isFlippedX: scaleX < 0,
        isFlippedY: scaleY < 0
      }
    }
  }, [shape, settings, enabled])

  // Create and manage mirror shape
  useEffect(() => {
    if (!editor) return

    // Clean up existing mirror for this shape
    const existingMirrors = editor.getCurrentPageShapes().filter((s: TLShape) => {
      const originalId = getOriginalShapeId(s)
      return originalId === shape.id && s.meta?.arrayType === 'mirror'
    })

    // Delete existing mirrors
    if (existingMirrors.length > 0) {
      editor.run(() => {
        editor.deleteShapes(existingMirrors.map((s: TLShape) => s.id))
      }, { ignoreShapeLock: true, history: 'ignore' })
    }

    // Create new mirror if enabled
    if (enabled && mirrorShape) {
      logShapeOperation('MirrorModifier Create', shape.id, {
        mirrorId: mirrorShape.id
      })
      
      editor.run(() => {
        editor.createShapes([mirrorShape])
      }, { history: 'ignore' })
    }

    // Cleanup function
    return () => {
      if (!editor) return
      
      const mirrorsToCleanup = editor.getCurrentPageShapes().filter((s: TLShape) => {
        const originalId = getOriginalShapeId(s)
        return originalId === shape.id && s.meta?.arrayType === 'mirror'
      })

      if (mirrorsToCleanup.length > 0) {
        editor.run(() => {
          editor.deleteShapes(mirrorsToCleanup.map((s: TLShape) => s.id))
        }, { ignoreShapeLock: true, history: 'ignore' })
      }
    }
  }, [editor, shape, enabled, mirrorShape])

  // This component doesn't render anything visible
  return null
} 