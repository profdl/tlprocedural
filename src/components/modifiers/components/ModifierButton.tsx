import { useCallback } from 'react'
import { stopEventPropagation } from 'tldraw'
import './ModifierButton.css'

export interface ModifierButtonProps {
  /** Button text */
  children: React.ReactNode
  /** Click handler */
  onClick: () => void
  /** Optional disabled state */
  disabled?: boolean
  /** Optional tooltip */
  title?: string
  /** Optional CSS class name */
  className?: string
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'apply'
}

/**
 * Unified button component for all modifier-related buttons
 * (Add Modifier, Apply, Apply All)
 *
 * This component provides consistent styling and behavior
 * without fighting against TLDraw's button styles.
 */
export function ModifierButton({
  children,
  onClick,
  disabled = false,
  title,
  className = '',
  variant = 'secondary'
}: ModifierButtonProps) {

  const handleClick = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    stopEventPropagation(e)
    if (!disabled) {
      onClick()
    }
  }, [disabled, onClick])

  const buttonClass = [
    'modifier-button',
    `modifier-button--${variant}`,
    disabled ? 'modifier-button--disabled' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={buttonClass}
      onClick={handleClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}