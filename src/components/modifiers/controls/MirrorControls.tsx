import { useCallback } from 'react'
import { type MirrorSettings } from '../../../types/modifiers'
import { ModifierSlider } from './ModifierSlider'
import { INPUT_CONSTRAINTS } from '../constants'

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
        <div className="modifier-controls__info">
          <label>Mirror Axis: X (Horizontal)</label>
          <span className="modifier-controls__description">
            Creates a horizontal mirror of the shape
          </span>
        </div>
        
        <ModifierSlider
          label="Offset (0 = center)"
          value={settings.offset}
          min={INPUT_CONSTRAINTS.offset.min}
          max={INPUT_CONSTRAINTS.offset.max}
          step={INPUT_CONSTRAINTS.offset.step}
          onChange={(value) => updateSetting('offset', value)}
        />
      </div>
    </div>
  )
} 