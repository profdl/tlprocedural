import { useState } from 'react'
import { 
  DefaultStylePanel, 
  DefaultStylePanelContent,
  useEditor,
  useRelevantStyles,
  useValue,
  TldrawUiButton,
  stopEventPropagation,
  type TLUiStylePanelProps,
  type TLShape,
  type TLShapeId
} from 'tldraw'
import { ModifierControls } from './modifiers/ModifierControls'

type TabType = 'styles' | 'modifiers'

export const CustomStylePanel = (props: TLUiStylePanelProps) => {
  const editor = useEditor()
  const styles = useRelevantStyles()
  const [activeTab, setActiveTab] = useState<TabType>('styles')
  
  // Get the currently selected shapes, expanding groups to include their child shapes
  const selectedShapes = useValue(
    'selected-shapes',
    () => {
      const shapes = editor.getSelectedShapes()
      
      // Expand groups to include their child shapes for modifier processing
      const expandedShapes: TLShape[] = []
      
      shapes.forEach(shape => {
        if (shape.type === 'group') {
          // Get all child shapes in the group
          const childShapeIds = editor.getShapeAndDescendantIds([shape.id])
          const childShapes = Array.from(childShapeIds)
            .map((id: TLShapeId) => editor.getShape(id))
            .filter(Boolean) as TLShape[]
          
          expandedShapes.push(...childShapes)
        } else {
          expandedShapes.push(shape)
        }
      })
      
      return expandedShapes
    },
    [editor]
  )

  return (
    <DefaultStylePanel {...props}>
      {/* Tab Navigation */}
      <div className="custom-style-panel__tabs" onPointerDown={stopEventPropagation}>
        <TldrawUiButton
          type="normal"
          className={`custom-style-panel__tab ${activeTab === 'styles' ? 'custom-style-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('styles')}
        >
          Styles
        </TldrawUiButton>
        <TldrawUiButton
          type="normal"
          className={`custom-style-panel__tab ${activeTab === 'modifiers' ? 'custom-style-panel__tab--active' : ''}`}
          onClick={() => setActiveTab('modifiers')}
        >
          Modifiers
        </TldrawUiButton>
      </div>
      
      {/* Tab Content */}
      <div className="custom-style-panel__content">
        {activeTab === 'styles' && (
          <DefaultStylePanelContent styles={styles} />
        )}
        
        {activeTab === 'modifiers' && (
          <div className="tlui-style-panel__section">
            <ModifierControls selectedShapes={selectedShapes as TLShape[]} />
          </div>
        )}
      </div>
    </DefaultStylePanel>
  )
} 