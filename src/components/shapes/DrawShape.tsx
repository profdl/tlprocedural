import { BaseBoxShapeUtil, HTMLContainer, T, type TLBaseShape, type RecordProps } from 'tldraw'

export type DrawShape = TLBaseShape<
  'custom-draw',
  {
    w: number
    h: number
    color: string
    strokeWidth: number
    segments: Array<{
      type: 'move' | 'line'
      x: number
      y: number
    }>
    isClosed: boolean
    smoothing: number
  }
>

export class DrawShapeUtil extends BaseBoxShapeUtil<DrawShape> {
  static override type = 'custom-draw' as const

  static override props: RecordProps<DrawShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    strokeWidth: T.number,
    segments: T.arrayOf(T.object({
      type: T.literalEnum('move', 'line'),
      x: T.number,
      y: T.number,
    })),
    isClosed: T.boolean,
    smoothing: T.number,
  }

  override getDefaultProps(): DrawShape['props'] {
    return {
      w: 1,
      h: 1,
      color: '#000000',
      strokeWidth: 2,
      segments: [],
      isClosed: false,
      smoothing: 0.5,
    }
  }

  override component(shape: DrawShape) {
    const { segments, color, strokeWidth, smoothing, isClosed } = shape.props
    
    if (segments.length < 2) {
      return <HTMLContainer><svg width={shape.props.w} height={shape.props.h}></svg></HTMLContainer>
    }

    // Convert segments to SVG path
    const pathData = this.segmentsToPath(segments, smoothing, isClosed)

    return (
      <HTMLContainer>
        <svg 
          width={shape.props.w} 
          height={shape.props.h} 
          style={{ overflow: 'visible' }}
        >
          <path
            d={pathData}
            fill={isClosed ? color : 'none'}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </HTMLContainer>
    )
  }

  private segmentsToPath(segments: DrawShape['props']['segments'], smoothing: number, isClosed: boolean): string {
    if (segments.length === 0) return ''
    
    const commands: string[] = []
    
    // Start with the first point
    const firstPoint = segments[0]
    commands.push(`M ${firstPoint.x} ${firstPoint.y}`)
    
    if (smoothing > 0 && segments.length > 2) {
      // Create smooth curves using quadratic Bézier curves
      for (let i = 1; i < segments.length - 1; i++) {
        const curr = segments[i]
        const next = segments[i + 1]
        
        // Control point for smoothing
        const cpX = curr.x + (next.x - curr.x) * smoothing * 0.5
        const cpY = curr.y + (next.y - curr.y) * smoothing * 0.5
        
        commands.push(`Q ${curr.x} ${curr.y} ${cpX} ${cpY}`)
      }
      
      // Final point
      if (segments.length > 1) {
        const lastPoint = segments[segments.length - 1]
        commands.push(`L ${lastPoint.x} ${lastPoint.y}`)
      }
    } else {
      // Simple line segments
      for (let i = 1; i < segments.length; i++) {
        const point = segments[i]
        commands.push(`L ${point.x} ${point.y}`)
      }
    }
    
    if (isClosed && segments.length > 2) {
      commands.push('Z')
    }
    
    return commands.join(' ')
  }

  override indicator(shape: DrawShape) {
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

  getBounds(shape: DrawShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: DrawShape) {
    return {
      x: shape.props.w / 2,
      y: shape.props.h / 2,
    }
  }

  getOutline(shape: DrawShape) {
    const { segments } = shape.props
    return segments.map(seg => ({ x: seg.x, y: seg.y }))
  }

  // Helper method to add a point to the drawing
  static addPoint(shape: DrawShape, point: { x: number; y: number }, type: 'move' | 'line' = 'line'): DrawShape {
    const newSegments = [...shape.props.segments, { type, x: point.x, y: point.y }]
    
    // Update bounds to include new point
    const allX = newSegments.map(s => s.x)
    const allY = newSegments.map(s => s.y)
    const minX = Math.min(...allX)
    const minY = Math.min(...allY)
    const maxX = Math.max(...allX)
    const maxY = Math.max(...allY)
    
    // Normalize points relative to the new bounds
    const normalizedSegments = newSegments.map(s => ({
      ...s,
      x: s.x - minX,
      y: s.y - minY,
    }))
    
    return {
      ...shape,
      props: {
        ...shape.props,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
        segments: normalizedSegments,
      },
      x: shape.x + minX,
      y: shape.y + minY,
    }
  }

  override canResize = () => false as const // Drawing shapes shouldn't be resized
  override canBind = () => false as const
}