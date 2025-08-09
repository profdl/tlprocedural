import { useMemo } from 'react'
import { useGeneratorStore } from '../../store/generators/useGeneratorStore'
import type { RandomWalkGenerator } from '../../types/generators'

export function GeneratorControls() {
  const store = useGeneratorStore()
  const generators = useGeneratorStore((s) => s.generators)
  const gens = useMemo(() => Object.values(generators), [generators])

  const addRandomWalk = () => {
    store.createRandomWalk({ mode: 'page' })
  }

  const updateGeneratorSettings = (id: string, updates: Partial<RandomWalkGenerator['settings']>) => {
    const gen = generators[id]
    if (!gen) return
    
    store.updateGenerator(id, {
      settings: { ...gen.settings, ...updates }
    })
  }

  return (
    <div style={{ padding: 8, borderTop: '1px solid #eee' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <strong>Generators</strong>
        <button onClick={addRandomWalk}>+ Random Walk</button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {gens.map((g) => (
          <div key={g.id} style={{ border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
            {/* Generator Header */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>Random Walk #{g.id.slice(-4)}</span>
              <span style={{ fontSize: '12px', color: '#666' }}>
                ({g.running ? 'running' : 'stopped'})
              </span>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={() => store.deleteGenerator(g.id)}
                  style={{
                    background: 'none',
                    border: '1px solid #ccc',
                    borderRadius: 2,
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#666'
                  }}
                  title="Remove generator"
                  disabled={g.running}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              {g.running ? (
                <button onClick={() => store.pause(g.id)}>Pause</button>
              ) : (
                <button onClick={() => store.start(g.id)}>Start</button>
              )}
              <button onClick={() => store.reset(g.id)}>Reset</button>
            </div>

            {/* Parameter Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Steps */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                  Steps: {g.settings.steps}
                </label>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={g.settings.steps}
                  onChange={(e) => updateGeneratorSettings(g.id, { steps: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                  disabled={g.running}
                />
              </div>

              {/* Step Length */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                  Step Length: {g.settings.stepLength}px
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={g.settings.stepLength}
                  onChange={(e) => updateGeneratorSettings(g.id, { stepLength: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                  disabled={g.running}
                />
              </div>

              {/* Seed */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                  Seed: {g.settings.seed}
                </label>
                <input
                  type="range"
                  min="1"
                  max="1000"
                  step="1"
                  value={g.settings.seed}
                  onChange={(e) => updateGeneratorSettings(g.id, { seed: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                  disabled={g.running}
                />
              </div>

              {/* Starting Position */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                    Start X: {g.settings.start.x}
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="800"
                    step="10"
                    value={g.settings.start.x}
                    onChange={(e) => updateGeneratorSettings(g.id, { 
                      start: { ...g.settings.start, x: parseInt(e.target.value) }
                    })}
                    style={{ width: '100%' }}
                    disabled={g.running}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                    Start Y: {g.settings.start.y}
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="600"
                    step="10"
                    value={g.settings.start.y}
                    onChange={(e) => updateGeneratorSettings(g.id, { 
                      start: { ...g.settings.start, y: parseInt(e.target.value) }
                    })}
                    style={{ width: '100%' }}
                    disabled={g.running}
                  />
                </div>
              </div>

              {/* Display Options */}
              <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #ddd' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: 8 }}>Display Options</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={g.settings.showPoints}
                      onChange={(e) => updateGeneratorSettings(g.id, { showPoints: e.target.checked })}
                      disabled={g.running}
                    />
                    Show Points
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={g.settings.showCurve}
                      onChange={(e) => updateGeneratorSettings(g.id, { showCurve: e.target.checked })}
                      disabled={g.running}
                    />
                    Show Curve
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
