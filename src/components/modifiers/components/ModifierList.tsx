import React, { useState, useCallback } from 'react'
import { TldrawUiButton, TldrawUiButtonIcon } from 'tldraw'
import { MODIFIER_DISPLAY_NAMES } from '../constants'
import { LinearArrayControls } from '../controls/LinearArrayControls'
import { CircularArrayControls } from '../controls/CircularArrayControls'
import { GridArrayControls } from '../controls/GridArrayControls'
import { MirrorControls } from '../controls/MirrorControls'
import { LSystemControls } from '../controls/LSystemControls'
import type { 
  TLModifier, 
  TLModifierId,
  LinearArraySettings,
  CircularArraySettings,
  GridArraySettings,
  MirrorSettings
} from '../../../types/modifiers'
import type { LSystemSettings } from '../../../types/modifiers'
import { useModifierStore } from '../../../store/modifierStore'

// Local stopEventPropagation implementation
function stopEventPropagation(e: React.SyntheticEvent | Event) {
  e.stopPropagation()
}

interface ModifierListProps {
  modifiers: TLModifier[]
  onToggleModifier: (modifierId: string) => void
  onRemoveModifier: (modifierId: string) => void
}

/**
 * Component for rendering the list of modifiers
 * Extracts the modifier list rendering logic from ModifierControls
 */
export function ModifierList({ modifiers, onToggleModifier, onRemoveModifier }: ModifierListProps) {
  const store = useModifierStore()
  const [collapsedModifiers, setCollapsedModifiers] = useState<Set<string>>(new Set())

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

  if (modifiers.length === 0) {
    return (
      <div className="modifier-controls__empty">
        <p>No modifiers added yet</p>
        <p>Click the "Add Modifier" button to add modifiers</p>
      </div>
    )
  }

  return (
    <div className="modifier-controls__list">
      {modifiers.map((modifier) => {
        const isCollapsed = collapsedModifiers.has(modifier.id)
        const isEnabled = modifier.enabled
        
        return (
          <ModifierItem
            key={modifier.id}
            modifier={modifier}
            isCollapsed={isCollapsed}
            isEnabled={isEnabled}
            onToggleCollapsed={toggleCollapsed}
            onToggleModifier={onToggleModifier}
            onRemoveModifier={onRemoveModifier}
            onUpdateSettings={(newSettings) => {
              console.log(`${modifier.type} onChange:`, newSettings)
              store.updateModifier(modifier.id as TLModifierId, { props: newSettings as any })
            }}
          />
        )
      })}
    </div>
  )
}

interface ModifierItemProps {
  modifier: TLModifier
  isCollapsed: boolean
  isEnabled: boolean
  onToggleCollapsed: (modifierId: string) => void
  onToggleModifier: (modifierId: string) => void
  onRemoveModifier: (modifierId: string) => void
  onUpdateSettings: (newSettings: LinearArraySettings | CircularArraySettings | GridArraySettings | MirrorSettings | LSystemSettings) => void
}

/**
 * Component for rendering a single modifier item
 */
function ModifierItem({
  modifier,
  isCollapsed,
  isEnabled,
  onToggleCollapsed,
  onToggleModifier,
  onRemoveModifier,
  onUpdateSettings
}: ModifierItemProps) {
  return (
    <div className="modifier-controls__item">
      <div className="modifier-controls__item-header">
        <div className="modifier-controls__item-title">
          <TldrawUiButton
            type="icon"
            onPointerDown={(e) => {
              stopEventPropagation(e)
              onToggleCollapsed(modifier.id)
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
              onChange={() => onToggleModifier(modifier.id)}
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
            onRemoveModifier(modifier.id)
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
              onChange={onUpdateSettings}
            />
          )}
          {modifier.type === 'circular-array' && (
            <CircularArrayControls
              settings={modifier.props}
              onChange={onUpdateSettings}
            />
          )}
          {modifier.type === 'grid-array' && (
            <GridArrayControls
              settings={modifier.props}
              onChange={onUpdateSettings}
            />
          )}
          {modifier.type === 'mirror' && (
            <MirrorControls
              settings={modifier.props}
              onChange={onUpdateSettings}
            />
          )}
          {modifier.type === 'lsystem' && (
            <LSystemControls
              settings={modifier.props}
              onChange={onUpdateSettings}
            />
          )}
        </div>
      )}
    </div>
  )
} 