import { 
  DefaultToolbar,
  TldrawUiMenuItem,
  useEditor,
  useValue,
  useTools,
  useIsToolSelected
} from 'tldraw'

export function CustomToolbar() {
  const editor = useEditor()
  const tools = useTools()
  // Track selection (kept if needed for future dynamic UI changes)
  useValue('is-sine-selected', () => {
    const selected = editor.getSelectedShapes()
    return selected.some((s) => s.type === 'sine-wave')
  }, [editor])

  // No custom click handler needed; using default tool item wiring for highlight behavior

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
      {['circle', 'polygon', 'triangle'].map((id) => {
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
    </DefaultToolbar>
  )
}
