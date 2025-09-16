import { HTMLContainer, T, type TLBaseShape, type RecordProps, type TLHandle, type TLResizeInfo } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'
import { BezierBounds } from './services/BezierBounds'
import { BezierState } from './services/BezierState'
import {
  generateBezierHandles,
  createHandleMemoKey,
  createHandleDragKey
} from './utils/bezierUtils'
import { bezierLog } from './utils/bezierConstants'
import { BezierPath } from './components/BezierPath'
import { BezierControlPoints } from './components/BezierControlPoints'
import { BezierHoverPreview } from './components/BezierHoverPreview'
import { LRUCache } from '../../utils/LRUCache'

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

    // Note: This is a class component following TLDraw's ShapeUtil pattern
    // FUTURE CONSIDERATION: Could potentially refactor to functional component if more hook usage is needed
    // Current architecture follows TLDraw best practices for custom shape utilities
    
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
          {/* Main bezier path */}
          <BezierPath
            pathData={pathData}
            color={color}
            strokeWidth={strokeWidth}
            fill={fill}
            isClosed={isClosed}
            editMode={!!editMode}
          />
          
          {/* Show control points and hover preview when in edit mode only */}
          {editMode && (
            <>
              {/* Hover preview for Alt+click point addition */}
              <BezierHoverPreview hoverPoint={hoverPoint} />
              
              {/* Control points and anchor points */}
              <BezierControlPoints 
                points={points}
                selectedPointIndices={selectedPointIndices}
              />
            </>
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
    // Use BezierBounds service for consistent bounds calculation
    if (shape.props.editMode) {
      return BezierBounds.getEditModeBounds(shape)
    } else {
      return BezierBounds.getNormalModeBounds(shape)
    }
  }

  getCenter(shape: BezierShape) {
    // Use BezierBounds service for center calculation
    return BezierBounds.getShapeCenter(shape)
  }

  getOutline(shape: BezierShape) {
    // Use BezierBounds service for outline points
    return BezierBounds.getOutlinePoints(shape)
  }

  // LRU cache for handle generation performance optimization
  private handleCache = new LRUCache<string, TLHandle[]>(100) // Increase capacity from 50 to 100
  
  // Handle management for interactive bezier points
  override getHandles(shape: BezierShape): TLHandle[] {
    // Create memoization key based on points and edit mode
    const cacheKey = createHandleMemoKey(shape)

    // Check if we have cached handles for this configuration
    const cachedHandles = this.handleCache.get(cacheKey)
    if (cachedHandles) {
      return cachedHandles
    }

    // Generate new handles using utility function
    const handles = generateBezierHandles(shape)

    // Cache the result using LRU cache (automatic eviction of least recently used)
    this.handleCache.set(cacheKey, handles)

    return handles
  }


  // Optimized handle drag tracking using Map for performance
  private handleDragStart = new Map<string, { x: number; y: number; deleted: boolean }>()
  
  // Handle updates when handles are moved
  override onHandleDrag = (shape: BezierShape, { handle }: { handle: TLHandle }) => {
    bezierLog('Drag', 'onHandleDrag called for handle:', handle.id, 'shiftKey:', this.editor.inputs.shiftKey)
    
    const ctrlKey = this.editor.inputs.ctrlKey // Ctrl key breaks symmetry
    
    // Track initial position for movement threshold detection
    const handleKey = createHandleDragKey(shape.id, handle.id)
    const isInitialDrag = !this.handleDragStart.has(handleKey)
    
    if (isInitialDrag) {
      this.handleDragStart.set(handleKey, { x: handle.x, y: handle.y, deleted: false })
    }
    
    // Use BezierState service for handle drag updates
    const newPoints = BezierState.updatePointsFromHandleDrag(shape.props.points, handle, ctrlKey)
    
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
      return BezierBounds.recalculateShapeBounds(next, next.props.points)
    }
    
    // If not in edit mode and points changed, also recalculate (for other operations)
    if (!next.props.editMode && prev.props.points !== next.props.points) {
      // Use BezierBounds service to check if bounds have changed
      const boundsChanged = BezierBounds.haveBoundsChanged(
        prev.props.points, 
        next.props.points, 
        next.props.isClosed
      )
      
      if (boundsChanged) {
        return BezierBounds.recalculateShapeBounds(next, next.props.points)
      }
    }
    
    return next
  }


  // Delete selected points - now delegated to BezierState service
  private deleteSelectedPoints(shape: BezierShape): BezierShape {
    const updatedShape = BezierState.deleteSelectedPoints(shape)
    // Recalculate bounds after deletion
    return BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)
  }
  




  // Helper method to add a point to the bezier curve
  static addPoint(shape: BezierShape, point: BezierPoint): BezierShape {
    const newPoints = [...shape.props.points, point]
    // Use BezierBounds service for consistent bounds calculation
    return BezierBounds.recalculateShapeBounds(shape, newPoints)
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
      const newPoint = { ...point }
      
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
    // Use BezierState service for consistent edit mode toggling
    return BezierState.toggleEditMode(shape, this.editor)
  }

  // Handle key events for shapes in edit mode
  onKeyDown = (shape: BezierShape, info: { key: string; code: string }) => {
    if (shape.props.editMode) {
      switch (info.key) {
        case 'Delete':
        case 'Backspace': {
          // Delete selected points if any are selected
          const selectedIndices = shape.props.selectedPointIndices || []
          if (selectedIndices.length > 0) {
            bezierLog('Delete', 'Deleting selected points:', selectedIndices)
            return this.deleteSelectedPoints(shape)
          }
          // If no points selected, don't delete the shape - let TldrawCanvas handle this
          bezierLog('Delete', 'No points selected, not deleting anything')
          return shape
        }
          
        case 'Escape':
        case 'Enter':
          // Use BezierState service to exit edit mode
          return BezierState.exitEditMode(shape, this.editor)
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

    // Note: FlippableShapeUtil doesn't have onResize, so we implement our own
    const resizedShape = { ...shape }
    
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
  override canResize = (shape: BezierShape) => !shape.props.editMode
  canRotate = (shape: BezierShape) => !shape.props.editMode
  override canBind = () => true
  
  // Override hideSelectionBoundsFg to hide selection bounds in edit mode
  override hideSelectionBoundsFg = (shape: BezierShape) => !!shape.props.editMode
  override hideSelectionBoundsBg = (shape: BezierShape) => !!shape.props.editMode

}