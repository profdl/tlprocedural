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
  type TLLinearArrayModifier,
  type TLCircularArrayModifier,
  type TLGridArrayModifier,
  type TLModifier,
  createModifierId 
} from '../../types/modifiers'
import { isArrayClone, getOriginalShapeId } from './LinearArrayModifier'

// Array type options
type ArrayType = 'linear' | 'circular' | 'grid'

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

// Array Type Dropdown Component
function ArrayTypeDropdown({
  arrayType,
  onChange
}: {
  arrayType: ArrayType
  onChange: (type: ArrayType) => void
}) {
  return (
    <div className="modifier-controls__dropdown">
      <select 
        value={arrayType}
        onChange={(e) => onChange(e.target.value as ArrayType)}
        className="modifier-controls__select"
        onPointerDown={stopEventPropagation}
      >
        <option value="linear">Linear Array</option>
        <option value="circular">Circular Array</option>
        <option value="grid">Grid Array</option>
      </select>
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
        <ModifierSlider
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

// Circular Array Controls Component
function CircularArrayControls({ 
  settings, 
  onChange 
}: { 
  settings: CircularArraySettings
  onChange: (settings: CircularArraySettings) => void 
}) {
  const updateSetting = useCallback((key: keyof CircularArraySettings, value: number) => {
    onChange({ ...settings, [key]: value })
  }, [settings, onChange])

  return (
    <div className="modifier-controls__section">
      <div className="modifier-controls__grid">
        <ModifierSlider
          label="Count"
          value={settings.count}
          min={2}
          max={50}
          step={1}
          onChange={(value) => updateSetting('count', value)}
        />
        
        <ModifierSlider
          label="Radius"
          value={settings.radius}
          min={10}
          max={500}
          step={5}
          onChange={(value) => updateSetting('radius', value)}
        />
        
        <ModifierSlider
          label="Start Angle"
          value={settings.startAngle}
          min={0}
          max={360}
          step={5}
          onChange={(value) => updateSetting('startAngle', value)}
        />
        
        <ModifierSlider
          label="End Angle"
          value={settings.endAngle}
          min={0}
          max={360}
          step={5}
          onChange={(value) => updateSetting('endAngle', value)}
        />
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
  const [selectedArrayType, setSelectedArrayType] = useState<ArrayType>('linear')
  
  // Get the first selected shape (for now, we'll work with single selection)
  const primaryShape = selectedShapes[0]
  
  // Get modifiers for the selected shape
  const modifiers = useMemo(() => {
    if (!primaryShape) return []
    return getMockModifiersForShape(primaryShape.id)
  }, [primaryShape, refreshKey])
  
  // Add a new array modifier based on selected type
  const addArrayModifier = useCallback(() => {
    if (!primaryShape) return
    
    let newModifier: TLModifier
    
    switch (selectedArrayType) {
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
            scaleStep: 1
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
            centerY: 0
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
        
      default:
        return
    }
    
    addMockModifier(primaryShape.id, newModifier)
    
    // Mark for undo/redo
    editor.markHistoryStoppingPoint()
  }, [primaryShape, modifiers.length, editor, selectedArrayType])
  
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
      {/* Header with Add Button */}
      <div className="modifier-controls__header">
        <div className="modifier-controls__title">Modifiers</div>
        <TldrawUiButton 
          type="icon" 
          className="modifier-controls__add-button modifier-controls__square-button"
          onClick={addArrayModifier}
          onPointerDown={stopEventPropagation}
          title={`Add ${selectedArrayType} Array Modifier`}
        >
          <TldrawUiButtonIcon icon="plus" />
        </TldrawUiButton>
      </div>
      
      {/* Array Type Dropdown */}
      <ArrayTypeDropdown 
        arrayType={selectedArrayType}
        onChange={setSelectedArrayType}
      />
      
      {/* Break Apart Button Section */}
      {modifiers.length > 0 && (
        <div className="modifier-controls__break-apart-section">
          <TldrawUiButton 
            type="normal" 
            className="modifier-controls__break-apart-button"
            onClick={breakApartClones}
            onPointerDown={stopEventPropagation}
            title="Break Apart - Make clones unique and remove modifiers"
          >
            <TldrawUiButtonIcon icon="external-link" />
            Break Apart Clones
          </TldrawUiButton>
        </div>
      )}
      
      {/* Modifier List */}
      {modifiers.length === 0 ? (
        <div className="modifier-controls__empty">
          No modifiers. Click + to add an Array.
        </div>
      ) : (
        <div className="modifier-controls__list">
          {modifiers.map((modifier) => {
            const anyModifier = modifier as TLModifier
            
            const getArrayTypeName = (type: string) => {
              switch (type) {
                case 'linear-array': return 'Linear'
                case 'circular-array': return 'Circular'
                case 'grid-array': return 'Grid'
                default: return 'Array'
              }
            }
            
            return (
              <div key={modifier.id.toString()} className="modifier-controls__item">
                <div className="modifier-controls__item-header">
                  <span className="modifier-controls__item-title">
                    {getArrayTypeName(anyModifier.type)} Array #{modifier.order + 1}
                  </span>
                  <TldrawUiButton 
                    type="icon" 
                    className="modifier-controls__remove-button modifier-controls__square-button"
                    onClick={() => removeModifier(modifier.id.toString())}
                    onPointerDown={stopEventPropagation}
                    title="Remove Modifier"
                  >
                    <TldrawUiButtonIcon icon="cross-2" />
                  </TldrawUiButton>
                </div>
                
                {/* Render different controls based on modifier type */}
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