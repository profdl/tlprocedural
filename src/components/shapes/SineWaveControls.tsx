import { useEditor, useValue, type TLShape } from 'tldraw'
import type { SineWaveShape } from './SineWaveShape'

interface SineWaveControlsProps {
  shapes: SineWaveShape[]
}

export function SineWaveControls({ shapes }: SineWaveControlsProps) {
  const editor = useEditor()

  // Get the common values across all selected sine wave shapes
  const commonValues = useValue('sine-wave-values', () => {
    if (shapes.length === 0) return null

    const first = shapes[0]
    const common = {
      length: first.props.length,
      amplitude: first.props.amplitude,
      frequency: first.props.frequency,
      phase: first.props.phase,
    }

    // Check if all shapes have the same values
    const allSame = shapes.every(shape => 
      shape.props.length === common.length &&
      shape.props.amplitude === common.amplitude &&
      shape.props.frequency === common.frequency &&
      shape.props.phase === common.phase
    )

    return allSame ? common : {
      length: undefined,
      amplitude: undefined,
      frequency: undefined,
      phase: undefined,
    }
  }, [shapes])

  const updateShapes = (updates: Partial<SineWaveShape['props']>) => {
    editor.updateShapes(
      shapes.map(shape => ({
        id: shape.id,
        type: shape.type,
        props: { ...shape.props, ...updates }
      }))
    )
  }

  const convertToDrawShape = () => {
    editor.run(() => {
      const newShapes: TLShape[] = []
      
      shapes.forEach(shape => {
        const { length, amplitude, frequency, phase } = shape.props
        
        // Generate sine wave points
        const points: { x: number; y: number; z: number }[] = []
        const steps = Math.max(50, length)
        
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * length
          const radians = (phase * Math.PI / 180) + (x * frequency * 2 * Math.PI / length)
          const y = amplitude + amplitude * Math.sin(radians)
          points.push({ x, y, z: 0.5 })
        }
        
        // Create a draw shape with the sine wave path
        editor.createShape({
          type: 'draw',
          x: shape.x,
          y: shape.y,
          props: {
            segments: [{
              type: 'free' as const,
              points: points
            }],
            color: 'black',
            size: 'm',
            isComplete: true,
          }
        })
        
        // Get the newly created shape (it will be the last one created)
        const allShapes = editor.getCurrentPageShapes()
        const drawShape = allShapes[allShapes.length - 1]
        if (drawShape) {
          newShapes.push(drawShape)
        }
        
        // Delete the original sine wave shape
        editor.deleteShapes([shape.id])
      })
      
      // Select all the new draw shapes
      if (newShapes.length > 0) {
        editor.setSelectedShapes(newShapes)
      }
    })
  }

  if (!commonValues) return null

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#666' }}>
        Sine Wave Properties
      </div>
      
      {/* Apply Button */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={convertToDrawShape}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
        >
          Apply as Draw Shape
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Length */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#666' }}>
            Length: {commonValues.length ?? 'Mixed'}
          </label>
          <input
            type="range"
            min="50"
            max="2000"
            step="5"
            value={commonValues.length ?? 200}
            onChange={(e) => updateShapes({ length: parseInt(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        {/* Amplitude */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#666' }}>
            Amplitude: {commonValues.amplitude ?? 'Mixed'}
          </label>
          <input
            type="range"
            min="2"
            max="500"
            step="1"
            value={commonValues.amplitude ?? 40}
            onChange={(e) => updateShapes({ amplitude: parseInt(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        {/* Frequency */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#666' }}>
            Frequency: {commonValues.frequency ?? 'Mixed'}
          </label>
          <input
            type="range"
            min="0.1"
            max="500"
            step="0.1"
            value={commonValues.frequency ?? 1}
            onChange={(e) => updateShapes({ frequency: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>

        {/* Phase */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#666' }}>
            Phase: {commonValues.phase ?? 'Mixed'}°
          </label>
          <input
            type="range"
            min="0"
            max="360"
            step="15"
            value={commonValues.phase ?? 0}
            onChange={(e) => updateShapes({ phase: parseInt(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  )
}
