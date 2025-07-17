import { useCallback } from 'react'
import { type CircularArraySettings } from '../../../types/modifiers'
import { ModifierPropertyInput } from './ModifierPropertyInput'
import { ModifierCheckboxInput } from './ModifierCheckboxInput'
import { INPUT_CONSTRAINTS } from '../constants'

interface CircularArrayControlsProps {
  settings: CircularArraySettings
  onChange: (settings: CircularArraySettings) => void
}

export function CircularArrayControls({ settings, onChange }: CircularArrayControlsProps) {
  const updateSetting = useCallback((key: keyof CircularArraySettings, value: number | boolean) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        <ModifierPropertyInput
          label="Count"
          value={settings.count}
          min={INPUT_CONSTRAINTS.count.min}
          max={INPUT_CONSTRAINTS.count.max}
          step={INPUT_CONSTRAINTS.count.step}
          onChange={(value) => updateSetting('count', value)}
        />
        
        <ModifierPropertyInput
          label="Radius"
          value={settings.radius}
          min={INPUT_CONSTRAINTS.radius.min}
          max={INPUT_CONSTRAINTS.radius.max}
          step={INPUT_CONSTRAINTS.radius.step}
          onChange={(value) => updateSetting('radius', value)}
        />
        
        <ModifierPropertyInput
          label="Start Angle"
          value={settings.startAngle}
          min={INPUT_CONSTRAINTS.startAngle.min}
          max={INPUT_CONSTRAINTS.startAngle.max}
          step={INPUT_CONSTRAINTS.startAngle.step}
          onChange={(value) => updateSetting('startAngle', value)}
        />
        
        <ModifierPropertyInput
          label="End Angle"
          value={settings.endAngle}
          min={INPUT_CONSTRAINTS.endAngle.min}
          max={INPUT_CONSTRAINTS.endAngle.max}
          step={INPUT_CONSTRAINTS.endAngle.step}
          onChange={(value) => updateSetting('endAngle', value)}
        />
        
        <ModifierCheckboxInput
          label="Point to Center"
          checked={settings.pointToCenter}
          onChange={(checked) => updateSetting('pointToCenter', checked)}
        />
      </div>
    </div>
  )
} 