import { useEffect, useRef, useCallback } from 'react'
import { useEditor, useValue, type TLShapeId } from 'tldraw'
import { useCustomShapeInstances } from './useCustomShapeInstances'
import { useCustomShapes } from './useCustomShapes'
import { bezierShapeToCustomTrayItem, normalizeBezierPoints } from '../utils/bezierToCustomShape'
import {
  combineShapesToCustom,
  isMultiShapeDefaultProps,
  sanitizeMeta,
  RESERVED_META_KEYS,
  cloneShapeProps
} from '../utils/multiShapeToCustomShape'
import { BezierBounds } from '../shapes/services/BezierBounds'
import type { BezierShape } from '../shapes/BezierShape'
import type { TLShape, Editor } from 'tldraw'
import type { JsonObject } from '@tldraw/utils'

interface BoundsSnapshot {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface ShapePosition {
  x: number
  y: number
}

type ShapeUpdate = Parameters<Editor['updateShapes']>[0][number]

function extractCustomShapeId(shape: TLShape): string | null {
  const value = shape.meta?.customShapeId
  return typeof value === 'string' ? value : null
}

function extractInstanceId(shape: TLShape): string | null {
  const value = shape.meta?.instanceId
  return typeof value === 'string' ? value : null
}

function sortShapesByIndex(shapes: TLShape[]): TLShape[] {
  return [...shapes].sort((a, b) => a.index.localeCompare(b.index))
}

function partitionGroupAndChildren(shapes: TLShape[]): { group: TLShape | null; children: TLShape[] } {
  let group: TLShape | null = null
  const children: TLShape[] = []

  shapes.forEach(shape => {
    if (shape.type === 'group' && shape.meta?.isMultiShapeGroup) {
      group = shape
      return
    }

    if (shape.meta?.isGroupChild === true || shape.meta?.isCustomShapeInstance === true) {
      children.push(shape)
      return
    }

    // Fallback: treat shape as child if no explicit metadata
    children.push(shape)
  })

  return { group, children }
}

function mergeInstanceMeta(
  currentMeta: Record<string, unknown> | undefined,
  templateMeta: Record<string, unknown> | undefined,
  overrides: Record<string, unknown>
): JsonObject {
  const meta: Record<string, unknown> = {}

  if (currentMeta) {
    Object.assign(meta, currentMeta)
  }

  const sanitizedTemplate = sanitizeMeta(templateMeta)
  if (sanitizedTemplate) {
    Object.entries(sanitizedTemplate).forEach(([key, value]) => {
      if (RESERVED_META_KEYS.has(key)) return
      meta[key] = value
    })
  }

  Object.assign(meta, overrides)

  return meta as JsonObject
}

/**
 * Enhanced manager hook that monitors custom shape instance editing for all shape types
 * Supports both single-shape and multi-shape custom shapes with group editing
 */
export function useMultiShapeInstanceManager() {
  const editor = useEditor()
  const { updateAllInstances, getInstancesForCustomShape } = useCustomShapeInstances()
  const { getCustomShape, updateCustomShape } = useCustomShapes()

  // Track edit states to detect when editing ends
  const editStateRef = useRef<Map<TLShapeId, boolean>>(new Map())

  // Track shape properties to detect live changes during edit mode
  const shapePropsRef = useRef<Map<TLShapeId, string>>(new Map())

  // Track original bounds when editing begins for proper compensation (bezier shapes only)
  const originalBoundsRef = useRef<Map<TLShapeId, BoundsSnapshot>>(new Map())

  // Track original instance positions to prevent cumulative compensation
  const originalInstancePositionsRef = useRef<Map<string, Map<TLShapeId, ShapePosition>>>(new Map())

  // Track group edit mode - when true, changes to any shape in a group will sync to all instances
  const groupEditModeRef = useRef<Map<TLShapeId, boolean>>(new Map())

  const storeOriginalInstancePositions = useCallback((customShapeId: string) => {
    const instances = getInstancesForCustomShape(customShapeId)
    const instancePositions = new Map<TLShapeId, ShapePosition>()
    instances.forEach(instance => {
      instancePositions.set(instance.id, { x: instance.x, y: instance.y })
    })
    originalInstancePositionsRef.current.set(customShapeId, instancePositions)
  }, [getInstancesForCustomShape])

  const cleanupShapeTracking = useCallback((shapeId: TLShapeId, customShapeId: string) => {
    shapePropsRef.current.delete(shapeId)
    originalBoundsRef.current.delete(shapeId)
    originalInstancePositionsRef.current.delete(customShapeId)
  }, [])

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
    if (parentGroup?.meta?.isMultiShapeGroup) {
      const customShapeId = extractCustomShapeId(parentGroup)
      const instanceId = extractInstanceId(parentGroup)
      if (!customShapeId || !instanceId) {
        return
      }

      console.log(`Detected TLDraw group editing for custom shape: ${customShapeId}`)

      // Find all child shapes of this group instead of using stored IDs
      const allShapes = editor.getCurrentPageShapes()
      const childShapes = allShapes.filter(shape => shape.parentId === parentGroup.id)

      // Update metadata to indicate native group editing is active
      const updatedShapes: ShapeUpdate[] = childShapes.map(shape => ({
        id: shape.id,
        type: shape.type,
        meta: {
          ...shape.meta,
          groupEditMode: true,
          nativeGroupEdit: true
        }
      }))

      if (updatedShapes.length > 0) {
        editor.updateShapes(updatedShapes)
      }
    }
  }, [editor, isEditingCustomShapeGroup, editingShapeId])

  /**
   * Initialize tracking when a shape enters edit mode
   */
  const initializeShapeTracking = useCallback((shape: TLShape, customShapeId: string) => {
    const shapeId = shape.id

    // Initialize props tracking
    let initialProps: string
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
    storeOriginalInstancePositions(customShapeId)
  }, [storeOriginalInstancePositions])

  /**
   * Handle live property changes for bezier shapes (existing logic)
   */
  const handleLivePropertyChange = useCallback((shape: BezierShape) => {
    const customShapeId = extractCustomShapeId(shape)
    if (!customShapeId) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Live update for bezier custom shape instance: ${customShapeId}`)

    try {
      const originalBounds = originalBoundsRef.current.get(shape.id)
      if (!originalBounds) {
        console.warn('No original bounds found for shape', shape.id)
        return
      }

      const currentBounds = BezierBounds.getAccurateBounds(shape.props.points, shape.props.isClosed)

      const boundsOffset = {
        x: currentBounds.minX - originalBounds.minX,
        y: currentBounds.minY - originalBounds.minY
      }

      const { normalizedPoints } = normalizeBezierPoints(shape.props.points)

      const normalizedBounds = BezierBounds.getAccurateBounds(normalizedPoints, shape.props.isClosed)
      const w = Math.max(1, normalizedBounds.maxX - normalizedBounds.minX)
      const h = Math.max(1, normalizedBounds.maxY - normalizedBounds.minY)

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

      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstances = allInstances.filter(instance => instance.id !== shape.id)

      if (otherInstances.length > 0) {
        const originalPositions = originalInstancePositionsRef.current.get(customShapeId)
        updateAllInstances(customShapeId, { props: liveProps }, shape.id, boundsOffset, originalPositions)
      }

      console.log(`Live updated other bezier instances for: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to live update bezier custom shape ${customShapeId}:`, error)
    }
  }, [getCustomShape, getInstancesForCustomShape, updateAllInstances])

  /**
   * Handle live property changes for group edit mode (multi-shape or any shape type)
   */
  const createUpdatedTemplateFromGroup = useCallback((groupShapes: TLShape[], label: string) => {
    if (groupShapes.length === 1 && groupShapes[0].type === 'bezier') {
      return bezierShapeToCustomTrayItem(groupShapes[0] as BezierShape, label)
    }

    return combineShapesToCustom(groupShapes, editor, label)
  }, [editor])

  const updateInstanceGroupFromTemplate = useCallback((
    instanceShapes: TLShape[],
    templateDefaultProps: Record<string, unknown>,
    customShapeId: string,
    nextVersion: number
  ) => {
    if (instanceShapes.length === 0) return

    const updates: ShapeUpdate[] = []

    if (!isMultiShapeDefaultProps(templateDefaultProps)) {
      const shape = instanceShapes[0]
      const singleInstanceId = extractInstanceId(shape) ?? extractInstanceId(instanceShapes[0])
      const overrides: Record<string, unknown> = {
        customShapeId,
        isCustomShapeInstance: true as const,
        version: nextVersion,
        groupEditMode: false
      }

      if (singleInstanceId) {
        overrides.instanceId = singleInstanceId
      }

      const mergedMeta = mergeInstanceMeta(
        shape.meta as Record<string, unknown> | undefined,
        undefined,
        overrides
      )

      const templateProps = cloneShapeProps(templateDefaultProps as Record<string, unknown>)
      const propsUpdate = {
        ...shape.props,
        ...templateProps
      }

      updates.push({
        id: shape.id,
        type: shape.type,
        props: propsUpdate,
        meta: mergedMeta
      })
    } else {
      const { group, children } = partitionGroupAndChildren(instanceShapes)
      const sortedChildren = sortShapesByIndex(children)
      const templateChildren = templateDefaultProps.shapes

      sortedChildren.forEach((instanceShape, index) => {
        const definition = templateChildren[index]
        if (!definition) return

        const instanceId = extractInstanceId(instanceShape) ?? extractInstanceId(group ?? instanceShape)

        const overrides: Record<string, unknown> = {
          customShapeId,
          isCustomShapeInstance: true as const,
          version: nextVersion,
          groupEditMode: false,
          isGroupChild: true
        }

        if (instanceId) {
          overrides.instanceId = instanceId
        }

        const mergedMeta = mergeInstanceMeta(
          instanceShape.meta as Record<string, unknown> | undefined,
          definition.meta,
          overrides
        )

        const propsUpdate = {
          ...instanceShape.props,
          ...cloneShapeProps(definition.props)
        }

        const shapeUpdate: ShapeUpdate = {
          id: instanceShape.id,
          type: instanceShape.type,
          props: propsUpdate,
          x: definition.localTransform.x,
          y: definition.localTransform.y,
          rotation: definition.localTransform.rotation,
          meta: mergedMeta
        }

        if (typeof definition.opacity === 'number') {
          shapeUpdate.opacity = definition.opacity
        }

        if (typeof definition.isLocked === 'boolean') {
          shapeUpdate.isLocked = definition.isLocked
        }

        updates.push(shapeUpdate)
      })

      if (group) {
        const groupInstanceId = extractInstanceId(group) ?? extractInstanceId(sortedChildren[0])
        const groupOverrides: Record<string, unknown> = {
          customShapeId,
          isCustomShapeInstance: true as const,
          version: nextVersion,
          isMultiShapeGroup: true,
          groupEditMode: false,
          nativeGroupEdit: false
        }

        if (groupInstanceId) {
          groupOverrides.instanceId = groupInstanceId
        }

        const groupMeta = mergeInstanceMeta(
          group.meta as Record<string, unknown> | undefined,
          undefined,
          groupOverrides
        )

        updates.push({
          id: group.id,
          type: group.type,
          meta: groupMeta
        })
      }
    }

    if (updates.length > 0) {
      editor.updateShapes(updates)
    }
  }, [editor])

  const handleGroupLivePropertyChange = useCallback((shape: TLShape, customShapeId: string) => {
    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Group live update for custom shape instance: ${customShapeId}`)

    try {
      const nextVersion = (customShape.version ?? 1) + 1

      // Get all shapes that belong to this instance group
      const allShapes = editor.getCurrentPageShapes()
      const instanceId = extractInstanceId(shape)
      if (!instanceId) {
        console.warn('No instance id found for shape during group update')
        return
      }
      const groupShapes = allShapes.filter(s =>
        extractCustomShapeId(s) === customShapeId &&
        extractInstanceId(s) === instanceId &&
        s.meta?.groupEditMode === true
      )

      if (groupShapes.length === 0) {
        console.warn('No group shapes found for instance:', instanceId)
        return
      }

      // Calculate the updated template definition from the current group state
      const templateSourceShapes = groupShapes.filter(s => s.type !== 'group')
      if (templateSourceShapes.length === 0) {
        console.warn('No editable shapes found in group for template update')
        return
      }

      const updatedTemplateData = createUpdatedTemplateFromGroup(templateSourceShapes, customShape.label)

      // Update the custom shape definition
      updateCustomShape(customShapeId, {
        iconSvg: updatedTemplateData.iconSvg,
        defaultProps: updatedTemplateData.defaultProps
      })

      // Update all OTHER instances with the new group structure
      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstanceIds = new Set(
        allInstances
          .map(instance => extractInstanceId(instance))
          .filter((id): id is string => !!id && id !== instanceId)
      )

      // For each other instance, update all its shapes
      otherInstanceIds.forEach(otherInstanceId => {
        const otherInstanceShapes = allShapes.filter(s =>
          extractCustomShapeId(s) === customShapeId &&
          extractInstanceId(s) === otherInstanceId
        )

        updateInstanceGroupFromTemplate(
          otherInstanceShapes,
          updatedTemplateData.defaultProps,
          customShapeId,
          nextVersion
        )
      })

      console.log(`Group live updated other instances for: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to group live update custom shape ${customShapeId}:`, error)
    }
  }, [createUpdatedTemplateFromGroup, editor, getCustomShape, getInstancesForCustomShape, updateCustomShape, updateInstanceGroupFromTemplate])

  /**
   * Handle edit mode exit for bezier shapes (existing logic)
   */
  const handleEditModeExit = useCallback((shape: BezierShape) => {
    const customShapeId = extractCustomShapeId(shape)
    if (!customShapeId) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    console.log(`Edit mode ended for bezier custom shape instance: ${customShapeId}`)

    try {
      const updatedCustomShape = bezierShapeToCustomTrayItem(shape, customShape.label)

      updateCustomShape(customShapeId, {
        iconSvg: updatedCustomShape.iconSvg,
        defaultProps: updatedCustomShape.defaultProps
      })

      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstances = allInstances.filter(instance => instance.id !== shape.id)

      if (otherInstances.length > 0) {
        updateAllInstances(customShapeId, { props: updatedCustomShape.defaultProps }, shape.id)
      }

      console.log(`Updated bezier custom shape definition and all instances for: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to update bezier custom shape ${customShapeId}:`, error)
    }
  }, [getCustomShape, getInstancesForCustomShape, updateAllInstances, updateCustomShape])

  /**
   * Handle group edit mode exit (multi-shape or any shape type)
   */
  const handleGroupEditModeExit = useCallback((shape: TLShape, customShapeId: string) => {
    const customShape = getCustomShape(customShapeId)
    if (!customShape) {
      console.warn(`Custom shape definition not found for ID: ${customShapeId}`)
      return
    }

    const instanceId = extractInstanceId(shape)
    if (!instanceId) {
      console.warn('No instance id found for shape during group exit')
      return
    }

    console.log(`Group edit mode ended for custom shape instance: ${customShapeId}`)

    try {
      const nextVersion = (customShape.version ?? 1) + 1

      const allShapes = editor.getCurrentPageShapes()
      const groupShapes = allShapes.filter(s =>
        extractCustomShapeId(s) === customShapeId &&
        extractInstanceId(s) === instanceId
      )

      if (groupShapes.length === 0) {
        console.warn('No group shapes found for final update:', instanceId)
        return
      }

      const templateSourceShapes = groupShapes.filter(s => s.type !== 'group')
      if (templateSourceShapes.length === 0) {
        console.warn('No editable shapes found in group for template update')
        return
      }

      const updatedTemplateData = createUpdatedTemplateFromGroup(templateSourceShapes, customShape.label)

      updateCustomShape(customShapeId, {
        iconSvg: updatedTemplateData.iconSvg,
        defaultProps: updatedTemplateData.defaultProps
      })

      const editingInstanceShapes = allShapes.filter(s =>
        extractCustomShapeId(s) === customShapeId && extractInstanceId(s) === instanceId
      )

      updateInstanceGroupFromTemplate(
        editingInstanceShapes,
        updatedTemplateData.defaultProps,
        customShapeId,
        nextVersion
      )

      const allInstances = getInstancesForCustomShape(customShapeId)
      const otherInstanceIds = new Set(
        allInstances
          .map(instance => extractInstanceId(instance))
          .filter((id): id is string => !!id && id !== instanceId)
      )

      otherInstanceIds.forEach(otherInstanceId => {
        const otherInstanceShapes = allShapes.filter(s =>
          extractCustomShapeId(s) === customShapeId &&
          extractInstanceId(s) === otherInstanceId
        )

        updateInstanceGroupFromTemplate(
          otherInstanceShapes,
          updatedTemplateData.defaultProps,
          customShapeId,
          nextVersion
        )
      })

      console.log(`Updated custom shape definition and all instances after group edit: ${customShapeId}`)
    } catch (error) {
      console.error(`Failed to update custom shape after group edit ${customShapeId}:`, error)
    }
  }, [createUpdatedTemplateFromGroup, editor, getCustomShape, getInstancesForCustomShape, updateCustomShape, updateInstanceGroupFromTemplate])

  /**
   * Handle bezier shape changes (existing logic with group edit mode support)
   */
  const handleBezierShapeChanges = useCallback((shape: BezierShape, customShapeId: string, isInGroupEditMode: boolean) => {
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
  }, [cleanupShapeTracking, handleEditModeExit, handleGroupEditModeExit, handleGroupLivePropertyChange, handleLivePropertyChange, initializeShapeTracking])

  /**
   * Handle generic shape changes (non-bezier shapes in group edit mode)
   */
  const handleGenericShapeChanges = useCallback((shape: TLShape, customShapeId: string, isInGroupEditMode: boolean) => {
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
  }, [cleanupShapeTracking, handleGroupEditModeExit, handleGroupLivePropertyChange, initializeShapeTracking])

  // Process all custom shape instances for state changes and cleanup tracking
  useEffect(() => {
    allShapes.forEach(shape => {
      if (!shape.meta?.isCustomShapeInstance) {
        return
      }

      const shapeId = shape.id
      const customShapeId = extractCustomShapeId(shape)
      if (!customShapeId) {
        return
      }
      const isInGroupEditMode = shape.meta?.groupEditMode === true
      const isInNativeGroupEdit = shape.meta?.nativeGroupEdit === true

      groupEditModeRef.current.set(shapeId, isInGroupEditMode || isInNativeGroupEdit)

      if (shape.type === 'bezier') {
        handleBezierShapeChanges(shape as BezierShape, customShapeId, isInGroupEditMode || isInNativeGroupEdit)
      } else {
        handleGenericShapeChanges(shape, customShapeId, isInGroupEditMode || isInNativeGroupEdit)
      }
    })

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
  }, [allShapes, handleBezierShapeChanges, handleGenericShapeChanges])

  // Handle exiting TLDraw's native group editing
  useEffect(() => {
    if (isEditingCustomShapeGroup) return

    const shapesInNativeGroupEdit = allShapes.filter(shape =>
      shape.meta?.nativeGroupEdit === true
    )

    if (shapesInNativeGroupEdit.length > 0) {
      console.log('Exiting TLDraw native group editing')

      const updatedShapes: ShapeUpdate[] = shapesInNativeGroupEdit.map(shape => ({
        id: shape.id,
        type: shape.type,
        meta: {
          ...shape.meta,
          groupEditMode: false,
          nativeGroupEdit: false
        }
      }))

      editor.updateShapes(updatedShapes)

      const customShapeIds = new Set(
        shapesInNativeGroupEdit
          .map(extractCustomShapeId)
          .filter((id): id is string => !!id)
      )

      customShapeIds.forEach(customShapeId => {
        const representativeShape = shapesInNativeGroupEdit.find(
          shape => extractCustomShapeId(shape) === customShapeId
        )
        if (representativeShape) {
          handleGroupEditModeExit(representativeShape, customShapeId)
        }
      })
    }
  }, [allShapes, editor, handleGroupEditModeExit, isEditingCustomShapeGroup])

  return {
    // Expose some utilities if needed
    isTrackingShape: (shapeId: TLShapeId) => editStateRef.current.has(shapeId),
    isShapeInGroupEditMode: (shapeId: TLShapeId) => groupEditModeRef.current.get(shapeId) || false
  }
}
