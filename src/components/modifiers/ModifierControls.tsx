import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { 
  TldrawUiButton,
  TldrawUiButtonIcon,
  useEditor,
  stopEventPropagation,
  createShapeId,
  type TLShape,
  type TLShapeId
} from 'tldraw'
import { AddButton, type AddButtonOption } from './components'

/**
 * Props for the ModifierControls component
 */
interface ModifierControlsProps {
  /** Array of currently selected shapes */
  selectedShapes: TLShape[]
}
import { 
  type LinearArraySettings, 
  type CircularArraySettings,
  type GridArraySettings,
  type MirrorSettings,
  type TLLinearArrayModifier,
  type TLCircularArrayModifier,
  type TLGridArrayModifier,
  type TLMirrorModifier,
  type TLModifier,
  createModifierId 
} from '../../types/modifiers'
import { isArrayClone, getOriginalShapeId } from './LinearArrayModifier'

// Import the new control components
import { LinearArrayControls } from './controls/LinearArrayControls'
import { CircularArrayControls } from './controls/CircularArrayControls'
import { GridArrayControls } from './controls/GridArrayControls'
import { MirrorControls } from './controls/MirrorControls'
import { MODIFIER_TYPES, DEFAULT_SETTINGS, MODIFIER_DISPLAY_NAMES } from './constants'

// Modifier type options
type ModifierType = 'linear' | 'circular' | 'grid' | 'mirror'

// Mock modifier storage (replace with proper state management)
const mockModifiers = new Map<TLShapeId, TLModifier[]>()

function getMockModifiersForShape(shapeId: TLShapeId): TLModifier[] {
  return mockModifiers.get(shapeId) || []
}

function addMockModifier(shapeId: TLShapeId, modifier: TLModifier) {
  const existing = getMockModifiersForShape(shapeId)
  mockModifiers.set(shapeId, [...existing, modifier])
}

function updateMockModifier(shapeId: TLShapeId, modifierId: string, changes: any) {
  const existing = getMockModifiersForShape(shapeId)
  const updated = existing.map(mod => 
    mod.id === modifierId ? { ...mod, ...changes } : mod
  )
  mockModifiers.set(shapeId, updated)
}

function removeMockModifier(shapeId: TLShapeId, modifierId: string) {
  const existing = getMockModifiersForShape(shapeId)
  const filtered = existing.filter(mod => mod.id !== modifierId)
  mockModifiers.set(shapeId, filtered)
}

// Global state to track local modifiers from ModifierControls
let globalLocalModifiers = new Map<TLShapeId, TLModifier[]>()

export function setGlobalLocalModifiers(modifiers: Map<TLShapeId, TLModifier[]>) {
  globalLocalModifiers = modifiers
}

// Create a reactive state for modifier changes
let modifierChangeListeners: (() => void)[] = []

export function subscribeToModifierChanges(listener: () => void) {
  modifierChangeListeners.push(listener)
  return () => {
    const index = modifierChangeListeners.indexOf(listener)
    if (index > -1) {
      modifierChangeListeners.splice(index, 1)
    }
  }
}

export function notifyModifierChanges() {
  modifierChangeListeners.forEach(listener => listener())
}

/**
 * Main component for managing shape modifiers
 * 
 * Provides UI controls for adding, configuring, and removing modifiers
 * from selected shapes. Supports linear arrays, circular arrays, grid arrays,
 * and mirror effects.
 * 
 * @param props - Component props
 * @param props.selectedShapes - Array of currently selected shapes
 * @returns JSX element with modifier controls UI
 */
