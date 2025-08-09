import { useCallback } from 'react'
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
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const newValue = Number(e.target.value)
    // Ensure the value respects the step by rounding to the nearest step
    const roundedValue = Math.round(newValue / step) * step
    onChange(roundedValue)
  }, [onChange, step])

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
        onChange={handleSliderChange}
        onPointerDown={stopEventPropagation}
        className="modifier-slider__input"
      />
    </div>
  )
}
