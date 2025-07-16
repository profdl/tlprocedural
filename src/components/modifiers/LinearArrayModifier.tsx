import { useMemo } from 'react'
import { useEditor, type TLShape, useDefaultColorTheme, useValue } from 'tldraw'
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

// Shape Clone Renderer Component
function ShapeClone({ 
  shape, 
  position 
}: { 
  shape: TLShape
  position: ArrayPosition 
}) {
  const editor = useEditor()
  
  // Get the theme using proper tldraw hook
  const theme = useDefaultColorTheme()
  
  // Get the most current shape from the editor (not the prop)
  const currentShape = editor.getShape(shape.id) || shape
  
  // Get shape geometry for accurate bounds
  const geometry = editor.getShapeGeometry(currentShape)
  const bounds = geometry.bounds
  
  // Create transform for the clone position
  const transform = `
    translate(${position.x - currentShape.x}px, ${position.y - currentShape.y}px) 
    rotate(${position.rotation}deg) 
    scale(${position.scaleX}, ${position.scaleY})
  `
  
  // Get shape properties for rendering - using current shape data
  const getShapeColor = (): string => {
    if ('color' in currentShape.props) {
      const colorName = currentShape.props.color as string
      // Use the correct theme structure with proper typing
      return (theme as any)[colorName]?.solid || theme.black.solid
    }
    return theme.black.solid
  }
  
  const getShapeFill = (): string => {
    if ('fill' in currentShape.props && 'color' in currentShape.props) {
      const fillType = currentShape.props.fill as string
      const colorName = currentShape.props.color as string
      
      // Use the correct tldraw fill behavior
      if (fillType === 'none') {
        return 'none'
      } else if (fillType === 'semi') {
        // Semi fill should be opaque white
        return 'white'
      } else if (fillType === 'pattern') {
        // Pattern fill should reference the pattern definition
        const patternId = `pattern-${currentShape.id}-${position.index}`
        return `url(#${patternId})`
      } else if (fillType === 'solid') {
        // Solid fill should be a much lighter opaque version of the stroke color
        const themeColor = (theme as any)[colorName]
        const solidColor = themeColor?.solid || theme.black.solid
        
        // Create a much lighter opaque version by mixing with white
        // Convert hex to RGB, lighten it significantly, then back to hex
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : null;
        }
        
        const rgbToHex = (r: number, g: number, b: number) => {
          return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }
        
        const rgb = hexToRgb(solidColor)
        if (rgb) {
          // Mix with white at about 80% white, 20% original color for a very light tint
          const lightR = Math.round(rgb.r * 0.2 + 255 * 0.8)
          const lightG = Math.round(rgb.g * 0.2 + 255 * 0.8)
          const lightB = Math.round(rgb.b * 0.2 + 255 * 0.8)
          return rgbToHex(lightR, lightG, lightB)
        }
        
        // Fallback to a very light gray if color parsing fails
        return '#f8f8f8'
      }
    }
    return 'none'
  }
  
  const getShapeStroke = (): string => {
    if ('dash' in currentShape.props) {
      const dashType = currentShape.props.dash as string
      switch (dashType) {
        case 'dashed':
          return '5,5'
        case 'dotted':
          return '2,3'
        default:
          return 'none'
      }
    }
    return 'none'
  }
  
  const getStrokeWidth = (): number => {
    if ('size' in currentShape.props) {
      const size = currentShape.props.size as string
      // Use the same stroke sizes as tldraw
      switch (size) {
        case 's': return 2
        case 'm': return 3.5
        case 'l': return 5
        case 'xl': return 10
        default: return 3.5
      }
    }
    return 2
  }
  
  // Get corner radius for rectangles (tldraw's rectangles can have rounded corners)
  const getCornerRadius = (): number => {
    if (editor.isShapeOfType(currentShape, 'geo')) {
      const geoType = 'geo' in currentShape.props ? currentShape.props.geo : 'rectangle'
      if (geoType === 'rectangle') {
        // For now, use a small radius that matches tldraw's default
        // You can expose this as a shape property if needed
        return Math.min(bounds.width, bounds.height) * 0.05 // 5% of smallest dimension
      }
    }
    return 0
  }
  
  // Check if we need a pattern definition
  const needsPattern = (): boolean => {
    if ('fill' in currentShape.props) {
      return currentShape.props.fill === 'pattern'
    }
    return false
  }
  
  // Create pattern definition
  const createPatternDefinition = () => {
    if (!needsPattern()) return null
    
    const patternId = `pattern-${currentShape.id}-${position.index}`
    const strokeColor = getShapeColor()
    
    return (
      <defs>
        <pattern
          id={patternId}
          x="0"
          y="0"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="8" fill="white" />
          <circle
            cx="4"
            cy="4"
            r="1.5"
            fill={strokeColor}
          />
        </pattern>
      </defs>
    )
  }
  
  // Render different shape types
  const renderShapeGeometry = () => {
    const strokeWidth = getStrokeWidth()
    const stroke = getShapeColor()
    const fill = getShapeFill()
    const strokeDasharray = getShapeStroke()
    
    // Handle different shape types
    if (editor.isShapeOfType(currentShape, 'geo')) {
      const geoType = 'geo' in currentShape.props ? currentShape.props.geo : 'rectangle'
      
      switch (geoType) {
        case 'ellipse':
          return (
            <ellipse
              cx={bounds.width / 2}
              cy={bounds.height / 2}
              rx={bounds.width / 2}
              ry={bounds.height / 2}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
            />
          )
        
        case 'triangle':
          const trianglePoints = `${bounds.width / 2},0 0,${bounds.height} ${bounds.width},${bounds.height}`
          return (
            <polygon
              points={trianglePoints}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
            />
          )
        
        case 'diamond':
          const diamondPoints = `${bounds.width / 2},0 ${bounds.width},${bounds.height / 2} ${bounds.width / 2},${bounds.height} 0,${bounds.height / 2}`
          return (
            <polygon
              points={diamondPoints}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
            />
          )
        
        case 'hexagon':
          const hex = bounds.width / 4
          const hexPoints = `${hex},0 ${bounds.width - hex},0 ${bounds.width},${bounds.height / 2} ${bounds.width - hex},${bounds.height} ${hex},${bounds.height} 0,${bounds.height / 2}`
          return (
            <polygon
              points={hexPoints}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
            />
          )
        
        case 'star':
          // Simplified 5-point star
          const cx = bounds.width / 2
          const cy = bounds.height / 2
          const outerRadius = Math.min(bounds.width, bounds.height) / 2
          const innerRadius = outerRadius * 0.4
          let starPoints = ''
          
          for (let i = 0; i < 10; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius
            const angle = (i * Math.PI) / 5 - Math.PI / 2
            const x = cx + radius * Math.cos(angle)
            const y = cy + radius * Math.sin(angle)
            starPoints += `${x},${y} `
          }
          
          return (
            <polygon
              points={starPoints.trim()}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
            />
          )
        
        default: // rectangle and other shapes
          const cornerRadius = getCornerRadius()
          return (
            <rect
              width={bounds.width}
              height={bounds.height}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              rx={cornerRadius}
              ry={cornerRadius}
            />
          )
      }
    } else if (editor.isShapeOfType(currentShape, 'draw')) {
      // For draw shapes, create a simplified representation
      return (
        <rect
          width={bounds.width}
          height={bounds.height}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth + 1}
          strokeDasharray="3,2"
          rx="4"
          opacity="0.8"
        />
      )
    } else if (editor.isShapeOfType(currentShape, 'text')) {
      // For text shapes, show a text placeholder
      return (
        <g>
          <rect
            width={bounds.width}
            height={bounds.height}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray="2,2"
            opacity="0.5"
          />
          <text
            x={bounds.width / 2}
            y={bounds.height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={Math.min(bounds.width / 4, bounds.height / 2, 16)}
            fill={stroke}
            opacity="0.7"
          >
            Aa
          </text>
        </g>
      )
    } else if (editor.isShapeOfType(currentShape, 'arrow')) {
      // For arrow shapes, create a simple arrow representation
      const arrowLength = Math.max(bounds.width, bounds.height)
      return (
        <g>
          <line
            x1="0"
            y1={bounds.height / 2}
            x2={arrowLength - 10}
            y2={bounds.height / 2}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <polygon
            points={`${arrowLength - 10},${bounds.height / 2 - 5} ${arrowLength},${bounds.height / 2} ${arrowLength - 10},${bounds.height / 2 + 5}`}
            fill={stroke}
          />
        </g>
      )
    } else {
      // Generic fallback for unknown shape types
      return (
        <rect
          width={bounds.width}
          height={bounds.height}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray="4,4"
          opacity="0.6"
        />
      )
    }
  }
  
  return (
    <div
      className="shape-clone"
      style={{
        position: 'absolute',
        left: currentShape.x,
        top: currentShape.y,
        transform,
        transformOrigin: 'center',
        pointerEvents: 'none',
        zIndex: 999,
        opacity: currentShape.opacity || 1 // Use the current shape's opacity
      }}
    >
      <svg
        width={bounds.width}
        height={bounds.height}
        style={{
          overflow: 'visible'
        }}
      >
        {createPatternDefinition()}
        {renderShapeGeometry()}
      </svg>
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
        <ShapeClone
          key={`${shape.id}-clone-${position.index}`}
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