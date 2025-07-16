import { 
  Tldraw, 
  DefaultStylePanel, 
  DefaultStylePanelContent,
  useEditor,
  useRelevantStyles,
  useValue,
  type TLUiStylePanelProps
} from 'tldraw'
import type { TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { ModifierControls } from './modifiers/ModifierControls'
import { ModifierOverlay } from './ModifierRenderer'

// Custom StylePanel that wraps DefaultStylePanel and adds our modifier controls
const CustomStylePanel = (props: TLUiStylePanelProps) => {
  const editor = useEditor()
  const styles = useRelevantStyles()
  
  // Get the currently selected shapes
  const selectedShapes = useValue(
    'selected-shapes',
    () => editor.getSelectedShapes(),
    [editor]
  )

  return (
    <DefaultStylePanel {...props}>
      {/* Render the default style panel content first */}
      <DefaultStylePanelContent styles={styles} />
      
      {/* Add our custom Modifiers section */}
      <div className="tlui-style-panel__section">
        <ModifierControls selectedShapes={selectedShapes} />
      </div>
    </DefaultStylePanel>
  )
}

// Custom component to render overlays on the canvas
const CanvasOverlays = () => {
  return <ModifierOverlay />
}

const components: TLComponents = {
  StylePanel: CustomStylePanel,
  InFrontOfTheCanvas: CanvasOverlays,
}

export function TldrawCanvas() {
  return <Tldraw components={components} />
} 