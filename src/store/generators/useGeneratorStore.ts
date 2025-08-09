import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Editor, TLShapeId } from 'tldraw'
import {
  type GeneratorTarget,
  type RandomWalkGenerator,
  type RandomWalkSettings,
  getDefaultRandomWalkSettings,
} from '../../types/generators'

type AnyGenerator = RandomWalkGenerator

interface GeneratorStoreState {
  editor: Editor | null
  generators: Record<string, AnyGenerator>

  // core
  setEditor: (editor: Editor) => void
  createRandomWalk: (target: GeneratorTarget, settings?: Partial<RandomWalkSettings>) => RandomWalkGenerator
  updateGenerator: (id: string, changes: Partial<AnyGenerator>) => void
  deleteGenerator: (id: string) => void
  start: (id: string) => void
  pause: (id: string) => void
  reset: (id: string) => void
  setPreviewShape: (id: string, shapeId: TLShapeId | undefined) => void
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

    updateGenerator: (id, changes) => {
      set((state) => {
        const prev = state.generators[id]
        if (!prev) return state
        return { generators: { ...state.generators, [id]: { ...prev, ...changes } } }
      })
    },

    deleteGenerator: (id) => {
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
      
      // Delete all generator preview shapes
      const allShapes = editor.getCurrentPageShapes()
      const generatorShapes = allShapes.filter(shape => 
        shape.meta?.isGeneratorPreview && shape.meta?.generatorId === id
      )
      
      if (generatorShapes.length > 0) {
        editor.run(() => {
          editor.deleteShapes(generatorShapes.map(s => s.id))
        }, { history: 'ignore', ignoreShapeLock: true })
      }
      
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
  }))
)
