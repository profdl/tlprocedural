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
      {/* Essential navigation and drawing tools */}
      {['select', 'hand', 'zoom', 'draw', 'eraser'].map((id) => {
        const item = tools[id]
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
      })}

      {/* Our custom shapes */}
      {(() => {
        const item = tools['sine-wave']
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key="sine-wave" {...item} isSelected={selected} />
      })()}

      {(() => {
        const item = tools['triangle']
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key="triangle" {...item} isSelected={selected} />
      })()}

      {/* Keep only arrow and line from native shapes */}
      {['arrow', 'line'].map((id) => {
        const item = tools[id]
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
      })}
    </DefaultToolbar>
  )
}
