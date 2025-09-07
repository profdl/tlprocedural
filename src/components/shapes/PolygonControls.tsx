import { useEditor } from 'tldraw'
import type { PolygonShape } from './PolygonShape'
import { EnhancedNumberInput } from '../modifiers/ui/EnhancedNumberInput'

interface PolygonControlsProps {
  shapes: PolygonShape[]
}

export const PolygonControls = ({ shapes }: PolygonControlsProps) => {
  const editor = useEditor()

  if (shapes.length === 0) return null

  const currentSides = shapes[0].props.sides

  const handleSidesChange = (value: number) => {
    const updatedShapes = shapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      props: { ...shape.props, sides: value }
    }))
    
    editor.updateShapes(updatedShapes)
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#666' }}>
        Polygon Properties
      </div>
      
      <EnhancedNumberInput
        label="Sides"
        value={currentSides}
        min={3}
        max={12}
        step={1}
        precision={0}
        onChange={handleSidesChange}
      />
    </div>
  )
}