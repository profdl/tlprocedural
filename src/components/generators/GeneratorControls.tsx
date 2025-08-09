import { useMemo } from 'react'
import { useGeneratorStore } from '../../store/generators/useGeneratorStore'
import type { AnyGenerator, RandomWalkGenerator, SineWaveGenerator } from '../../types/generators'

export function GeneratorControls() {
  const store = useGeneratorStore()
  const generators = useGeneratorStore((s) => s.generators)
  const gens = useMemo(() => Object.values(generators), [generators])

  const addRandomWalk = () => {
    store.createRandomWalk({ mode: 'page' })
  }

  const addSineWave = () => {
    store.createSineWave({ mode: 'page' })
  }

  const updateGeneratorSettings = (id: string, updates: Record<string, unknown>) => {
    const gen = generators[id]
    if (!gen) return
    
    store.updateGenerator(id, {
      settings: { ...gen.settings, ...updates }
    } as Partial<AnyGenerator>)
  }

  const renderGeneratorControls = (g: AnyGenerator) => {
    if (g.type === 'random-walk') {
      const rwGen = g as RandomWalkGenerator
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Steps */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
              Steps: {rwGen.settings.steps}
            </label>
            <input
              type="range"
              min="50"
              max="2000"
              step="50"
              value={rwGen.settings.steps}
              onChange={(e) => updateGeneratorSettings(g.id, { steps: parseInt(e.target.value) })}
              style={{ width: '100%' }}
              disabled={g.running}
            />
          </div>

          {/* Step Length */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
              Step Length: {rwGen.settings.stepLength}px
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={rwGen.settings.stepLength}
              onChange={(e) => updateGeneratorSettings(g.id, { stepLength: parseInt(e.target.value) })}
              style={{ width: '100%' }}
              disabled={g.running}
            />
          </div>

          {/* Seed */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
              Seed: {rwGen.settings.seed}
            </label>
            <input
              type="range"
              min="1"
              max="1000"
              step="1"
              value={rwGen.settings.seed}
              onChange={(e) => updateGeneratorSettings(g.id, { seed: parseInt(e.target.value) })}
              style={{ width: '100%' }}
              disabled={g.running}
            />
          </div>

          {/* Starting Position */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                Start X: {rwGen.settings.start.x}
              </label>
              <input
                type="range"
                min="50"
                max="800"
                step="10"
                value={rwGen.settings.start.x}
                onChange={(e) => updateGeneratorSettings(g.id, { 
                  start: { ...rwGen.settings.start, x: parseInt(e.target.value) }
                })}
                style={{ width: '100%' }}
                disabled={g.running}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                Start Y: {rwGen.settings.start.y}
              </label>
              <input
                type="range"
                min="50"
                max="600"
                step="10"
                value={rwGen.settings.start.y}
                onChange={(e) => updateGeneratorSettings(g.id, { 
                  start: { ...rwGen.settings.start, y: parseInt(e.target.value) }
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
                  checked={rwGen.settings.showPoints}
                  onChange={(e) => updateGeneratorSettings(g.id, { showPoints: e.target.checked })}
                  disabled={g.running}
                />
                Show Points
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={rwGen.settings.showCurve}
                  onChange={(e) => updateGeneratorSettings(g.id, { showCurve: e.target.checked })}
                  disabled={g.running}
                />
                Show Curve
              </label>
            </div>
          </div>
        </div>
      )
    } else if (g.type === 'sine-wave') {
      const swGen = g as SineWaveGenerator
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Length */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
              Length: {swGen.settings.length}px
            </label>
            <input
              type="range"
              min="100"
              max="800"
              step="10"
              value={swGen.settings.length}
              onChange={(e) => updateGeneratorSettings(g.id, { length: parseInt(e.target.value) })}
              style={{ width: '100%' }}
              disabled={g.running}
            />
          </div>

          {/* Amplitude */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
              Amplitude: {swGen.settings.amplitude}px
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={swGen.settings.amplitude}
              onChange={(e) => updateGeneratorSettings(g.id, { amplitude: parseInt(e.target.value) })}
              style={{ width: '100%' }}
              disabled={g.running}
            />
          </div>

          {/* Frequency */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
              Frequency: {swGen.settings.frequency}
            </label>
            <input
              type="range"
              min="0.1"
              max="100"
              step="0.1"
              value={swGen.settings.frequency}
              onChange={(e) => updateGeneratorSettings(g.id, { frequency: parseFloat(e.target.value) })}
              style={{ width: '100%' }}
              disabled={g.running}
            />
          </div>

          {/* Phase */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
              Phase: {swGen.settings.phase}°
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="15"
              value={swGen.settings.phase}
              onChange={(e) => updateGeneratorSettings(g.id, { phase: parseInt(e.target.value) })}
              style={{ width: '100%' }}
              disabled={g.running}
            />
          </div>

          {/* Direction */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
              Direction: {swGen.settings.direction}°
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="15"
              value={swGen.settings.direction}
              onChange={(e) => updateGeneratorSettings(g.id, { direction: parseInt(e.target.value) })}
              style={{ width: '100%' }}
              disabled={g.running}
            />
          </div>

          {/* Starting Position */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                Start X: {swGen.settings.start.x}
              </label>
              <input
                type="range"
                min="50"
                max="800"
                step="10"
                value={swGen.settings.start.x}
                onChange={(e) => updateGeneratorSettings(g.id, { 
                  start: { ...swGen.settings.start, x: parseInt(e.target.value) }
                })}
                style={{ width: '100%' }}
                disabled={g.running}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: 2 }}>
                Start Y: {swGen.settings.start.y}
              </label>
              <input
                type="range"
                min="50"
                max="600"
                step="10"
                value={swGen.settings.start.y}
                onChange={(e) => updateGeneratorSettings(g.id, { 
                  start: { ...swGen.settings.start, y: parseInt(e.target.value) }
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
                  checked={swGen.settings.showPoints}
                  onChange={(e) => updateGeneratorSettings(g.id, { showPoints: e.target.checked })}
                  disabled={g.running}
                />
                Show Points
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={swGen.settings.showCurve}
                  onChange={(e) => updateGeneratorSettings(g.id, { showCurve: e.target.checked })}
                  disabled={g.running}
                />
                Show Curve
              </label>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  const getGeneratorTitle = (g: AnyGenerator) => {
    const typeNames = {
      'random-walk': 'Random Walk',
      'sine-wave': 'Sine Wave'
    }
    return `${typeNames[g.type]} #${g.id.slice(-4)}`
  }

  return (
    <div style={{ padding: 8, borderTop: '1px solid #eee' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <strong>Generators</strong>
        <button onClick={addRandomWalk}>+ Random Walk</button>
        <button onClick={addSineWave}>+ Sine Wave</button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {gens.map((g) => (
          <div key={g.id} style={{ border: '1px solid #ddd', borderRadius: 4, padding: 8 }}>
            {/* Generator Header */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 'bold' }}>{getGeneratorTitle(g)}</span>
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
              {g.type === 'random-walk' && (
                <button 
                  onClick={() => store.applyGenerator(g.id)}
                  style={{
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                  title="Convert simulation to permanent shape"
                >
                  Apply
                </button>
              )}
            </div>

            {/* Type-specific Parameter Controls */}
            {renderGeneratorControls(g)}
          </div>
        ))}
      </div>
    </div>
  )
}
