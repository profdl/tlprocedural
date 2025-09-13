import { 
  DefaultStylePanel, 
  useEditor,
  useValue,
  stopEventPropagation,
  type TLUiStylePanelProps,
  type TLShape,
  type TLShapeId
} from 'tldraw'
import { StyleControls } from './modifiers/components/StyleControls'
import { ModifierControls } from './modifiers/ModifierControls'
import { SineWaveControls } from './shapes/SineWaveControls'
import { TriangleControls } from './shapes/TriangleControls'
import { PolygonControls } from './shapes/PolygonControls'
import type { SineWaveShape } from './shapes/SineWaveShape'
import type { TriangleShape } from './shapes/TriangleShape'
import type { PolygonShape } from './shapes/PolygonShape'

export const CustomStylePanel = (props: TLUiStylePanelProps) => {
  const editor = useEditor()
  
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

  // Prevent canvas from capturing wheel events
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
  }

  const handlePointerEvents = (e: React.PointerEvent) => {
    e.stopPropagation()
  }

  return (
    <DefaultStylePanel {...props}>
      <div 
        className="custom-style-panel__wrapper"
        onWheel={handleWheel}
        onPointerDown={handlePointerEvents}
        onPointerMove={handlePointerEvents}
        onPointerUp={handlePointerEvents}
      >
        <div 
          className="custom-style-panel__content" 
          onPointerDown={stopEventPropagation}
          onWheel={handleWheel}
        >
          {/* Style Controls Section */}
          <div className="custom-style-panel__section">
            <h3 className="custom-style-panel__section-title">Style</h3>
            <StyleControls selectedShapes={selectedShapes as TLShape[]} />
          </div>

          {/* Custom Shape Controls Section */}
          {(() => {
            const sineWaveShapes = selectedShapes.filter(shape => shape.type === 'sine-wave') as SineWaveShape[]
            const triangleShapes = selectedShapes.filter(shape => shape.type === 'triangle') as TriangleShape[]
            const polygonShapes = selectedShapes.filter(shape => shape.type === 'polygon') as PolygonShape[]
            
            return (
              <>
                {sineWaveShapes.length > 0 && (
                  <div className="custom-style-panel__section">
                    <h3 className="custom-style-panel__section-title">Sine Wave</h3>
                    <SineWaveControls shapes={sineWaveShapes} />
                  </div>
                )}
                {triangleShapes.length > 0 && (
                  <div className="custom-style-panel__section">
                    <h3 className="custom-style-panel__section-title">Triangle</h3>
                    <TriangleControls shapes={triangleShapes} />
                  </div>
                )}
                {polygonShapes.length > 0 && (
                  <div className="custom-style-panel__section">
                    <h3 className="custom-style-panel__section-title">Polygon</h3>
                    <PolygonControls shapes={polygonShapes} />
                  </div>
                )}
              </>
            )
          })()}

          {/* Modifier Controls Section */}
          <div className="custom-style-panel__section">
            <h3 className="custom-style-panel__section-title">Modifiers</h3>
            <ModifierControls selectedShapes={selectedShapes as TLShape[]} />
          </div>
      </div>
      </div>
    </DefaultStylePanel>
  )
}
