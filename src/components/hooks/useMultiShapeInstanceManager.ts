import { useEffect, useRef } from 'react'
import { useEditor, useValue } from 'tldraw'
import { useCustomShapeInstances } from './useCustomShapeInstances'
import { useCustomShapes } from './useCustomShapes'
import { bezierShapeToCustomTrayItem, normalizeBezierPoints } from '../utils/bezierToCustomShape'
import { combineShapesToCustom } from '../utils/multiShapeToCustomShape'
import { BezierBounds } from '../shapes/services/BezierBounds'
import type { BezierShape, BezierPoint } from '../shapes/BezierShape'
import type { TLShape } from 'tldraw'

/**
 * Enhanced manager hook that monitors custom shape instance editing for all shape types
 * Supports both single-shape and multi-shape custom shapes with group editing
 */
export function useMultiShapeInstanceManager() {
  const editor = useEditor()
  const { updateAllInstances, getInstancesForCustomShape } = useCustomShapeInstances()
  const { getCustomShape, updateCustomShape } = useCustomShapes()

  // Track edit states to detect when editing ends
  const editStateRef = useRef<Map<string, boolean>>(new Map())

  // Track shape properties to detect live changes during edit mode
  const shapePropsRef = useRef<Map<string, any>>(new Map())

  // Track original bounds when editing begins for proper compensation (bezier shapes only)
  const originalBoundsRef = useRef<Map<string, { minX: number; minY: number; maxX: number; maxY: number }>>(new Map())

  // Track original instance positions to prevent cumulative compensation
  const originalInstancePositionsRef = useRef<Map<string, Map<string, { x: number; y: number }>>>(new Map())

  // Track group edit mode - when true, changes to any shape in a group will sync to all instances
  const groupEditModeRef = useRef<Map<string, boolean>>(new Map())

  // Monitor all shapes for edit mode changes
  const allShapes = useValue(
    'all-shapes-for-multi-instance-manager',
    () => Array.from(editor.getCurrentPageShapes()),
    [editor]
  )

  // Monitor TLDraw's current editing state to detect group editing
  const editingShapeId = useValue(
    'editing-shape-id',
    () => editor.getEditingShapeId(),
    [editor]
  )

  // Check if we're currently editing inside a custom shape group
  const isEditingCustomShapeGroup = useValue(
    'is-editing-custom-shape-group',
    () => {
      if (!editingShapeId) return false

      const editingShape = editor.getShape(editingShapeId)
      if (!editingShape) return false

      // Check if the editing shape is part of a custom shape group
      return editingShape.meta?.isGroupChild === true ||
             editingShape.meta?.isCustomShapeInstance === true
    },
    [editor, editingShapeId]
  )

  // Handle TLDraw's native group editing detection and synchronization
  useEffect(() => {
    if (!isEditingCustomShapeGroup || !editingShapeId) return

    const editingShape = editor.getShape(editingShapeId)
    if (!editingShape) return

    // Find the group that contains this shape
    const parentGroupId = editingShape.parentId
    const parentGroup = parentGroupId ? editor.getShape(parentGroupId) : null

    // Check if this is a custom shape group being edited
    if (parentGroup?.meta?.isMultiShapeGroup && parentGroup?.meta?.customShapeId) {
      const customShapeId = parentGroup.meta.customShapeId as string
      const instanceId = parentGroup.meta.instanceId as string

      console.log(`Detected TLDraw group editing for custom shape: ${customShapeId}`)

      // Find all child shapes of this group instead of using stored IDs
      const allShapes = editor.getCurrentPageShapes()
      const childShapes = allShapes.filter(shape => shape.parentId === parentGroup.id)

      // Update metadata to indicate native group editing is active
      const updatedShapes = childShapes.map(shape => ({
        ...shape!,
        meta: {
          ...shape!.meta,
          groupEditMode: true,
          nativeGroupEdit: true // Flag to distinguish from keyboard shortcut editing
        }
      }))

      if (updatedShapes.length > 0) {
        editor.updateShapes(updatedShapes)
      }
    }
  }, [editor, isEditingCustomShapeGroup, editingShapeId, allShapes])

  // Handle exiting TLDraw's native group editing
  useEffect(() => {
    if (isEditingCustomShapeGroup) return // Still editing

    // Find any shapes that were in native group edit mode and clean them up
    const shapesInNativeGroupEdit = allShapes.filter(shape =>
      shape.meta?.nativeGroupEdit === true
    )

    if (shapesInNativeGroupEdit.length > 0) {
      console.log('Exiting TLDraw native group editing')

      // Clear native group edit flags
      const updatedShapes = shapesInNativeGroupEdit.map(shape => ({
        ...shape,
        meta: {
          ...shape.meta,
          groupEditMode: false,
          nativeGroupEdit: false
        }
      }))

      editor.updateShapes(updatedShapes)

      // Trigger final synchronization for each custom shape that was being edited
      const customShapeIds = new Set(
        shapesInNativeGroupEdit
          .map(shape => shape.meta?.customShapeId as string)
          .filter(Boolean)
      )

      customShapeIds.forEach(customShapeId => {
        const representativeShape = shapesInNativeGroupEdit.find(
          shape => shape.meta?.customShapeId === customShapeId
        )
        if (representativeShape) {
          handleGroupEditModeExit(representativeShape, customShapeId)
        }
      })
    }
  }, [editor, isEditingCustomShapeGroup, allShapes])

  useEffect(() => {
    // Process all custom shape instances for state changes
    allShapes.forEach(shape => {
      // Only handle shapes that are custom shape instances
      if (!shape.meta?.isCustomShapeInstance) {
        return
      }

      const shapeId = shape.id
      const customShapeId = shape.meta?.customShapeId as string
      const isInGroupEditMode = shape.meta?.groupEditMode === true
      const isInNativeGroupEdit = shape.meta?.nativeGroupEdit === true

      // Update group edit mode tracking (both custom and native)
      groupEditModeRef.current.set(shapeId, isInGroupEditMode || isInNativeGroupEdit)

      // Handle different shape types differently
      if (shape.type === 'bezier') {
        handleBezierShapeChanges(shape as BezierShape, customShapeId, isInGroupEditMode || isInNativeGroupEdit)
      } else {
        handleGenericShapeChanges(shape, customShapeId, isInGroupEditMode || isInNativeGroupEdit)
      }
    })

    // Clean up tracking for deleted shapes
    const currentShapeIds = new Set(allShapes.map(s => s.id))
    const trackedShapeIds = Array.from(editStateRef.current.keys())

    trackedShapeIds.forEach(shapeId => {
      if (!currentShapeIds.has(shapeId)) {
        editStateRef.current.delete(shapeId)
        shapePropsRef.current.delete(shapeId)
        originalBoundsRef.current.delete(shapeId)
        groupEditModeRef.current.delete(shapeId)
      }
    })
  }, [allShapes])

  /**
   * Handle bezier shape changes (existing logic with group edit mode support)
   */
  const handleBezierShapeChanges = (shape: BezierShape, customShapeId: string, isInGroupEditMode: boolean) => {
    const shapeId = shape.id
    const isInEditMode = shape.props.editMode === true || isInGroupEditMode
    const wasInEditMode = editStateRef.current.get(shapeId) === true

    // Update current edit state
    editStateRef.current.set(shapeId, isInEditMode)

    // Handle live property changes during edit mode
    if (isInEditMode) {
      const currentProps = JSON.stringify({
        points: shape.props.points,
        isClosed: shape.props.isClosed,
        color: shape.props.color,
        fillColor: shape.props.fillColor,
        strokeWidth: shape.props.strokeWidth,
        fill: shape.props.fill,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation
      })

      const previousProps = shapePropsRef.current.get(shapeId)

      if (previousProps && previousProps !== currentProps) {
        // Properties changed during edit mode - update other instances live
        if (isInGroupEditMode) {
          handleGroupLivePropertyChange(shape, customShapeId)
        } else {
          handleLivePropertyChange(shape)
        }
      }

      // Store current props for next comparison
      shapePropsRef.current.set(shapeId, currentProps)
    }

    // Detect transition from edit mode to normal mode
    if (wasInEditMode && !isInEditMode) {
      if (isInGroupEditMode) {
        handleGroupEditModeExit(shape, customShapeId)
      } else {
        handleEditModeExit(shape)
      }
      // Clean up tracking state
      cleanupShapeTracking(shapeId, customShapeId)
    }

    // Initialize tracking when entering edit mode
    if (!wasInEditMode && isInEditMode) {
      initializeShapeTracking(shape, customShapeId)
    }
  }

  /**
   * Handle generic shape changes (non-bezier shapes in group edit mode)
   */
  const handleGenericShapeChanges = (shape: TLShape, customShapeId: string, isInGroupEditMode: boolean) => {
    if (!isInGroupEditMode) return

    const shapeId = shape.id
    const wasInEditMode = editStateRef.current.get(shapeId) === true

    // Update current edit state
    editStateRef.current.set(shapeId, isInGroupEditMode)

    // Handle live property changes during group edit mode
    if (isInGroupEditMode) {
      const currentProps = JSON.stringify({
        ...shape.props,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation
      })

      const previousProps = shapePropsRef.current.get(shapeId)

      if (previousProps && previousProps !== currentProps) {
        // Properties changed during group edit mode - update other instances
        handleGroupLivePropertyChange(shape, customShapeId)
      }

      // Store current props for next comparison
      shapePropsRef.current.set(shapeId, currentProps)
    }

    // Detect transition from group edit mode to normal mode
    if (wasInEditMode && !isInGroupEditMode) {
      handleGroupEditModeExit(shape, customShapeId)
      cleanupShapeTracking(shapeId, customShapeId)
    }

    // Initialize tracking when entering group edit mode
    if (!wasInEditMode && isInGroupEditMode) {
      initializeShapeTracking(shape, customShapeId)
    }
  }

  /**
   * Initialize tracking when a shape enters edit mode
   */
  const initializeShapeTracking = (shape: TLShape, customShapeId: string) => {
    const shapeId = shape.id

    // Initialize props tracking
    let initialProps: any
    if (shape.type === 'bezier') {
      const bezierShape = shape as BezierShape
      initialProps = JSON.stringify({
        points: bezierShape.props.points,
        isClosed: bezierShape.props.isClosed,
        color: bezierShape.props.color,
        fillColor: bezierShape.props.fillColor,
        strokeWidth: bezierShape.props.strokeWidth,
        fill: bezierShape.props.fill,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation
      })

      // Store original bounds for bezier shapes
      const originalBounds = BezierBounds.getAccurateBounds(bezierShape.props.points, bezierShape.props.isClosed)
      originalBoundsRef.current.set(shapeId, originalBounds)
    } else {
      initialProps = JSON.stringify({
        ...shape.props,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation
      })
    }

    shapePropsRef.current.set(shapeId, initialProps)

    // Store original positions of all instances when editing begins
    const instances = getInstancesForCustomShape(customShapeId)
    const instancePositions = new Map<string, { x: number; y: number }>()
    instances.forEach(instance => {
      instancePositions.set(instance.id, { x: instance.x, y: instance.y })
    })
    originalInstancePositionsRef.current.set(customShapeId, instancePositions)
  }

  /**
   * Clean up tracking when a shape exits edit mode
   */
  const cleanupShapeTracking = (shapeId: string, customShapeId: string) => {
    shapePropsRef.current.delete(shapeId)
    originalBoundsRef.current.delete(shapeId)
    originalInstancePositionsRef.current.delete(customShapeId)
  }

  /**
   * Handle live property changes for bezier shapes (existing logic)
   */
  const handleLivePropertyChange = (shape: BezierShape) => {
    const customShapeId = shape.meta?.customShapeId as string
    if (!customShapeId) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Live update for bezier custom shape instance: ${customShapeId}`)

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
        editMode: false,
        selectedPointIndices: [],
        hoverPoint: undefined,
        hoverSegmentIndex: undefined
      }

      // Update all OTHER instances (not the one being edited)
      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstances = allInstances.filter(instance => instance.id !== shape.id)

      if (otherInstances.length > 0) {
        // Apply position compensation during live editing
        const originalPositions = originalInstancePositionsRef.current.get(customShapeId)
        updateAllInstances(customShapeId, {
          props: liveProps
        }, shape.id, boundsOffset, originalPositions)
      }

      console.log(`Live updated other bezier instances for: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to live update bezier custom shape ${customShapeId}:`, error)
    }
  }

  /**
   * Handle live property changes for group edit mode (multi-shape or any shape type)
   */
  const handleGroupLivePropertyChange = (shape: TLShape, customShapeId: string) => {
    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Group live update for custom shape instance: ${customShapeId}`)

    try {
      // Get all shapes that belong to this instance group
      const allShapes = editor.getCurrentPageShapes()
      const instanceId = shape.meta?.instanceId as string
      const groupShapes = allShapes.filter(s =>
        s.meta?.customShapeId === customShapeId &&
        s.meta?.instanceId === instanceId &&
        s.meta?.groupEditMode === true
      )

      if (groupShapes.length === 0) {
        console.warn('No group shapes found for instance:', instanceId)
        return
      }

      // Calculate the updated template definition from the current group state
      const updatedTemplateData = createUpdatedTemplateFromGroup(groupShapes, customShape.label)

      // Update the custom shape definition
      updateCustomShape(customShapeId, {
        iconSvg: updatedTemplateData.iconSvg,
        defaultProps: updatedTemplateData.defaultProps
      })

      // Update all OTHER instances with the new group structure
      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstanceIds = new Set(
        allInstances
          .filter(instance => instance.meta?.instanceId !== instanceId)
          .map(instance => instance.meta?.instanceId as string)
      )

      // For each other instance, update all its shapes
      otherInstanceIds.forEach(otherInstanceId => {
        const otherInstanceShapes = allShapes.filter(s =>
          s.meta?.customShapeId === customShapeId &&
          s.meta?.instanceId === otherInstanceId
        )

        updateInstanceGroupFromTemplate(otherInstanceShapes, updatedTemplateData.defaultProps, customShapeId)
      })

      console.log(`Group live updated other instances for: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to group live update custom shape ${customShapeId}:`, error)
    }
  }

  /**
   * Create updated template data from the current group state
   */
  const createUpdatedTemplateFromGroup = (groupShapes: TLShape[], label: string) => {
    if (groupShapes.length === 1 && groupShapes[0].type === 'bezier') {
      // Single bezier shape
      return bezierShapeToCustomTrayItem(groupShapes[0] as BezierShape, label)
    } else {
      // Multi-shape group
      return combineShapesToCustom(groupShapes, editor, label)
    }
  }

  /**
   * Update an instance group from the template data
   */
  const updateInstanceGroupFromTemplate = (instanceShapes: TLShape[], templateProps: any, customShapeId: string) => {
    if (!templateProps.shapes) {
      // Single shape template
      if (instanceShapes.length === 1) {
        const shape = instanceShapes[0]
        const updatedShape = {
          ...shape,
          props: {
            ...shape.props,
            ...templateProps
          }
        }
        editor.updateShape(updatedShape)
      }
    } else {
      // Multi-shape template
      const templateShapes = templateProps.shapes as TLShape[]

      // Match instance shapes to template shapes by type and index
      templateShapes.forEach((templateShape, index) => {
        const instanceShape = instanceShapes.find(s =>
          s.type === templateShape.type
          // Could add more sophisticated matching logic here
        )

        if (instanceShape) {
          const updatedShape = {
            ...instanceShape,
            props: {
              ...instanceShape.props,
              ...templateShape.props
            },
            // Maintain instance position but update relative positioning if needed
            x: instanceShape.x + (templateShape.x || 0),
            y: instanceShape.y + (templateShape.y || 0)
          }
          editor.updateShape(updatedShape)
        }
      })
    }
  }

  /**
   * Handle edit mode exit for bezier shapes (existing logic)
   */
  const handleEditModeExit = (shape: BezierShape) => {
    const customShapeId = shape.meta?.customShapeId as string
    if (!customShapeId) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Edit mode ended for bezier custom shape instance: ${customShapeId}`)

    try {
      // Convert the edited shape back to a custom tray item format
      const updatedCustomShape = bezierShapeToCustomTrayItem(shape, customShape.label)

      // Update the custom shape definition
      updateCustomShape(customShapeId, {
        iconSvg: updatedCustomShape.iconSvg,
        defaultProps: updatedCustomShape.defaultProps
      })

      // Update all other instances with the new properties
      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstances = allInstances.filter(instance => instance.id !== shape.id)

      if (otherInstances.length > 0) {
        updateAllInstances(customShapeId, {
          props: updatedCustomShape.defaultProps
        }, shape.id)
      }

      console.log(`Updated bezier custom shape definition and all instances for: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to update bezier custom shape ${customShapeId}:`, error)
    }
  }

  /**
   * Handle group edit mode exit (multi-shape or any shape type)
   */
  const handleGroupEditModeExit = (shape: TLShape, customShapeId: string) => {
    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Group edit mode ended for custom shape instance: ${customShapeId}`)

    try {
      // Get all shapes that were in this group edit session
      const allShapes = editor.getCurrentPageShapes()
      const instanceId = shape.meta?.instanceId as string
      const groupShapes = allShapes.filter(s =>
        s.meta?.customShapeId === customShapeId &&
        s.meta?.instanceId === instanceId
      )

      if (groupShapes.length === 0) {
        console.warn('No group shapes found for final update:', instanceId)
        return
      }

      // Create the final updated template
      const updatedTemplateData = createUpdatedTemplateFromGroup(groupShapes, customShape.label)

      // Update the custom shape definition
      updateCustomShape(customShapeId, {
        iconSvg: updatedTemplateData.iconSvg,
        defaultProps: updatedTemplateData.defaultProps
      })

      // Update all other instances with the final group structure
      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstanceIds = new Set(
        allInstances
          .filter(instance => instance.meta?.instanceId !== instanceId)
          .map(instance => instance.meta?.instanceId as string)
      )

      otherInstanceIds.forEach(otherInstanceId => {
        const otherInstanceShapes = allShapes.filter(s =>
          s.meta?.customShapeId === customShapeId &&
          s.meta?.instanceId === otherInstanceId
        )

        updateInstanceGroupFromTemplate(otherInstanceShapes, updatedTemplateData.defaultProps, customShapeId)
      })

      console.log(`Updated custom shape definition and all instances after group edit: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to update custom shape after group edit ${customShapeId}:`, error)
    }
  }

  return {
    // Expose some utilities if needed
    isTrackingShape: (shapeId: string) => editStateRef.current.has(shapeId),
    isShapeInGroupEditMode: (shapeId: string) => groupEditModeRef.current.get(shapeId) || false
  }
}