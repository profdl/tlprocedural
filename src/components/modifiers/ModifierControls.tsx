import { useState, useCallback, useMemo } from 'react'
import { 
  TldrawUiButton,
  TldrawUiButtonIcon,
  useEditor,
  stopEventPropagation,
  type TLShape,
  type TLShapeId
} from 'tldraw'
import { 
  type LinearArraySettings, 
  type TLLinearArrayModifier,
  createModifierId 
} from '../../types/modifiers'

interface ModifierControlsProps {
  selectedShapes: TLShape[]
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

// Custom slider component with tldraw styling
function ModifierSlider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="modifier-slider" onPointerDown={stopEventPropagation}>
      <div className="modifier-slider__label">
        <span>{label}</span>
        <span className="modifier-slider__value">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={stopEventPropagation}
        className="modifier-slider__input"
      />
    </div>
  )
}

// Number input component with tldraw styling
function NumberInput({ 
  label, 
  value, 
  min, 
  max, 
  step = 1, 
  onChange 
}: SliderProps) {
  return (
    <div className="modifier-number-input" onPointerDown={stopEventPropagation}>
      <label className="modifier-number-input__label">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={stopEventPropagation}
        className="modifier-number-input__input"
      />
    </div>
  )
}

// Linear Array Controls Component
function LinearArrayControls({ 
  settings, 
  onChange 
}: { 
  settings: LinearArraySettings
  onChange: (settings: LinearArraySettings) => void 
}) {
  const updateSetting = useCallback((key: keyof LinearArraySettings, value: number) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__section-header">
        <span>Linear Array</span>
      </div>
      
      <div className="modifier-controls__grid">
        <NumberInput
          label="Count"
          value={settings.count}
          min={2}
          max={50}
          step={1}
          onChange={(value) => updateSetting('count', value)}
        />
        
        <ModifierSlider
          label="Offset X"
          value={settings.offsetX}
          min={-200}
          max={200}
          step={1}
          onChange={(value) => updateSetting('offsetX', value)}
        />
        
        <ModifierSlider
          label="Offset Y"
          value={settings.offsetY}
          min={-200}
          max={200}
          step={1}
          onChange={(value) => updateSetting('offsetY', value)}
        />
        
        <ModifierSlider
          label="Rotation"
          value={settings.rotation}
          min={-180}
          max={180}
          step={1}
          onChange={(value) => updateSetting('rotation', value)}
        />
        
        <ModifierSlider
          label="Spacing"
          value={settings.spacing}
          min={0.1}
          max={3}
          step={0.1}
          onChange={(value) => updateSetting('spacing', value)}
        />
        
        <ModifierSlider
          label="Scale Step"
          value={settings.scaleStep}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(value) => updateSetting('scaleStep', value)}
        />
      </div>
    </div>
  )
}

// Mock modifier storage (we'll replace this with the real store later)
const mockModifiers = new Map<TLShapeId, TLLinearArrayModifier[]>()

// Global refresh mechanism for modifier changes
let globalRefreshCallbacks: Array<() => void> = []

function triggerGlobalRefresh() {
  globalRefreshCallbacks.forEach(callback => callback())
}

export function useModifierRefresh() {
  const [refreshKey, setRefreshKey] = useState(0)
  
  const forceRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])
  
  // Register this component for global refresh
  useMemo(() => {
    globalRefreshCallbacks.push(forceRefresh)
    return () => {
      globalRefreshCallbacks = globalRefreshCallbacks.filter(cb => cb !== forceRefresh)
    }
  }, [forceRefresh])
  
  return refreshKey
}

function getMockModifiersForShape(shapeId: TLShapeId): TLLinearArrayModifier[] {
  return mockModifiers.get(shapeId) || []
}

function addMockModifier(shapeId: TLShapeId, modifier: TLLinearArrayModifier) {
  const existing = mockModifiers.get(shapeId) || []
  mockModifiers.set(shapeId, [...existing, modifier])
  triggerGlobalRefresh()
}

function updateMockModifier(shapeId: TLShapeId, modifierId: string, changes: Partial<LinearArraySettings>) {
  const modifiers = mockModifiers.get(shapeId) || []
  const updated = modifiers.map(m => 
    m.id.toString() === modifierId 
      ? { ...m, props: { ...m.props, ...changes } }
      : m
  )
  mockModifiers.set(shapeId, updated)
  triggerGlobalRefresh()
}

