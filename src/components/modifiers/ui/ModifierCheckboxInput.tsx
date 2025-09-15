import { memo } from 'react'
import { stopEventPropagation } from 'tldraw'

interface ModifierCheckboxInputProps {
  label?: string // Now optional since labels are handled externally
  checked: boolean
  onChange: (checked: boolean) => void
}

export const ModifierCheckboxInput = memo(function ModifierCheckboxInput({
  label: _label,
  checked,
  onChange
}: ModifierCheckboxInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked)
  }

  return (
    <div className="modifier-property-input" onPointerDown={stopEventPropagation}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        onPointerDown={stopEventPropagation}
        className="modifier-property-input__checkbox"
      />
    </div>
  )
}) 