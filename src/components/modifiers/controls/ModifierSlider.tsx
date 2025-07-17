import { stopEventPropagation } from 'tldraw'

interface ModifierSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export function ModifierSlider({ label, value, min, max, step, onChange }: ModifierSliderProps) {
  return (
    <div className="modifier-slider" onPointerDown={stopEventPropagation}>
      <div className="modifier-slider__label">
        <span>{label}</span>
        <span className="modifier-slider__value">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={stopEventPropagation}
        className="modifier-slider__input"
      />
    </div>
  )
} 