function removeMockModifier(shapeId: TLShapeId, modifierId: string) {
  const modifiers = mockModifiers.get(shapeId) || []
  const filtered = modifiers.filter(m => m.id.toString() !== modifierId)
  mockModifiers.set(shapeId, filtered)
  triggerGlobalRefresh()
}

// Main Modifier Controls Component
export function ModifierControls({ selectedShapes }: ModifierControlsProps) {
  const editor = useEditor()
  const refreshKey = useModifierRefresh() // Use the global refresh mechanism
  
  // Get the first selected shape (for now, we'll work with single selection)
  const primaryShape = selectedShapes[0]
  
  // Get modifiers for the selected shape
  const modifiers = useMemo(() => {
    if (!primaryShape) return []
    return getMockModifiersForShape(primaryShape.id)
  }, [primaryShape, refreshKey])
  
  // Add a new linear array modifier
  const addLinearArrayModifier = useCallback(() => {
    if (!primaryShape) return
    
    const newModifier: TLLinearArrayModifier = {
      id: createModifierId(),
      typeName: 'modifier',
      type: 'linear-array',
      targetShapeId: primaryShape.id,
      enabled: true,
      order: modifiers.length,
      props: {
        count: 3,
        offsetX: 50,
        offsetY: 0,
        rotation: 0,
        spacing: 1,
        scaleStep: 1
      }
    }
    
    addMockModifier(primaryShape.id, newModifier)
    
    // Mark for undo/redo
    editor.mark('add-modifier')
  }, [primaryShape, modifiers.length, editor])
  
  // Update modifier settings
  const updateModifier = useCallback((modifierId: string, settings: LinearArraySettings) => {
    if (!primaryShape) return
    
    updateMockModifier(primaryShape.id, modifierId, settings)
  }, [primaryShape])
  
  // Remove modifier
  const removeModifier = useCallback((modifierId: string) => {
    if (!primaryShape) return
    
    removeMockModifier(primaryShape.id, modifierId)
    
    // Mark for undo/redo
    editor.mark('remove-modifier')
  }, [primaryShape, editor])
  
  // Don't show if no shape is selected
  if (!primaryShape) {
    return (
      <div className="modifier-controls" onPointerDown={stopEventPropagation}>
        <div className="modifier-controls__empty">
          Select a shape to add modifiers
        </div>
      </div>
    )
  }
  
  return (
    <div className="modifier-controls" onPointerDown={stopEventPropagation}>
      {/* Header with Add Button */}
      <div className="modifier-controls__header">
        <div className="modifier-controls__title">Modifiers</div>
        <TldrawUiButton 
          type="icon" 
          className="modifier-controls__add-button"
          onClick={addLinearArrayModifier}
          onPointerDown={stopEventPropagation}
          title="Add Linear Array Modifier"
        >
          <TldrawUiButtonIcon icon="plus" />
        </TldrawUiButton>
      </div>
      
      {/* Modifier List */}
      {modifiers.length === 0 ? (
        <div className="modifier-controls__empty">
          No modifiers. Click + to add a Linear Array.
        </div>
      ) : (
        <div className="modifier-controls__list">
          {modifiers.map((modifier) => (
            <div key={modifier.id.toString()} className="modifier-controls__item">
              <div className="modifier-controls__item-header">
                <span className="modifier-controls__item-title">
                  Linear Array #{modifier.order + 1}
                </span>
                <TldrawUiButton 
                  type="icon" 
                  className="modifier-controls__remove-button"
                  onClick={() => removeModifier(modifier.id.toString())}
                  onPointerDown={stopEventPropagation}
                  title="Remove Modifier"
                >
                  <TldrawUiButtonIcon icon="cross-2" />
                </TldrawUiButton>
              </div>
              
              <LinearArrayControls
                settings={modifier.props}
                onChange={(settings) => updateModifier(modifier.id.toString(), settings)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Export the modifiers for use in the canvas
export function getShapeModifiers(shapeId: TLShapeId): TLLinearArrayModifier[] {
  return getMockModifiersForShape(shapeId)
} 