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
              {/* Show clickable segment midpoints for adding points */}
              {points.map((point, i) => {
                if (i < points.length - 1) {
                  const nextPoint = points[i + 1]
                  const midX = (point.x + nextPoint.x) / 2
                  const midY = (point.y + nextPoint.y) / 2
                  return (
                    <circle
                      key={`seg-${i}`}
                      cx={midX}
                      cy={midY}
                      r={3}
                      fill="#00ff00"
                      stroke="white"
                      strokeWidth={1}
                      opacity={0.4}
                      style={{ cursor: 'pointer' }}
                    />
                  )
                }
                return null
              })}
              
              {/* Show segment midpoint for closed paths */}
              {isClosed && points.length > 2 && (
                <circle
                  cx={(points[points.length - 1].x + points[0].x) / 2}
                  cy={(points[points.length - 1].y + points[0].y) / 2}
                  r={3}
                  fill="#00ff00"
                  stroke="white"
                  strokeWidth={1}
                  opacity={0.4}
                  style={{ cursor: 'pointer' }}
                />
              )}
              
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
                      title="Drag to adjust curve. Alt+drag for asymmetric handles"
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
                      title="Drag to adjust curve. Alt+drag for asymmetric handles"
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
                    title="Drag to move. Shift+click to delete"
                  />
                </g>
              ))}
            </g>
          )}
        </svg>
        
        {/* Helper text when in edit mode */}
        {editMode && (
          <div style={{
            position: 'absolute',
            bottom: -30,
            left: 0,
            fontSize: '11px',
            color: '#666',
            background: 'rgba(255,255,255,0.9)',
            padding: '2px 6px',
            borderRadius: '3px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}>
            Click green dots to add points • Shift+click anchors to delete • Alt+drag handles for asymmetric
          </div>
        )}
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
    
    // Add invisible handles on path segments for adding points
    for (let i = 0; i < shape.props.points.length - 1; i++) {
      const p1 = shape.props.points[i]
      const p2 = shape.props.points[i + 1]
      
      // Calculate midpoint of segment
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      
      handles.push({
        id: `segment-${i}`,
        type: 'create',
        index: `s${i}` as any,
        x: midX,
        y: midY,
        canSnap: false,
      })
    }
    
    // If closed, add segment handle for last->first connection
    if (shape.props.isClosed && shape.props.points.length > 2) {
      const p1 = shape.props.points[shape.props.points.length - 1]
      const p2 = shape.props.points[0]
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      
      handles.push({
        id: `segment-${shape.props.points.length - 1}`,
        type: 'create',
        index: `s${shape.props.points.length - 1}` as any,
        x: midX,
        y: midY,
        canSnap: false,
      })
    }
    
    return handles
  }


  // Track initial handle positions and deletion state for movement threshold detection
  private handleDragStart = new Map<string, { x: number; y: number; deleted: boolean }>()
  
  // Handle updates when handles are moved
  override onHandleDrag = (shape: BezierShape, { handle }: { handle: TLHandle }) => {
    const newPoints = [...shape.props.points]
    const altKey = this.editor.inputs.altKey // Alt key breaks symmetry
    const shiftKey = this.editor.inputs.shiftKey // Shift key for removing points
    
    // Track initial position and deletion state for movement threshold detection
    const handleKey = `${shape.id}-${handle.id}`
    if (!this.handleDragStart.has(handleKey)) {
      this.handleDragStart.set(handleKey, { x: handle.x, y: handle.y, deleted: false })
    }
    
    // Parse handle ID to determine what we're updating
    if (handle.id.startsWith('segment-')) {
      // Clicking on a segment handle adds a new point
      const segmentIndex = parseInt(handle.id.split('-')[1])
      if (segmentIndex >= 0) {
        const newPoint: BezierPoint = {
          x: handle.x,
          y: handle.y,
        }
        
        // Insert the new point after the segment start
        newPoints.splice(segmentIndex + 1, 0, newPoint)
        
        // Recalculate bounds with new points
        return this.recalculateBounds(shape, newPoints)
      }
    } else if (handle.id.startsWith('anchor-')) {
      const pointIndex = parseInt(handle.id.split('-')[1])
      if (pointIndex >= 0 && pointIndex < newPoints.length) {
        // Check for shift+drag deletion (only once per drag operation)
        if (shiftKey && newPoints.length > 2) {
          const dragState = this.handleDragStart.get(handleKey)
          if (dragState && !dragState.deleted) {
            // Delete immediately on first drag event when shift is held
            newPoints.splice(pointIndex, 1)
            
            // Mark this point as deleted to prevent further deletions during this drag
            dragState.deleted = true
            
            return this.recalculateBounds(shape, newPoints)
          }
          
          // If already deleted during this drag, skip normal dragging
          if (dragState?.deleted) {
            return shape // Don't process further - point is already gone
          }
        }
        
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
    
    // Clean up completed drag operations
    this.handleDragStart.delete(handleKey)
    
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
  
  private recalculateBounds(shape: BezierShape, points: BezierPoint[]): BezierShape {
    // Calculate bounds from all points including control points
    const allPoints = points.flatMap(p => [
      { x: p.x, y: p.y },
      ...(p.cp1 ? [p.cp1] : []),
      ...(p.cp2 ? [p.cp2] : [])
    ])

    const xs = allPoints.map(p => p.x)
    const ys = allPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)

    const w = Math.max(1, maxX - minX)
    const h = Math.max(1, maxY - minY)

    // Normalize points to new bounds
    const normalizedPoints = points.map(p => ({
      x: p.x - minX,
      y: p.y - minY,
      cp1: p.cp1 ? { x: p.cp1.x - minX, y: p.cp1.y - minY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - minX, y: p.cp2.y - minY } : undefined,
    }))

    return {
      ...shape,
      x: shape.x + minX,
      y: shape.y + minY,
      props: {
        ...shape.props,
        w,
        h,
        points: normalizedPoints,
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