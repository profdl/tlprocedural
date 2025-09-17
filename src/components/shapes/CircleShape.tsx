import { HTMLContainer, T, type TLBaseShape, type RecordProps, type VecLike } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type CircleShape = TLBaseShape<
  'circle',
  {
    w: number
    h: number
    color: string
    strokeWidth: number
    fill: boolean
    points?: VecLike[] // Optional path data for modified circles
    renderAsPath?: boolean // Flag to render as path instead of geometry
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
    points: T.optional(T.arrayOf(T.object({
      x: T.number,
      y: T.number,
    }))),
    renderAsPath: T.optional(T.boolean),
  }

  override getDefaultProps(): CircleShape['props'] {
    return {
      w: 100,
      h: 100,
      color: '#000000',
      strokeWidth: 1,
      fill: false,
    }
  }

  override component(shape: CircleShape) {
    const { w, h, color, strokeWidth, fill, points, renderAsPath } = shape.props
    
    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)
    
    if (renderAsPath && points && points.length >= 3) {
      // Render from modified path points
      const pathData = this.pointsToPath(points)
      
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
    } else {
      // Render original circle geometry
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
  }

  // Convert points array to SVG path string
  private pointsToPath(points: VecLike[]): string {
    if (points.length === 0) return ''
    
    const commands: string[] = []
    commands.push(`M ${points[0].x} ${points[0].y}`)
    
    for (let i = 1; i < points.length; i++) {
      commands.push(`L ${points[i].x} ${points[i].y}`)
    }
    
    commands.push('Z') // Close the path
    return commands.join(' ')
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
    const { w, h, points, renderAsPath } = shape.props
    
    if (renderAsPath && points && points.length >= 3) {
      // Return the modified path points
      return points
    }
    
    // Return original circle outline
    const rx = w / 2
    const ry = h / 2
    const cx = rx
    const cy = ry
    
    // Approximate ellipse outline with points
    const outlinePoints = []
    const numPoints = 32
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI
      const x = cx + rx * Math.cos(angle)
      const y = cy + ry * Math.sin(angle)
      outlinePoints.push({ x, y })
    }
    
    return outlinePoints
  }

  // Custom behavior for circle-specific properties
  protected override onFlipCustom(
    shape: CircleShape, 
    // _direction: 'horizontal' | 'vertical',
    // _isFlippedX: boolean,
    // _isFlippedY: boolean
  ): CircleShape {
    // For circles/ellipses, flipping doesn't require any special property adjustments
    return shape
  }

  override canResize = () => true as const
  override canBind = () => true as const
}