import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Editor, TLShapeId } from 'tldraw'
import {
  type GeneratorTarget,
  type AnyGenerator,
  type RandomWalkGenerator,
  type SineWaveGenerator,
  type RandomWalkSettings,
  type SineWaveSettings,
  getDefaultRandomWalkSettings,
  getDefaultSineWaveSettings,
} from '../../types/generators'
import { ShapeRenderer } from '../../components/generators/core/ShapeRenderer'

interface GeneratorStoreState {
  editor: Editor | null
  generators: Record<string, AnyGenerator>

  // core
  setEditor: (editor: Editor) => void
  createRandomWalk: (target: GeneratorTarget, settings?: Partial<RandomWalkSettings>) => RandomWalkGenerator
  createSineWave: (target: GeneratorTarget, settings?: Partial<SineWaveSettings>) => SineWaveGenerator
  updateGenerator: (id: string, changes: Partial<AnyGenerator>) => void
  deleteGenerator: (id: string) => void
  start: (id: string) => void
  pause: (id: string) => void
  reset: (id: string) => void
  setPreviewShape: (id: string, shapeId: TLShapeId | undefined) => void
  applyGenerator: (id: string) => void
}

function createId() {
  return 'gen_' + Math.random().toString(36).slice(2, 10)
}

export const useGeneratorStore = create<GeneratorStoreState>()(
  subscribeWithSelector((set, get) => ({
    editor: null,
    generators: {},

    setEditor: (editor) => set({ editor }),

    createRandomWalk: (target, overrides = {}) => {
      const id = createId()
      const settings = { ...getDefaultRandomWalkSettings(), ...overrides }
      const gen: RandomWalkGenerator = {
        id,
        type: 'random-walk',
        target,
        enabled: true,
        running: false,
        settings,
      }
      set((state) => ({ generators: { ...state.generators, [id]: gen } }))
      return gen
    },

    createSineWave: (target, overrides = {}) => {
      const id = createId()
      const settings = { ...getDefaultSineWaveSettings(), ...overrides }
      const gen: SineWaveGenerator = {
        id,
        type: 'sine-wave',
        target,
        enabled: true,
        running: false,
        settings,
      }
      set((state) => ({ generators: { ...state.generators, [id]: gen } }))
      return gen
    },

    updateGenerator: (id, changes) => {
      set((state) => {
        const prev = state.generators[id]
        if (!prev) return state
        return { generators: { ...state.generators, [id]: { ...prev, ...changes } as AnyGenerator } }
      })
    },

    deleteGenerator: (id) => {
      const gen = get().generators[id]
      const editor = get().editor
      
      // Clean up any preview shapes before deleting
      if (gen && editor) {
        const shapeRenderer = new ShapeRenderer(editor)
        shapeRenderer.removeGeneratorShapes(id)
      }
      
      set((state) => {
        const next = { ...state.generators }
        delete next[id]
        return { generators: next }
      })
    },

    start: (id) => {
      const gen = get().generators[id]
      console.log('Store.start called for:', id, 'found gen:', !!gen)
      if (!gen) return
      get().updateGenerator(id, { running: true })
      console.log('Updated generator to running:', get().generators[id])
    },

    pause: (id) => {
      const gen = get().generators[id]
      if (!gen) return
      get().updateGenerator(id, { running: false })
    },

    reset: (id) => {
      const gen = get().generators[id]
      const editor = get().editor
      if (!gen || !editor) return
      
      // Delete all generator preview shapes using ShapeRenderer
      const shapeRenderer = new ShapeRenderer(editor)
      shapeRenderer.removeGeneratorShapes(id)
      
      // Force runtime state recreation by updating a timestamp
      get().updateGenerator(id, { 
        running: false, 
        previewShapeId: undefined,
        // Add a reset timestamp to force runtime recreation
        resetTimestamp: Date.now()
      })
    },

    setPreviewShape: (id, shapeId) => {
      const gen = get().generators[id]
      if (!gen) return
      get().updateGenerator(id, { previewShapeId: shapeId })
    },

    applyGenerator: (id) => {
      const gen = get().generators[id]
      const editor = get().editor
      if (!gen || !editor) return
      
      // Convert generator shapes to permanent shapes
      const shapeRenderer = new ShapeRenderer(editor)
      shapeRenderer.applyGeneratorShapes(id)
      
      // Remove the generator from the store without deleting the shapes
      set((state) => {
        const next = { ...state.generators }
        delete next[id]
        return { generators: next }
      })
    },
  }))
)
