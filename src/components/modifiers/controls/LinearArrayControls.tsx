import { useCallback } from 'react'
import { type LinearArraySettings } from '../../../types/modifiers'
import { ModifierPropertyInput } from './ModifierPropertyInput'
import { INPUT_CONSTRAINTS } from '../constants'

interface LinearArrayControlsProps {
  settings: LinearArraySettings
  onChange: (settings: LinearArraySettings) => void
}

export function LinearArrayControls({ settings, onChange }: LinearArrayControlsProps) {
  const updateSetting = useCallback((key: keyof LinearArraySettings, value: number) => {
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
          precision={2}
          onChange={(value) => updateSetting('count', value)}
        />
        
        <ModifierPropertyInput
          label="Offset X"
          value={settings.offsetX}
          min={INPUT_CONSTRAINTS.offsetX.min}
          max={INPUT_CONSTRAINTS.offsetX.max}
          step={INPUT_CONSTRAINTS.offsetX.step}
          precision={2}
          onChange={(value) => updateSetting('offsetX', value)}
        />
        
        <ModifierPropertyInput
          label="Offset Y"
          value={settings.offsetY}
          min={INPUT_CONSTRAINTS.offsetY.min}
          max={INPUT_CONSTRAINTS.offsetY.max}
          step={INPUT_CONSTRAINTS.offsetY.step}
          precision={2}
          onChange={(value) => updateSetting('offsetY', value)}
        />
        
        <ModifierPropertyInput
          label="Rotation"
          value={settings.rotation}
          min={INPUT_CONSTRAINTS.rotation.min}
          max={INPUT_CONSTRAINTS.rotation.max}
          step={INPUT_CONSTRAINTS.rotation.step}
          precision={2}
          onChange={(value) => updateSetting('rotation', value)}
        />
        
        <ModifierPropertyInput
          label="Spacing"
          value={settings.spacing}
          min={INPUT_CONSTRAINTS.spacing.min}
          max={INPUT_CONSTRAINTS.spacing.max}
          step={INPUT_CONSTRAINTS.spacing.step}
          precision={INPUT_CONSTRAINTS.spacing.precision}
          onChange={(value) => updateSetting('spacing', value)}
        />
        
        <ModifierPropertyInput
          label="Scale Step"
          value={settings.scaleStep}
          min={INPUT_CONSTRAINTS.scaleStep.min}
          max={INPUT_CONSTRAINTS.scaleStep.max}
          step={INPUT_CONSTRAINTS.scaleStep.step}
          precision={INPUT_CONSTRAINTS.scaleStep.precision}
          onChange={(value) => updateSetting('scaleStep', value)}
        />
      </div>
    </div>
  )
} 