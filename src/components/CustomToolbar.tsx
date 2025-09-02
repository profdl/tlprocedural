import { 
  DefaultToolbar,
  TldrawUiMenuItem,
  useEditor,
  useValue,
  useTools,
  useIsToolSelected,
  TldrawUiButton
} from 'tldraw'

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()
  
  // Track selection (kept if needed for future dynamic UI changes)
  useValue('is-sine-selected', () => {
    const selected = editor.getSelectedShapes()
    return selected.some((s) => s.type === 'sine-wave')
  }, [editor])

  // Helper function to flip shapes horizontally
  const flipShapesHorizontally = () => {
    const selectedShapeIds = editor.getSelectedShapeIds()
    if (selectedShapeIds.length > 0) {
      // Try both possible API signatures for flipShapes
      try {
        ;(editor as any).flipShapes(selectedShapeIds, 'horizontal')
      } catch (e) {
        console.log('Horizontal flip via flipShapes failed, trying custom implementation', e)
        // Fallback to our custom flip implementation
        const shapes = selectedShapeIds.map(id => editor.getShape(id)).filter(Boolean)
        shapes.forEach(shape => {
          if (shape) {
            const util = editor.getShapeUtil(shape)
            if ('flipShape' in util) {
              const flipped = (util as any).flipShape(shape, 'horizontal')
              editor.updateShape(flipped)
            }
          }
        })
      }
    }
  }

  // Helper function to flip shapes vertically  
  const flipShapesVertically = () => {
    const selectedShapeIds = editor.getSelectedShapeIds()
    if (selectedShapeIds.length > 0) {
      // Try both possible API signatures for flipShapes
      try {
        ;(editor as any).flipShapes(selectedShapeIds, 'vertical')
      } catch (e) {
        console.log('Vertical flip via flipShapes failed, trying custom implementation', e)
        // Fallback to our custom flip implementation
        const shapes = selectedShapeIds.map(id => editor.getShape(id)).filter(Boolean)
        shapes.forEach(shape => {
          if (shape) {
            const util = editor.getShapeUtil(shape)
            if ('flipShape' in util) {
              const flipped = (util as any).flipShape(shape, 'vertical')
              editor.updateShape(flipped)
            }
          }
        })
      }
    }
  }

  // Check if any shapes are selected
  const hasSelection = useValue('has-selection', () => {
    return editor.getSelectedShapeIds().length > 0
  }, [editor])

  return (
    <DefaultToolbar>
      {/* Essential navigation tools */}
      {['select', 'hand', 'zoom'].map((id) => {
        const item = tools[id]
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
      })}

      {/* Basic custom shapes */}
      {['circle', 'polygon', 'triangle', 'custom-arrow'].map((id) => {
        const item = tools[id]
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
      })}

      {/* Drawing and path tools */}
      {['custom-line', 'custom-draw', 'bezier'].map((id) => {
        const item = tools[id]
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
      })}

      {/* Procedural shapes */}
      {(() => {
        const item = tools['sine-wave']
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key="sine-wave" {...item} isSelected={selected} />
      })()}

      {/* Flip controls - only show when shapes are selected */}
      {hasSelection && (
        <>
          <div className="tlui-toolbar__divider" />
          <TldrawUiButton
            type="tool"
            onClick={flipShapesHorizontally}
            title="Flip Horizontally"
          >
            ↔️
          </TldrawUiButton>
          <TldrawUiButton
            type="tool" 
            onClick={flipShapesVertically}
            title="Flip Vertically"
          >
            ↕️
          </TldrawUiButton>
        </>
      )}
    </DefaultToolbar>
  )
}