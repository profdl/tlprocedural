import { useEffect, useRef } from 'react'
import { useEditor, useValue } from 'tldraw'
import { useCustomShapeInstances } from './useCustomShapeInstances'
import { useCustomShapes } from './useCustomShapes'
import { bezierShapeToCustomTrayItem, normalizeBezierPoints } from '../utils/bezierToCustomShape'
import { BezierBounds } from '../shapes/services/BezierBounds'
import type { BezierShape, BezierPoint } from '../shapes/BezierShape'

/**
 * Manager hook that monitors custom shape instance editing and propagates changes
 * This hook should be used at the app level to handle instance synchronization
 */
export function useCustomShapeInstanceManager() {
  const editor = useEditor()
  const { updateAllInstances, getInstancesForCustomShape } = useCustomShapeInstances()
  const { getCustomShape, updateCustomShape } = useCustomShapes()

  // Track edit states to detect when editing ends
  const editStateRef = useRef<Map<string, boolean>>(new Map())

  // Track shape properties to detect live changes during edit mode
  const shapePropsRef = useRef<Map<string, any>>(new Map())

  // Track original bounds when editing begins for proper compensation
  const originalBoundsRef = useRef<Map<string, { minX: number; minY: number; maxX: number; maxY: number }>>(new Map())

  // Track original instance positions to prevent cumulative compensation
  const originalInstancePositionsRef = useRef<Map<string, Map<string, { x: number; y: number }>>>(new Map())

  // Monitor all shapes for edit mode changes
  const allShapes = useValue(
    'all-shapes-for-instance-manager',
    () => Array.from(editor.getCurrentPageShapes()),
    [editor]
  )

  useEffect(() => {
    // Process all custom shape instances for state changes
    allShapes.forEach(shape => {
      // Only handle bezier shapes that are custom shape instances
      if (shape.type !== 'bezier' || !shape.meta?.isCustomShapeInstance) {
        return
      }

      const bezierShape = shape as BezierShape
      const shapeId = shape.id
      const isInEditMode = bezierShape.props.editMode === true
      const wasInEditMode = editStateRef.current.get(shapeId) === true

      // Update current edit state
      editStateRef.current.set(shapeId, isInEditMode)

      // Handle live property changes during edit mode
      if (isInEditMode) {
        const currentProps = JSON.stringify({
          points: bezierShape.props.points,
          isClosed: bezierShape.props.isClosed,
          color: bezierShape.props.color,
          fillColor: bezierShape.props.fillColor,
          strokeWidth: bezierShape.props.strokeWidth,
          fill: bezierShape.props.fill
        })

        const previousProps = shapePropsRef.current.get(shapeId)

        if (previousProps && previousProps !== currentProps) {
          // Properties changed during edit mode - update other instances live
          handleLivePropertyChange(bezierShape)
        }

        // Store current props for next comparison
        shapePropsRef.current.set(shapeId, currentProps)
      }

      // Detect transition from edit mode to normal mode
      if (wasInEditMode && !isInEditMode) {
        handleEditModeExit(bezierShape)
        // Clean up props tracking when exiting edit mode
        shapePropsRef.current.delete(shapeId)
        // Clean up original bounds tracking
        originalBoundsRef.current.delete(shapeId)
        // Clean up original instance positions
        const customShapeId = bezierShape.meta?.customShapeId as string
        if (customShapeId) {
          originalInstancePositionsRef.current.delete(customShapeId)
        }
      }

      // Initialize props tracking when entering edit mode
      if (!wasInEditMode && isInEditMode) {
        const initialProps = JSON.stringify({
          points: bezierShape.props.points,
          isClosed: bezierShape.props.isClosed,
          color: bezierShape.props.color,
          fillColor: bezierShape.props.fillColor,
          strokeWidth: bezierShape.props.strokeWidth,
          fill: bezierShape.props.fill
        })
        shapePropsRef.current.set(shapeId, initialProps)

        // Store original bounds when entering edit mode
        const originalBounds = BezierBounds.getAccurateBounds(bezierShape.props.points, bezierShape.props.isClosed)
        originalBoundsRef.current.set(shapeId, originalBounds)

        // Store original positions of all instances when editing begins
        const customShapeId = bezierShape.meta?.customShapeId as string
        if (customShapeId) {
          const instances = getInstancesForCustomShape(customShapeId)
          const instancePositions = new Map<string, { x: number; y: number }>()
          instances.forEach(instance => {
            instancePositions.set(instance.id, { x: instance.x, y: instance.y })
          })
          originalInstancePositionsRef.current.set(customShapeId, instancePositions)
        }
      }
    })
  }, [allShapes])

  const handleLivePropertyChange = (shape: BezierShape) => {
    const customShapeId = shape.meta?.customShapeId as string
    if (!customShapeId) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Live update for custom shape instance: ${customShapeId}`)

    try {
      // Get original bounds that were stored when editing began
      const originalBounds = originalBoundsRef.current.get(shape.id)
      if (!originalBounds) {
        console.warn('No original bounds found for shape', shape.id)
        return
      }

      // Calculate current bounds from the edited points
      const currentBounds = BezierBounds.getAccurateBounds(shape.props.points, shape.props.isClosed)

      // Calculate the bounds offset from original to current
      const boundsOffset = {
        x: currentBounds.minX - originalBounds.minX,
        y: currentBounds.minY - originalBounds.minY
      }

      // Normalize the points to ensure they're relative to the shape's origin
      const { normalizedPoints } = normalizeBezierPoints(shape.props.points)

      // Calculate bounds from normalized points for consistent sizing
      const normalizedBounds = BezierBounds.getAccurateBounds(normalizedPoints, shape.props.isClosed)
      const w = Math.max(1, normalizedBounds.maxX - normalizedBounds.minX)
      const h = Math.max(1, normalizedBounds.maxY - normalizedBounds.minY)

      // Create properties update from the currently edited shape
      const liveProps = {
        w,
        h,
        points: normalizedPoints,
        isClosed: shape.props.isClosed,
        color: shape.props.color,
        fillColor: shape.props.fillColor,
        strokeWidth: shape.props.strokeWidth,
        fill: shape.props.fill,
        // Keep edit mode false for other instances
        editMode: false,
        selectedPointIndices: [],
        hoverPoint: undefined,
        hoverSegmentIndex: undefined
      }

      // Update all OTHER instances (not the one being edited)
      // Only proceed if there are other instances to update
      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstances = allInstances.filter(instance => instance.id !== shape.id)

      if (otherInstances.length > 0) {
        // Apply position compensation during live editing to maintain instance positions
        // Pass original positions to prevent cumulative compensation
        const originalPositions = originalInstancePositionsRef.current.get(customShapeId)
        updateAllInstances(customShapeId, {
          props: liveProps
        }, shape.id, boundsOffset, originalPositions)
      }

      console.log(`Live updated other instances for: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to live update custom shape ${customShapeId}:`, error)
    }
  }

  const handleEditModeExit = (shape: BezierShape) => {
    const customShapeId = shape.meta?.customShapeId as string
    if (!customShapeId) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Edit mode ended for custom shape instance: ${customShapeId}`)

    try {
      // Convert the edited shape back to a custom tray item format
      const updatedCustomShape = bezierShapeToCustomTrayItem(shape, customShape.label)

      // Update the custom shape definition
      updateCustomShape(customShapeId, {
        iconSvg: updatedCustomShape.iconSvg,
        defaultProps: updatedCustomShape.defaultProps
      })

      // Update all other instances with the new properties
      // No position compensation needed - the shape being edited will have its position
      // adjusted by BezierBounds.recalculateShapeBounds, and other instances should stay put
      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstances = allInstances.filter(instance => instance.id !== shape.id)

      if (otherInstances.length > 0) {
        updateAllInstances(customShapeId, {
          props: updatedCustomShape.defaultProps
        }, shape.id)
      }

      console.log(`Updated custom shape definition and all instances for: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to update custom shape ${customShapeId}:`, error)
    }
  }

  // Cleanup edit state tracking for deleted shapes
  useEffect(() => {
    const currentShapeIds = new Set(allShapes.map(s => s.id))
    const trackedShapeIds = Array.from(editStateRef.current.keys())

    trackedShapeIds.forEach(shapeId => {
      if (!currentShapeIds.has(shapeId)) {
        editStateRef.current.delete(shapeId)
        shapePropsRef.current.delete(shapeId)
        originalBoundsRef.current.delete(shapeId)
        // Clean up original instance positions for any custom shape IDs
        // Note: We don't have direct access to customShapeId here, so we clean up during edit mode exit
      }
    })
  }, [allShapes])

  return {
    // Expose some utilities if needed
    isTrackingShape: (shapeId: string) => editStateRef.current.has(shapeId)
  }
}