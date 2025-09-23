import { useEffect, useRef, useCallback } from 'react'
import { useEditor } from 'tldraw'
import { useCustomShapes } from './useCustomShapes'

/**
 * Hook for managing group edit mode on multi-shape custom shape instances
 * Detects keyboard shortcuts on custom shape instances and enables group editing
 */
export function useGroupEditMode() {
  const editor = useEditor()
  const { getCustomShape } = useCustomShapes()

  // Track the current group edit state
  const groupEditStateRef = useRef<{
    customShapeId: string
    instanceId: string
    shapeIds: string[]
  } | null>(null)

  const enterGroupEditMode = useCallback((instanceShapeId: string, customShapeId: string) => {
    if (!editor) return

    // Find all shapes that belong to this custom shape instance
    const allShapes = editor.getCurrentPageShapes()
    const instanceShapes = allShapes.filter(shape => {
      const shapeMeta = shape.meta
      return shapeMeta?.customShapeId === customShapeId &&
             shapeMeta?.instanceId === allShapes.find(s => s.id === instanceShapeId)?.meta?.instanceId
    })

    if (instanceShapes.length === 0) {
      console.warn('No instance shapes found for custom shape:', customShapeId)
      return
    }

    // Update metadata to indicate group edit mode
    const shapeUpdates = instanceShapes.map(shape => ({
      ...shape,
      meta: {
        ...shape.meta,
        groupEditMode: true,
        groupEditInstanceId: instanceShapeId
      }
    }))

    editor.run(() => {
      editor.updateShapes(shapeUpdates)
      // Select all shapes in the group for easier editing
      editor.setSelectedShapes(instanceShapes.map(s => s.id))
    }, { history: 'record-preserveRedoStack' })

    // Store the current group edit state
    groupEditStateRef.current = {
      customShapeId,
      instanceId: allShapes.find(s => s.id === instanceShapeId)?.meta?.instanceId as string,
      shapeIds: instanceShapes.map(s => s.id)
    }

    console.log('Entered group edit mode for custom shape:', customShapeId)
  }, [editor])

  const exitGroupEditMode = useCallback(() => {
    if (!editor || !groupEditStateRef.current) return

    const { customShapeId, shapeIds } = groupEditStateRef.current

    // Update metadata to exit group edit mode
    const shapeUpdates = shapeIds.map(shapeId => {
      const shape = editor.getShape(shapeId as any)
      if (!shape) return null

      const { groupEditInstanceId, ...restMeta } = shape.meta || {}
      return {
        ...shape,
        meta: {
          ...restMeta,
          groupEditMode: false
        }
      }
    }).filter(Boolean)

    if (shapeUpdates.length > 0) {
      editor.run(() => {
        editor.updateShapes(shapeUpdates)
        // Clear selection
        editor.setSelectedShapes([])
      }, { history: 'record-preserveRedoStack' })
    }

    // Clear the group edit state
    groupEditStateRef.current = null

    console.log('Exited group edit mode for custom shape:', customShapeId)
  }, [editor])

  // Listen for keyboard shortcut to enter group edit mode (Ctrl/Cmd + E)
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+E (Windows) or Cmd+E (Mac) to enter group edit mode
      if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault()

        const selectedShapes = editor.getSelectedShapes()

        if (selectedShapes.length === 1) {
          const shape = selectedShapes[0]

          // Check if this is a custom shape instance
          const isCustomShapeInstance = shape.meta?.isCustomShapeInstance === true
          const customShapeId = shape.meta?.customShapeId as string

          if (!isCustomShapeInstance || !customShapeId) return

          // Get the custom shape definition to check if it's multi-shape
          const customShape = getCustomShape(customShapeId)
          if (!customShape || customShape.shapeType !== 'multi-shape') return

          // This is a multi-shape custom shape instance - enter group edit mode
          enterGroupEditMode(shape.id, customShapeId)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, getCustomShape, enterGroupEditMode])

  // Listen for Escape key to exit group edit mode
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && groupEditStateRef.current) {
        exitGroupEditMode()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, exitGroupEditMode])

  // Listen for clicks outside the group to exit edit mode
  useEffect(() => {
    if (!editor || !groupEditStateRef.current) return

    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement
      const shapeElement = target.closest('[data-shape-id]')

      if (!shapeElement) {
        // Clicked outside any shape - exit group edit mode
        exitGroupEditMode()
        return
      }

      const shapeId = shapeElement.getAttribute('data-shape-id')
      if (!shapeId) return

      // Check if the clicked shape is part of the current group
      const currentGroup = groupEditStateRef.current
      if (currentGroup && !currentGroup.shapeIds.includes(shapeId)) {
        // Clicked on a shape outside the current group - exit edit mode
        exitGroupEditMode()
      }
    }

    const canvas = editor.getContainer()
    canvas.addEventListener('click', handleClick)

    return () => {
      canvas.removeEventListener('click', handleClick)
    }
  }, [editor, exitGroupEditMode, groupEditStateRef.current])

  // Get the current group edit state
  const currentGroupEditState = groupEditStateRef.current

  // Check if a specific shape is in group edit mode
  const isShapeInGroupEditMode = useCallback((shapeId: string) => {
    return currentGroupEditState?.shapeIds.includes(shapeId) || false
  }, [currentGroupEditState])

  return {
    currentGroupEditState,
    isShapeInGroupEditMode,
    enterGroupEditMode,
    exitGroupEditMode
  }
}