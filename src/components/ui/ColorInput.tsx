import { useState, useCallback } from 'react'

interface ColorInputProps {
  label?: string // Now optional since labels are handled externally
  value: string
  onChange: (value: string) => void
  allowNone?: boolean
}

export function ColorInput({
  label,
  value,
  onChange,
  // allowNone = false
}: ColorInputProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  // const _handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  //   onChange(e.target.value)
  // }, [onChange])

  // const _handleNoneClick = useCallback(() => {
  //   onChange('none')
  // }, [onChange])

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }, [onChange])

  return (
    <div className="color-input-compact">
      {/* Only show label if provided - for backwards compatibility */}
      {label && <label className="color-input-compact__label">{label}</label>}

      <div className="color-input-compact__container">
        {/* Color preview square */}
        <div
          className="color-input-compact__preview"
          style={{
            backgroundColor: value === 'none' ? 'transparent' : value,
            backgroundImage: value === 'none'
              ? 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)'
              : undefined,
            backgroundSize: value === 'none' ? '6px 6px' : undefined,
            backgroundPosition: value === 'none' ? '0 0, 0 3px, 3px -3px, -3px 0px' : undefined
          }}
          onClick={() => setIsPickerOpen(!isPickerOpen)}
        />

        {/* Hex value text */}
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          className="color-input-compact__text"
          placeholder="#000000"
        />

        {/* Hidden color picker */}
        {isPickerOpen && (
          <input
            type="color"
            value={value === 'none' ? '#000000' : value}
            onChange={(e) => {
              onChange(e.target.value)
              setIsPickerOpen(false)
            }}
            className="color-input-compact__picker"
            autoFocus
            onBlur={() => setIsPickerOpen(false)}
          />
        )}
      </div>
    </div>
  )
}