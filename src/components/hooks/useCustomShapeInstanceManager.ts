import { useCallback, useEffect, useRef } from 'react'
import { useEditor, useValue } from 'tldraw'
import { useCustomShapeInstances } from './useCustomShapeInstances'
import { useCustomShapes } from './useCustomShapes'
import { bezierShapeToCustomTrayItem, normalizeBezierPoints } from '../utils/bezierToCustomShape'
import { BezierBounds } from '../shapes/services/BezierBounds'
import type { BezierShape } from '../shapes/BezierShape'
import { BEZIER_DEBUG } from '../shapes/utils/bezierConstants'

interface BoundsSnapshot {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface ShapePropsSnapshot {
  points: BezierShape['props']['points']
  isClosed: boolean
  color: string
  fillColor: string
  strokeWidth: number
  fill: boolean
}

function createSnapshot(props: BezierShape['props']): ShapePropsSnapshot {
  return {
    points: props.points,
    isClosed: props.isClosed,
    color: props.color,
    fillColor: props.fillColor,
    strokeWidth: props.strokeWidth,
    fill: props.fill
  }
}

function havePropsChanged(previous: ShapePropsSnapshot | undefined, props: BezierShape['props']): boolean {
  if (!previous) return false

  return (
    previous.points !== props.points ||
    previous.isClosed !== props.isClosed ||
    previous.color !== props.color ||
    previous.fillColor !== props.fillColor ||
    previous.strokeWidth !== props.strokeWidth ||
    previous.fill !== props.fill
  )
}

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
  const shapePropsRef = useRef<Map<string, ShapePropsSnapshot>>(new Map())

  // Track original bounds when editing begins for proper compensation
  const originalBoundsRef = useRef<Map<string, BoundsSnapshot>>(new Map())

  // Track original instance positions to prevent cumulative compensation
  const originalInstancePositionsRef = useRef<Map<string, Map<string, { x: number; y: number }>>>(new Map())

  // Monitor all shapes for edit mode changes
  const trackedBezierInstances = useValue(
    'custom-shape-instance-manager:bezier-instances',
    () => Array.from(editor.getCurrentPageShapes()).filter((shape): shape is BezierShape => {
      return shape.type === 'bezier' && shape.meta?.isCustomShapeInstance === true
    }),
    [editor]
  )

  const handleLivePropertyChange = useCallback((shape: BezierShape) => {
    const customShapeId = typeof shape.meta?.customShapeId === 'string' ? shape.meta.customShapeId : null
    if (!customShapeId) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    if (BEZIER_DEBUG) {
      console.log(`Live update for custom shape instance: ${customShapeId}`)
    }

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

      if (BEZIER_DEBUG) {
        console.log(`Live updated other instances for: ${customShapeId}`)
      }
    } catch (error) {
      console.error(`Failed to live update custom shape ${customShapeId}:`, error)
    }
  }, [getCustomShape, getInstancesForCustomShape, updateAllInstances])

  const handleEditModeExit = useCallback((shape: BezierShape) => {
    const customShapeId = typeof shape.meta?.customShapeId === 'string' ? shape.meta.customShapeId : null
    if (!customShapeId) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    if (BEZIER_DEBUG) {
      console.log(`Edit mode ended for custom shape instance: ${customShapeId}`)
    }

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

      if (BEZIER_DEBUG) {
        console.log(`Updated custom shape definition and all instances for: ${customShapeId}`)
      }
    } catch (error) {
      console.error(`Failed to update custom shape ${customShapeId}:`, error)
    }
  }, [getCustomShape, updateCustomShape, getInstancesForCustomShape, updateAllInstances])

  useEffect(() => {
    // Process all custom shape instances for state changes
    trackedBezierInstances.forEach(shape => {
      const bezierShape = shape as BezierShape
      const shapeId = shape.id
      const isInEditMode = bezierShape.props.editMode === true
      const wasInEditMode = editStateRef.current.get(shapeId) === true

      editStateRef.current.set(shapeId, isInEditMode)

      if (isInEditMode) {
        const previousProps = shapePropsRef.current.get(shapeId)
        if (havePropsChanged(previousProps, bezierShape.props)) {
          handleLivePropertyChange(bezierShape)
        }

        shapePropsRef.current.set(shapeId, createSnapshot(bezierShape.props))
      }

      if (wasInEditMode && !isInEditMode) {
        handleEditModeExit(bezierShape)
        shapePropsRef.current.delete(shapeId)
        originalBoundsRef.current.delete(shapeId)
        const customShapeId = typeof bezierShape.meta?.customShapeId === 'string'
          ? bezierShape.meta.customShapeId
          : null
        if (customShapeId) {
          originalInstancePositionsRef.current.delete(customShapeId)
        }
      }

      if (!wasInEditMode && isInEditMode) {
        shapePropsRef.current.set(shapeId, createSnapshot(bezierShape.props))

        const originalBounds = BezierBounds.getAccurateBounds(
          bezierShape.props.points,
          bezierShape.props.isClosed
        )
        originalBoundsRef.current.set(shapeId, originalBounds)

        const customShapeId = typeof bezierShape.meta?.customShapeId === 'string'
          ? bezierShape.meta.customShapeId
          : null
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
  }, [trackedBezierInstances, getInstancesForCustomShape, handleEditModeExit, handleLivePropertyChange])

  // Cleanup edit state tracking for deleted shapes
  useEffect(() => {
    const currentShapeIds = new Set(trackedBezierInstances.map(s => s.id))
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
  }, [trackedBezierInstances])

  return {
    // Expose some utilities if needed
    isTrackingShape: (shapeId: string) => editStateRef.current.has(shapeId)
  }
}
