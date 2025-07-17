import { useState, useCallback, useEffect, useRef } from 'react'
import { 
  TldrawUiButton,
  TldrawUiButtonIcon,
  stopEventPropagation
} from 'tldraw'
import './AddButton.css'

export interface AddButtonOption {
  /** Unique identifier for the option */
  id: string
  /** Display text for the option */
  label: string
  /** Icon name for the option (used for the main button) */
  icon: string
  /** Optional disabled state */
  disabled?: boolean
}

export interface AddButtonProps {
  /** Main button label */
  label: string
  /** Icon for the main button */
  icon: string
  /** Array of options to show in the dropdown */
  options: AddButtonOption[]
  /** Callback when an option is selected */
  onSelect: (optionId: string) => void
  /** Optional tooltip for the main button */
  title?: string
  /** Optional disabled state for the main button */
  disabled?: boolean
  /** Optional CSS class name */
  className?: string
}

/**
 * Reusable AddButton component with dropdown functionality
 * 
 * Provides a button with a label and icon that opens a dropdown menu
 * with selectable options. Useful for adding modifiers, tools, or other features.
 */
export function AddButton({ 
  label, 
  icon, 
  options, 
  onSelect, 
  title, 
  disabled = false,
  className = ''
}: AddButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleOptionSelect = useCallback((optionId: string) => {
    onSelect(optionId)
    setShowDropdown(false)
  }, [onSelect])

  const handleButtonClick = useCallback((e: React.PointerEvent) => {
    stopEventPropagation(e)
    if (!disabled) {
      setShowDropdown(!showDropdown)
    }
  }, [disabled, showDropdown])

  return (
    <div className={`add-button ${className}`} ref={dropdownRef}>
      <TldrawUiButton
        type="normal"
        onPointerDown={handleButtonClick}
        title={title || `Add ${label}`}
        disabled={disabled}
        className="add-button__main"
      >
        <TldrawUiButtonIcon icon={icon} />
        {label}
      </TldrawUiButton>
      
             {showDropdown && (
         <div className="add-button__dropdown">
           {options.map((option) => (
             <button
               key={option.id}
               onClick={(e) => {
                 stopEventPropagation(e)
                 if (!option.disabled) {
                   handleOptionSelect(option.id)
                 }
               }}
               disabled={option.disabled}
               className="add-button__option"
             >
               {option.label}
             </button>
           ))}
         </div>
       )}
    </div>
  )
} 