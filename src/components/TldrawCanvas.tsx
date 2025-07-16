import { 
  Tldraw, 
  DefaultStylePanel, 
  DefaultStylePanelContent,
  useEditor,
  useRelevantStyles,
  useValue,
  type TLUiStylePanelProps,
  type TLShape
} from 'tldraw'
import type { TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { ModifierControls } from './modifiers/ModifierControls'
import { ModifierOverlay } from './ModifierRenderer'
import { isArrayClone } from './modifiers/LinearArrayModifier'

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

const components: TLComponents = {
  StylePanel: CustomStylePanel,
}

export function TldrawCanvas() {
  const handleMount = (editor: any) => {
    // Set up side effects to keep array clone shapes locked and non-interactive
    
    // Prevent array clones from being unlocked
    const cleanupKeepArrayClonesLocked = editor.sideEffects.registerBeforeChangeHandler(
      'shape',
      (prev: TLShape, next: TLShape) => {
        if (!isArrayClone(next)) return next
        if (next.isLocked) return next
        // Keep array clones locked
        return { ...next, isLocked: true }
      }
    )

    // Prevent array clones from being selected by select-all
    const cleanupSelection = editor.sideEffects.registerAfterCreateHandler(
      'shape',
      () => {
        const selectedShapeIds = editor.getSelectedShapeIds()
        const filteredSelectedShapeIds = selectedShapeIds.filter((id: string) => {
          const shape = editor.getShape(id)
          return shape && !isArrayClone(shape)
        })
        
        if (selectedShapeIds.length !== filteredSelectedShapeIds.length) {
          editor.setSelectedShapes(filteredSelectedShapeIds)
        }
      }
    )

    // Return cleanup function
    return () => {
      cleanupKeepArrayClonesLocked()
      cleanupSelection()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw 
        components={components}
        onMount={handleMount}
      >
        <ModifierOverlay />
      </Tldraw>
    </div>
  )
} 