import { 
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiButton,
  useEditor
} from 'tldraw'

export function CustomToolbar() {
  const editor = useEditor()

  const handleSineWaveClick = () => {
    // Create a sine wave shape directly
    editor.createShape({
      type: 'sine-wave',
      x: 100,
      y: 100,
      props: {
        w: 200,
        h: 100,
        length: 200,
        amplitude: 40,
        frequency: 1,
        phase: 0,
        strokeWidth: 2,
        color: 'black',
      }
    })
  }

  return (
    <DefaultToolbar>
      {/* Make sine wave the primary/default button by placing it first */}
      <TldrawUiButton
        type="normal"
        data-testid="tools.sine-wave"
        title="Add Sine Wave"
        onClick={handleSineWaveClick}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 8 Q4 4, 8 8 T15 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </TldrawUiButton>
      <DefaultToolbarContent />
    </DefaultToolbar>
  )
}
