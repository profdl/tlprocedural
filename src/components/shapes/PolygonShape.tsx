import { HTMLContainer, T, type TLBaseShape, type RecordProps } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type PolygonShape = TLBaseShape<
  'polygon',
  {
    w: number
    h: number
    sides: number
    color: string
    strokeWidth: number
    fill: boolean
  }
>

export class PolygonShapeUtil extends FlippableShapeUtil<PolygonShape> {
  static override type = 'polygon' as const

  static override props: RecordProps<PolygonShape> = {
    w: T.number,
    h: T.number,
    sides: T.number,
    color: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
  }

  override getDefaultProps(): PolygonShape['props'] {
    return {
      w: 120,
      h: 120,
      sides: 6,
      color: '#000000',
      strokeWidth: 2,
      fill: false,
    }
  }

  override component(shape: PolygonShape) {
    const { w, h, color, strokeWidth, fill } = shape.props
    
    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)
    
    // Use the same scaling logic as getOutline to ensure visual consistency
    const outline = this.getOutline(shape)
    const points = outline.map(p => `${p.x},${p.y}`)
    const pathData = `M ${points.join(' L ')} Z`
    
    return (
      <HTMLContainer>
        <svg 
          width={w} 
          height={h} 
          style={{ 
            overflow: 'visible',
            ...flipTransform
          }}
        >
          <path 
            d={pathData} 
            fill={fill ? color : 'none'} 
            stroke={color} 
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </HTMLContainer>
    )
  }

  override indicator() {
    return null
  }

  getBounds(shape: PolygonShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: PolygonShape) {
    const bounds = this.getBounds(shape)
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
    }
  }

  getOutline(shape: PolygonShape) {
    const { w, h, sides } = shape.props
    const centerX = w / 2
    const centerY = h / 2
    const radiusX = w / 2
    const radiusY = h / 2
    
    // Calculate polygon vertices
    const vertices = []
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
      const x = centerX + radiusX * Math.cos(angle)
      const y = centerY + radiusY * Math.sin(angle)
      vertices.push({ x, y })
    }
    
    // Calculate actual bounds of the vertices
    const minX = Math.min(...vertices.map(p => p.x))
    const maxX = Math.max(...vertices.map(p => p.x))
    const minY = Math.min(...vertices.map(p => p.y))
    const maxY = Math.max(...vertices.map(p => p.y))
    
    const actualW = maxX - minX
    const actualH = maxY - minY
    
    // Scale vertices to fill the entire w x h bounds
    const scaleX = w / actualW
    const scaleY = h / actualH
    
    return vertices.map(vertex => ({
      x: (vertex.x - minX) * scaleX,
      y: (vertex.y - minY) * scaleY
    }))
  }

  // Custom behavior for polygon-specific properties
  protected override onFlip(
    shape: PolygonShape, 
    // _isFlippedX: boolean,
    // _isFlippedY: boolean,
    // _scaleX: number,
    // _scaleY: number
  ): PolygonShape {
    // For polygons, we don't need to adjust any properties during flipping
    // The flip is handled by CSS transform in the component
    return shape
  }

  override canResize = () => true as const
  override canBind = () => true as const
}