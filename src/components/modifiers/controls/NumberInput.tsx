import { stopEventPropagation } from 'tldraw'

interface NumberInputProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

export function NumberInput({ 
  label, 
  value, 
  min, 
  max, 
  step = 1, 
  onChange 
}: NumberInputProps) {
  return (
    <div className="modifier-number-input" onPointerDown={stopEventPropagation}>
      <label className="modifier-number-input__label">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={stopEventPropagation}
        className="modifier-number-input__input"
      />
    </div>
  )
} 