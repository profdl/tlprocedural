import { useCallback } from 'react'
import { stopEventPropagation } from 'tldraw'
import { type MirrorSettings } from '../../../types/modifiers'
import { ModifierSlider } from './ModifierSlider'
import { INPUT_CONSTRAINTS, MIRROR_AXIS_OPTIONS } from '../constants'

interface MirrorControlsProps {
  settings: MirrorSettings
  onChange: (settings: MirrorSettings) => void
}

export function MirrorControls({ settings, onChange }: MirrorControlsProps) {
  const updateSetting = useCallback((key: keyof MirrorSettings, value: string | number) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        <div className="modifier-controls__dropdown">
          <label>Mirror Axis</label>
          <select
            value={settings.axis}
            onChange={(e) => updateSetting('axis', e.target.value)}
            className="modifier-controls__select"
            onPointerDown={stopEventPropagation}
          >
            {MIRROR_AXIS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <ModifierSlider
          label="Offset"
          value={settings.offset}
          min={INPUT_CONSTRAINTS.offset.min}
          max={INPUT_CONSTRAINTS.offset.max}
          step={INPUT_CONSTRAINTS.offset.step}
          onChange={(value) => updateSetting('offset', value)}
        />
        
        <ModifierSlider
          label="Merge Threshold"
          value={settings.mergeThreshold}
          min={INPUT_CONSTRAINTS.mergeThreshold.min}
          max={INPUT_CONSTRAINTS.mergeThreshold.max}
          step={INPUT_CONSTRAINTS.mergeThreshold.step}
          onChange={(value) => updateSetting('mergeThreshold', value)}
        />
      </div>
    </div>
  )
} 