import { useEditor, type TLShape } from 'tldraw'
import type { TLModifier } from '../../types/modifiers'
import { useStackedModifier } from './hooks/useStackedModifier'
import { useCloneManager } from './hooks/useCloneManager'
import { CircularArrayGraphics } from './graphics/CircularArrayGraphics'
import { findTopLevelGroup, calculateGroupBounds } from './utils'

interface StackedModifierProps {
  shape: TLShape
  modifiers: TLModifier[]
}

/**
 * Refactored StackedModifier component
 * Uses extracted hooks for better separation of concerns
 */
export function StackedModifier({ shape, modifiers }: StackedModifierProps) {
  const editor = useEditor()
  
  // Process shapes with modifiers
  const { processedShapes, shapeKey, modifiersKey } = useStackedModifier({ shape, modifiers })
  
  // Manage clones in the editor
  useCloneManager({ 
    shape, 
    modifiers, 
    processedShapes, 
    shapeKey, 
    modifiersKey 
  })

  // Render graphics for circular array modifiers
  const circularArrayModifiers = modifiers.filter(
    (mod): mod is TLModifier & { type: 'circular-array' } => 
      mod.type === 'circular-array' && mod.enabled
  )

  // Determine group context if shape is part of a group
  let groupContext: {
    groupTopLeft: { x: number; y: number }
    groupBounds: { width: number; height: number }
    groupTransform?: { x: number; y: number; rotation: number }
  } | undefined
  if (editor) {
    const parentGroup = findTopLevelGroup(shape, editor)
    if (parentGroup || shape.type === 'group') {
      const targetGroup = parentGroup || shape
      const groupShapeIds = editor.getShapeAndDescendantIds([targetGroup.id])
      const groupShapes = Array.from(groupShapeIds)
        .map(id => editor.getShape(id))
        .filter(Boolean) as TLShape[]
      
      const childShapes = groupShapes.filter(s => s.id !== targetGroup.id)
      if (childShapes.length > 0) {
        const groupBounds = calculateGroupBounds(childShapes)
        groupContext = {
          groupTopLeft: {
            x: groupBounds.minX,
            y: groupBounds.minY
          },
          groupBounds: {
            width: groupBounds.width,
            height: groupBounds.height
          },
          groupTransform: {
            x: targetGroup.x,
            y: targetGroup.y,
            rotation: targetGroup.rotation || 0
          }
        }
      }
    }
  }

  return (
    <>
      {circularArrayModifiers.map((modifier) => (
        <CircularArrayGraphics
          key={`${shape.id}-${modifier.id}-graphics`}
          shape={shape}
          settings={modifier.props}
          groupContext={groupContext}
        />
      ))}
    </>
  )
} 