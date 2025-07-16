import { 
  Tldraw, 
  DefaultStylePanel, 
  useRelevantStyles, 
  useEditor,
  TldrawUiButton,
  TldrawUiButtonIcon
} from 'tldraw'
import type { TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'

const CustomStylePanel = () => {
  const editor = useEditor()
  const styles = useRelevantStyles()

  return (
    <>
      {/* Render the default style panel content */}
      <DefaultStylePanel />
      
      {/* Add our custom Modifiers section */}
      <div className="tlui-style-panel__section">
        <div className="tlui-style-panel__row">
          <div className="tlui-style-panel__section-label">
            Modifiers
          </div>
          <TldrawUiButton 
            type="icon" 
            className="tlui-style-panel__add-button"
            onClick={() => {
              console.log('Add modifier clicked')
              // Add your custom logic here
            }}
          >
            <TldrawUiButtonIcon icon="plus" />
          </TldrawUiButton>
        </div>
      </div>
    </>
  )
}

const components: TLComponents = {
  StylePanel: CustomStylePanel,
}

export function TldrawCanvas() {
  return <Tldraw components={components} />
} 