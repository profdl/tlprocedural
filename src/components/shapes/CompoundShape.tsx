import { HTMLContainer, T, type TLBaseShape, type RecordProps, type TLShapeId } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

/**
 * Child shape data for compound shape
 */
export interface ChildShapeData {
  id: TLShapeId
  type: string
  relativeX: number // Position relative to compound shape origin
  relativeY: number
  relativeRotation: number // Rotation relative to compound shape
  props: Record<string, unknown> // Shape-specific properties
}

/**
 * CompoundShape - Contains multiple child shapes and treats them as single entity
 * Used primarily for multi-shape boolean operations
 */
export type CompoundShape = TLBaseShape<
  'compound',
  {
    w: number
    h: number
    color: string
    fillColor: string
    strokeWidth: number
    fill: boolean
    childShapes: ChildShapeData[] // Array of child shapes with relative positions
    boundingBoxVisible?: boolean // Whether to show compound bounding box
  }
>

export class CompoundShapeUtil extends FlippableShapeUtil<CompoundShape> {
  static override type = 'compound' as const

  static override props: RecordProps<CompoundShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    fillColor: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
    childShapes: T.arrayOf(T.object({
      id: T.string,
      type: T.string,
      relativeX: T.number,
      relativeY: T.number,
      relativeRotation: T.number,
      props: T.any
    })),
    boundingBoxVisible: T.optional(T.boolean),
  }

  override getDefaultProps(): CompoundShape['props'] {
    return {
      w: 100,
      h: 100,
      childShapes: [],
      boundingBoxVisible: false,
      ...this.getCommonDefaultProps(),
    }
  }

  override component(shape: CompoundShape) {
    const { w, h, color, fillColor, strokeWidth, fill, childShapes, boundingBoxVisible } = shape.props

    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)

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
          {/* Render bounding box if visible */}
          {boundingBoxVisible && (
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray="4,4"
              opacity={0.5}
            />
          )}

          {/* Render each child shape */}
          {childShapes.map((child, index) => (
            <g
              key={`${child.id}-${index}`}
              transform={`translate(${child.relativeX}, ${child.relativeY}) rotate(${child.relativeRotation * 180 / Math.PI})`}
            >
              {this.renderChildShape(child)}
            </g>
          ))}
        </svg>
      </HTMLContainer>
    )
  }

  /**
   * Render individual child shape based on its type
   */
  private renderChildShape(child: ChildShapeData): JSX.Element {
    const { type, props } = child

    switch (type) {
      case 'geo':
        return this.renderGeoShape(props)
      case 'draw':
        return this.renderDrawShape(props)
      case 'circle':
        return this.renderCircleShape(props)
      case 'triangle':
        return this.renderTriangleShape(props)
      case 'polygon':
        return this.renderPolygonShape(props)
      case 'bezier':
        return this.renderBezierShape(props)
      default:
        // Fallback for unknown shape types
        return this.renderFallbackShape(props)
    }
  }

  private renderGeoShape(props: Record<string, unknown>): JSX.Element {
    const { w, h, color, fillColor, fill, strokeWidth } = props
    return (
      <rect
        width={w as number}
        height={h as number}
        fill={fill ? (fillColor as string) : 'none'}
        stroke={color as string}
        strokeWidth={strokeWidth as number}
      />
    )
  }

  private renderDrawShape(props: Record<string, unknown>): JSX.Element {
    const { segments, color, strokeWidth } = props
    if (!segments || !Array.isArray(segments)) {
      return <g /> // Empty group for invalid draw shape
    }

    // Convert draw segments to path data
    let pathData = ''
    segments.forEach((segment: any, index: number) => {
      if (segment.points && segment.points.length > 0) {
        const firstPoint = segment.points[0]
        pathData += `${index === 0 ? 'M' : 'L'} ${firstPoint.x} ${firstPoint.y}`

        segment.points.slice(1).forEach((point: any) => {
          pathData += ` L ${point.x} ${point.y}`
        })
      }
    })

    return (
      <path
        d={pathData}
        fill="none"
        stroke={color as string}
        strokeWidth={strokeWidth as number}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  private renderCircleShape(props: Record<string, unknown>): JSX.Element {
    const { w, h, color, fillColor, fill, strokeWidth } = props
    const rx = (w as number) / 2
    const ry = (h as number) / 2

    return (
      <ellipse
        cx={rx}
        cy={ry}
        rx={rx}
        ry={ry}
        fill={fill ? (fillColor as string) : 'none'}
        stroke={color as string}
        strokeWidth={strokeWidth as number}
      />
    )
  }

  private renderTriangleShape(props: Record<string, unknown>): JSX.Element {
    const { w, h, color, fillColor, fill, strokeWidth } = props
    const width = w as number
    const height = h as number

    // Standard triangle points
    const points = `${width / 2},0 0,${height} ${width},${height}`

    return (
      <polygon
        points={points}
        fill={fill ? (fillColor as string) : 'none'}
        stroke={color as string}
        strokeWidth={strokeWidth as number}
      />
    )
  }

  private renderPolygonShape(props: Record<string, unknown>): JSX.Element {
    const { points, color, fillColor, fill, strokeWidth } = props

    if (!points || !Array.isArray(points)) {
      return <g /> // Empty group for invalid polygon
    }

    const pointsString = (points as Array<{ x: number; y: number }>)
      .map(p => `${p.x},${p.y}`)
      .join(' ')

    return (
      <polygon
        points={pointsString}
        fill={fill ? (fillColor as string) : 'none'}
        stroke={color as string}
        strokeWidth={strokeWidth as number}
      />
    )
  }

  private renderBezierShape(props: Record<string, unknown>): JSX.Element {
    const { points, color, fillColor, fill, strokeWidth, isClosed } = props

    if (!points || !Array.isArray(points)) {
      return <g /> // Empty group for invalid bezier
    }

    // Convert bezier points to path data
    let pathData = ''
    (points as Array<any>).forEach((point, index) => {
      if (index === 0) {
        pathData += `M ${point.x} ${point.y}`
      } else {
        if (point.cp1 && point.cp2) {
          // Cubic bezier curve
          pathData += ` C ${point.cp1.x} ${point.cp1.y} ${point.cp2.x} ${point.cp2.y} ${point.x} ${point.y}`
        } else {
          // Line to
          pathData += ` L ${point.x} ${point.y}`
        }
      }
    })

    if (isClosed) {
      pathData += ' Z'
    }

    return (
      <path
        d={pathData}
        fill={fill && isClosed ? (fillColor as string) : 'none'}
        stroke={color as string}
        strokeWidth={strokeWidth as number}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  private renderFallbackShape(props: Record<string, unknown>): JSX.Element {
    const { w = 50, h = 50, color = '#999', strokeWidth = 1 } = props

    // Render a simple rectangle with an X for unknown shapes
    return (
      <g>
        <rect
          width={w as number}
          height={h as number}
          fill="none"
          stroke={color as string}
          strokeWidth={strokeWidth as number}
          strokeDasharray="2,2"
        />
        <path
          d={`M 0 0 L ${w} ${h} M ${w} 0 L 0 ${h}`}
          stroke={color as string}
          strokeWidth={(strokeWidth as number) / 2}
          opacity={0.5}
        />
      </g>
    )
  }

  /**
   * Create compound shape from multiple selected shapes
   */
  static createFromShapes(shapes: Array<{ shape: any; relativePosition: { x: number; y: number } }>): Omit<CompoundShape['props'], keyof typeof FlippableShapeUtil.prototype.getCommonDefaultProps> {
    // Calculate overall bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    shapes.forEach(({ shape, relativePosition }) => {
      const shapeMinX = relativePosition.x
      const shapeMinY = relativePosition.y
      const shapeMaxX = relativePosition.x + (shape.props?.w || 0)
      const shapeMaxY = relativePosition.y + (shape.props?.h || 0)

      minX = Math.min(minX, shapeMinX)
      minY = Math.min(minY, shapeMinY)
      maxX = Math.max(maxX, shapeMaxX)
      maxY = Math.max(maxY, shapeMaxY)
    })

    const w = maxX - minX
    const h = maxY - minY

    // Create child shape data
    const childShapes: ChildShapeData[] = shapes.map(({ shape, relativePosition }) => ({
      id: shape.id,
      type: shape.type,
      relativeX: relativePosition.x - minX,
      relativeY: relativePosition.y - minY,
      relativeRotation: shape.rotation || 0,
      props: shape.props || {}
    }))

    return {
      w,
      h,
      childShapes,
      boundingBoxVisible: false
    }
  }
}