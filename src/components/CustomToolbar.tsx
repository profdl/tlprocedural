import {
  DefaultToolbar,
  TldrawUiMenuItem,
  useEditor,
  useValue,
  useTools,
  useIsToolSelected
} from 'tldraw'

// Helper component to properly use hooks
function ToolMenuItem({ toolId, tools }: { toolId: string, tools: Record<string, unknown> }) {
  const item = tools[toolId]
  const selected = useIsToolSelected(item)

  if (!item) return null
  return <TldrawUiMenuItem key={toolId} {...item} isSelected={selected} />
}

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()

  // Track selection (kept if needed for future dynamic UI changes)
  useValue('is-sine-selected', () => {
    const selected = editor.getSelectedShapes()
    return selected.some((s) => s.type === 'sine-wave')
  }, [editor])

  // These functions are kept for potential future use but currently unused
  // const flipShapesHorizontally = () => {
  //   const selectedShapeIds = editor.getSelectedShapeIds()
  //   if (selectedShapeIds.length > 0) {
  //     // Try both possible API signatures for flipShapes
  //     try {
  //       ;(editor as Editor & { flipShapes?: (ids: string[], direction: string) => void }).flipShapes?.(selectedShapeIds, 'horizontal')
  //     } catch {
  //       // Fallback to our custom flip implementation
  //       const shapes = selectedShapeIds.map(id => editor.getShape(id)).filter(Boolean)
  //       shapes.forEach(shape => {
  //         if (shape) {
  //           const util = editor.getShapeUtil(shape)
  //           if ('flipShape' in util) {
  //             const flipped = (util as { flipShape: (shape: TLShape, direction: string) => TLShape }).flipShape(shape, 'horizontal')
  //             editor.updateShape(flipped)
  //           }
  //         }
  //       })
  //     }
  //   }
  // }

  // const flipShapesVertically = () => {
  //   const selectedShapeIds = editor.getSelectedShapeIds()
  //   if (selectedShapeIds.length > 0) {
  //     // Try both possible API signatures for flipShapes
  //     try {
  //       ;(editor as Editor & { flipShapes?: (ids: string[], direction: string) => void }).flipShapes?.(selectedShapeIds, 'vertical')
  //     } catch {
  //       // Fallback to our custom flip implementation
  //       const shapes = selectedShapeIds.map(id => editor.getShape(id)).filter(Boolean)
  //       shapes.forEach(shape => {
  //         if (shape) {
  //           const util = editor.getShapeUtil(shape)
  //           if ('flipShape' in util) {
  //             const flipped = (util as { flipShape: (shape: TLShape, direction: string) => TLShape }).flipShape(shape, 'vertical')
  //             editor.updateShape(flipped)
  //           }
  //         }
  //       })
  //     }
  //   }
  // }

  // const hasSelection = useValue('has-selection', () => {
  //   return editor.getSelectedShapeIds().length > 0
  // }, [editor])

  return (
    <DefaultToolbar>
      {/* Essential navigation tools */}
      {['select', 'hand', 'zoom'].map((id) => (
        <ToolMenuItem key={id} toolId={id} tools={tools} />
      ))}

      {/* Basic custom shapes */}
      {['circle', 'polygon', 'triangle'].map((id) => (
        <ToolMenuItem key={id} toolId={id} tools={tools} />
      ))}

      {/* Drawing and path tools */}
      {['custom-draw', 'bezier'].map((id) => (
        <ToolMenuItem key={id} toolId={id} tools={tools} />
      ))}

      {/* Path editing tools */}
      {['add-point'].map((id) => (
        <ToolMenuItem key={id} toolId={id} tools={tools} />
      ))}

      {/* Procedural shapes */}
      <ToolMenuItem toolId="sine-wave" tools={tools} />

    </DefaultToolbar>
  )
}