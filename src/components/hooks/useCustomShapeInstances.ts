import { useCallback, useMemo } from 'react'
import { useEditor, useValue, type TLShape } from 'tldraw'
import type { Editor } from 'tldraw'
import { useCustomShapes } from './useCustomShapes'

export interface CustomShapeInstanceMetadata {
  customShapeId: string
  instanceId: string
  isCustomShapeInstance: true
  version: number
}

/**
 * Hook for managing custom shape instances on the canvas
 * Provides tracking, updating, and synchronization of custom shape instances
 */
export function useCustomShapeInstances() {
  const editor = useEditor()
  const { updateCustomShape, getCustomShape } = useCustomShapes()

  type ShapeUpdate = Parameters<Editor['updateShapes']>[0][number]

  // Get all shapes from the editor with reactive updates
  const allShapes = useValue(
    'all-shapes',
    () => Array.from(editor.getCurrentPageShapes()),
    [editor]
  )

  // Find all custom shape instances
  const customShapeInstances = useMemo(() => {
    return allShapes.filter((shape): shape is TLShape & { meta: CustomShapeInstanceMetadata } => {
      return shape.meta?.isCustomShapeInstance === true &&
             typeof shape.meta?.customShapeId === 'string'
    })
  }, [allShapes])

  // Group instances by their custom shape ID
  const instancesByCustomShapeId = useMemo(() => {
    const grouped: Record<string, Array<TLShape & { meta: CustomShapeInstanceMetadata }>> = {}

    customShapeInstances.forEach(instance => {
      const customShapeId = instance.meta.customShapeId
      if (!grouped[customShapeId]) {
        grouped[customShapeId] = []
      }
      grouped[customShapeId].push(instance)
    })

    return grouped
  }, [customShapeInstances])

  // Get instances for a specific custom shape
  const getInstancesForCustomShape = useCallback((customShapeId: string) => {
    return instancesByCustomShapeId[customShapeId] || []
  }, [instancesByCustomShapeId])

  // Get instance count for a custom shape
  const getInstanceCount = useCallback((customShapeId: string) => {
    return getInstancesForCustomShape(customShapeId).length
  }, [getInstancesForCustomShape])

  // Check if a shape is a custom shape instance
  const isCustomShapeInstance = useCallback((shape: TLShape): shape is TLShape & { meta: CustomShapeInstanceMetadata } => {
    return shape.meta?.isCustomShapeInstance === true &&
           typeof shape.meta?.customShapeId === 'string'
  }, [])

  // Update all instances of a custom shape with new properties
  const updateAllInstances = useCallback((customShapeId: string, updates: Partial<TLShape>, excludeShapeId?: string, boundsOffset?: { x: number; y: number }, originalPositions?: Map<string, { x: number; y: number }>) => {
    const instances = getInstancesForCustomShape(customShapeId)
    if (instances.length === 0) return

    const customShape = getCustomShape(customShapeId)
    if (!customShape) return

    const mutableUpdates: Partial<TLShape> = { ...updates }
    delete mutableUpdates.type
    delete mutableUpdates.id
    delete mutableUpdates.parentId
    delete mutableUpdates.index

    // Filter out the excluded shape (typically the one being edited)
    const instancesToUpdate = excludeShapeId
      ? instances.filter(instance => instance.id !== excludeShapeId)
      : instances

    const propsUpdate = mutableUpdates.props
    const otherUpdates: Partial<TLShape> = { ...mutableUpdates }
    delete otherUpdates.props
    delete otherUpdates.x
    delete otherUpdates.y

    const shapeUpdates: ShapeUpdate[] = instancesToUpdate.map(instance => {
      const updatedShape: ShapeUpdate = {
        id: instance.id,
        type: instance.type,
        meta: {
          ...instance.meta,
          version: customShape.version
        }
      }

      if (propsUpdate) {
        updatedShape.props = {
          ...instance.props,
          ...propsUpdate
        }
      }

      if (boundsOffset && originalPositions) {
        // Get the original position for this instance to prevent cumulative compensation
        const originalPos = originalPositions.get(instance.id)
        if (originalPos) {
          // Compensate for bounds changes by adjusting from the original position
          // This prevents cumulative/exponential movement during live editing
          updatedShape.x = originalPos.x + boundsOffset.x
          updatedShape.y = originalPos.y + boundsOffset.y
        } else {
          // Fallback to current position if original not found
          updatedShape.x = instance.x + boundsOffset.x
          updatedShape.y = instance.y + boundsOffset.y
        }
      } else if (typeof mutableUpdates.x === 'number' || typeof mutableUpdates.y === 'number') {
        if (typeof mutableUpdates.x === 'number') {
          updatedShape.x = mutableUpdates.x
        }
        if (typeof mutableUpdates.y === 'number') {
          updatedShape.y = mutableUpdates.y
        }
      }

      if (otherUpdates.meta) {
        updatedShape.meta = {
          ...updatedShape.meta,
          ...otherUpdates.meta
        }
      }

      const remainingUpdates: Partial<TLShape> = { ...otherUpdates }
      delete remainingUpdates.meta
      Object.assign(updatedShape, remainingUpdates)

      return updatedShape
    })

    // Validate shape updates before applying
    const validatedUpdates = shapeUpdates.filter(shape => {
      if (!shape.type || !shape.id) {
        console.error('Invalid shape update - missing type or id:', shape)
        return false
      }
      return true
    })

    if (validatedUpdates.length === 0) {
      console.warn('No valid shape updates to apply')
      return
    }

    console.log('Applying shape updates:', validatedUpdates.map(s => ({ id: s.id, type: s.type, hasProps: !!s.props })))

    // Batch update all instances
    editor.run(() => {
      editor.updateShapes(validatedUpdates)
    }, { history: 'record-preserveRedoStack' })
  }, [editor, getInstancesForCustomShape, getCustomShape])

  // Update a custom shape definition and propagate to all instances
  const updateCustomShapeAndInstances = useCallback((
    customShapeId: string,
    definitionUpdates: Parameters<typeof updateCustomShape>[1],
    shapeUpdates?: Partial<TLShape>
  ) => {
    // Update the custom shape definition
    updateCustomShape(customShapeId, definitionUpdates)

    // If shape updates are provided, apply them to all instances
    if (shapeUpdates) {
      updateAllInstances(customShapeId, shapeUpdates)
    }
  }, [updateCustomShape, updateAllInstances])

  // Synchronize instances that are out of sync with their definition
  const syncOutdatedInstances = useCallback(() => {
    const outdatedInstances: Array<{
      instance: TLShape & { meta: CustomShapeInstanceMetadata }
      customShape: ReturnType<typeof getCustomShape>
    }> = []

    // Find instances that have older versions than their definition
    customShapeInstances.forEach(instance => {
      const customShape = getCustomShape(instance.meta.customShapeId)
      if (customShape && instance.meta.version < customShape.version) {
        outdatedInstances.push({ instance, customShape })
      }
    })

    if (outdatedInstances.length === 0) return

    // Group by custom shape ID and update
    const updatesByCustomShapeId: Record<string, Array<typeof outdatedInstances[0]>> = {}
    outdatedInstances.forEach(item => {
      const id = item.customShape!.id
      if (!updatesByCustomShapeId[id]) {
        updatesByCustomShapeId[id] = []
      }
      updatesByCustomShapeId[id].push(item)
    })

    // Apply updates
    Object.values(updatesByCustomShapeId).forEach(items => {
      const customShape = items[0].customShape!

      // Create shape updates based on the custom shape definition
      const shapeUpdates = items.map(({ instance }) => ({
        id: instance.id,
        type: instance.type, // Use the instance's actual type, not the stored shapeType
        props: customShape.defaultProps,
        // Preserve position
        x: instance.x,
        y: instance.y,
        // Update metadata version
        meta: {
          ...instance.meta,
          version: customShape.version
        }
      }))

      // Validate shape updates
      const validUpdates = shapeUpdates.filter(shape => {
        if (!shape.type || !shape.id) {
          console.error('Invalid sync update - missing type or id:', shape)
          return false
        }
        return true
      })

      if (validUpdates.length > 0) {
        editor.run(() => {
          editor.updateShapes(validUpdates)
        }, { history: 'record-preserveRedoStack' })
      }
    })

    console.log(`Synchronized ${outdatedInstances.length} outdated custom shape instances`)
  }, [customShapeInstances, getCustomShape, editor])

  // Remove orphaned instances (instances whose custom shape definition no longer exists)
  const removeOrphanedInstances = useCallback(() => {
    const orphanedInstances = customShapeInstances.filter(instance => {
      return !getCustomShape(instance.meta.customShapeId)
    })

    if (orphanedInstances.length > 0) {
      const orphanedIds = orphanedInstances.map(instance => instance.id)
      editor.run(() => {
        editor.deleteShapes(orphanedIds)
      }, { history: 'record-preserveRedoStack' })

      console.log(`Removed ${orphanedInstances.length} orphaned custom shape instances`)
    }
  }, [customShapeInstances, getCustomShape, editor])

  // Generate a unique instance ID
  const generateInstanceId = useCallback(() => {
    return `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  return {
    customShapeInstances,
    instancesByCustomShapeId,
    getInstancesForCustomShape,
    getInstanceCount,
    isCustomShapeInstance,
    updateAllInstances,
    updateCustomShapeAndInstances,
    syncOutdatedInstances,
    removeOrphanedInstances,
    generateInstanceId
  }
}
