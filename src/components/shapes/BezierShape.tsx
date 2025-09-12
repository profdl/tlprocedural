import { HTMLContainer, T, type TLBaseShape, type RecordProps, type TLHandle, useEditor, type TLResizeInfo } from 'tldraw'
import { useMemo } from 'react'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'
import { 
  getAccurateBounds, 
  generateBezierHandles, 
  createHandleMemoKey,
  updatePointsFromHandleDrag,
  createHandleDragKey 
} from './utils/bezierUtils'
import { BEZIER_THRESHOLDS, BEZIER_STYLES, bezierLog } from './utils/bezierConstants'
import { useBezierHover } from './hooks/useBezierHover'

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
    hoverPoint?: { x: number; y: number; cp1?: { x: number; y: number }; cp2?: { x: number; y: number } }
    hoverSegmentIndex?: number
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
    hoverPoint: T.optional(T.object({
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
    hoverSegmentIndex: T.optional(T.number),
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
    const { points, color, strokeWidth, fill, isClosed, editMode, selectedPointIndices = [], hoverPoint } = shape.props
    const editor = useEditor()
    
    // Use custom hook for hover/preview logic
    useBezierHover({ shape, editor, editMode: !!editMode })
    
    // Debug logging for selection state
    if (editMode && selectedPointIndices.length > 0) {
      bezierLog('Render', 'Component rendering with selectedPointIndices:', selectedPointIndices)
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
              strokeDasharray={editMode ? BEZIER_STYLES.EDIT_MODE_DASH : undefined}
              opacity={editMode ? BEZIER_STYLES.EDIT_MODE_OPACITY : 1}
              style={{ cursor: editMode ? 'crosshair' : 'default' }}
            />
          )}
          
          {/* Show control points and connection lines when in edit mode only */}
          {editMode && (
            <g opacity={BEZIER_STYLES.CONTROL_OPACITY}>
              {/* Show hover preview point (Alt+click to add) */}
              {hoverPoint && (
                <g key="hover-preview" opacity={BEZIER_STYLES.CONTROL_OPACITY}>
                  {/* Simple preview dot - no control points for better performance */}
                  <circle
                    cx={hoverPoint.x}
                    cy={hoverPoint.y}
                    r={BEZIER_THRESHOLDS.HOVER_PREVIEW_RADIUS}
                    fill={BEZIER_STYLES.HOVER_PREVIEW_COLOR}
                    stroke="white"
                    strokeWidth={BEZIER_STYLES.HOVER_PREVIEW_STROKE}
                    opacity={BEZIER_STYLES.HOVER_OPACITY}
                    style={{ cursor: 'pointer' }}
                  />
                  {/* Small pulsing ring for visibility */}
                  <circle
                    cx={hoverPoint.x}
                    cy={hoverPoint.y}
                    r={BEZIER_THRESHOLDS.HOVER_PREVIEW_RING}
                    fill="none"
                    stroke={BEZIER_STYLES.HOVER_PREVIEW_COLOR}
                    strokeWidth={BEZIER_STYLES.HOVER_RING_STROKE}
                    opacity={BEZIER_STYLES.HOVER_RING_OPACITY}
                  />
                </g>
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
                      stroke={BEZIER_STYLES.CONTROL_LINE_COLOR}
                      strokeWidth={BEZIER_STYLES.CONTROL_LINE_WIDTH}
                      strokeDasharray={BEZIER_STYLES.CONTROL_LINE_DASH}
                      opacity={0.5}
                    />
                  )}
                  {point.cp2 && (
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={point.cp2.x}
                      y2={point.cp2.y}
                      stroke={BEZIER_STYLES.CONTROL_LINE_COLOR}
                      strokeWidth={BEZIER_STYLES.CONTROL_LINE_WIDTH}
                      strokeDasharray={BEZIER_STYLES.CONTROL_LINE_DASH}
                      opacity={0.5}
                    />
                  )}
                  
                  {/* Control point handles */}
                  {point.cp1 && (
                    <circle
                      cx={point.cp1.x}
                      cy={point.cp1.y}
                      r={selectedPointIndices.includes(i) ? BEZIER_THRESHOLDS.CONTROL_RADIUS_SELECTED : BEZIER_THRESHOLDS.CONTROL_RADIUS}
                      fill={selectedPointIndices.includes(i) ? BEZIER_STYLES.CONTROL_POINT_SELECTED : BEZIER_STYLES.CONTROL_POINT_COLOR}
                      stroke="white"
                      strokeWidth={selectedPointIndices.includes(i) ? BEZIER_STYLES.CONTROL_STROKE_SELECTED : BEZIER_STYLES.CONTROL_STROKE}
                    />
                  )}
                  {point.cp2 && (
                    <circle
                      cx={point.cp2.x}
                      cy={point.cp2.y}
                      r={selectedPointIndices.includes(i) ? BEZIER_THRESHOLDS.CONTROL_RADIUS_SELECTED : BEZIER_THRESHOLDS.CONTROL_RADIUS}
                      fill={selectedPointIndices.includes(i) ? BEZIER_STYLES.CONTROL_POINT_SELECTED : BEZIER_STYLES.CONTROL_POINT_COLOR}
                      stroke="white"
                      strokeWidth={selectedPointIndices.includes(i) ? BEZIER_STYLES.CONTROL_STROKE_SELECTED : BEZIER_STYLES.CONTROL_STROKE}
                    />
                  )}
                  
                  {/* Anchor points - draw these last so they appear on top */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={selectedPointIndices.includes(i) ? BEZIER_THRESHOLDS.ANCHOR_RADIUS_SELECTED : BEZIER_THRESHOLDS.ANCHOR_RADIUS}
                    fill={selectedPointIndices.includes(i) ? BEZIER_STYLES.ANCHOR_POINT_SELECTED : BEZIER_STYLES.ANCHOR_POINT_COLOR}
                    stroke={BEZIER_STYLES.CONTROL_POINT_COLOR}
                    strokeWidth={selectedPointIndices.includes(i) ? BEZIER_STYLES.ANCHOR_STROKE_SELECTED : BEZIER_STYLES.ANCHOR_STROKE}
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

  // Memoized handle generation for performance optimization
  private handleMemo = new Map<string, TLHandle[]>()
  
  // Handle management for interactive bezier points
  override getHandles(shape: BezierShape): TLHandle[] {
    // Create memoization key based on points and edit mode
    const memoKey = createHandleMemoKey(shape)
    
    // Check if we have cached handles for this configuration
    if (this.handleMemo.has(memoKey)) {
      return this.handleMemo.get(memoKey)!
    }
    
    // Generate new handles using utility function
    const handles = generateBezierHandles(shape)
    
    // Cache the result (limit cache size to prevent memory leaks)
    if (this.handleMemo.size > 50) {
      this.handleMemo.clear() // Simple cache cleanup
    }
    this.handleMemo.set(memoKey, handles)
    
    return handles
  }


  // Optimized handle drag tracking using Map for performance
  private handleDragStart = new Map<string, { x: number; y: number; deleted: boolean }>()
  
  // Handle updates when handles are moved
  override onHandleDrag = (shape: BezierShape, { handle }: { handle: TLHandle }) => {
    bezierLog('Drag', 'onHandleDrag called for handle:', handle.id, 'shiftKey:', this.editor.inputs.shiftKey)
    
    const altKey = this.editor.inputs.altKey // Alt key breaks symmetry
    
    // Track initial position for movement threshold detection
    const handleKey = createHandleDragKey(shape.id, handle.id)
    const isInitialDrag = !this.handleDragStart.has(handleKey)
    
    if (isInitialDrag) {
      this.handleDragStart.set(handleKey, { x: handle.x, y: handle.y, deleted: false })
    }
    
    // Use utility function to update points based on handle drag
    const newPoints = updatePointsFromHandleDrag(shape.props.points, handle, altKey)
    
    // Clean up completed drag operations
    this.handleDragStart.delete(handleKey)
    
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
            bezierLog('Delete', 'Deleting selected points:', selectedIndices)
            return this.deleteSelectedPoints(shape, selectedIndices)
          }
          // If no points selected, don't delete the shape - let TldrawCanvas handle this
          bezierLog('Delete', 'No points selected, not deleting anything')
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