export function ModifierControls({ selectedShapes }: ModifierControlsProps) {
  const editor = useEditor()
  const [localModifiers, setLocalModifiers] = useState<Map<TLShapeId, TLModifier[]>>(new Map())
  const [collapsedModifiers, setCollapsedModifiers] = useState<Set<string>>(new Set())
  
  // Get modifiers for the first selected shape (simplified for now)
  const selectedShape = selectedShapes[0]
  const shapeModifiers = selectedShape ? (localModifiers.get(selectedShape.id) || getMockModifiersForShape(selectedShape.id)) : []
  
  // Sync local state with global state whenever it changes
  useEffect(() => {
    setGlobalLocalModifiers(localModifiers)
    notifyModifierChanges() // Notify listeners that modifiers have changed
  }, [localModifiers])
  
  const addModifier = useCallback((type: ModifierType) => {
    if (!selectedShape) return
    
    const newModifier: TLModifier = {
      id: createModifierId(),
      typeName: 'modifier',
      targetShapeId: selectedShape.id,
      enabled: true,
      order: shapeModifiers.length,
      type: type === 'linear' ? 'linear-array' : 
            type === 'circular' ? 'circular-array' : 
            type === 'grid' ? 'grid-array' : 'mirror',
      props: DEFAULT_SETTINGS[type === 'linear' ? 'linear-array' : 
                             type === 'circular' ? 'circular-array' : 
                             type === 'grid' ? 'grid-array' : 'mirror']
    } as TLModifier
    
    // Update both local state and mock storage
    const existing = localModifiers.get(selectedShape.id) || getMockModifiersForShape(selectedShape.id)
    const updated = [...existing, newModifier]
    
    setLocalModifiers(prev => new Map(prev).set(selectedShape.id, updated))
    addMockModifier(selectedShape.id, newModifier)
  }, [selectedShape, shapeModifiers.length, localModifiers])
  
  const updateModifier = useCallback((modifierId: string, changes: any) => {
    if (!selectedShape) return
    
    const existing = localModifiers.get(selectedShape.id) || getMockModifiersForShape(selectedShape.id)
    const updated = existing.map(mod => 
      mod.id === modifierId ? { ...mod, ...changes } : mod
    )
    
    setLocalModifiers(prev => new Map(prev).set(selectedShape.id, updated))
    updateMockModifier(selectedShape.id, modifierId, changes)
  }, [selectedShape, localModifiers])
  
  const removeModifier = useCallback((modifierId: string) => {
    if (!selectedShape) return
    
    const existing = localModifiers.get(selectedShape.id) || getMockModifiersForShape(selectedShape.id)
    const filtered = existing.filter(mod => mod.id !== modifierId)
    
    setLocalModifiers(prev => new Map(prev).set(selectedShape.id, filtered))
    removeMockModifier(selectedShape.id, modifierId)
  }, [selectedShape, localModifiers])
  
  const toggleModifier = useCallback((modifierId: string) => {
    if (!selectedShape) return
    const modifier = shapeModifiers.find(m => m.id === modifierId)
    if (modifier) {
      updateModifier(modifierId, { enabled: !modifier.enabled })
    }
  }, [selectedShape, shapeModifiers, updateModifier])

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
                
                {isEnabled && !isCollapsed && (
                  <div className="modifier-controls__item-content">
                    {modifier.type === 'linear-array' && (
                      <LinearArrayControls
                        settings={modifier.props}
                        onChange={(settings) => updateModifier(modifier.id, { props: settings })}
                      />
                    )}
                    
                    {modifier.type === 'circular-array' && (
                      <CircularArrayControls
                        settings={modifier.props}
                        onChange={(settings) => updateModifier(modifier.id, { props: settings })}
                      />
                    )}
                    
                    {modifier.type === 'grid-array' && (
                      <GridArrayControls
                        settings={modifier.props}
                        onChange={(settings) => updateModifier(modifier.id, { props: settings })}
                      />
                    )}
                    
                    {modifier.type === 'mirror' && (
                      <MirrorControls
                        settings={modifier.props}
                        onChange={(settings) => updateModifier(modifier.id, { props: settings })}
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

/**
 * Retrieves all modifiers associated with a specific shape
 * 
 * @param shapeId - The ID of the shape to get modifiers for
 * @returns Array of modifiers associated with the shape
 */
export function getShapeModifiers(shapeId: TLShapeId): TLModifier[] {
  // Check local modifiers first, then fall back to mock storage
  const localMods = globalLocalModifiers.get(shapeId)
  if (localMods) {
    return localMods
  }
  return getMockModifiersForShape(shapeId)
} 