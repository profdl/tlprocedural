import { useCallback } from 'react'
import { AddButton, type AddButtonOption } from './AddButton'
import { ModifierButton } from './ModifierButton'

type ModifierType = 'linear' | 'circular' | 'grid' | 'mirror'

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
      'mirror': 'mirror'
    }
    const type = typeMap[optionId]
    if (type) {
      onAddModifier(type)
    }
  }, [onAddModifier])

  // Define modifier options for the AddButton
  const modifierOptions: AddButtonOption[] = [
    // Transform/Array Modifiers
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

      <ModifierButton
        onClick={onApplyModifiers}
        disabled={!hasEnabledModifiers}
        title="Apply all modifiers (creates permanent clones and removes all modifiers)"
        variant="apply"
        className="modifier-action-apply-all"
      >
        APPLY ALL
      </ModifierButton>
    </div>
  )
} 