import { HTMLContainer, T, type TLBaseShape, type RecordProps, type TLShapeId, type TLShape } from 'tldraw'
import type { JSX } from 'react'
import type { JsonObject } from '@tldraw/utils'
import type { BezierPoint } from './BezierShape'
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
  props: JsonObject // Shape-specific properties
}

interface DrawPoint {
  x: number
  y: number
}

interface DrawSegment {
  points: DrawPoint[]
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPointArray(value: unknown): value is DrawPoint[] {
  return Array.isArray(value) && value.every(point =>
    point &&
    typeof point === 'object' &&
    typeof (point as Partial<DrawPoint>).x === 'number' &&
    typeof (point as Partial<DrawPoint>).y === 'number'
  )
}

function isDrawSegmentArray(value: unknown): value is DrawSegment[] {
  return Array.isArray(value) && value.every(segment =>
    segment &&
    typeof segment === 'object' &&
    isPointArray((segment as Partial<DrawSegment>).points)
  )
}

function isBezierPointArray(value: unknown): value is BezierPoint[] {
  return Array.isArray(value) && value.every(point =>
    point &&
    typeof point === 'object' &&
    typeof (point as Partial<BezierPoint>).x === 'number' &&
    typeof (point as Partial<BezierPoint>).y === 'number'
  )
}

function getNumberProp(obj: JsonObject, key: string, fallback = 0): number {
  const value = obj[key]
  return typeof value === 'number' ? value : fallback
}

function getStringProp(obj: JsonObject, key: string, fallback = ''): string {
  const value = obj[key]
  return typeof value === 'string' ? value : fallback
}

function getBooleanProp(obj: JsonObject, key: string, fallback = false): boolean {
  const value = obj[key]
  return typeof value === 'boolean' ? value : fallback
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

  private static readonly childShapeValidator = T.jsonValue.refine<ChildShapeData>((value) => {
    if (!isJsonObject(value)) {
      throw new Error('Child shape must be a JSON object')
    }

    const { id, type, relativeX, relativeY, relativeRotation, props } = value

    if (typeof id !== 'string' || !id.startsWith('shape:')) {
      throw new Error('Child shape id must be a TLShapeId string')
    }
    if (typeof type !== 'string') {
      throw new Error('Child shape type must be a string')
    }
    if (typeof relativeX !== 'number' || typeof relativeY !== 'number' || typeof relativeRotation !== 'number') {
      throw new Error('Child shape relative transform must be numeric')
    }

    const childProps = isJsonObject(props) ? props : {} as JsonObject

    const child: ChildShapeData = {
      id: id as TLShapeId,
      type,
      relativeX,
      relativeY,
      relativeRotation,
      props: childProps
    }

    return child
  })

  static override props: RecordProps<CompoundShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    fillColor: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
    childShapes: T.arrayOf(CompoundShapeUtil.childShapeValidator),
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
    const { w, h, color, strokeWidth, childShapes, boundingBoxVisible } = shape.props

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

  override indicator(shape: CompoundShape): JSX.Element {
    const { w, h } = shape.props
    return (
      <rect x={0} y={0} width={w} height={h} />
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

  private renderGeoShape(props: JsonObject): JSX.Element {
    const w = getNumberProp(props, 'w')
    const h = getNumberProp(props, 'h')
    const color = getStringProp(props, 'color', '#000')
    const fillColor = getStringProp(props, 'fillColor', 'transparent')
    const fill = getBooleanProp(props, 'fill', false)
    const strokeWidth = getNumberProp(props, 'strokeWidth', 1)
    return (
      <rect
        width={w}
        height={h}
        fill={fill ? fillColor : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    )
  }

  private renderDrawShape(props: JsonObject): JSX.Element {
    const segments = props.segments
    const color = getStringProp(props, 'color', '#000')
    const strokeWidth = getNumberProp(props, 'strokeWidth', 1)
    if (!isDrawSegmentArray(segments)) {
      return <g />
    }

    let pathData = ''
    segments.forEach((segment, index) => {
      if (segment.points.length > 0) {
        const [firstPoint, ...remainingPoints] = segment.points
        pathData += `${index === 0 ? 'M' : 'L'} ${firstPoint.x} ${firstPoint.y}`

        remainingPoints.forEach(point => {
          pathData += ` L ${point.x} ${point.y}`
        })
      }
    })

    return (
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  private renderCircleShape(props: JsonObject): JSX.Element {
    const w = getNumberProp(props, 'w')
    const h = getNumberProp(props, 'h')
    const color = getStringProp(props, 'color', '#000')
    const fillColor = getStringProp(props, 'fillColor', 'transparent')
    const fill = getBooleanProp(props, 'fill', false)
    const strokeWidth = getNumberProp(props, 'strokeWidth', 1)
    const rx = w / 2
    const ry = h / 2

    return (
      <ellipse
        cx={0}
        cy={0}
        rx={rx}
        ry={ry}
        fill={fill ? fillColor : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
        transform={`translate(${rx}, ${ry})`}
      />
    )
  }

  private renderTriangleShape(props: JsonObject): JSX.Element {
    const width = getNumberProp(props, 'w')
    const height = getNumberProp(props, 'h')
    const color = getStringProp(props, 'color', '#000')
    const fillColor = getStringProp(props, 'fillColor', 'transparent')
    const fill = getBooleanProp(props, 'fill', false)
    const strokeWidth = getNumberProp(props, 'strokeWidth', 1)

    // Standard triangle points
    const points = `${width / 2},0 0,${height} ${width},${height}`

    return (
      <polygon
        points={points}
        fill={fill ? fillColor : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    )
  }

  private renderPolygonShape(props: JsonObject): JSX.Element {
    const color = getStringProp(props, 'color', '#000')
    const fillColor = getStringProp(props, 'fillColor', 'transparent')
    const fill = getBooleanProp(props, 'fill', false)
    const strokeWidth = getNumberProp(props, 'strokeWidth', 1)
    const points = props.points

    if (!isPointArray(points)) {
      return <g />
    }

    const pointsString = points.map(p => `${p.x},${p.y}`).join(' ')

    return (
      <polygon
        points={pointsString}
        fill={fill ? fillColor : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    )
  }

  private renderBezierShape(props: JsonObject): JSX.Element {
    const points = props.points
    const color = getStringProp(props, 'color', '#000')
    const fillColor = getStringProp(props, 'fillColor', 'transparent')
    const fill = getBooleanProp(props, 'fill', false)
    const strokeWidth = getNumberProp(props, 'strokeWidth', 1)
    const isClosed = getBooleanProp(props, 'isClosed', false)

    if (!isBezierPointArray(points)) {
      return <g />
    }

    let pathData = ''
    points.forEach((point, index) => {
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
        fill={fill && isClosed ? fillColor : 'none'}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }

  private renderFallbackShape(props: JsonObject): JSX.Element {
    const width = getNumberProp(props, 'w', 50)
    const height = getNumberProp(props, 'h', 50)
    const strokeColor = getStringProp(props, 'color', '#999')
    const stroke = getNumberProp(props, 'strokeWidth', 1)

    // Render a simple rectangle with an X for unknown shapes
    return (
      <g>
        <rect
          width={width}
          height={height}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeDasharray="2,2"
        />
        <path
          d={`M 0 0 L ${width} ${height} M ${width} 0 L 0 ${height}`}
          stroke={strokeColor}
          strokeWidth={stroke / 2}
          opacity={0.5}
        />
      </g>
    )
  }

  /**
   * Create compound shape from multiple selected shapes
   */
  static createFromShapes(shapes: Array<{ shape: TLShape; relativePosition: { x: number; y: number } }>): Pick<CompoundShape['props'], 'w' | 'h' | 'childShapes' | 'boundingBoxVisible'> {
    // Calculate overall bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    shapes.forEach(({ shape, relativePosition }) => {
      const shapeMinX = relativePosition.x
      const shapeMinY = relativePosition.y
      const shapeProps = shape.props as Record<string, unknown>
      const shapeWidth = typeof shapeProps.w === 'number' ? shapeProps.w : 0
      const shapeHeight = typeof shapeProps.h === 'number' ? shapeProps.h : 0
      const shapeMaxX = relativePosition.x + shapeWidth
      const shapeMaxY = relativePosition.y + shapeHeight

      minX = Math.min(minX, shapeMinX)
      minY = Math.min(minY, shapeMinY)
      maxX = Math.max(maxX, shapeMaxX)
      maxY = Math.max(maxY, shapeMaxY)
    })

    const w = maxX - minX
    const h = maxY - minY

    // Create child shape data
    const childShapes: ChildShapeData[] = shapes.map(({ shape, relativePosition }) => {
      const props = shape.props
      const parsedProps = isJsonObject(props) ? props : {} as JsonObject

      return {
        id: shape.id,
        type: shape.type,
        relativeX: relativePosition.x - minX,
        relativeY: relativePosition.y - minY,
        relativeRotation: shape.rotation ?? 0,
        props: parsedProps
      }
    })

    return {
      w,
      h,
      childShapes,
      boundingBoxVisible: false
    }
  }
}
