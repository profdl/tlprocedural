import { HTMLContainer, T, type TLBaseShape, type RecordProps } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type CircleShape = TLBaseShape<
  'circle',
  {
    w: number
    h: number
    color: string
    strokeWidth: number
    fill: boolean
  }
>

export class CircleShapeUtil extends FlippableShapeUtil<CircleShape> {
  static override type = 'circle' as const

  static override props: RecordProps<CircleShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
  }

  override getDefaultProps(): CircleShape['props'] {
    return {
      w: 100,
      h: 100,
      color: '#000000',
      strokeWidth: 2,
      fill: false,
    }
  }

  override component(shape: CircleShape) {
    const { w, h, color, strokeWidth, fill } = shape.props
    
    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)
    
    const rx = w / 2
    const ry = h / 2
    const cx = rx
    const cy = ry
    
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
          <ellipse 
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={fill ? color : 'none'} 
            stroke={color} 
            strokeWidth={strokeWidth}
          />
        </svg>
      </HTMLContainer>
    )
  }

  override indicator(shape: CircleShape) {
    return (
      <rect 
        width={shape.props.w} 
        height={shape.props.h} 
        fill="none" 
        stroke="var(--color-selection-stroke)" 
        strokeWidth={1}
      />
    )
  }

  getBounds(shape: CircleShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: CircleShape) {
    return {
      x: shape.props.w / 2,
      y: shape.props.h / 2,
    }
  }

  getOutline(shape: CircleShape) {
    const { w, h } = shape.props
    const rx = w / 2
    const ry = h / 2
    const cx = rx
    const cy = ry
    
    // Approximate ellipse outline with points
    const points = []
    const numPoints = 32
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI
      const x = cx + rx * Math.cos(angle)
      const y = cy + ry * Math.sin(angle)
      points.push({ x, y })
    }
    
    return points
  }

  // Custom behavior for circle-specific properties
  protected override onFlip(
    shape: CircleShape, 
    _isFlippedX: boolean, 
    _isFlippedY: boolean, 
    _scaleX: number, 
    _scaleY: number
  ): CircleShape {
    // For circles/ellipses, flipping doesn't require any special property adjustments
    return shape
  }

  override canResize = () => true as const
  override canBind = () => true as const
}