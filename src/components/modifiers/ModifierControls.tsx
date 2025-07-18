import React, { useCallback, useMemo, useState } from 'react'
import { useModifierStore } from '../../store/modifierStore'
import { DEFAULT_SETTINGS } from './constants'
import { TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { MODIFIER_DISPLAY_NAMES } from './constants'
import type { TLModifierId } from '../../types/modifiers'
import type { TLShape } from 'tldraw'
import { LinearArrayControls } from './controls/LinearArrayControls'
import { CircularArrayControls } from './controls/CircularArrayControls'
import { GridArrayControls } from './controls/GridArrayControls'
import { MirrorControls } from './controls/MirrorControls'
import { AddButton, type AddButtonOption } from './components/AddButton'

// Local stopEventPropagation implementation
function stopEventPropagation(e: React.SyntheticEvent | Event) {
  e.stopPropagation()
}

interface ModifierControlsProps {
  /** Array of currently selected shapes */
  selectedShapes: TLShape[]
}

type ModifierType = 'linear' | 'circular' | 'grid' | 'mirror'

// Using the AddButtonOption interface from the imported AddButton component

export function ModifierControls({ selectedShapes }: ModifierControlsProps) {
  const store = useModifierStore()
  const [collapsedModifiers, setCollapsedModifiers] = useState<Set<string>>(new Set())

  // Get modifiers for the first selected shape (simplified for now)
  const selectedShape = selectedShapes[0]
  const shapeModifiers = useMemo(() => {
    return selectedShape ? store.getModifiersForShape(selectedShape.id) : []
  }, [store, selectedShape])

  const addModifier = useCallback((type: ModifierType) => {
    if (!selectedShape) return
    // Map UI type to store type
    const typeMap: Record<ModifierType, 'linear-array' | 'circular-array' | 'grid-array' | 'mirror'> = {
      linear: 'linear-array',
      circular: 'circular-array',
      grid: 'grid-array',
      mirror: 'mirror',
    }
    const storeType = typeMap[type]
    const settings = DEFAULT_SETTINGS[storeType] || {}
    store.createModifier(selectedShape.id, storeType, settings)
  }, [selectedShape, store])

  const removeModifier = useCallback((modifierId: string) => {
    store.deleteModifier(modifierId as TLModifierId)
  }, [store])

  const toggleModifier = useCallback((modifierId: string) => {
    const modifier = shapeModifiers.find(m => m.id === modifierId)
    if (modifier) {
      store.updateModifier(modifierId as TLModifierId, { enabled: !modifier.enabled })
    }
  }, [shapeModifiers, store])

  const toggleCollapsed = useCallback((modifierId: string) => {
    setCollapsedModifiers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(modifierId)) {
        newSet.delete(modifierId)
      } else {
        newSet.add(modifierId)
      }
      return newSet
    })
  }, [])

  const handleAddModifier = useCallback((optionId: string) => {
    const typeMap: Record<string, ModifierType> = {
      'linear': 'linear',
      'circular': 'circular',
      'grid': 'grid',
      'mirror': 'mirror'
    }
    const type = typeMap[optionId]
    if (type) {
      addModifier(type)
    }
  }, [addModifier])

  if (!selectedShape) {
    return (
      <div className="modifier-controls">
        <div className="modifier-controls__empty">
          <p>Select a shape to add modifiers</p>
        </div>
      </div>
    )
  }

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
    }
  ]

  return (
    <div className="modifier-controls">
      <AddButton
        label="Add Modifier"
        icon="plus"
        options={modifierOptions}
        onSelect={handleAddModifier}
        disabled={!selectedShape}
        className="modifier-controls__add-button"
      />
      {shapeModifiers.length === 0 ? (
        <div className="modifier-controls__empty">
          <p>No modifiers added yet</p>
          <p>Click the "Add Modifier" button to add modifiers</p>
        </div>
      ) : (
        <div className="modifier-controls__list">
          {shapeModifiers.map((modifier) => {
            const isCollapsed = collapsedModifiers.has(modifier.id)
            const isEnabled = modifier.enabled
            return (
              <div key={modifier.id} className="modifier-controls__item">
                <div className="modifier-controls__item-header">
                  <div className="modifier-controls__item-title">
                    <TldrawUiButton
                      type="icon"
                      onPointerDown={(e) => {
                        stopEventPropagation(e)
                        toggleCollapsed(modifier.id)
                      }}
                      title={isCollapsed ? "Expand" : "Collapse"}
                      className="modifier-controls__caret"
                    >
                      <TldrawUiButtonIcon
                        icon={isCollapsed ? "chevron-right" : "chevron-down"}
                      />
                    </TldrawUiButton>
                    <label className="modifier-controls__checkbox-label">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleModifier(modifier.id)}
                        onPointerDown={stopEventPropagation}
                        className="modifier-controls__checkbox"
                      />
                      <span className="modifier-controls__checkbox-text">
                        {MODIFIER_DISPLAY_NAMES[modifier.type] || modifier.type}
                      </span>
                    </label>
                  </div>
                  <TldrawUiButton
                    type="icon"
                    onPointerDown={(e) => {
                      stopEventPropagation(e)
                      removeModifier(modifier.id)
                    }}
                    title="Remove Modifier"
                    className="modifier-controls__remove-button"
                  >
                    ×
                  </TldrawUiButton>
                </div>
                {/* Modifier details UI */}
                {!isCollapsed && (
                  <div className="modifier-controls__item-details">
                    {modifier.type === 'linear-array' && (
                      <LinearArrayControls
                        settings={modifier.props}
                        onChange={(newSettings) => {
                          console.log('LinearArrayControls onChange:', newSettings)
                          store.updateModifier(modifier.id as TLModifierId, { props: newSettings })
                        }}
                      />
                    )}
                    {modifier.type === 'circular-array' && (
                      <CircularArrayControls
                        settings={modifier.props}
                        onChange={(newSettings) => {
                          console.log('CircularArrayControls onChange:', newSettings)
                          store.updateModifier(modifier.id as TLModifierId, { props: newSettings })
                        }}
                      />
                    )}
                    {modifier.type === 'grid-array' && (
                      <GridArrayControls
                        settings={modifier.props}
                        onChange={(newSettings) => {
                          console.log('GridArrayControls onChange:', newSettings)
                          store.updateModifier(modifier.id as TLModifierId, { props: newSettings })
                        }}
                      />
                    )}
                    {modifier.type === 'mirror' && (
                      <MirrorControls
                        settings={modifier.props}
                        onChange={(newSettings) => {
                          console.log('MirrorControls onChange:', newSettings)
                          store.updateModifier(modifier.id as TLModifierId, { props: newSettings })
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Remove the local AddButton function - using the imported one instead 