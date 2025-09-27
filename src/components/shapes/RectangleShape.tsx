import { HTMLContainer, T, type TLBaseShape, type RecordProps, type VecLike } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type RectangleShape = TLBaseShape<
  'rectangle',
  {
    w: number
    h: number
    color: string
    fillColor: string
    strokeWidth: number
    fill: boolean
    cornerRadius?: number
    points?: VecLike[] // Optional path data for modified rectangles
    renderAsPath?: boolean // Flag to render as path instead of geometry
  }
>

export class RectangleShapeUtil extends FlippableShapeUtil<RectangleShape> {
  static override type = 'rectangle' as const

  static override props: RecordProps<RectangleShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    fillColor: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
    cornerRadius: T.optional(T.number),
    points: T.optional(T.arrayOf(T.object({
      x: T.number,
      y: T.number,
    }))),
    renderAsPath: T.optional(T.boolean),
  }

  override getDefaultProps(): RectangleShape['props'] {
    return {
      w: 120,
      h: 80,
      cornerRadius: 0,
      ...this.getCommonDefaultProps(),
    }
  }

  override component(shape: RectangleShape) {
    const { w, h, color, fillColor, strokeWidth, fill, cornerRadius = 0, points, renderAsPath } = shape.props

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
              fill={fill ? fillColor : 'none'}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </HTMLContainer>
      )
    }

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
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            rx={cornerRadius}
            ry={cornerRadius}
            fill={fill ? fillColor : 'none'}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </HTMLContainer>
    )
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

  override indicator() {
    return null
  }

  getBounds(shape: RectangleShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: RectangleShape) {
    const bounds = this.getBounds(shape)
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
    }
  }

  getOutline(shape: RectangleShape) {
    const { w, h } = shape.props

    return [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ]
  }

  // Custom behavior for rectangle-specific properties
  protected override onFlip(shape: RectangleShape): RectangleShape {
    // For rectangles, we don't need to adjust any properties during flipping
    // The flip is handled by CSS transform in the component
    return shape
  }

  override canResize = () => true as const
  override canBind = () => true as const
}