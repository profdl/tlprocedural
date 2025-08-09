import React from 'react'

export type RandomWalkProps = {
  width: number
  height: number
  stepMs?: number
  stepSize?: number
  maxPoints?: number
}

type Point = { x: number; y: number }

export function RandomWalk(props: RandomWalkProps): React.ReactElement {
  const { width, height, stepMs = 16, stepSize = 1, maxPoints = 3000 } = props
  const pathRef = React.useRef<SVGPathElement | null>(null)
  const [running, setRunning] = React.useState(true)

  const stateRef = React.useRef({
    points: [] as Point[],
    x: 0,
    y: 0,
    t: 0,
  })

  React.useEffect(() => {
    // initialize in the middle
    stateRef.current.x = width / 2
    stateRef.current.y = height / 2
    stateRef.current.points = [{ x: stateRef.current.x, y: stateRef.current.y }]
  }, [width, height])

  React.useEffect(() => {
    let rafId: number | null = null
    const startedAt = performance.now()

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      if (!running) return

      const now = performance.now()
      const s = stateRef.current
      if (now - s.t < stepMs) return
      s.t = now - startedAt

      const dx = (Math.random() - 0.5) * stepSize * 2
      const dy = (Math.random() - 0.5) * stepSize * 2
      s.x = Math.max(0, Math.min(width, s.x + dx))
      s.y = Math.max(0, Math.min(height, s.y + dy))
      s.points.push({ x: s.x, y: s.y })
      if (s.points.length > maxPoints) s.points.shift()

      if (pathRef.current) {
        pathRef.current.setAttribute('d', toPath(s.points))
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [running, stepMs, stepSize, width, height, maxPoints])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setRunning((v) => !v)}>{running ? 'Pause' : 'Resume'}</button>
        <button
          onClick={() => {
            const s = stateRef.current
            s.x = width / 2
            s.y = height / 2
            s.points = [{ x: s.x, y: s.y }]
            if (pathRef.current) pathRef.current.setAttribute('d', toPath(s.points))
          }}
        >
          Reset
        </button>
      </div>
      <svg width={width} height={height} style={{ background: '#0b1020', borderRadius: 8 }}>
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#6ee7ff" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill="#0b1020" />
        <path ref={pathRef} fill="none" stroke="url(#g)" strokeWidth={2} />
      </svg>
    </div>
  )
}

function toPath(points: Point[]): string {
  if (points.length === 0) return ''
  const [p0, ...rest] = points
  let d = `M${p0.x},${p0.y}`
  for (const p of rest) d += ` L${p.x},${p.y}`
  return d
}


