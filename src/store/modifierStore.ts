import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { 
  type Editor,
  type TLShapeId
} from 'tldraw'
import { 
  type TLModifier, 
  type TLModifierId, 
  type TLLinearArrayModifier, 
  type TLCircularArrayModifier,
  type TLGridArrayModifier,
  type TLMirrorModifier,
  createModifierId
} from '../types/modifiers'

// Zustand store state interface
interface ModifierStoreState {
  // State
  modifiers: Record<string, TLModifier>
  editor: Editor | null
  
  // Actions
  setEditor: (editor: Editor) => void
  
  // Core operations
  getModifiersForShape: (shapeId: TLShapeId) => TLModifier[]
  getModifier: (id: TLModifierId) => TLModifier | undefined
  /**
   * Generic modifier creation supporting all types
   * settings type depends on modifier type
   */
  createModifier: (
    targetShapeId: TLShapeId,
    type: 'linear-array' | 'circular-array' | 'grid-array' | 'mirror' | 'lsystem' | 'subdivide' | 'noise-offset' | 'smooth' | 'simplify',
    settings?: object
  ) => TLModifier
  addModifier: (modifier: TLModifier) => void
  updateModifier: (id: TLModifierId, changes: Partial<TLModifier>) => void
  deleteModifier: (id: TLModifierId) => void
  deleteModifiersForShape: (shapeId: TLShapeId) => void
  getAllModifiers: () => TLModifier[]
  hasModifiers: (shapeId: TLShapeId) => boolean
  getEnabledModifiersForShape: (shapeId: TLShapeId) => TLModifier[]
  reorderModifiers: (shapeId: TLShapeId, newOrder: TLModifierId[]) => void
  toggleModifier: (id: TLModifierId) => void
  clearAll: () => void
  exportModifiers: () => string
  importModifiers: (json: string) => void
  notifyChange: () => void
}

