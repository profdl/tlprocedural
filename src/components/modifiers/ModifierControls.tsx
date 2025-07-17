import { useState, useCallback, useMemo } from 'react'
import { 
  TldrawUiButton,
  TldrawUiButtonIcon,
  useEditor,
  stopEventPropagation,
  createShapeId,
  type TLShape,
  type TLShapeId
} from 'tldraw'
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

// Modifier type options
type ModifierType = 'linear' | 'circular' | 'grid' | 'mirror'

interface ModifierControlsProps {
  selectedShapes: TLShape[]
}

interface ModifierPropertyInputProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  precision?: number // Number of decimal places to show
}

// Reusable Modifier Property Input Component
function ModifierPropertyInput({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  onChange, 
  precision = 0 
}: ModifierPropertyInputProps) {
  const [inputValue, setInputValue] = useState(value.toString())
  
  // Update input value when prop value changes
  useMemo(() => {
    setInputValue(value.toFixed(precision))
  }, [value, precision])
  
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value)
    onChange(newValue)
  }, [onChange])
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = e.target.value
    setInputValue(newInputValue)
    
    const numValue = Number(newInputValue)
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(numValue)
    }
  }, [onChange, min, max])
  
  const handleInputBlur = useCallback(() => {
    const numValue = Number(inputValue)
    if (isNaN(numValue) || numValue < min) {
      setInputValue(min.toFixed(precision))
      onChange(min)
    } else if (numValue > max) {
      setInputValue(max.toFixed(precision))
      onChange(max)
    } else {
      setInputValue(numValue.toFixed(precision))
    }
  }, [inputValue, min, max, precision, onChange])
  
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }, [])

  return (
    <div className="modifier-property-input" onPointerDown={stopEventPropagation}>
      <div className="modifier-property-input__label">
        <span>{label}</span>
        <input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          min={min}
          max={max}
          step={step}
          className="modifier-property-input__number"
          onPointerDown={stopEventPropagation}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleSliderChange}
        onPointerDown={stopEventPropagation}
        className="modifier-property-input__slider"
      />
    </div>
  )
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



// Mirror Controls Component
function MirrorControls({ 
  settings, 
  onChange 
}: { 
  settings: MirrorSettings
  onChange: (settings: MirrorSettings) => void 
}) {
  const updateSetting = useCallback((key: keyof MirrorSettings, value: string | number) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        <div className="modifier-controls__dropdown">
          <label>Mirror Axis</label>
          <select
            value={settings.axis}
            onChange={(e) => updateSetting('axis', e.target.value)}
            className="modifier-controls__select"
            onPointerDown={stopEventPropagation}
          >
            <option value="x">Horizontal (X)</option>
            <option value="y">Vertical (Y)</option>
            <option value="diagonal">Diagonal</option>
          </select>
        </div>
        
        <ModifierSlider
          label="Offset"
          value={settings.offset}
          min={-200}
          max={200}
          step={1}
          onChange={(value) => updateSetting('offset', value)}
        />
        
        <ModifierSlider
          label="Merge Threshold"
          value={settings.mergeThreshold}
          min={0}
          max={50}
          step={1}
          onChange={(value) => updateSetting('mergeThreshold', value)}
        />
      </div>
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
      <div className="modifier-controls__grid">
        <ModifierPropertyInput
          label="Count"
          value={settings.count}
          min={2}
          max={50}
          step={1}
          onChange={(value) => updateSetting('count', value)}
        />
        
        <ModifierPropertyInput
          label="Offset X"
          value={settings.offsetX}
          min={-200}
          max={200}
          step={1}
          onChange={(value) => updateSetting('offsetX', value)}
        />
        
        <ModifierPropertyInput
          label="Offset Y"
          value={settings.offsetY}
          min={-200}
          max={200}
          step={1}
          onChange={(value) => updateSetting('offsetY', value)}
        />
        
        <ModifierPropertyInput
          label="Rotation"
          value={settings.rotation}
          min={-180}
          max={180}
          step={1}
          onChange={(value) => updateSetting('rotation', value)}
        />
        
        <ModifierPropertyInput
          label="Spacing"
          value={settings.spacing}
          min={0.1}
          max={3}
          step={0.1}
          precision={1}
          onChange={(value) => updateSetting('spacing', value)}
        />
        
        <ModifierPropertyInput
          label="Scale Step"
          value={settings.scaleStep}
          min={0.8}
          max={1.5}
          step={0.001}
          precision={3}
          onChange={(value) => updateSetting('scaleStep', value)}
        />
      </div>
    </div>
  )
}

