import { stopEventPropagation } from 'tldraw'

interface ModifierSelectInputProps {
  label: string
  value: any
  options: Array<{ value: any; label: string }>
  onChange: (value: any) => void
}

export function ModifierSelectInput({ 
  label, 
  value, 
  options, 
  onChange 
}: ModifierSelectInputProps) {
  return (
    <div className="modifier-select-input" onPointerDown={stopEventPropagation}>
      <label className="modifier-select-input__label">{label}</label>
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