import { useCallback } from 'react'
import { type GridArraySettings } from '../../../types/modifiers'
import { ModifierPropertyInput } from './ModifierPropertyInput'
import { INPUT_CONSTRAINTS } from '../constants'

interface GridArrayControlsProps {
  settings: GridArraySettings
  onChange: (settings: GridArraySettings) => void
}

export function GridArrayControls({ settings, onChange }: GridArrayControlsProps) {
  const updateSetting = useCallback((key: keyof GridArraySettings, value: number) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        <ModifierPropertyInput
          label="Rows"
          value={settings.rows}
          min={INPUT_CONSTRAINTS.rows.min}
          max={INPUT_CONSTRAINTS.rows.max}
          step={INPUT_CONSTRAINTS.rows.step}
          onChange={(value) => updateSetting('rows', value)}
        />
        
        <ModifierPropertyInput
          label="Columns"
          value={settings.columns}
          min={INPUT_CONSTRAINTS.columns.min}
          max={INPUT_CONSTRAINTS.columns.max}
          step={INPUT_CONSTRAINTS.columns.step}
          onChange={(value) => updateSetting('columns', value)}
        />
        
        <ModifierPropertyInput
          label="Spacing X"
          value={settings.spacingX}
          min={INPUT_CONSTRAINTS.spacingX.min}
          max={INPUT_CONSTRAINTS.spacingX.max}
          step={INPUT_CONSTRAINTS.spacingX.step}
          onChange={(value) => updateSetting('spacingX', value)}
        />
        
        <ModifierPropertyInput
          label="Spacing Y"
          value={settings.spacingY}
          min={INPUT_CONSTRAINTS.spacingY.min}
          max={INPUT_CONSTRAINTS.spacingY.max}
          step={INPUT_CONSTRAINTS.spacingY.step}
          onChange={(value) => updateSetting('spacingY', value)}
        />
        
        <ModifierPropertyInput
          label="Offset X"
          value={settings.offsetX}
          min={INPUT_CONSTRAINTS.offsetX.min}
          max={INPUT_CONSTRAINTS.offsetX.max}
          step={INPUT_CONSTRAINTS.offsetX.step}
          onChange={(value) => updateSetting('offsetX', value)}
        />
        
        <ModifierPropertyInput
          label="Offset Y"
          value={settings.offsetY}
          min={INPUT_CONSTRAINTS.offsetY.min}
          max={INPUT_CONSTRAINTS.offsetY.max}
          step={INPUT_CONSTRAINTS.offsetY.step}
          onChange={(value) => updateSetting('offsetY', value)}
        />
      </div>
    </div>
  )
} 