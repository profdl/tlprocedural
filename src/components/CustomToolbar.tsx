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
      {/* Core tools in a reasonable order */}
      {['select', 'hand', 'zoom', 'draw', 'eraser', 'text', 'sticky'].map((id) => {
        const item = tools[id]
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
      })}

      {/* Sine wave tool (uses the same menu item to inherit selected highlighting) */}
      {(() => {
        const item = tools['sine-wave']
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key="sine-wave" {...item} isSelected={selected} />
      })()}

      {/* Triangle tool */}
      {(() => {
        const item = tools['triangle']
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key="triangle" {...item} isSelected={selected} />
      })()}

      {/* Continue with common tools */}
      {['geo', 'arrow', 'line', 'frame', 'image'].map((id) => {
        const item = tools[id]
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
      })}

      {/* Render any remaining tools not explicitly ordered above */}
      {Object.keys(tools)
        .filter(
          (id) =>
            ![
              'select',
              'hand',
              'zoom',
              'draw',
              'eraser',
              'text',
              'sticky',
              'geo',
              'arrow',
              'line',
              'frame',
              'image',
              'sine-wave',
              'triangle',
            ].includes(id)
        )
        .map((id) => {
          const item = tools[id]
          if (!item) return null
          const selected = useIsToolSelected(item)
          return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
        })}
    </DefaultToolbar>
  )
}
