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
      // Calculate the original bounds from the custom shape definition to track changes
      const originalBounds = BezierBounds.getAccurateBounds(
        customShape.defaultProps.points as BezierPoint[],
        customShape.defaultProps.isClosed as boolean
      )

      // Normalize the points to ensure they're relative to the shape's origin
      // This prevents position drift when other instances are at different positions
      const { normalizedPoints } = normalizeBezierPoints(shape.props.points)

      // Calculate the bounds using the same method as BezierShape for consistency
      const bounds = BezierBounds.getAccurateBounds(normalizedPoints, shape.props.isClosed)
      const w = Math.max(1, bounds.maxX - bounds.minX)
      const h = Math.max(1, bounds.maxY - bounds.minY)

      // Calculate bounds offset to compensate for position changes
      const boundsOffset = {
        x: bounds.minX - originalBounds.minX,
        y: bounds.minY - originalBounds.minY
      }

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
        updateAllInstances(customShapeId, {
          props: liveProps
        }, shape.id, boundsOffset)
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
      // Calculate the original bounds from the custom shape definition to track changes
      const originalBounds = BezierBounds.getAccurateBounds(
        customShape.defaultProps.points as BezierPoint[],
        customShape.defaultProps.isClosed as boolean
      )

      // Convert the edited shape back to a custom tray item format
      const updatedCustomShape = bezierShapeToCustomTrayItem(shape, customShape.label)

      // Calculate the new bounds to determine position offset
      const newBounds = BezierBounds.getAccurateBounds(
        updatedCustomShape.defaultProps.points as BezierPoint[],
        updatedCustomShape.defaultProps.isClosed as boolean
      )

      // Calculate bounds offset for position compensation
      const boundsOffset = {
        x: newBounds.minX - originalBounds.minX,
        y: newBounds.minY - originalBounds.minY
      }

      // Update the custom shape definition
      updateCustomShape(customShapeId, {
        iconSvg: updatedCustomShape.iconSvg,
        defaultProps: updatedCustomShape.defaultProps
      })

      // Update all other instances with the new properties and position compensation
      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstances = allInstances.filter(instance => instance.id !== shape.id)

      if (otherInstances.length > 0) {
        updateAllInstances(customShapeId, {
          props: updatedCustomShape.defaultProps
        }, shape.id, boundsOffset)
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
      }
    })
  }, [allShapes])

  return {
    // Expose some utilities if needed
    isTrackingShape: (shapeId: string) => editStateRef.current.has(shapeId)
  }
}