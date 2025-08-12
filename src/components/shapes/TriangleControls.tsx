import { useEditor, track, type TLShape } from 'tldraw'
import type { TriangleShape } from './TriangleShape'

interface TriangleControlsProps {
  shapes: TriangleShape[]
}

export const TriangleControls = track(({ shapes }: TriangleControlsProps) => {
  const editor = useEditor()
  
  if (shapes.length === 0) return null

  const shape = shapes[0]
  const { w, h, color, strokeWidth, fill } = shape.props

  const updateShapes = (updates: Partial<TriangleShape['props']>) => {
    editor.updateShapes(
      shapes.map(shape => ({
        id: shape.id,
        type: shape.type,
        props: { ...shape.props, ...updates }
      }))
    )
  }

  const convertToNativeTriangle = () => {
    editor.run(() => {
      const newShapes: TLShape[] = []
      
      shapes.forEach(triangleShape => {
        const { w, h, color, strokeWidth, fill } = triangleShape.props
        
        // Convert hex color to tldraw's valid color names
        let tldrawColor = 'black' // default
        if (color === '#000000' || color === 'black') tldrawColor = 'black'
        else if (color === '#ffffff' || color === 'white') tldrawColor = 'white'
        else if (color === '#ff0000' || color === 'red') tldrawColor = 'red'
        else if (color === '#0000ff' || color === 'blue') tldrawColor = 'blue'
        else if (color === '#00ff00' || color === 'green') tldrawColor = 'green'
        else if (color === '#ffff00' || color === 'yellow') tldrawColor = 'yellow'
        else if (color === '#ffa500' || color === 'orange') tldrawColor = 'orange'
        else if (color === '#808080' || color === 'grey') tldrawColor = 'grey'
        else if (color.includes('violet') || color.includes('purple')) tldrawColor = 'violet'
        else if (color.includes('light-blue')) tldrawColor = 'light-blue'
        else if (color.includes('light-green')) tldrawColor = 'light-green'
        else if (color.includes('light-red')) tldrawColor = 'light-red'
        else if (color.includes('light-violet')) tldrawColor = 'light-violet'
        else {
          // For any other hex color, find the closest match
          if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16)
            const g = parseInt(color.slice(3, 5), 16)
            const b = parseInt(color.slice(5, 7), 16)
            
            // Simple color matching logic
            if (r > 200 && g > 200 && b > 200) tldrawColor = 'white'
            else if (r < 50 && g < 50 && b < 50) tldrawColor = 'black'
            else if (r > g && r > b) tldrawColor = 'red'
            else if (g > r && g > b) tldrawColor = 'green'
            else if (b > r && b > g) tldrawColor = 'blue'
            else if (r > 150 && g > 150) tldrawColor = 'yellow'
            else if (r > 150 && g > 100 && b < 100) tldrawColor = 'orange'
            else tldrawColor = 'grey'
          }
        }
        
        // Convert stroke width to tldraw size
        let size = 'm' // default medium
        if (strokeWidth <= 1) size = 's'
        else if (strokeWidth <= 2) size = 'm'
        else if (strokeWidth <= 4) size = 'l'
        else size = 'xl'
        
        // Create a native tldraw triangle (geo shape)
        editor.createShape({
          type: 'geo',
          x: triangleShape.x,
          y: triangleShape.y,
          props: {
            w: w,
            h: h,
            geo: 'triangle',
            color: tldrawColor as any,
            fill: fill ? 'solid' : 'none',
            dash: 'solid',
            size: size as any,
          }
        })
        
        // Get the newly created shape (it will be the last one created)
        const allShapes = editor.getCurrentPageShapes()
        const geoShape = allShapes[allShapes.length - 1]
        if (geoShape) {
          newShapes.push(geoShape)
        }
        
        // Delete the original triangle shape
        editor.deleteShapes([triangleShape.id])
      })
      
      // Select all the new geo shapes
      if (newShapes.length > 0) {
        editor.setSelectedShapes(newShapes)
      }
    })
  }

  return (
    <div className="triangle-controls" style={{ 
      padding: '12px', 
      borderRadius: '8px', 
      backgroundColor: 'var(--color-panel)', 
      border: '1px solid var(--color-border)',
      margin: '8px 0'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>
        Triangle Properties
      </h3>
      
      {/* Apply Button */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={convertToNativeTriangle}
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
          Apply as Native Triangle
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Width Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ minWidth: '60px', fontSize: '12px' }}>Width:</label>
          <input
            type="range"
            min="20"
            max="400"
            step="5"
            value={w}
            onChange={(e) => updateShapes({ w: parseInt(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: '40px', fontSize: '12px' }}>{w}px</span>
        </div>

        {/* Height Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ minWidth: '60px', fontSize: '12px' }}>Height:</label>
          <input
            type="range"
            min="20"
            max="400"
            step="5"
            value={h}
            onChange={(e) => updateShapes({ h: parseInt(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: '40px', fontSize: '12px' }}>{h}px</span>
        </div>

        {/* Stroke Width Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ minWidth: '60px', fontSize: '12px' }}>Stroke:</label>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => updateShapes({ strokeWidth: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: '40px', fontSize: '12px' }}>{strokeWidth}px</span>
        </div>

        {/* Color Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ minWidth: '60px', fontSize: '12px' }}>Color:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => updateShapes({ color: e.target.value })}
            style={{ flex: 1, height: '30px' }}
          />
        </div>

        {/* Fill Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ minWidth: '60px', fontSize: '12px' }}>Fill:</label>
          <input
            type="checkbox"
            checked={fill}
            onChange={(e) => updateShapes({ fill: e.target.checked })}
          />
        </div>

        {/* Flip Status Display */}
        {(shape.meta?.isFlippedX || shape.meta?.isFlippedY) && (
          <div style={{ 
            padding: '6px', 
            backgroundColor: 'var(--color-accent)', 
            borderRadius: '4px',
            fontSize: '11px',
            color: 'white'
          }}>
            Flipped: {shape.meta?.isFlippedX ? 'X ' : ''}{shape.meta?.isFlippedY ? 'Y' : ''}
          </div>
        )}
      </div>
    </div>
  )
})
