import { 
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiButton,
  useEditor
} from 'tldraw'

export function CustomToolbar() {
  const editor = useEditor()

  const handleSineWaveClick = () => {
    editor.setCurrentTool('sine-wave')
  }

  return (
    <DefaultToolbar>
      <DefaultToolbarContent />
      {/* Sine wave button should appear after the default image tool */}
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
      {/* Restore default shape tool after sine wave */}
      <TldrawUiButton
        type="normal"
        data-testid="tools.shape"
        title="Shapes"
        onClick={() => editor.setCurrentTool('geo')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="3" y="3" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
        </svg>
      </TldrawUiButton>
    </DefaultToolbar>
  )
}
