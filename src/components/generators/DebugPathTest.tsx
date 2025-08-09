import { useState } from 'react'

export function DebugPathTest() {
  const [points, setPoints] = useState([
    { x: 100, y: 100 },
    { x: 120, y: 120 },
    { x: 140, y: 110 },
    { x: 160, y: 130 },
    { x: 180, y: 115 },
  ])

  const generatePath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return ''
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`
    }
    return d
  }

  const addRandomPoint = () => {
    const lastPoint = points[points.length - 1]
    const newPoint = {
      x: lastPoint.x + (Math.random() - 0.5) * 40,
      y: lastPoint.y + (Math.random() - 0.5) * 40,
    }
    console.log('Adding point:', newPoint)
    setPoints(prev => {
      const updated = [...prev, newPoint]
      console.log('Updated points:', updated)
      return updated
    })
  }

  const pathD = generatePath(points)

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', margin: 20 }}>
      <h3>Debug Path Test</h3>
      <div style={{ marginBottom: 10 }}>
        <button onClick={addRandomPoint}>Add Random Point</button>
        <button onClick={() => setPoints([{ x: 100, y: 100 }])}>Reset</button>
      </div>
      
      <div style={{ marginBottom: 10 }}>
        <strong>Points ({points.length}):</strong>
        <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 5 }}>
          {JSON.stringify(points, null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: 10 }}>
        <strong>SVG Path:</strong>
        <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 5 }}>
          {pathD}
        </pre>
      </div>

      <svg width="400" height="300" style={{ border: '1px solid #ddd', background: '#fafafa' }}>
        <path 
          d={pathD} 
          fill="none" 
          stroke="#0066cc" 
          strokeWidth="2"
        />
        {/* Draw points as circles for debugging */}
        {points.map((p, i) => (
          <circle 
            key={i} 
            cx={p.x} 
            cy={p.y} 
            r="3" 
            fill={i === 0 ? "#ff0000" : "#0066cc"}
          />
        ))}
      </svg>
    </div>
  )
}
