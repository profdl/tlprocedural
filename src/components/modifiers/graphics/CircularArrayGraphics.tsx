import { useEditor } from 'tldraw'
import type { TLShape } from 'tldraw'
import type { CircularArraySettings } from '../../../types/modifiers'

interface CircularArrayGraphicsProps {
  shape: TLShape
  settings: CircularArraySettings
  groupContext?: {
    groupTopLeft: { x: number; y: number }
    groupBounds: { width: number; height: number }
    groupTransform?: { x: number; y: number; rotation: number }
  }
}

export function CircularArrayGraphics({ shape, settings, groupContext }: CircularArrayGraphicsProps) {
  const editor = useEditor()
  
  if (!editor) return null
  
  const { centerX, centerY, radius, startAngle } = settings
  const camera = editor.getCamera()
  
  // Calculate source shape center first - accounting for rotation
  const shapeWidth = 'w' in shape.props ? (shape.props.w as number) : 100
  const shapeHeight = 'h' in shape.props ? (shape.props.h as number) : 100
  
  // For rotated shapes, calculate the actual center position in world coordinates
  const localCenterX = shapeWidth / 2
  const localCenterY = shapeHeight / 2
  const rotation = shape.rotation || 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  
  // Transform the local center to world coordinates
  const sourceCenterX = shape.x + (localCenterX * cos - localCenterY * sin)
  const sourceCenterY = shape.y + (localCenterX * sin + localCenterY * cos)
  
  // Calculate the offset needed to position the original shape at the first position
  // This matches the logic in CircularArrayProcessor
  const firstAngle = startAngle * Math.PI / 180
  const offsetX = Math.cos(firstAngle) * radius
  const offsetY = Math.sin(firstAngle) * radius
  
  // Calculate array center position relative to the SOURCE SHAPE CENTER, not its top-left
  let arrayCenterX: number
  let arrayCenterY: number
  
  if (groupContext) {
    // For groups, this is more complex - we need to account for group positioning
    // But for now, let's use the source center as the base reference
    arrayCenterX = sourceCenterX + (centerX || 0) - offsetX
    arrayCenterY = sourceCenterY + (centerY || 0) - offsetY
  } else {
    // For individual shapes, calculate from source center + offset settings
    arrayCenterX = sourceCenterX + (centerX || 0) - offsetX
    arrayCenterY = sourceCenterY + (centerY || 0) - offsetY
  }
  
  // Convert to screen coordinates
  const arrayScreenX = (arrayCenterX + camera.x) * camera.z
  const arrayScreenY = (arrayCenterY + camera.y) * camera.z
  const sourceScreenX = (sourceCenterX + camera.x) * camera.z
  const sourceScreenY = (sourceCenterY + camera.y) * camera.z
  const radiusScreenSize = radius * camera.z
  
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {/* Array center indicator - transform handle style */}
      <div
        style={{
          position: 'absolute',
          left: arrayScreenX - 6,
          top: arrayScreenY - 6,
          width: 12,
          height: 12,
          border: '2px solid #0066FF',
          backgroundColor: 'white',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
      
      {/* Array center crosshairs */}
      <div
        style={{
          position: 'absolute',
          left: arrayScreenX - 8,
          top: arrayScreenY - 0.5,
          width: 16,
          height: 1,
          backgroundColor: '#0066FF',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: arrayScreenX - 0.5,
          top: arrayScreenY - 8,
          width: 1,
          height: 16,
          backgroundColor: '#0066FF',
        }}
      />
      
      {/* Source shape center indicator - different color */}
      <div
        style={{
          position: 'absolute',
          left: sourceScreenX - 5,
          top: sourceScreenY - 5,
          width: 10,
          height: 10,
          border: '2px solid #FF6600',
          backgroundColor: 'white',
          borderRadius: '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
      
      {/* Source shape center crosshairs */}
      <div
        style={{
          position: 'absolute',
          left: sourceScreenX - 6,
          top: sourceScreenY - 0.5,
          width: 12,
          height: 1,
          backgroundColor: '#FF6600',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: sourceScreenX - 0.5,
          top: sourceScreenY - 6,
          width: 1,
          height: 12,
          backgroundColor: '#FF6600',
        }}
      />
      
      {/* Radius circle - faint guide */}
      {radiusScreenSize > 10 && (
        <div
          style={{
            position: 'absolute',
            left: arrayScreenX - radiusScreenSize,
            top: arrayScreenY - radiusScreenSize,
            width: radiusScreenSize * 2,
            height: radiusScreenSize * 2,
            border: '1px dashed #0066FF40',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      )}
      
      {/* Connection line between centers */}
      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <line
          x1={arrayScreenX}
          y1={arrayScreenY}
          x2={sourceScreenX}
          y2={sourceScreenY}
          stroke="#66666640"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>
    </div>
  )
}