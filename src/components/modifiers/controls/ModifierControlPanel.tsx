import { useCallback } from 'react'
import { 
  getModifierSchema, 
  isNumberInputConfig, 
  isCheckboxInputConfig, 
  isSelectInputConfig,
  type ModifierSchemas 
} from '../config/schemas'
import { EnhancedNumberInput } from '../ui/EnhancedNumberInput'
import { ModifierCheckboxInput } from '../ui/ModifierCheckboxInput'
import { ModifierSelectInput } from '../ui/ModifierSelectInput'

interface ModifierControlPanelProps<T extends keyof ModifierSchemas> {
  modifierType: T
  settings: Record<string, any>
  onChange: (settings: Record<string, any>) => void
}

export function ModifierControlPanel<T extends keyof ModifierSchemas>({ 
  modifierType, 
  settings, 
  onChange 
}: ModifierControlPanelProps<T>) {
  const schema = getModifierSchema(modifierType)
  
  const updateSetting = useCallback((field: string, value: any) => {
    onChange({ ...settings, [field]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        {schema.inputs.map((inputConfig) => {
          const key = `${modifierType}-${inputConfig.field}`
          const containerClass = inputConfig.fullWidth ? 'modifier-input--full-width' : ''
          
          if (isNumberInputConfig(inputConfig)) {
            return (
              <div key={key} className={containerClass}>
                <EnhancedNumberInput
                  label={inputConfig.label}
                  value={settings[inputConfig.field] ?? 0}
                  min={inputConfig.min}
                  max={inputConfig.max}
                  step={inputConfig.step}
                  precision={inputConfig.precision ?? 0}
                  unit={inputConfig.unit}
                  onChange={(value) => updateSetting(inputConfig.field, value)}
                />
              </div>
            )
          }
          
          if (isCheckboxInputConfig(inputConfig)) {
            return (
              <div key={key} className={containerClass}>
                <ModifierCheckboxInput
                  label={inputConfig.label}
                  checked={settings[inputConfig.field] ?? false}
                  onChange={(checked) => updateSetting(inputConfig.field, checked)}
                />
              </div>
            )
          }
          
          if (isSelectInputConfig(inputConfig)) {
            return (
              <div key={key} className={containerClass}>
                <ModifierSelectInput
                  label={inputConfig.label}
                  value={settings[inputConfig.field] ?? inputConfig.options[0]?.value}
                  options={inputConfig.options}
                  onChange={(value) => updateSetting(inputConfig.field, value)}
                />
              </div>
            )
          }
          
          return null
        })}
      </div>
    </div>
  )
}