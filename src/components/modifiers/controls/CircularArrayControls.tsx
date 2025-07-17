import { useCallback } from 'react'
import { type CircularArraySettings } from '../../../types/modifiers'
import { ModifierPropertyInput } from './ModifierPropertyInput'
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
        
        <ModifierPropertyInput
          label="Center X"
          value={settings.centerX}
          min={INPUT_CONSTRAINTS.centerX.min}
          max={INPUT_CONSTRAINTS.centerX.max}
          step={INPUT_CONSTRAINTS.centerX.step}
          onChange={(value) => updateSetting('centerX', value)}
        />
        
        <ModifierPropertyInput
          label="Center Y"
          value={settings.centerY}
          min={INPUT_CONSTRAINTS.centerY.min}
          max={INPUT_CONSTRAINTS.centerY.max}
          step={INPUT_CONSTRAINTS.centerY.step}
          onChange={(value) => updateSetting('centerY', value)}
        />
        
        <ModifierPropertyInput
          label="Rotate Each"
          value={settings.rotateEach}
          min={INPUT_CONSTRAINTS.rotateEach.min}
          max={INPUT_CONSTRAINTS.rotateEach.max}
          step={INPUT_CONSTRAINTS.rotateEach.step}
          onChange={(value) => updateSetting('rotateEach', value)}
        />
        
        <ModifierPropertyInput
          label="Rotate All"
          value={settings.rotateAll}
          min={INPUT_CONSTRAINTS.rotateAll.min}
          max={INPUT_CONSTRAINTS.rotateAll.max}
          step={INPUT_CONSTRAINTS.rotateAll.step}
          onChange={(value) => updateSetting('rotateAll', value)}
        />
        
        <div className="modifier-controls__checkbox">
          <label>
            <input
              type="checkbox"
              checked={settings.pointToCenter}
              onChange={(e) => updateSetting('pointToCenter', e.target.checked)}
            />
            Point to Center
          </label>
        </div>
      </div>
    </div>
  )
} 