import { useMemo } from 'react'
import { type TLShape } from 'tldraw'
import { 
  type LinearArraySettings
} from '../../types/modifiers'

interface LinearArrayModifierProps {
  shape: TLShape
  settings: LinearArraySettings
  enabled: boolean
}

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
  
  for (let i = 1; i < settings.count; i++) {
    // Calculate offset with spacing
    const offsetX = settings.offsetX * i * settings.spacing
    const offsetY = settings.offsetY * i * settings.spacing
    
    // Calculate rotation
    const rotation = settings.rotation * i
    
    // Calculate scale with step
    const scaleStep = settings.scaleStep
    const scaleX = Math.pow(scaleStep, i)
    const scaleY = Math.pow(scaleStep, i)
    
    positions.push({
      x: originalShape.x + offsetX,
      y: originalShape.y + offsetY,
      rotation,
      scaleX,
      scaleY,
      index: i
    })
  }
  
  return positions
}

// Virtual Shape Renderer Component
function VirtualShapeRender({ 
  shape, 
  position 
}: { 
  shape: TLShape
  position: ArrayPosition 
}) {
  // Get shape dimensions from props (works with most shape types)
  const width = 'w' in shape.props ? (shape.props.w as number) : 100
  const height = 'h' in shape.props ? (shape.props.h as number) : 100
  
  // Create transform style for the virtual shape
  const transform = `
    translate(${position.x - shape.x}px, ${position.y - shape.y}px) 
    rotate(${position.rotation}deg) 
    scale(${position.scaleX}, ${position.scaleY})
  `
  
  return (
    <div
      className="virtual-shape-copy"
      style={{
        position: 'absolute',
        left: shape.x,
        top: shape.y,
        width: width,
        height: height,
        transform,
        transformOrigin: 'center',
        border: '2px dashed rgba(0, 100, 255, 0.6)',
        background: 'rgba(0, 100, 255, 0.1)',
        pointerEvents: 'none',
        zIndex: 1000,
        borderRadius: '3px',
        boxSizing: 'border-box'
      }}
    >
      {/* Copy indicator */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#0066ff',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '2px 4px',
          borderRadius: '2px',
          lineHeight: '1',
          fontFamily: 'ui-monospace, monospace'
        }}
      >
        #{position.index}
      </div>
    </div>
  )
}

// Main Linear Array Modifier Component
export function LinearArrayModifier({ 
  shape, 
  settings, 
  enabled 
}: LinearArrayModifierProps) {
  // Calculate all array positions
  const arrayPositions = useMemo(() => {
    if (!enabled || settings.count <= 1) return []
    return calculateArrayPositions(shape, settings)
  }, [shape, settings, enabled])
      
  // Don't render anything if disabled or only one copy
  if (!enabled || settings.count <= 1) {
    return null
  }
  
  return (
    <div className="linear-array-modifier" style={{ position: 'relative' }}>
      {arrayPositions.map((position) => (
        <VirtualShapeRender
          key={`${shape.id}-copy-${position.index}`}
          shape={shape}
          position={position}
        />
      ))}
    </div>
  )
}

// Helper to apply linear array modifier to a shape
export function applyLinearArrayModifier(
  shape: TLShape, 
  settings: LinearArraySettings
): TLShape[] {
  const results = [shape] // Start with original
  
  for (let i = 1; i < settings.count; i++) {
    // Calculate position
    const offsetX = settings.offsetX * i * settings.spacing
    const offsetY = settings.offsetY * i * settings.spacing
    
    // Create modified copy
    const copy = {
      ...shape,
      id: `${shape.id}_copy_${i}` as any,
      x: shape.x + offsetX,
      y: shape.y + offsetY,
      rotation: (shape.rotation || 0) + (settings.rotation * i),
      // Note: Scale would need to be applied differently depending on shape type
    }
    
    results.push(copy)
  }
  
  return results
}

// Export the LinearArraySettings type for convenience
export type { LinearArraySettings } 