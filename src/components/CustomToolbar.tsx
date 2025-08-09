import { 
  DefaultToolbar,
  TldrawUiButton,
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

  const handleSineWaveClick = () => {
    editor.setCurrentTool('sine-wave')
  }

  return (
    <DefaultToolbar>
      {/* Core tools in a reasonable order */}
      {['select', 'hand', 'zoom', 'draw', 'eraser', 'text', 'sticky'].map((id) => {
        const item = tools[id]
        if (!item) return null
        const selected = useIsToolSelected(item)
        return <TldrawUiMenuItem key={id} {...item} isSelected={selected} />
      })}

      {/* Sine wave button placed directly after sticky */}
      <TldrawUiButton
        type="normal"
        data-testid="tools.sine-wave"
        title="Sine Wave"
        onClick={handleSineWaveClick}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 8 Q4 4, 8 8 T15 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </TldrawUiButton>

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
