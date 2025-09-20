import { HTMLContainer, T, type TLBaseShape, type RecordProps, type TLHandle, type IndexKey, type VecLike } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type DrawShape = TLBaseShape<
  'custom-draw',
  {
    w: number
    h: number
    color: string
    fillColor: string
    strokeWidth: number
    segments: Array<{
      type: 'move' | 'line'
      x: number
      y: number
    }>
    isClosed: boolean
    smoothing: number
    editMode?: boolean
    points?: VecLike[] // Optional path data for modified draw shapes
    renderAsPath?: boolean // Flag to render as path instead of geometry
  }
>

export class DrawShapeUtil extends FlippableShapeUtil<DrawShape> {
  static override type = 'custom-draw' as const

  static override props: RecordProps<DrawShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    fillColor: T.string,
    strokeWidth: T.number,
    segments: T.arrayOf(T.object({
      type: T.literalEnum('move', 'line'),
      x: T.number,
      y: T.number,
    })),
    isClosed: T.boolean,
    smoothing: T.number,
    editMode: T.optional(T.boolean),
  }

  override getDefaultProps(): DrawShape['props'] {
    return {
      w: 1,
      h: 1,
      segments: [],
      isClosed: false,
      smoothing: 0.5,
      ...this.getCommonDefaultProps(),
    }
  }

  override component(shape: DrawShape) {
    const { segments, color, fillColor, strokeWidth, smoothing, isClosed, editMode } = shape.props
    
    if (segments.length < 2) {
      return <HTMLContainer><svg width={shape.props.w} height={shape.props.h}></svg></HTMLContainer>
    }

    // Convert segments to SVG path
    const pathData = this.segmentsToPath(segments, smoothing, isClosed)

    return (
      <HTMLContainer style={{ cursor: editMode ? 'crosshair' : 'default' }}>
        <svg 
          width={shape.props.w} 
          height={shape.props.h} 
          style={{ overflow: 'visible' }}
        >
          <path
            d={pathData}
            fill={isClosed ? fillColor : 'none'}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={editMode ? '5 3' : undefined}
            opacity={editMode ? 0.8 : 1}
          />
          
          {/* Show points when in edit mode */}
          {editMode && (
            <g opacity={0.8}>
              {segments.map((segment, i) => (
                <circle
                  key={i}
                  cx={segment.x}
                  cy={segment.y}
                  r={4}
                  fill="white"
                  stroke="#0066ff"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
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

  // Handle management for interactive path editing
  override getHandles(shape: DrawShape): TLHandle[] {
    const handles: TLHandle[] = []
    
    shape.props.segments.forEach((segment, i) => {
      handles.push({
        id: `point-${i}`,
        type: 'vertex',
        index: `a${i}` as IndexKey,
        x: segment.x,
        y: segment.y,
        canSnap: true,
      })
    })
    
    return handles
  }

  // Handle updates when handles are moved
  override onHandleDrag = (shape: DrawShape, { handle }: { handle: TLHandle }) => {
    const newSegments = [...shape.props.segments]
    
    // Parse handle ID to get segment index
    const match = handle.id.match(/point-(\d+)/)
    if (!match) return shape
    
    const segmentIndex = parseInt(match[1])
    if (segmentIndex >= 0 && segmentIndex < newSegments.length) {
      newSegments[segmentIndex] = {
        ...newSegments[segmentIndex],
        x: handle.x,
        y: handle.y,
      }
    }
    
    // Recalculate bounds
    const xs = newSegments.map(s => s.x)
    const ys = newSegments.map(s => s.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    
    // Normalize segments to local coordinates
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

  // Double-click to enter/exit edit mode
  override onDoubleClick = (shape: DrawShape) => {
    return {
      ...shape,
      props: {
        ...shape.props,
        editMode: !shape.props.editMode,
      }
    }
  }

  // Allow resize for flipping support
  override canResize = () => true as const
  override canBind = () => false as const
}