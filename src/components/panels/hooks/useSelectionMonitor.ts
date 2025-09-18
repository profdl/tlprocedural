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
    // Keep Style and Modifiers panels always visible
    setPanelVisible('style', true)
    setPanelVisible('modifiers', true)
  }, [setPanelVisible])

  return {
    hasSelection: selectedShapes.length > 0,
    selectedShapes
  }
}