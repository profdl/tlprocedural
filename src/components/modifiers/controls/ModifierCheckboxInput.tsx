import { memo } from 'react'
import { stopEventPropagation } from 'tldraw'

interface ModifierCheckboxInputProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export const ModifierCheckboxInput = memo(function ModifierCheckboxInput({ 
  label, 
  checked, 
  onChange 
}: ModifierCheckboxInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked)
  }

  return (
    <div className="modifier-property-input" onPointerDown={stopEventPropagation}>
      <div className="modifier-property-input__label">
        <label className="modifier-property-input__checkbox-label">
          <input
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            onPointerDown={stopEventPropagation}
            className="modifier-property-input__checkbox"
          />
          <span className="modifier-property-input__checkbox-text">
            {label}
          </span>
        </label>
      </div>
    </div>
  )
}) 