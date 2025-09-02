import { BaseBoxShapeUtil, HTMLContainer, T, type TLBaseShape, type RecordProps, type TLHandle } from 'tldraw'

export interface BezierPoint {
  x: number
  y: number
  cp1?: { x: number; y: number } // Control point 1 (incoming)
  cp2?: { x: number; y: number } // Control point 2 (outgoing)
}

export type BezierShape = TLBaseShape<
  'bezier',
  {
    w: number
    h: number
    color: string
    strokeWidth: number
    fill: boolean
    points: BezierPoint[]
    isClosed: boolean
  }
>

export class BezierShapeUtil extends BaseBoxShapeUtil<BezierShape> {
  static override type = 'bezier' as const

  static override props: RecordProps<BezierShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
    points: T.arrayOf(T.object({
      x: T.number,
      y: T.number,
      cp1: T.optional(T.object({
        x: T.number,
        y: T.number,
      })),
      cp2: T.optional(T.object({
        x: T.number,
        y: T.number,
      })),
    })),
    isClosed: T.boolean,
  }

  override getDefaultProps(): BezierShape['props'] {
    return {
      w: 1,
      h: 1,
      color: '#000000',
      strokeWidth: 2,
      fill: false,
      points: [],
      isClosed: false,
    }
  }

  override component(shape: BezierShape) {
    const { points, color, strokeWidth, fill, isClosed } = shape.props
    
    if (points.length < 2) {
      return <HTMLContainer><svg width={shape.props.w} height={shape.props.h}></svg></HTMLContainer>
    }

    // Convert points to SVG path
    const pathData = this.pointsToPath(points, isClosed)

    return (
      <HTMLContainer>
        <svg 
          width={shape.props.w} 
          height={shape.props.h} 
          style={{ overflow: 'visible' }}
        >
          <path
            d={pathData}
            fill={isClosed && fill ? color : 'none'}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Show control points when selected (optional visual aid) */}
          {false && (
            <g opacity={0.6}>
              {points.map((point, i) => (
                <g key={i}>
                  {/* Control point lines */}
                  {point.cp1 && (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={point.cp1.x}
                      y2={point.cp1.y}
                      stroke="#0066ff"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  )}
                  {point.cp2 && (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={point.cp2.x}
                      y2={point.cp2.y}
                      stroke="#0066ff"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  )}
                  
                  {/* Control point handles */}
                  {point.cp1 && (
                    <circle
                      cx={point.cp1.x}
                      cy={point.cp1.y}
                      r={3}
                      fill="#0066ff"
                      stroke="white"
                      strokeWidth={1}
                    />
                  )}
                  {point.cp2 && (
                    <circle
                      cx={point.cp2.x}
                      cy={point.cp2.y}
                      r={3}
                      fill="#0066ff"
                      stroke="white"
                      strokeWidth={1}
                    />
                  )}
                  
                  {/* Anchor points */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={4}
                    fill="white"
                    stroke="#0066ff"
                    strokeWidth={2}
                  />
                </g>
              ))}
            </g>
          )}
        </svg>
      </HTMLContainer>
    )
  }

  private pointsToPath(points: BezierPoint[], isClosed: boolean): string {
    if (points.length === 0) return ''
    
    const commands: string[] = []
    const firstPoint = points[0]
    commands.push(`M ${firstPoint.x} ${firstPoint.y}`)
    
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1]
      const currPoint = points[i]
      
      if (prevPoint.cp2 && currPoint.cp1) {
        // Cubic Bézier curve
        commands.push(`C ${prevPoint.cp2.x} ${prevPoint.cp2.y} ${currPoint.cp1.x} ${currPoint.cp1.y} ${currPoint.x} ${currPoint.y}`)
      } else if (prevPoint.cp2) {
        // Quadratic Bézier curve (using only outgoing control point)
        commands.push(`Q ${prevPoint.cp2.x} ${prevPoint.cp2.y} ${currPoint.x} ${currPoint.y}`)
      } else if (currPoint.cp1) {
        // Quadratic Bézier curve (using only incoming control point)
        commands.push(`Q ${currPoint.cp1.x} ${currPoint.cp1.y} ${currPoint.x} ${currPoint.y}`)
      } else {
        // Straight line
        commands.push(`L ${currPoint.x} ${currPoint.y}`)
      }
    }
    
    if (isClosed && points.length > 2) {
      // Close the path with appropriate curve if needed
      const lastPoint = points[points.length - 1]
      const firstPoint = points[0]
      
      if (lastPoint.cp2 && firstPoint.cp1) {
        commands.push(`C ${lastPoint.cp2.x} ${lastPoint.cp2.y} ${firstPoint.cp1.x} ${firstPoint.cp1.y} ${firstPoint.x} ${firstPoint.y}`)
      }
      commands.push('Z')
    }
    
    return commands.join(' ')
  }

  override indicator(shape: BezierShape) {
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

  getBounds(shape: BezierShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: BezierShape) {
    return {
      x: shape.props.w / 2,
      y: shape.props.h / 2,
    }
  }

  getOutline(shape: BezierShape) {
    const { points } = shape.props
    return points.map(p => ({ x: p.x, y: p.y }))
  }

  // Handle management for interactive bezier points
  override getHandles(shape: BezierShape): TLHandle[] {
    const handles: TLHandle[] = []
    
    shape.props.points.forEach((point, i) => {
      // Anchor point handle
      handles.push({
        id: `anchor-${i}`,
        type: 'vertex',
        index: `a${i}` as any,
        x: point.x,
        y: point.y,
      })
      
      // Control point handles
      if (point.cp1) {
        handles.push({
          id: `cp1-${i}`,
          type: 'virtual',
          index: `cp1-${i}` as any,
          x: point.cp1.x,
          y: point.cp1.y,
        })
      }
      
      if (point.cp2) {
        handles.push({
          id: `cp2-${i}`,
          type: 'virtual',
          index: `cp2-${i}` as any,
          x: point.cp2.x,
          y: point.cp2.y,
        })
      }
    })
    
    return handles
  }

  // Helper method to add a point to the bezier curve
  static addPoint(shape: BezierShape, point: BezierPoint): BezierShape {
    const newPoints = [...shape.props.points, point]
    
    // Update bounds to include new point and control points
    const allPoints = newPoints.flatMap(p => [
      { x: p.x, y: p.y },
      ...(p.cp1 ? [p.cp1] : []),
      ...(p.cp2 ? [p.cp2] : [])
    ])
    
    const allX = allPoints.map(p => p.x)
    const allY = allPoints.map(p => p.y)
    const minX = Math.min(...allX)
    const minY = Math.min(...allY)
    const maxX = Math.max(...allX)
    const maxY = Math.max(...allY)
    
    // Normalize points relative to the new bounds
    const normalizedPoints = newPoints.map(p => ({
      x: p.x - minX,
      y: p.y - minY,
      cp1: p.cp1 ? { x: p.cp1.x - minX, y: p.cp1.y - minY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - minX, y: p.cp2.y - minY } : undefined,
    }))
    
    return {
      ...shape,
      props: {
        ...shape.props,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
        points: normalizedPoints,
      },
      x: shape.x + minX,
      y: shape.y + minY,
    }
  }

  override canResize = () => false as const // Bezier shapes shouldn't be resized directly
  override canBind = () => true as const
}