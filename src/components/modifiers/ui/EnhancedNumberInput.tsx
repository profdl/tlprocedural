import { useState, useCallback, useRef, useEffect } from 'react'
import { stopEventPropagation } from 'tldraw'

interface EnhancedNumberInputProps {
  label?: string // Now optional since labels are handled externally
  value: number
  min: number
  max: number
  step: number
  precision?: number // Number of decimal places to show
  onChange: (value: number) => void
  unit?: string // Optional unit to display (e.g., "px", "°")
}

export function EnhancedNumberInput({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  precision = 0,
  onChange,
  unit = ''
}: EnhancedNumberInputProps) {
  const [inputValue, setInputValue] = useState(value.toFixed(precision))
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartValue, setDragStartValue] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Update input value when prop value changes (but not while editing)
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toFixed(precision))
    }
  }, [value, precision, isEditing])

  // Clamp and round value to step
  const clampValue = useCallback((val: number) => {
    const clampedValue = Math.max(min, Math.min(max, val))
    return Math.round(clampedValue / step) * step
  }, [min, max, step])

  // Handle increment/decrement buttons
  const handleIncrement = useCallback(() => {
    const newValue = clampValue(value + step)
    onChange(newValue)
  }, [value, step, clampValue, onChange])

  const handleDecrement = useCallback(() => {
    const newValue = clampValue(value - step)
    onChange(newValue)
  }, [value, step, clampValue, onChange])

  // Handle direct input changes - defer onChange until blur
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value
    setInputValue(newInputValue)
    setIsEditing(true)
  }, [])

  // Handle input blur (validate and format)
  const handleInputBlur = useCallback(() => {
    setIsEditing(false)
    const numValue = Number(inputValue)
    if (isNaN(numValue)) {
      // Invalid input - restore previous value
      setInputValue(value.toFixed(precision))
    } else {
      // Valid input - clamp, format, and call onChange
      const clampedValue = clampValue(numValue)
      setInputValue(clampedValue.toFixed(precision))
      onChange(clampedValue)
    }
  }, [inputValue, value, precision, clampValue, onChange])

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsEditing(true)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIsEditing(false)
      handleIncrement()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIsEditing(false)
      handleDecrement()
    } else if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }, [handleIncrement, handleDecrement])

  // Mouse drag functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag on input field itself or arrow buttons
    if (e.target === inputRef.current || (e.target as HTMLElement).closest('.enhanced-number-input__arrow')) return
    
    e.preventDefault()
    setIsDragging(true)
    setIsEditing(false) // Exit editing mode when starting drag
    setDragStartY(e.clientY)
    setDragStartValue(value)
    
    // Focus the input when starting drag
    inputRef.current?.focus()
  }, [value])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    e.preventDefault()
    const deltaY = dragStartY - e.clientY // Inverted: up = positive
    const sensitivity = step * 0.5 // Adjust drag sensitivity
    const deltaValue = deltaY * sensitivity
    
    const newValue = clampValue(dragStartValue + deltaValue)
    onChange(newValue)
    // Update input display immediately when dragging
    setInputValue(newValue.toFixed(precision))
  }, [isDragging, dragStartY, dragStartValue, step, clampValue, onChange, precision])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Attach global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ns-resize'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'auto'
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={containerRef}
      className={`enhanced-number-input ${isDragging ? 'enhanced-number-input--dragging' : ''}`}
      onPointerDown={stopEventPropagation}
    >
      {/* Only show label if provided - for backwards compatibility */}
      {label && <label className="enhanced-number-input__label">{label}</label>}

      <div
        className="enhanced-number-input__container"
        onMouseDown={handleMouseDown}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={stopEventPropagation}
          className="enhanced-number-input__input"
          inputMode="decimal"
        />
        
        {unit && (
          <span className="enhanced-number-input__unit">{unit}</span>
        )}
        
        <div className="enhanced-number-input__arrows">
          <button
            type="button"
            className="tlui-button tlui-button__panel enhanced-number-input__arrow enhanced-number-input__arrow--up"
            onClick={handleIncrement}
            onPointerDown={stopEventPropagation}
            disabled={value >= max}
          >
            ▲
          </button>
          <button
            type="button"
            className="tlui-button tlui-button__panel enhanced-number-input__arrow enhanced-number-input__arrow--down"
            onClick={handleDecrement}
            onPointerDown={stopEventPropagation}
            disabled={value <= min}
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  )
}