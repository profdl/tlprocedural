import React, { useCallback } from 'react'
import { TldrawUiButton } from 'tldraw'
import { AddButton, type AddButtonOption } from './AddButton'

// Local stopEventPropagation implementation
function stopEventPropagation(e: React.SyntheticEvent | Event) {
  e.stopPropagation()
}

type ModifierType = 'linear' | 'circular' | 'grid' | 'mirror' | 'lsystem'

interface ModifierActionButtonsProps {
  selectedShape: boolean
  hasEnabledModifiers: boolean
  onAddModifier: (type: ModifierType) => void
  onApplyModifiers: () => void
}

/**
 * Component for modifier action buttons
 * Extracts the action buttons logic from ModifierControls
 */
export function ModifierActionButtons({
  selectedShape,
  hasEnabledModifiers,
  onAddModifier,
  onApplyModifiers
}: ModifierActionButtonsProps) {
  const handleAddModifier = useCallback((optionId: string) => {
    const typeMap: Record<string, ModifierType> = {
      'linear': 'linear',
      'circular': 'circular',
      'grid': 'grid',
      'mirror': 'mirror',
      'lsystem': 'lsystem'
    }
    const type = typeMap[optionId]
    if (type) {
      onAddModifier(type)
    }
  }, [onAddModifier])

  // Define modifier options for the AddButton
  const modifierOptions: AddButtonOption[] = [
    {
      id: 'linear',
      label: 'Linear Array',
      icon: 'array'
    },
    {
      id: 'circular',
      label: 'Circular Array',
      icon: 'circle'
    },
    {
      id: 'grid',
      label: 'Grid Array',
      icon: 'grid'
    },
    {
      id: 'mirror',
      label: 'Mirror',
      icon: 'mirror'
    },
    {
      id: 'lsystem',
      label: 'L-System',
      icon: 'code'
    }
  ]

  return (
    <div className="modifier-controls__buttons">
      <AddButton
        label="Add Modifier"
        icon="plus"
        options={modifierOptions}
        onSelect={handleAddModifier}
        disabled={!selectedShape}
        className="modifier-controls__add-button"
      />
      <TldrawUiButton
        type="normal"
        onPointerDown={(e) => {
          stopEventPropagation(e)
          onApplyModifiers()
        }}
        disabled={!hasEnabledModifiers}
        className="modifier-controls__apply-button"
      >
        APPLY
      </TldrawUiButton>
    </div>
  )
} 