// Create the Zustand store
export const useModifierStore = create<ModifierStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    modifiers: {},
    editor: null,
    
    // Set editor reference
    setEditor: (editor: Editor) => {
      set({ editor })
    },
    
    // Get all modifiers for a shape
    getModifiersForShape: (shapeId: TLShapeId) => {
      const { modifiers } = get()
      return Object.values(modifiers)
        .filter(modifier => modifier.targetShapeId === shapeId)
        .sort((a, b) => a.order - b.order)
    },
    
    // Get a specific modifier by ID
    getModifier: (id: TLModifierId) => {
      const { modifiers } = get()
      return modifiers[id]
    },

    // Add a pre-created modifier to the store
    addModifier: (modifier: TLModifier) => {
      set(state => ({
        modifiers: {
          ...state.modifiers,
          [modifier.id]: modifier
        }
      }))
    },

    // Create a new generic modifier
    createModifier: (targetShapeId: TLShapeId, type: 'linear-array' | 'circular-array' | 'grid-array' | 'mirror' | 'lsystem' | 'subdivide' | 'noise-offset' | 'smooth' | 'simplify', settings: object = {}) => {
      const { getModifiersForShape } = get()
      const id = createModifierId()
      let modifier: TLModifier
      if (type === 'linear-array') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'linear-array',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            count: 3,
            offsetX: 50,
            offsetY: 0,
            rotation: 0,
            scaleStep: 1.0,
            ...settings
          }
        } as TLLinearArrayModifier
      } else if (type === 'circular-array') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'circular-array',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            count: 6,
            radius: 100,
            startAngle: 0,
            endAngle: 360,
            centerX: 0,
            centerY: 0,
            rotateEach: 0,
            rotateAll: 0,
            pointToCenter: false,
            ...settings
          }
        } as TLCircularArrayModifier
      } else if (type === 'grid-array') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'grid-array',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            rows: 2,
            columns: 2,
            spacingX: 50,
            spacingY: 50,
            offsetX: 0,
            offsetY: 0,
            ...settings
          }
        } as TLGridArrayModifier
      } else if (type === 'mirror') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'mirror',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            axis: 'x',
            offset: 0,
            mergeThreshold: 0,
            ...settings
          }
        } as TLMirrorModifier
      } else if (type === 'lsystem') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'lsystem',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            axiom: 'F',
            rules: { F: 'F+F−F−F+F' },
            iterations: 6,
            angle: 20,
            stepPercent: 100,
            lengthDecay: 1.0,
            scalePerIteration: 1.0,
            ...settings
          }
        } as import('../types/modifiers').TLLSystemModifier
      } else if (type === 'subdivide') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'subdivide',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            iterations: 1,
            factor: 0.5,
            smooth: false,
            ...settings
          }
        } as import('../types/modifiers').TLSubdivideModifier
      } else if (type === 'noise-offset') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'noise-offset',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            amplitude: 10,
            frequency: 0.1,
            octaves: 3,
            seed: 123,
            direction: 'both',
            ...settings
          }
        } as import('../types/modifiers').TLNoiseOffsetModifier
      } else if (type === 'smooth') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'smooth',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            iterations: 1,
            factor: 0.5,
            preserveCorners: true,
            cornerThreshold: 90,
            ...settings
          }
        } as import('../types/modifiers').TLSmoothModifier
      } else if (type === 'simplify') {
        modifier = {
          id,
          typeName: 'modifier',
          type: 'simplify',
          targetShapeId,
          enabled: true,
          order: getModifiersForShape(targetShapeId).length,
          props: {
            tolerance: 5,
            preserveCorners: true,
            minPoints: 3,
            ...settings
          }
        } as import('../types/modifiers').TLSimplifyModifier
      } else {
        throw new Error(`Unknown modifier type: ${type}`)
      }
      set(state => ({
        modifiers: { ...state.modifiers, [id]: modifier }
      }))
      get().notifyChange()
      return modifier
    },

    
    // Update modifier settings
    updateModifier: (id: TLModifierId, changes: Partial<TLModifier>) => {
      const { modifiers } = get()
      const existing = modifiers[id]
      
      if (existing) {
        const updated = { ...existing, ...changes }
        set(state => ({
          modifiers: { ...state.modifiers, [id]: updated as TLModifier }
        }))
        // Don't call notifyChange() for updates to avoid interfering with selection
        // The UI will re-render automatically due to Zustand subscriptions
      }
    },
    
    // Delete a modifier
    deleteModifier: (id: TLModifierId) => {
      const { modifiers } = get()
      if (modifiers[id]) {
        set(state => {
          const newModifiers = { ...state.modifiers }
          delete newModifiers[id]
          return { modifiers: newModifiers }
        })
        get().notifyChange()
      }
    },
    
    // Delete all modifiers for a shape
    deleteModifiersForShape: (shapeId: TLShapeId) => {
      const { modifiers } = get()
      const modifiersToDelete = Object.values(modifiers)
        .filter(modifier => modifier.targetShapeId === shapeId)
        .map(modifier => modifier.id)
      
      if (modifiersToDelete.length > 0) {
        set(state => {
          const newModifiers = { ...state.modifiers }
          modifiersToDelete.forEach(id => delete newModifiers[id])
          return { modifiers: newModifiers }
        })
        get().notifyChange()
      }
    },
    
    // Get all modifiers
    getAllModifiers: () => {
      const { modifiers } = get()
      return Object.values(modifiers)
    },
    
    // Check if a shape has modifiers
    hasModifiers: (shapeId: TLShapeId) => {
      const { getModifiersForShape } = get()
      return getModifiersForShape(shapeId).length > 0
    },
    
    // Get enabled modifiers for a shape
    getEnabledModifiersForShape: (shapeId: TLShapeId) => {
      const { getModifiersForShape } = get()
      return getModifiersForShape(shapeId).filter(m => m.enabled)
    },
    
    // Reorder modifiers
    reorderModifiers: (_shapeId: TLShapeId, newOrder: TLModifierId[]) => {
      const { updateModifier } = get()
      newOrder.forEach((id, index) => {
        updateModifier(id, { order: index })
      })
    },
    
    // Toggle modifier enabled state
    toggleModifier: (id: TLModifierId) => {
      const { getModifier, updateModifier } = get()
      const modifier = getModifier(id)
      if (modifier) {
        updateModifier(id, { enabled: !modifier.enabled })
      }
    },
    
    // Notify tldraw that something changed (force re-render)
    notifyChange: () => {
      const { editor } = get()
      if (editor) {
        // Use a more gentle approach that doesn't interfere with selection
        // Instead of marking a change, we'll just trigger a re-render
        editor.updateInstanceState({ isDebugMode: editor.getInstanceState().isDebugMode })
      }
    },
    
    // Clear all modifiers (useful for cleanup)
    clearAll: () => {
      set({ modifiers: {} })
      get().notifyChange()
    },
    
    // Export modifiers as JSON (for persistence)
    exportModifiers: () => {
      const { modifiers } = get()
      return JSON.stringify(modifiers)
    },
    
    // Import modifiers from JSON
    importModifiers: (json: string) => {
      try {
        const modifiers = JSON.parse(json) as Record<string, TLModifier>
        set({ modifiers })
        get().notifyChange()
      } catch (error) {
        console.error('Failed to import modifiers:', error)
      }
    }
  }))
)
