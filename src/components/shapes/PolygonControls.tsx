import { useEditor } from 'tldraw'
import type { PolygonShape } from './PolygonShape'

interface PolygonControlsProps {
  shapes: PolygonShape[]
}

export const PolygonControls = ({ shapes }: PolygonControlsProps) => {
  const editor = useEditor()

  if (shapes.length === 0) return null

  const currentSides = shapes[0].props.sides
  const allSameValue = shapes.every(shape => shape.props.sides === currentSides)

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
      
      <div>
        <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#666' }}>
          Sides: {allSameValue ? currentSides : 'Mixed'}
        </label>
        <input
          type="range"
          min="3"
          max="12"
          step="1"
          value={currentSides}
          onChange={(e) => handleSidesChange(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  )
}