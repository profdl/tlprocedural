import { useCallback, useMemo } from 'react'
import type { LSystemSettings } from '../../../types/modifiers'
import { ModifierPropertyInput } from './ModifierPropertyInput'
import { L_SYSTEM_PRESETS } from '../constants'

interface LSystemControlsProps {
  settings: LSystemSettings
  onChange: (settings: LSystemSettings) => void
}

export function LSystemControls({ settings, onChange }: LSystemControlsProps) {
  const rulesText = useMemo(() => {
    return Object.entries(settings.rules)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
  }, [settings.rules])

  const updateSetting = useCallback((key: keyof LSystemSettings, value: unknown) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  const handleRulesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value.split('\n').map(l => l.trim()).filter(Boolean)
    const rules: Record<string, string> = {}
    for (const line of lines) {
      const [lhs, rhs] = line.split('=')
      if (lhs && rhs) rules[lhs.trim()] = rhs.trim()
    }
    updateSetting('rules', rules)
  }, [updateSetting])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        <div className="modifier-controls__field" style={{ gridColumn: '1 / -1' }}>
          <label>Preset</label>
          <select
            value=""
            onChange={(e) => {
              const preset = L_SYSTEM_PRESETS.find(p => p.id === e.target.value)
              if (preset) onChange({ ...settings, ...preset.settings })
            }}
            className="modifier-property-input__number"
          >
            <option value="" disabled>Select a preset…</option>
            {L_SYSTEM_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="modifier-controls__field">
          <label>Axiom</label>
          <input
            type="text"
            value={settings.axiom}
            onChange={(e) => updateSetting('axiom', e.target.value)}
            className="modifier-property-input__number"
          />
        </div>

        <div className="modifier-controls__field" style={{ gridColumn: '1 / -1' }}>
          <label>Rules (one per line, format: A=AB)</label>
          <textarea
            value={rulesText}
            onChange={handleRulesChange}
            rows={4}
            className="modifier-property-input__number"
          />
        </div>


        <ModifierPropertyInput
          label="Iterations"
          value={settings.iterations}
          min={0}
          max={8}
          step={1}
          onChange={(value) => updateSetting('iterations', value)}
        />

        <ModifierPropertyInput
          label="Angle (deg)"
          value={settings.angle}
          min={0}
          max={360}
          step={1}
          onChange={(value) => updateSetting('angle', value)}
        />

        <ModifierPropertyInput
          label="Scale per Level"
          value={settings.scalePerIteration ?? 1.0}
          min={0.2}
          max={1.2}
          step={0.01}
          precision={2}
          onChange={(value) => updateSetting('scalePerIteration', value)}
        />

        <ModifierPropertyInput
          label="Step (% of size)"
          value={settings.stepPercent}
          min={25}
          max={200}
          step={1}
          onChange={(value) => updateSetting('stepPercent', value)}
        />

      <ModifierPropertyInput
        label="Angle Jitter"
        value={settings.angleJitter ?? 0}
        min={0}
        max={30}
        step={1}
        onChange={(value) => updateSetting('angleJitter', value)}
      />


      <ModifierPropertyInput
        label="Branch Probability"
        value={settings.branchProbability ?? 1}
        min={0.3}
        max={1}
        step={0.01}
        onChange={(value) => updateSetting('branchProbability', value)}
      />

      <div className="modifier-controls__field" style={{ gridColumn: '1 / -1' }}>
        <label>Custom Branch Angles (deg, comma-separated; empty = use symmetric ±angle)</label>
        <input
          type="text"
          value={(settings.branches ?? []).join(', ')}
          onChange={(e) => {
            const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            const nums = parts.map(v => Number(v)).filter(v => !isNaN(v))
            updateSetting('branches', nums)
          }}
          className="modifier-property-input__number"
        />
      </div>

      </div>
    </div>
  )
}
