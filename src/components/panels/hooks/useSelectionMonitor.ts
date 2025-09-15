import { useEffect } from 'react'
import { useEditor, useValue } from 'tldraw'
import { usePanelStore } from '../../../store/panelStore'

/**
 * Hook to monitor shape selection and control Style/Modifiers panel visibility
 */
export function useSelectionMonitor() {
  const editor = useEditor()
  const { setPanelVisible } = usePanelStore()

  // Monitor selected shapes
  const selectedShapes = useValue(
    'selected-shapes',
    () => editor.getSelectedShapes(),
    [editor]
  )

  // Update panel visibility based on selection
  useEffect(() => {
    const hasSelection = selectedShapes.length > 0

    // Show/hide Style and Modifiers panels based on selection
    setPanelVisible('style', hasSelection)
    setPanelVisible('modifiers', hasSelection)
  }, [selectedShapes.length, setPanelVisible])

  return {
    hasSelection: selectedShapes.length > 0,
    selectedShapes
  }
}