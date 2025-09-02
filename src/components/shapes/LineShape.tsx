import { HTMLContainer, T, type TLBaseShape, type RecordProps, type TLHandle } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type LineShape = TLBaseShape<
  'custom-line',
  {
    w: number
    h: number
    color: string
    strokeWidth: number
    dash: 'solid' | 'dashed' | 'dotted'
    startX: number
    startY: number
    endX: number
    endY: number
  }
>

export class LineShapeUtil extends FlippableShapeUtil<LineShape> {
  static override type = 'custom-line' as const

  static override props: RecordProps<LineShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    strokeWidth: T.number,
    dash: T.literalEnum('solid', 'dashed', 'dotted'),
    startX: T.number,
    startY: T.number,
    endX: T.number,
    endY: T.number,
  }

  override getDefaultProps(): LineShape['props'] {
    return {
      w: 100,
      h: 100,
      color: '#000000',
      strokeWidth: 2,
      dash: 'solid',
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100,
    }
  }

  override component(shape: LineShape) {
    const { startX, startY, endX, endY, color, strokeWidth, dash } = shape.props
    
    const strokeDasharray = {
      solid: 'none',
      dashed: '8 4',
      dotted: '2 2'
    }[dash]

    return (
      <HTMLContainer>
        <svg 
          width={shape.props.w} 
          height={shape.props.h} 
          style={{ overflow: 'visible' }}
        >
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
          />
        </svg>
      </HTMLContainer>
    )
  }

  override indicator(shape: LineShape) {
    const { startX, startY, endX, endY } = shape.props
    return (
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="var(--color-selection-stroke)"
        strokeWidth={1}
      />
    )
  }

  getBounds(shape: LineShape) {
    const { startX, startY, endX, endY } = shape.props
    const minX = Math.min(startX, endX)
    const minY = Math.min(startY, endY)
    const maxX = Math.max(startX, endX)
    const maxY = Math.max(startY, endY)
    
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    }
  }

  getCenter(shape: LineShape) {
    const { startX, startY, endX, endY } = shape.props
    return {
      x: (startX + endX) / 2,
      y: (startY + endY) / 2,
    }
  }

  getOutline(shape: LineShape) {
    const { startX, startY, endX, endY } = shape.props
    return [
      { x: startX, y: startY },
      { x: endX, y: endY },
    ]
  }

  // Handle management for interactive line endpoints
  override getHandles(shape: LineShape): TLHandle[] {
    const { startX, startY, endX, endY } = shape.props
    
    return [
      {
        id: 'start',
        type: 'vertex',
        index: 'a1' as any,
        x: startX,
        y: startY,
      },
      {
        id: 'end',
        type: 'vertex',
        index: 'a2' as any,
        x: endX,
        y: endY,
      },
    ]
  }

  // Handle updates when handles are moved
  onHandleChange = (shape: LineShape, { handle }: { handle: TLHandle }) => {
    const { startX, startY, endX, endY } = shape.props
    
    let newStartX = startX
    let newStartY = startY
    let newEndX = endX
    let newEndY = endY
    
    if (handle.id === 'start') {
      newStartX = handle.x
      newStartY = handle.y
    } else if (handle.id === 'end') {
      newEndX = handle.x
      newEndY = handle.y
    }
    
    // Update bounding box
    const minX = Math.min(newStartX, newEndX)
    const minY = Math.min(newStartY, newEndY)
    const maxX = Math.max(newStartX, newEndX)
    const maxY = Math.max(newStartY, newEndY)
    
    return {
      ...shape,
      props: {
        ...shape.props,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
        startX: newStartX - minX,
        startY: newStartY - minY,
        endX: newEndX - minX,
        endY: newEndY - minY,
      },
      x: shape.x + minX,
      y: shape.y + minY,
    }
  }

  override canResize = () => true as const
  override canBind = () => true as const
}