// Circular Array Controls Component
function CircularArrayControls({ 
  settings, 
  onChange 
}: { 
  settings: CircularArraySettings
  onChange: (settings: CircularArraySettings) => void 
}) {
  const updateSetting = useCallback((key: keyof CircularArraySettings, value: number | boolean) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        <ModifierPropertyInput
          label="Count"
          value={settings.count}
          min={2}
          max={50}
          step={1}
          onChange={(value) => updateSetting('count', value)}
        />
        
        <ModifierPropertyInput
          label="Radius"
          value={settings.radius}
          min={10}
          max={500}
          step={5}
          onChange={(value) => updateSetting('radius', value)}
        />
        
        <ModifierPropertyInput
          label="Start Angle"
          value={settings.startAngle}
          min={0}
          max={360}
          step={5}
          onChange={(value) => updateSetting('startAngle', value)}
        />
        
        <ModifierPropertyInput
          label="End Angle"
          value={settings.endAngle}
          min={0}
          max={360}
          step={5}
          onChange={(value) => updateSetting('endAngle', value)}
        />
        
        <ModifierPropertyInput
          label="Rotate All"
          value={settings.rotateAll}
          min={-180}
          max={180}
          step={5}
          onChange={(value) => updateSetting('rotateAll', value)}
        />
        
        <ModifierPropertyInput
          label="Rotate Each"
          value={settings.rotateEach}
          min={-180}
          max={180}
          step={5}
          onChange={(value) => updateSetting('rotateEach', value)}
        />
      </div>
      
      <div className="modifier-controls__checkbox-section">
        <label className="modifier-controls__checkbox">
          <input
            type="checkbox"
            checked={settings.pointToCenter}
            onChange={(e) => updateSetting('pointToCenter', e.target.checked)}
          />
          <span>Point to Center</span>
        </label>
      </div>
    </div>
  )
}

// Grid Array Controls Component
function GridArrayControls({ 
  settings, 
  onChange 
}: { 
  settings: GridArraySettings
  onChange: (settings: GridArraySettings) => void 
}) {
  const updateSetting = useCallback((key: keyof GridArraySettings, value: number) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        <ModifierSlider
          label="Rows"
          value={settings.rows}
          min={1}
          max={20}
          step={1}
          onChange={(value) => updateSetting('rows', value)}
        />
        
        <ModifierSlider
          label="Columns"
          value={settings.columns}
          min={1}
          max={20}
          step={1}
          onChange={(value) => updateSetting('columns', value)}
        />
        
        <ModifierSlider
          label="Spacing X"
          value={settings.spacingX}
          min={10}
          max={500}
          step={5}
          onChange={(value) => updateSetting('spacingX', value)}
        />
        
        <ModifierSlider
          label="Spacing Y"
          value={settings.spacingY}
          min={10}
          max={500}
          step={5}
          onChange={(value) => updateSetting('spacingY', value)}
        />
      </div>
    </div>
  )
}

// Mock modifier storage (we'll replace this with the real store later)
const mockModifiers = new Map<TLShapeId, TLModifier[]>()

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

function getMockModifiersForShape(shapeId: TLShapeId): TLModifier[] {
  return mockModifiers.get(shapeId) || []
}

function addMockModifier(shapeId: TLShapeId, modifier: TLModifier) {
  const existing = mockModifiers.get(shapeId) || []
  mockModifiers.set(shapeId, [...existing, modifier])
  triggerGlobalRefresh()
}

