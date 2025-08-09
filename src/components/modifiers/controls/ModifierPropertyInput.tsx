import { useState, useCallback, useMemo, memo } from 'react'
import { stopEventPropagation } from 'tldraw'

interface ModifierPropertyInputProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  precision?: number // Number of decimal places to show
}

export const ModifierPropertyInput = memo(function ModifierPropertyInput({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  onChange, 
  precision = 0 
}: ModifierPropertyInputProps) {
  const [inputValue, setInputValue] = useState(value.toString())
  
  // Update input value when prop value changes
  useMemo(() => {
    setInputValue(value.toFixed(precision))
  }, [value, precision])
  
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const newValue = Number(e.target.value)
    // Ensure the value respects the step by rounding to the nearest step
    const roundedValue = Math.round(newValue / step) * step
    onChange(roundedValue)
  }, [onChange, step])
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value
    setInputValue(newInputValue)
    
    const numValue = Number(newInputValue)
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      // Ensure the value respects the step by rounding to the nearest step
      const roundedValue = Math.round(numValue / step) * step
      onChange(roundedValue)
    }
  }, [onChange, min, max, step])
  
  const handleInputBlur = useCallback(() => {
    const numValue = Number(inputValue)
    if (isNaN(numValue) || numValue < min) {
      setInputValue(min.toFixed(precision))
      onChange(min)
    } else if (numValue > max) {
      setInputValue(max.toFixed(precision))
      onChange(max)
    } else {
      // Ensure the value respects the step by rounding to the nearest step
      const roundedValue = Math.round(numValue / step) * step
      setInputValue(roundedValue.toFixed(precision))
      onChange(roundedValue)
    }
  }, [inputValue, min, max, precision, onChange, step])
  
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }, [])

  return (
    <div className="modifier-property-input" onPointerDown={stopEventPropagation}>
      <div className="modifier-property-input__label">
        <span>{label}</span>
        <input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          min={min}
          max={max}
          step={step}
          className="modifier-property-input__number"
          onPointerDown={stopEventPropagation}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleSliderChange}
        onPointerDown={stopEventPropagation}
        className="modifier-property-input__slider"
      />
    </div>
  )
})
