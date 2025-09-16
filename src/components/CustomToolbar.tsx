import {
  DefaultToolbar,
  TldrawUiMenuItem,
  useEditor,
  useValue,
  useTools,
  useIsToolSelected,
  type TLUiToolItem
} from 'tldraw'

// Helper component to properly use hooks
function ToolMenuItem({ toolId, tools }: { toolId: string, tools: Record<string, TLUiToolItem> }) {
  const item = tools[toolId] as TLUiToolItem | undefined
  const selected = useIsToolSelected(item)
  if (!item) return null

  return <TldrawUiMenuItem {...item} isSelected={selected} />
}

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()

  // Track selection (kept if needed for future dynamic UI changes)
  useValue('is-sine-selected', () => {
    const selected = editor.getSelectedShapes()
    return selected.some((s) => s.type === 'sine-wave')
  }, [editor])

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