function updateMockModifier(shapeId: TLShapeId, modifierId: string, changes: any) {
  const modifiers = mockModifiers.get(shapeId) || []
  const updated = modifiers.map(m => 
    m.id.toString() === modifierId 
      ? { ...m, props: { ...m.props, ...changes } } as TLModifier
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
  const [showModifierDropdown, setShowModifierDropdown] = useState(false)
  // Collapsed state for each modifier by id
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  
  // Get the first selected shape (for now, we'll work with single selection)
  const primaryShape = selectedShapes[0]
  
  // Get modifiers for the selected shape
  const modifiers = useMemo(() => {
    if (!primaryShape) return []
    return getMockModifiersForShape(primaryShape.id)
  }, [primaryShape, refreshKey])
  
  // Add a new array modifier based on selected type
  const addArrayModifier = useCallback((modifierType: ModifierType) => {
    if (!primaryShape) return
    
    let newModifier: TLModifier
    
    switch (modifierType) {
      case 'linear':
        newModifier = {
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
            scaleStep: 1.1
          }
        } as TLLinearArrayModifier
        break
        
      case 'circular':
        newModifier = {
          id: createModifierId(),
          typeName: 'modifier',
          type: 'circular-array',
          targetShapeId: primaryShape.id,
          enabled: true,
          order: modifiers.length,
          props: {
            count: 8,
            radius: 100,
            startAngle: 0,
            endAngle: 360,
            centerX: 0,
            centerY: 0,
            rotateAll: 0,
            rotateEach: 0,
            pointToCenter: false
          }
        } as TLCircularArrayModifier
        break
        
      case 'grid':
        newModifier = {
          id: createModifierId(),
          typeName: 'modifier',
          type: 'grid-array',
          targetShapeId: primaryShape.id,
          enabled: true,
          order: modifiers.length,
          props: {
            rows: 3,
            columns: 3,
            spacingX: 50,
            spacingY: 50,
            offsetX: 0,
            offsetY: 0
          }
        } as TLGridArrayModifier
        break
        
      case 'mirror':
        newModifier = {
          id: createModifierId(),
          typeName: 'modifier',
          type: 'mirror',
          targetShapeId: primaryShape.id,
          enabled: true,
          order: modifiers.length,
          props: {
            axis: 'x',
            offset: 0,
            mergeThreshold: 10
          }
        } as TLMirrorModifier
        break
        
      default:
        return
    }
    
    addMockModifier(primaryShape.id, newModifier)
    
    // Close the dropdown after adding
    setShowModifierDropdown(false)
    
    // Mark for undo/redo
    editor.markHistoryStoppingPoint()
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
    editor.markHistoryStoppingPoint()
  }, [primaryShape, editor])

  // Break apart clones - convert all modifier clones to unique editable shapes
  const breakApartClones = useCallback(() => {
    if (!primaryShape) return
    
    // Get all shapes in the editor
    const allShapes = editor.getCurrentPageShapes()
    
    // Find all clones of this shape
    const clonesToConvert: TLShape[] = []
    allShapes.forEach(shape => {
      if (isArrayClone(shape) && getOriginalShapeId(shape) === primaryShape.id) {
        clonesToConvert.push(shape)
      }
    })
    
    if (clonesToConvert.length === 0) {
      return // No clones to convert
    }
    
    // First, remove all modifiers from the original shape to stop the modifier system
    const allModifiers = getMockModifiersForShape(primaryShape.id)
    allModifiers.forEach(modifier => {
      removeMockModifier(primaryShape.id, modifier.id.toString())
    })
    
    // Create new independent shapes at the same positions as the clones
    const newIndependentShapes = clonesToConvert.map(clone => {
      // Remove clone-specific properties from meta
      const { isArrayClone, originalShapeId, arrayIndex, ...cleanMeta } = clone.meta || {}
      
      return {
        ...clone,
        id: createShapeId(), // Create completely new ID
        isLocked: false, // Make them editable
        meta: cleanMeta // Use the cleaned meta without clone properties
      }
    })
    
    // Create the new independent shapes
    editor.run(() => {
      editor.createShapes(newIndependentShapes)
    })
    
    // Mark for undo/redo
    editor.mark('break-apart-clones')
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
      {/* Add Button Section */}
      <div className="modifier-controls__add-section">
        <TldrawUiButton 
          type="normal" 
          className="modifier-controls__add-button"
          onClick={() => setShowModifierDropdown(!showModifierDropdown)}
          onPointerDown={stopEventPropagation}
          title="Add Modifier"
        >
          <TldrawUiButtonIcon icon="plus" />
          Add Modifier
        </TldrawUiButton>
        
        {/* Modifier Type Dropdown */}
        {showModifierDropdown && (
          <div className="modifier-controls__dropdown-menu">
            <TldrawUiButton 
              type="menu" 
              className="modifier-controls__dropdown-item"
              onClick={() => addArrayModifier('linear')}
              onPointerDown={stopEventPropagation}
            >
              Linear Array
            </TldrawUiButton>
            <TldrawUiButton 
              type="menu" 
              className="modifier-controls__dropdown-item"
              onClick={() => addArrayModifier('circular')}
              onPointerDown={stopEventPropagation}
            >
              Circular Array
            </TldrawUiButton>
            <TldrawUiButton 
              type="menu" 
              className="modifier-controls__dropdown-item"
              onClick={() => addArrayModifier('grid')}
              onPointerDown={stopEventPropagation}
            >
              Grid Array
            </TldrawUiButton>
            <TldrawUiButton 
              type="menu" 
              className="modifier-controls__dropdown-item"
              onClick={() => addArrayModifier('mirror')}
              onPointerDown={stopEventPropagation}
            >
              Mirror
            </TldrawUiButton>
          </div>
        )}
      </div>
      
      {/* Apply Button Section */}
      {modifiers.length > 0 && (
        <div className="modifier-controls__apply-section">
          <TldrawUiButton 
            type="normal" 
            className="modifier-controls__apply-button"
            onClick={breakApartClones}
            onPointerDown={stopEventPropagation}
            title="Apply - Make clones unique and remove modifiers"
          >
            Apply
          </TldrawUiButton>
        </div>
      )}
      
      {/* Modifier List */}
      {modifiers.length === 0 ? (
        <div className="modifier-controls__empty">
          No modifiers. Click "Add Modifier" to add one.
        </div>
      ) : (
        <div className="modifier-controls__list">
          {modifiers.map((modifier) => {
            const anyModifier = modifier as TLModifier
            const isCollapsed = collapsed[modifier.id] || false
            
            const getModifierTypeName = (type: string) => {
              switch (type) {
                case 'linear-array': return 'Linear Array'
                case 'circular-array': return 'Circular Array'
                case 'grid-array': return 'Grid Array'
                case 'mirror': return 'Mirror'
                default: return 'Modifier'
              }
            }
            
            return (
              <div key={modifier.id.toString()} className="modifier-controls__item">
                <div className="modifier-controls__item-header modifier-controls__item-header--borderless">
                  <span className="modifier-controls__item-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="modifier-controls__collapse-btn"
                      onClick={() => setCollapsed(c => ({ ...c, [modifier.id]: !isCollapsed }))}
                      tabIndex={-1}
                      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                        <polyline points="4,6 7,9 10,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {getModifierTypeName(anyModifier.type)} #{modifier.order + 1}
                  </span>
                  <TldrawUiButton 
                    type="icon" 
                    className="modifier-controls__remove-button modifier-controls__remove-button--small"
                    onClick={() => removeModifier(modifier.id.toString())}
                    onPointerDown={stopEventPropagation}
                    title="Remove Modifier"
                  >
                    <TldrawUiButtonIcon icon="cross-2" />
                  </TldrawUiButton>
                </div>
                
                {!isCollapsed && (
                  <div className="modifier-controls__inputs-wrapper">
                    {anyModifier.type === 'linear-array' && (
                      <LinearArrayControls
                        settings={(anyModifier as TLLinearArrayModifier).props}
                        onChange={(settings) => updateModifier(modifier.id.toString(), settings)}
                      />
                    )}
                    
                    {anyModifier.type === 'circular-array' && (
                      <CircularArrayControls
                        settings={(anyModifier as TLCircularArrayModifier).props}
                        onChange={(settings) => updateModifier(modifier.id.toString(), settings as any)}
                      />
                    )}
                    
                    {anyModifier.type === 'grid-array' && (
                      <GridArrayControls
                        settings={(anyModifier as TLGridArrayModifier).props}
                        onChange={(settings) => updateModifier(modifier.id.toString(), settings as any)}
                      />
                    )}
                    
                    {anyModifier.type === 'mirror' && (
                      <MirrorControls
                        settings={(anyModifier as TLMirrorModifier).props}
                        onChange={(settings) => updateModifier(modifier.id.toString(), settings as any)}
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

// Export the modifiers for use in the canvas
export function getShapeModifiers(shapeId: TLShapeId): TLModifier[] {
  return getMockModifiersForShape(shapeId)
} 