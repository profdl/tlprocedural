import { type Editor, type TLHandle } from 'tldraw'
import { type BezierPoint, type BezierShape } from '../BezierShape'
import { BezierMath } from './BezierMath'
import { BEZIER_THRESHOLDS, bezierLog } from '../utils/bezierConstants'

/**
 * State management service for Bezier shape editing operations
 * Centralizes edit mode, point selection, and interaction logic
 */
export class BezierState {
  
  /**
   * Toggle edit mode for a Bezier shape
   */
  static toggleEditMode(
    shape: BezierShape, 
    editor: Editor
  ): BezierShape {
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        editMode: !shape.props.editMode,
        selectedPointIndices: shape.props.editMode ? [] : (shape.props.selectedPointIndices || [])
      }
    }
    
    editor.updateShape(updatedShape)
    
    // Handle selection state based on edit mode transition
    if (updatedShape.props.editMode) {
      // Entering edit mode: keep shape selected for interaction
      editor.setSelectedShapes([shape.id])
    } else {
      // Exiting edit mode: select shape to show transform controls
      editor.setSelectedShapes([shape.id])
    }
    
    return updatedShape
  }

  /**
   * Enter edit mode for a shape
   */
  static enterEditMode(
    shape: BezierShape, 
    editor: Editor
  ): BezierShape {
    if (shape.props.editMode) return shape
    
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        editMode: true,
      }
    }
    
    editor.updateShape(updatedShape)
    return updatedShape
  }

  /**
   * Exit edit mode for a shape
   */
  static exitEditMode(
    shape: BezierShape, 
    editor: Editor
  ): BezierShape {
    if (!shape.props.editMode) return shape
    
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        editMode: false,
        selectedPointIndices: [], // Clear selection when exiting
        hoverPoint: undefined,
        hoverSegmentIndex: undefined
      }
    }
    
    editor.updateShape(updatedShape)
    editor.setSelectedShapes([shape.id]) // Select shape to show transform controls
    
    return updatedShape
  }

  /**
   * Handle point selection with shift-click support
   */
  static handlePointSelection(
    shape: BezierShape,
    pointIndex: number,
    shiftKey: boolean,
    editor: Editor
  ): BezierShape {
    const currentSelected = shape.props.selectedPointIndices || []
    let newSelected: number[]
    
    if (shiftKey) {
      // Add to selection or remove if already selected
      if (currentSelected.includes(pointIndex)) {
        newSelected = currentSelected.filter(i => i !== pointIndex)
      } else {
        newSelected = [...currentSelected, pointIndex]
      }
    } else {
      // Single selection (or deselect if clicking the same point)
      newSelected = currentSelected.length === 1 && currentSelected[0] === pointIndex 
        ? [] 
        : [pointIndex]
    }
    
    bezierLog('Selection', 'Point selection changed:', { 
      pointIndex, 
      shiftKey, 
      newSelected 
    })
    
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        selectedPointIndices: newSelected
      }
    }
    
    editor.updateShape(updatedShape)
    return updatedShape
  }

  /**
   * Clear point selection
   */
  static clearPointSelection(
    shape: BezierShape,
    editor: Editor
  ): BezierShape {
    if (!shape.props.selectedPointIndices || shape.props.selectedPointIndices.length === 0) {
      return shape
    }
    
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        selectedPointIndices: []
      }
    }
    
    editor.updateShape(updatedShape)
    return updatedShape
  }

  /**
   * Delete selected points from shape
   */
  static deleteSelectedPoints(
    shape: BezierShape
  ): BezierShape {
    const selectedIndices = shape.props.selectedPointIndices || []
    if (selectedIndices.length === 0) return shape
    
    const currentPoints = [...shape.props.points]
    
    // Don't allow deletion if it would leave less than 2 points
    if (currentPoints.length - selectedIndices.length < 2) {
      bezierLog('Delete', 'Cannot delete points - would leave < 2 points')
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
    
    bezierLog('Delete', 'Deleted selected points:', selectedIndices)
    
    // Return updated shape with cleared selection - bounds will be recalculated in BezierBounds
    return {
      ...shape,
      props: {
        ...shape.props,
        points: currentPoints,
        selectedPointIndices: [] // Clear selection after deletion
      }
    }
  }

  /**
   * Toggle point type between smooth and corner
   */
  static togglePointType(
    shape: BezierShape,
    pointIndex: number,
    editor: Editor
  ): BezierShape {
    if (pointIndex < 0 || pointIndex >= shape.props.points.length) return shape
    
    const newPoints = [...shape.props.points]
    const point = newPoints[pointIndex]
    
    // Check if the point currently has control points (smooth) or not (corner)
    const hasControlPoints = point.cp1 || point.cp2
    
    if (hasControlPoints) {
      // Convert smooth point to corner point (remove control points)
      newPoints[pointIndex] = {
        x: point.x,
        y: point.y,
      }
      bezierLog('PointType', 'Converted to corner point:', pointIndex)
    } else {
      // Convert corner point to smooth point (add control points)
      const prevIndex = pointIndex === 0 ? 
        (shape.props.isClosed ? shape.props.points.length - 1 : -1) : 
        pointIndex - 1
      const nextIndex = pointIndex === shape.props.points.length - 1 ? 
        (shape.props.isClosed ? 0 : -1) : 
        pointIndex + 1
      
      const prevPoint = prevIndex >= 0 ? shape.props.points[prevIndex] : null
      const nextPoint = nextIndex >= 0 ? shape.props.points[nextIndex] : null
      
      const controlPoints = BezierMath.createSmoothControlPoints(prevPoint, point, nextPoint)
      
      newPoints[pointIndex] = {
        x: point.x,
        y: point.y,
        cp1: controlPoints.cp1,
        cp2: controlPoints.cp2,
      }
      bezierLog('PointType', 'Converted to smooth point:', pointIndex)
    }
    
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        points: newPoints
      }
    }
    
    editor.updateShape(updatedShape)
    return updatedShape
  }

  /**
   * Add point to curve at specific segment position
   */
  static addPointToSegment(
    shape: BezierShape,
    segmentIndex: number,
    t: number
  ): BezierShape {
    const newPoints = [...shape.props.points]
    const p1 = newPoints[segmentIndex]
    const p2 = segmentIndex === newPoints.length - 1 && shape.props.isClosed 
      ? newPoints[0] 
      : newPoints[segmentIndex + 1]

    // Use BezierMath service for precise segment splitting
    const splitResult = BezierMath.splitSegmentAtT(p1, p2, t)
    
    // Update the original points with new control points
    newPoints[segmentIndex] = splitResult.leftSegment.p1
    
    // Insert the new point with calculated control points
    const insertIndex = segmentIndex + 1
    let newPointIndex: number
    
    if (segmentIndex === newPoints.length - 1 && shape.props.isClosed) {
      // Inserting in closing segment - update first point instead
      newPoints[0] = splitResult.rightSegment.p2
      newPoints.push(splitResult.splitPoint)
      newPointIndex = newPoints.length - 1
    } else {
      newPoints[insertIndex] = splitResult.rightSegment.p2
      newPoints.splice(insertIndex, 0, splitResult.splitPoint)
      newPointIndex = insertIndex
    }
    
    bezierLog('PointAdd', 'Added point at segment', segmentIndex, 'index', newPointIndex)
    
    // Return updated shape with new point selected - bounds will be recalculated by BezierBounds
    return {
      ...shape,
      props: {
        ...shape.props,
        points: newPoints,
        selectedPointIndices: [newPointIndex] // Auto-select the new point
      }
    }
  }

  // === Point Detection ===

  /**
   * Find anchor point at local coordinates
   */
  static getAnchorPointAt(
    points: BezierPoint[], 
    localPoint: { x: number; y: number }, 
    zoomLevel: number
  ): number {
    const threshold = BEZIER_THRESHOLDS.ANCHOR_POINT / zoomLevel
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      const distance = BezierMath.getDistance(localPoint, point)
      
      if (distance < threshold) {
        return i
      }
    }
    
    return -1
  }

  /**
   * Find control point at local coordinates
   */
  static getControlPointAt(
    points: BezierPoint[], 
    localPoint: { x: number; y: number }, 
    zoomLevel: number
  ): { pointIndex: number; type: 'cp1' | 'cp2' } | null {
    const threshold = BEZIER_THRESHOLDS.CONTROL_POINT / zoomLevel
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      
      if (point.cp1) {
        const distance = BezierMath.getDistance(localPoint, point.cp1)
        if (distance < threshold) {
          return { pointIndex: i, type: 'cp1' }
        }
      }
      
      if (point.cp2) {
        const distance = BezierMath.getDistance(localPoint, point.cp2)
        if (distance < threshold) {
          return { pointIndex: i, type: 'cp2' }
        }
      }
    }
    
    return null
  }

  /**
   * Find segment at position for point insertion
   */
  static getSegmentAtPosition(
    points: BezierPoint[], 
    localPoint: { x: number; y: number }, 
    zoomLevel: number,
    isClosed: boolean = false
  ): { segmentIndex: number; t: number } | null {
    const threshold = BEZIER_THRESHOLDS.PATH_SEGMENT / zoomLevel
    const segments = BezierMath.getAllSegments(points, isClosed)
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const projected = segment.project(localPoint)
      
      if ((projected.d || 0) < threshold) {
        return { segmentIndex: i, t: projected.t || 0 }
      }
    }
    
    return null
  }

  // === Handle Management ===

  /**
   * Update points from handle drag operation
   */
  static updatePointsFromHandleDrag(
    points: BezierPoint[], 
    handle: TLHandle, 
    ctrlKey: boolean
  ): BezierPoint[] {
    const newPoints = [...points]
    
    // Parse handle ID to determine what we're updating
    // New format: "bezier-{index}-{type}" where type is "anchor", "cp1", or "cp2"
    const parts = handle.id.split('-')
    if (parts.length !== 3 || parts[0] !== 'bezier') {
      return newPoints // Invalid handle ID format
    }
    
    const pointIndex = parseInt(parts[1], 10)
    const handleType = parts[2]
    
    if (isNaN(pointIndex) || pointIndex >= newPoints.length) {
      return newPoints
    }
    
    const point = newPoints[pointIndex]
    
    if (handleType === 'anchor') {
      // Moving anchor point - move the entire point and its control points
      const deltaX = handle.x - point.x
      const deltaY = handle.y - point.y
      
      newPoints[pointIndex] = {
        ...point,
        x: handle.x,
        y: handle.y,
        cp1: point.cp1 ? { 
          x: point.cp1.x + deltaX, 
          y: point.cp1.y + deltaY 
        } : undefined,
        cp2: point.cp2 ? { 
          x: point.cp2.x + deltaX, 
          y: point.cp2.y + deltaY 
        } : undefined,
      }
    } else if (handleType === 'cp1' || handleType === 'cp2') {
      // Moving control point
      const updatedPoint = { ...point }
      
      if (handleType === 'cp1') {
        updatedPoint.cp1 = { x: handle.x, y: handle.y }
        
        // Update symmetric control point unless Ctrl is pressed (break symmetry)
        if (!ctrlKey && point.cp2) {
          const deltaX = handle.x - point.x
          const deltaY = handle.y - point.y
          updatedPoint.cp2 = {
            x: point.x - deltaX,
            y: point.y - deltaY
          }
        }
      } else if (handleType === 'cp2') {
        updatedPoint.cp2 = { x: handle.x, y: handle.y }
        
        // Update symmetric control point unless Ctrl is pressed (break symmetry)  
        if (!ctrlKey && point.cp1) {
          const deltaX = handle.x - point.x
          const deltaY = handle.y - point.y
          updatedPoint.cp1 = {
            x: point.x - deltaX,
            y: point.y - deltaY
          }
        }
      }
      
      newPoints[pointIndex] = updatedPoint
    }
    
    return newPoints
  }
}