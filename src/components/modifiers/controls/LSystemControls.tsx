import { useCallback, useMemo } from 'react'
import type { LSystemSettings } from '../../../types/modifiers'
import { ModifierPropertyInput } from './ModifierPropertyInput'

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

  const updateSetting = useCallback((key: keyof LSystemSettings, value: any) => {
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
          label="Step (% of size)"
          value={settings.stepPercent}
          min={25}
          max={200}
          step={1}
          onChange={(value) => updateSetting('stepPercent', value)}
        />

        <ModifierPropertyInput
          label="Scale per Level"
          value={settings.scalePerIteration ?? 1.0}
          min={0.2}
          max={1.2}
          step={0.01}
          onChange={(value) => updateSetting('scalePerIteration', value)}
        />

      <ModifierPropertyInput
        label="Length Decay"
        value={settings.lengthDecay ?? 0.75}
        min={0.3}
        max={1}
        step={0.01}
        onChange={(value) => updateSetting('lengthDecay', value)}
      />
      </div>
    </div>
  )
}


