import { HTMLContainer, T, type TLBaseShape, type RecordProps, type TLHandle, useEditor, type TLResizeInfo } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'
import { getAccurateBounds, getClosestPointOnSegment, splitSegmentAtT } from './utils/bezierUtils'

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
    selectedPointIndices?: number[]
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
    selectedPointIndices: T.optional(T.arrayOf(T.number)),
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
    const { points, color, strokeWidth, fill, isClosed, editMode, selectedPointIndices = [] } = shape.props
    const editor = useEditor()
    
    // Debug logging for selection state
    if (editMode && selectedPointIndices.length > 0) {
      console.log('🔵 RENDER: BezierShape component rendering with selectedPointIndices:', selectedPointIndices)
    }
    
    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)
    
    
    // Convert points to SVG path (only if we have 2+ points)
    const pathData = points.length >= 2 ? this.pointsToPath(points, isClosed) : ''

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
          {/* Only render path if we have 2+ points */}
          {pathData && (
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
          )}
          
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
                      r={selectedPointIndices.includes(i) ? 5 : 4}
                      fill={selectedPointIndices.includes(i) ? "#0099ff" : "#0066ff"}
                      stroke="white"
                      strokeWidth={selectedPointIndices.includes(i) ? 2 : 1.5}
                    />
                  )}
                  {point.cp2 && (
                    <circle
                      cx={point.cp2.x}
                      cy={point.cp2.y}
                      r={selectedPointIndices.includes(i) ? 5 : 4}
                      fill={selectedPointIndices.includes(i) ? "#0099ff" : "#0066ff"}
                      stroke="white"
                      strokeWidth={selectedPointIndices.includes(i) ? 2 : 1.5}
                    />
                  )}
                  
                  {/* Anchor points - draw these last so they appear on top */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={selectedPointIndices.includes(i) ? 8 : 5}
                    fill={selectedPointIndices.includes(i) ? "#0066ff" : "white"}
                    stroke={selectedPointIndices.includes(i) ? "#0066ff" : "#0066ff"}
                    strokeWidth={selectedPointIndices.includes(i) ? 1 : 2}
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
    // Don't show any selection indicator in edit mode to prevent blue rectangle
    if (shape.props.editMode) {
      return null
    }
    // Show minimal indicator in normal mode
    return <rect width={shape.props.w} height={shape.props.h} fill="none" stroke="transparent" />
  }

  getBounds(shape: BezierShape) {
    // In edit mode, always calculate accurate bounds for proper hit detection
    if (shape.props.editMode) {
      const bounds = getAccurateBounds(shape.props.points, shape.props.isClosed)
      return {
        x: 0,
        y: 0,
        w: Math.max(1, bounds.maxX - bounds.minX),
        h: Math.max(1, bounds.maxY - bounds.minY),
      }
    }
    
    // Outside edit mode, use the stored width and height (points are normalized)
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: BezierShape) {
    // Calculate center from actual bounds, not static w/h
    const bounds = this.getBounds(shape)
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
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
      // Anchor point handle - needed for dragging functionality
      // The visual styling is handled by our custom SVG, but TLDraw needs the handle for interaction
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
  // Track which segment handles have already added a point during the current drag operation
  private segmentPointsAdded = new Set<string>()
  
  // Handle updates when handles are moved
  override onHandleDrag = (shape: BezierShape, { handle }: { handle: TLHandle }) => {
    console.log('🎯 DRAG: onHandleDrag called for handle:', handle.id, 'shiftKey:', this.editor.inputs.shiftKey)
    const newPoints = [...shape.props.points]
    const altKey = this.editor.inputs.altKey // Alt key breaks symmetry
    
    // Track initial position for movement threshold detection
    const handleKey = `${shape.id}-${handle.id}`
    const isInitialDrag = !this.handleDragStart.has(handleKey)
    
    if (isInitialDrag) {
      this.handleDragStart.set(handleKey, { x: handle.x, y: handle.y, deleted: false })
    }
    
    // Parse handle ID to determine what we're updating
    if (handle.id.startsWith('segment-')) {
      const handleKey = `${shape.id}-${handle.id}`
      
      // Only add point once per drag operation
      if (this.segmentPointsAdded.has(handleKey)) {
        return shape // Already added point for this segment
      }
      
      const segmentIndex = parseInt(handle.id.split('-')[1])
      if (segmentIndex >= 0) {
        // Mark this segment as having a point added
        this.segmentPointsAdded.add(handleKey)
        
        // Get the segment points
        const p1 = newPoints[segmentIndex]
        const p2 = segmentIndex === newPoints.length - 1 && shape.props.isClosed 
          ? newPoints[0] 
          : newPoints[segmentIndex + 1]
        
        // Calculate the t value for where the user clicked on the curve
        const localPoint = { x: handle.x, y: handle.y }
        const curveResult = getClosestPointOnSegment(p1, p2, localPoint)
        
        // Use bezier.js to split the segment at the precise t value for smooth insertion
        const splitResult = splitSegmentAtT(p1, p2, curveResult.t)
        
        // Update the original points with new control points
        newPoints[segmentIndex] = splitResult.leftSegment.p1
        
        // Insert the new point with calculated control points
        const insertIndex = segmentIndex + 1
        if (segmentIndex === newPoints.length - 1 && shape.props.isClosed) {
          // Inserting in closing segment - update first point instead
          newPoints[0] = splitResult.rightSegment.p2
          newPoints.push(splitResult.splitPoint)
        } else {
          newPoints[insertIndex] = splitResult.rightSegment.p2
          newPoints.splice(insertIndex, 0, splitResult.splitPoint)
        }
        
        // Recalculate bounds with new points
        return this.recalculateBounds(shape, newPoints)
      }
    } else if (handle.id.startsWith('anchor-')) {
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
    
    // Clean up completed drag operations
    this.handleDragStart.delete(handleKey)
    this.segmentPointsAdded.delete(handleKey)
    
    // For normal point dragging, just update points without recalculating bounds
    // Bounds will be recalculated in onBeforeUpdate when the drag operation completes
    return {
      ...shape,
      props: {
        ...shape.props,
        points: newPoints,
      }
    }
  }

  // Recalculate bounds when exiting edit mode or when points change outside edit mode
  override onBeforeUpdate = (prev: BezierShape, next: BezierShape) => {
    // If transitioning from edit mode to normal mode, recalculate bounds
    if (prev.props.editMode && !next.props.editMode) {
      return this.recalculateBounds(next, next.props.points)
    }
    
    // If not in edit mode and points changed, also recalculate (for other operations)
    if (!next.props.editMode && prev.props.points !== next.props.points) {
      const prevBounds = getAccurateBounds(prev.props.points, prev.props.isClosed)
      const nextBounds = getAccurateBounds(next.props.points, next.props.isClosed)
      
      // If the actual bounds changed, recalculate
      const boundsChanged = 
        Math.abs(prevBounds.maxX - prevBounds.minX - (nextBounds.maxX - nextBounds.minX)) > 0.01 ||
        Math.abs(prevBounds.maxY - prevBounds.minY - (nextBounds.maxY - nextBounds.minY)) > 0.01 ||
        Math.abs(prevBounds.minX - nextBounds.minX) > 0.01 ||
        Math.abs(prevBounds.minY - nextBounds.minY) > 0.01
      
      if (boundsChanged) {
        return this.recalculateBounds(next, next.props.points)
      }
    }
    
    return next
  }

  // Handle point selection logic for clicks (not drags)
  private handlePointSelection(shape: BezierShape, pointIndex: number, shiftKey: boolean): BezierShape {
    const currentSelected = shape.props.selectedPointIndices || []
    let newSelected: number[]

    if (shiftKey) {
      // Shift-click: toggle selection
      if (currentSelected.includes(pointIndex)) {
        // Remove from selection
        newSelected = currentSelected.filter(i => i !== pointIndex)
        console.log('🔵 SELECTION: Removed point', pointIndex, 'from selection. New selection:', newSelected)
      } else {
        // Add to selection
        newSelected = [...currentSelected, pointIndex]
        console.log('🔵 SELECTION: Added point', pointIndex, 'to selection. New selection:', newSelected)
      }
    } else {
      // Regular click: select only this point
      newSelected = [pointIndex]
      console.log('🔵 SELECTION: Single-selected point', pointIndex)
    }

    return {
      ...shape,
      props: {
        ...shape.props,
        selectedPointIndices: newSelected
      }
    }
  }

  // Delete selected points
  private deleteSelectedPoints(shape: BezierShape, selectedIndices: number[]): BezierShape {
    const currentPoints = [...shape.props.points]
    
    // Don't allow deletion if it would leave less than 2 points
    if (currentPoints.length - selectedIndices.length < 2) {
      return shape
    }
    
    // Sort indices in descending order to avoid index shifting during deletion
    const sortedIndices = [...selectedIndices].sort((a, b) => b - a)
    
    // Remove points from highest index to lowest
    for (const index of sortedIndices) {
      if (index >= 0 && index < currentPoints.length) {
        currentPoints.splice(index, 1)
      }
    }
    
    // Recalculate bounds and clear selection
    const updatedShape = this.recalculateBounds(shape, currentPoints)
    return {
      ...updatedShape,
      props: {
        ...updatedShape.props,
        selectedPointIndices: [] // Clear selection after deletion
      }
    }
  }
  
  private recalculateBounds(shape: BezierShape, points: BezierPoint[]): BezierShape {
    // Use bezier.js for accurate bounds calculation
    const bounds = getAccurateBounds(points, shape.props.isClosed)

    const w = Math.max(1, bounds.maxX - bounds.minX)
    const h = Math.max(1, bounds.maxY - bounds.minY)

    // Normalize points to new bounds
    const normalizedPoints = points.map(p => ({
      x: p.x - bounds.minX,
      y: p.y - bounds.minY,
      cp1: p.cp1 ? { x: p.cp1.x - bounds.minX, y: p.cp1.y - bounds.minY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - bounds.minX, y: p.cp2.y - bounds.minY } : undefined,
    }))

    const updatedShape = {
      ...shape,
      x: shape.x + bounds.minX,
      y: shape.y + bounds.minY,
      props: {
        ...shape.props,
        w,
        h,
        points: normalizedPoints,
      }
    }


    return updatedShape
  }



  // Helper method to add a point to the bezier curve
  static addPoint(shape: BezierShape, point: BezierPoint): BezierShape {
    const newPoints = [...shape.props.points, point]
    
    // Use bezier.js for accurate bounds calculation
    const bounds = getAccurateBounds(newPoints, shape.props.isClosed)
    
    const w = Math.max(1, bounds.maxX - bounds.minX)
    const h = Math.max(1, bounds.maxY - bounds.minY)
    
    // Normalize points relative to the new bounds
    const normalizedPoints = newPoints.map(p => ({
      x: p.x - bounds.minX,
      y: p.y - bounds.minY,
      cp1: p.cp1 ? { x: p.cp1.x - bounds.minX, y: p.cp1.y - bounds.minY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - bounds.minX, y: p.cp2.y - bounds.minY } : undefined,
    }))
    
    return {
      ...shape,
      x: shape.x + bounds.minX,
      y: shape.y + bounds.minY,
      props: {
        ...shape.props,
        w,
        h,
        points: normalizedPoints,
      },
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
    const wasInEditMode = shape.props.editMode
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        editMode: !shape.props.editMode,
      }
    }
    
    // Update the shape
    this.editor.updateShape(updatedShape)
    
    // Handle selection state based on edit mode transition
    if (!wasInEditMode) {
      // Entering edit mode: keep shape selected so first click can interact with points/paths
      this.editor.setSelectedShapes([shape.id])
    } else {
      // Exiting edit mode: select the shape to show transform controls
      this.editor.setSelectedShapes([shape.id])
    }
    
    return updatedShape
  }

  // Handle key events for shapes in edit mode
  override onKeyDown = (shape: BezierShape, info: { key: string; code: string }) => {
    if (shape.props.editMode) {
      switch (info.key) {
        case 'Delete':
        case 'Backspace':
          // Delete selected points if any are selected
          const selectedIndices = shape.props.selectedPointIndices || []
          if (selectedIndices.length > 0) {
            console.log('🗑️ DELETE: Deleting selected points:', selectedIndices)
            return this.deleteSelectedPoints(shape, selectedIndices)
          }
          // If no points selected, don't delete the shape - let TldrawCanvas handle this
          console.log('🗑️ DELETE: No points selected, not deleting anything')
          return shape
          
        case 'Escape':
        case 'Enter':
          // Exit edit mode
          const updatedShape = {
            ...shape,
            props: {
              ...shape.props,
              editMode: false,
              selectedPointIndices: [], // Clear selection when exiting edit mode
            }
          }
          this.editor.updateShape(updatedShape)
          
          // Force visual refresh by triggering a re-render
          this.editor.updateShape(updatedShape)
          
          // Select the shape to show transform controls
          this.editor.setSelectedShapes([shape.id])
          
          return updatedShape
      }
    }
    return shape
  }



  // Handle resize operations for transform controls
  override onResize = (shape: BezierShape, info: TLResizeInfo<BezierShape>) => {
    // Don't allow resize in edit mode
    if (shape.props.editMode) return shape

    const { scaleX, scaleY } = info
    
    // Scale all points and control points
    const scaledPoints = shape.props.points.map(p => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
      cp1: p.cp1 ? { x: p.cp1.x * scaleX, y: p.cp1.y * scaleY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x * scaleX, y: p.cp2.y * scaleY } : undefined,
    }))

    // Use FlippableShapeUtil's resize handling for consistent behavior
    const resizedShape = super.onResize(shape, info) as BezierShape
    
    return {
      ...resizedShape,
      props: {
        ...resizedShape.props,
        points: scaledPoints,
      }
    }
  }

  // Rotation is handled by TLDraw's built-in transform system
  // No custom onRotate needed - TLDraw applies rotation to the entire shape container

  // Disable transform controls during edit mode but allow basic interaction
  override canResize = (shape: BezierShape) => !shape.props.editMode as const
  override canRotate = (shape: BezierShape) => !shape.props.editMode as const
  override canBind = () => true as const
  
  // Override hideSelectionBoundsFg to hide selection bounds in edit mode
  override hideSelectionBoundsFg = (shape: BezierShape) => !!shape.props.editMode
  override hideSelectionBoundsBg = (shape: BezierShape) => !!shape.props.editMode

}