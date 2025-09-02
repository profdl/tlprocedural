import { HTMLContainer, T, type TLBaseShape, type RecordProps } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type TriangleShape = TLBaseShape<
  'triangle',
  {
    w: number
    h: number
    color: string
    strokeWidth: number
    fill: boolean
  }
>

export class TriangleShapeUtil extends FlippableShapeUtil<TriangleShape> {
  static override type = 'triangle' as const

  static override props: RecordProps<TriangleShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
  }

  override getDefaultProps(): TriangleShape['props'] {
    return {
      w: 120,
      h: 100,
      color: '#000000',
      strokeWidth: 1,
      fill: false,
    }
  }

  override component(shape: TriangleShape) {
    const { w, h, color, strokeWidth, fill } = shape.props
    
    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)
    
    // Create triangle path - equilateral triangle pointing up
    const pathData = `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`
    
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

  override indicator(shape: TriangleShape) {
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

  getBounds(shape: TriangleShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: TriangleShape) {
    return {
      x: shape.props.w / 2,
      y: shape.props.h / 2,
    }
  }

  getOutline(shape: TriangleShape) {
    const { w, h } = shape.props
    return [
      { x: w / 2, y: 0 },    // Top point
      { x: w, y: h },        // Bottom right
      { x: 0, y: h },        // Bottom left
    ]
  }

  // Custom flip behavior for triangle-specific properties
  protected override onFlipCustom(
    shape: TriangleShape, 
    _direction: 'horizontal' | 'vertical',
    _isFlippedX: boolean, 
    _isFlippedY: boolean
  ): TriangleShape {
    // For triangles, we don't want to adjust any properties during flipping
    // Just return the shape as-is with the flip metadata already set by FlippableShapeUtil
    return shape
  }

  override canResize = () => true as const
  override canBind = () => false as const
}
