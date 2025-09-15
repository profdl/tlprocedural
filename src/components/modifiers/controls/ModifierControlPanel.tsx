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
  settings: Record<string, unknown>
  onChange: (settings: Record<string, unknown>) => void
}

export function ModifierControlPanel<T extends keyof ModifierSchemas>({ 
  modifierType, 
  settings, 
  onChange 
}: ModifierControlPanelProps<T>) {
  const schema = getModifierSchema(modifierType)
  
  const updateSetting = useCallback((field: string, value: unknown) => {
    onChange({ ...settings, [field]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        {schema.inputs.map((inputConfig) => {
          const key = `${modifierType}-${inputConfig.field}`

          if (isNumberInputConfig(inputConfig)) {
            return (
              <div key={key} className="modifier-input-row">
                <label className="modifier-input-row__label">
                  {inputConfig.label}
                </label>
                <div className="modifier-input-row__control">
                  <EnhancedNumberInput
                    value={(settings[inputConfig.field] as number) ?? 0}
                    min={inputConfig.min}
                    max={inputConfig.max}
                    step={inputConfig.step}
                    precision={inputConfig.precision ?? 0}
                    unit={inputConfig.unit}
                    onChange={(value) => updateSetting(inputConfig.field, value)}
                  />
                </div>
              </div>
            )
          }

          if (isCheckboxInputConfig(inputConfig)) {
            return (
              <div key={key} className="modifier-input-row">
                <label className="modifier-input-row__label">
                  {inputConfig.label}
                </label>
                <div className="modifier-input-row__control">
                  <ModifierCheckboxInput
                    checked={(settings[inputConfig.field] as boolean) ?? false}
                    onChange={(checked) => updateSetting(inputConfig.field, checked)}
                  />
                </div>
              </div>
            )
          }

          if (isSelectInputConfig(inputConfig)) {
            return (
              <div key={key} className="modifier-input-row">
                <label className="modifier-input-row__label">
                  {inputConfig.label}
                </label>
                <div className="modifier-input-row__control">
                  <ModifierSelectInput
                    value={(settings[inputConfig.field] as string | number) ?? inputConfig.options[0]?.value}
                    options={inputConfig.options.map(opt => ({ ...opt, value: opt.value as string | number }))}
                    onChange={(value) => updateSetting(inputConfig.field, value)}
                  />
                </div>
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}