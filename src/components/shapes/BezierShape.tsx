import { HTMLContainer, T, type TLBaseShape, type RecordProps, type TLHandle, useEditor, type Editor } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

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
    editMode?: boolean
  }
>


export class BezierShapeUtil extends FlippableShapeUtil<BezierShape> {
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
    editMode: T.optional(T.boolean),
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
    const { points, color, strokeWidth, fill, isClosed, editMode } = shape.props
    const editor = useEditor()
    
    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)
    
    
    if (points.length < 2) {
      return <HTMLContainer><svg width={shape.props.w} height={shape.props.h}></svg></HTMLContainer>
    }

    // Convert points to SVG path
    const pathData = this.pointsToPath(points, isClosed)

    return (
      <HTMLContainer style={{ cursor: editMode ? 'crosshair' : 'default' }}>
        <svg 
          width={shape.props.w} 
          height={shape.props.h} 
          style={{ 
            overflow: 'visible',
            ...flipTransform
          }}
        >
          <path
            d={pathData}
            fill={isClosed && fill ? color : 'none'}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={editMode ? '5 3' : undefined}
            opacity={editMode ? 0.7 : 1}
            style={{ cursor: editMode ? 'crosshair' : 'default' }}
          />
          
          {/* Show control points and connection lines when in edit mode only */}
          {editMode && (
            <g opacity={0.8}>
              {points.map((point, i) => (
                <g key={i}>
                  {/* Control point lines - draw these first so they appear behind the circles */}
                  {point.cp1 && (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={point.cp1.x}
                      y2={point.cp1.y}
                      stroke="#0066ff"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      opacity={0.5}
                    />
                  )}
                  {point.cp2 && (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={point.cp2.x}
                      y2={point.cp2.y}
                      stroke="#0066ff"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      opacity={0.5}
                    />
                  )}
                  
                  {/* Control point handles */}
                  {point.cp1 && (
                    <circle
                      cx={point.cp1.x}
                      cy={point.cp1.y}
                      r={4}
                      fill="#0066ff"
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  )}
                  {point.cp2 && (
                    <circle
                      cx={point.cp2.x}
                      cy={point.cp2.y}
                      r={4}
                      fill="#0066ff"
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  )}
                  
                  {/* Anchor points - draw these last so they appear on top */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={5}
                    fill="white"
                    stroke="#0066ff"
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
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
    // Only show basic handles for point and control point dragging in edit mode
    if (!shape.props.editMode) return []
    
    const handles: TLHandle[] = []
    
    shape.props.points.forEach((point, i) => {
      // Anchor point handle
      handles.push({
        id: `anchor-${i}`,
        type: 'vertex',
        index: `a${i}` as any,
        x: point.x,
        y: point.y,
        canSnap: true,
      })
      
      // Control point handles
      if (point.cp1) {
        handles.push({
          id: `cp1-${i}`,
          type: 'virtual',
          index: `cp1-${i}` as any,
          x: point.cp1.x,
          y: point.cp1.y,
          canSnap: true,
        })
      }
      
      if (point.cp2) {
        handles.push({
          id: `cp2-${i}`,
          type: 'virtual',
          index: `cp2-${i}` as any,
          x: point.cp2.x,
          y: point.cp2.y,
          canSnap: true,
        })
      }
    })
    
    return handles
  }

  // Handle updates when handles are moved
  override onHandleDrag = (shape: BezierShape, { handle }: { handle: TLHandle }) => {
    const newPoints = [...shape.props.points]
    const altKey = this.editor.inputs.altKey // Alt key breaks symmetry
    
    // Parse handle ID to determine what we're updating
    if (handle.id.startsWith('anchor-')) {
      const pointIndex = parseInt(handle.id.split('-')[1])
      if (pointIndex >= 0 && pointIndex < newPoints.length) {
        // Move the anchor point and mirror both control points relative to the new position
        const oldPoint = newPoints[pointIndex]
        const deltaX = handle.x - oldPoint.x
        const deltaY = handle.y - oldPoint.y
        
        newPoints[pointIndex] = {
          ...oldPoint,
          x: handle.x,
          y: handle.y,
          cp1: oldPoint.cp1 ? { x: oldPoint.cp1.x + deltaX, y: oldPoint.cp1.y + deltaY } : undefined,
          cp2: oldPoint.cp2 ? { x: oldPoint.cp2.x + deltaX, y: oldPoint.cp2.y + deltaY } : undefined,
        }
      }
    } else if (handle.id.startsWith('cp1-')) {
      const pointIndex = parseInt(handle.id.split('-')[1])
      if (pointIndex >= 0 && pointIndex < newPoints.length) {
        const anchorPoint = newPoints[pointIndex]
        
        // Update cp1
        newPoints[pointIndex] = {
          ...anchorPoint,
          cp1: { x: handle.x, y: handle.y },
        }
        
        // Mirror cp2 if it exists and Alt key is not pressed (Illustrator-style symmetric handles)
        if (anchorPoint.cp2 && !altKey) {
          const cp1Vector = { x: handle.x - anchorPoint.x, y: handle.y - anchorPoint.y }
          newPoints[pointIndex].cp2 = {
            x: anchorPoint.x - cp1Vector.x,
            y: anchorPoint.y - cp1Vector.y,
          }
        }
      }
    } else if (handle.id.startsWith('cp2-')) {
      const pointIndex = parseInt(handle.id.split('-')[1])
      if (pointIndex >= 0 && pointIndex < newPoints.length) {
        const anchorPoint = newPoints[pointIndex]
        
        // Update cp2
        newPoints[pointIndex] = {
          ...anchorPoint,
          cp2: { x: handle.x, y: handle.y },
        }
        
        // Mirror cp1 if it exists and Alt key is not pressed (Illustrator-style symmetric handles)
        if (anchorPoint.cp1 && !altKey) {
          const cp2Vector = { x: handle.x - anchorPoint.x, y: handle.y - anchorPoint.y }
          newPoints[pointIndex].cp1 = {
            x: anchorPoint.x - cp2Vector.x,
            y: anchorPoint.y - cp2Vector.y,
          }
        }
      }
    }
    
    // Only recalculate bounds when necessary (not on every handle drag)
    // This prevents the exponential movement issue
    return {
      ...shape,
      props: {
        ...shape.props,
        points: newPoints,
      }
    }
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

  // Custom flip behavior for Bezier curves
  protected override onFlipCustom(
    shape: BezierShape,
    direction: 'horizontal' | 'vertical',
    isFlippedX: boolean,
    isFlippedY: boolean
  ): BezierShape {
    // For Bezier curves, we need to flip the actual point coordinates
    const { w, h } = shape.props
    
    const flippedPoints = shape.props.points.map(point => {
      let newPoint = { ...point }
      
      if (direction === 'horizontal' || isFlippedX) {
        newPoint.x = w - point.x
        if (point.cp1) newPoint.cp1 = { x: w - point.cp1.x, y: point.cp1.y }
        if (point.cp2) newPoint.cp2 = { x: w - point.cp2.x, y: point.cp2.y }
      }
      
      if (direction === 'vertical' || isFlippedY) {
        newPoint.y = h - point.y
        if (point.cp1) newPoint.cp1 = { x: newPoint.cp1?.x || point.cp1.x, y: h - point.cp1.y }
        if (point.cp2) newPoint.cp2 = { x: newPoint.cp2?.x || point.cp2.x, y: h - point.cp2.y }
      }
      
      return newPoint
    })
    
    return {
      ...shape,
      props: {
        ...shape.props,
        points: flippedPoints
      }
    }
  }

  // Double-click to enter/exit edit mode
  override onDoubleClick = (shape: BezierShape) => {
    console.log('Double-click detected, current editMode:', shape.props.editMode)
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        editMode: !shape.props.editMode,
      }
    }
    this.editor.updateShape(updatedShape)
    return updatedShape
  }



  // Allow resize for flipping support, but disable handles if needed
  override canResize = () => true as const
  override canBind = () => true as const
}