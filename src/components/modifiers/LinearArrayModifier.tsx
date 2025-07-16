import { useMemo } from 'react'
import { useEditor, type TLShape, getDefaultColorTheme, useValue } from 'tldraw'
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
  
  // Get the theme using useValue for reactivity
  const theme = useValue('theme', () => {
    const isDarkMode = editor.user.getIsDarkMode()
    return getDefaultColorTheme({ isDarkMode })
  }, [editor])
  
  // Get shape geometry for accurate bounds
  const geometry = editor.getShapeGeometry(shape)
  const bounds = geometry.bounds
  
  // Create transform for the clone position
  const transform = `
    translate(${position.x - shape.x}px, ${position.y - shape.y}px) 
    rotate(${position.rotation}deg) 
    scale(${position.scaleX}, ${position.scaleY})
  `
  
  // Get shape properties for rendering with proper typing
  const getShapeColor = (): string => {
    if ('color' in shape.props) {
      const colorName = shape.props.color as keyof typeof theme
      if (colorName in theme && typeof theme[colorName] === 'object' && 'solid' in theme[colorName]) {
        return (theme[colorName] as any).solid
      }
    }
    return '#666666'
  }
  
  const getShapeFill = (): string => {
    if ('fill' in shape.props && 'color' in shape.props) {
      const fillType = shape.props.fill as string
      const colorName = shape.props.color as keyof typeof theme
      
      if (colorName in theme && typeof theme[colorName] === 'object') {
        const color = theme[colorName] as any
        switch (fillType) {
          case 'solid':
            return color.solid || '#cccccc'
          case 'semi':
            return color.semi || 'rgba(204, 204, 204, 0.5)'
          default:
            return 'none'
        }
      }
    }
    return 'none'
  }
  
  const getShapeStroke = (): string => {
    if ('dash' in shape.props) {
      const dashType = shape.props.dash as string
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
    if ('size' in shape.props) {
      const size = shape.props.size as string
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
  
  // Render different shape types
  const renderShapeGeometry = () => {
    const strokeWidth = getStrokeWidth()
    const stroke = getShapeColor()
    const fill = getShapeFill()
    const strokeDasharray = getShapeStroke()
    
    // Handle different shape types
    if (editor.isShapeOfType(shape, 'geo')) {
      const geoType = 'geo' in shape.props ? shape.props.geo : 'rectangle'
      
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
          return (
            <rect
              width={bounds.width}
              height={bounds.height}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              rx={geoType === 'rectangle' ? 0 : 8}
            />
          )
      }
    } else if (editor.isShapeOfType(shape, 'draw')) {
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
    } else if (editor.isShapeOfType(shape, 'text')) {
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
    } else if (editor.isShapeOfType(shape, 'arrow')) {
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
        left: shape.x,
        top: shape.y,
        transform,
        transformOrigin: 'center',
        pointerEvents: 'none',
        zIndex: 999,
        opacity: 0.7
      }}
    >
      <svg
        width={bounds.width}
        height={bounds.height}
        style={{
          overflow: 'visible'
        }}
      >
        {renderShapeGeometry()}
        
        {/* Copy number indicator */}
        <g transform={`translate(${bounds.width + 5}, -5)`}>
          <circle
            cx="0"
            cy="0"
            r="8"
            fill="rgba(0, 100, 255, 0.8)"
            stroke="white"
            strokeWidth="1"
          />
          <text
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="10"
            fill="white"
            fontWeight="bold"
            fontFamily="ui-monospace, monospace"
          >
            {position.index}
          </text>
        </g>
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