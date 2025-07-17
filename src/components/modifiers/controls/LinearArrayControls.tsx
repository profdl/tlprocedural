import { useCallback } from 'react'
import { type LinearArraySettings } from '../../../types/modifiers'
import { ModifierPropertyInput } from './ModifierPropertyInput'

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
          min={2}
          max={50}
          step={1}
          onChange={(value) => updateSetting('count', value)}
        />
        
        <ModifierPropertyInput
          label="Offset X"
          value={settings.offsetX}
          min={-500}
          max={500}
          step={1}
          onChange={(value) => updateSetting('offsetX', value)}
        />
        
        <ModifierPropertyInput
          label="Offset Y"
          value={settings.offsetY}
          min={-500}
          max={500}
          step={1}
          onChange={(value) => updateSetting('offsetY', value)}
        />
        
        <ModifierPropertyInput
          label="Rotation"
          value={settings.rotation}
          min={-360}
          max={360}
          step={1}
          onChange={(value) => updateSetting('rotation', value)}
        />
        
        <ModifierPropertyInput
          label="Spacing"
          value={settings.spacing}
          min={0.1}
          max={5}
          step={0.1}
          precision={1}
          onChange={(value) => updateSetting('spacing', value)}
        />
        
        <ModifierPropertyInput
          label="Scale Step"
          value={settings.scaleStep}
          min={0.1}
          max={3}
          step={0.1}
          precision={1}
          onChange={(value) => updateSetting('scaleStep', value)}
        />
      </div>
    </div>
  )
} 