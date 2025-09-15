import { stopEventPropagation } from 'tldraw'

interface ModifierSelectInputProps {
  label?: string // Now optional since labels are handled externally
  value: string | number
  options: Array<{ value: string | number; label: string }>
  onChange: (value: string | number) => void
}

export function ModifierSelectInput({ 
  label, 
  value, 
  options, 
  onChange 
}: ModifierSelectInputProps) {
  return (
    <div className="modifier-select-input" onPointerDown={stopEventPropagation}>
      {/* Only show label if provided - for backwards compatibility */}
      {label && <label className="modifier-select-input__label">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={stopEventPropagation}
        className="modifier-select-input__select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}