import { HTMLContainer, T, type TLBaseShape, type RecordProps, type VecLike } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type StarShape = TLBaseShape<
  'star',
  {
    w: number
    h: number
    points: number
    innerRadius: number
    color: string
    fillColor: string
    strokeWidth: number
    fill: boolean
    pathData?: VecLike[] // Optional path data for modified stars
    renderAsPath?: boolean // Flag to render as path instead of geometry
  }
>

export class StarShapeUtil extends FlippableShapeUtil<StarShape> {
  static override type = 'star' as const

  static override props: RecordProps<StarShape> = {
    w: T.number,
    h: T.number,
    points: T.number,
    innerRadius: T.number,
    color: T.string,
    fillColor: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
    pathData: T.optional(T.arrayOf(T.object({
      x: T.number,
      y: T.number,
    }))),
    renderAsPath: T.optional(T.boolean),
  }

  override getDefaultProps(): StarShape['props'] {
    return {
      w: 100,
      h: 100,
      points: 5,
      innerRadius: 0.4,
      ...this.getCommonDefaultProps(),
    }
  }

  override component(shape: StarShape) {
    const { w, h, color, fillColor, strokeWidth, fill, pathData, renderAsPath } = shape.props

    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)

    let pathDataStr: string

    if (renderAsPath && pathData && pathData.length >= 3) {
      // Render from modified path points
      pathDataStr = this.pointsToPath(pathData)
    } else {
      // Use the same scaling logic as getOutline to ensure visual consistency
      const outline = this.getOutline(shape)
      const pointsStr = outline.map(p => `${p.x},${p.y}`)
      pathDataStr = `M ${pointsStr.join(' L ')} Z`
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
          <path
            d={pathDataStr}
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

  getBounds(shape: StarShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: StarShape) {
    const bounds = this.getBounds(shape)
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
    }
  }

  getOutline(shape: StarShape) {
    const { w, h, points, innerRadius } = shape.props
    const centerX = w / 2
    const centerY = h / 2
    const outerRadius = Math.min(w, h) / 2
    const innerRadiusActual = outerRadius * innerRadius

    // Calculate star vertices (alternating between outer and inner points)
    const vertices = []
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2
      const radius = i % 2 === 0 ? outerRadius : innerRadiusActual
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
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

  // Custom behavior for star-specific properties
  protected override onFlip(shape: StarShape): StarShape {
    // For stars, we don't need to adjust any properties during flipping
    // The flip is handled by CSS transform in the component
    return shape
  }

  override canResize = () => true as const
  override canBind = () => true as const
}