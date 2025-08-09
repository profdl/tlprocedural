import { useEffect, useRef } from 'react'
import { useGeneratorStore } from '../../../store/generators/useGeneratorStore'
import { useEditor } from 'tldraw'
import { ShapeRenderer } from '../core/ShapeRenderer'
import { type GeneratorRuntime, processGeneratorStep } from '../core/GeneratorRegistry'

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * Engine to drive running generators and update preview shape props.
 */
export function useGeneratorEngine() {
  const editor = useEditor()
  const store = useGeneratorStore()
  const rafRef = useRef<number | null>(null)
  const lastTick = useRef<number | null>(null)
  const runtimeStates = useRef<Map<string, GeneratorRuntime>>(new Map())

  useEffect(() => {
    if (editor) {
      const currentEditor = useGeneratorStore.getState().editor
      if (currentEditor !== editor) {
        store.setEditor(editor)
      }
    }
  }, [editor, store])

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const t = now()
      lastTick.current = t

      const state = useGeneratorStore.getState()
      const { generators } = state
      const ed = state.editor
      if (!ed) return

      const shapeRenderer = new ShapeRenderer(ed)

      Object.values(generators).forEach((gen) => {
        if (!gen.running) return

        // Get current runtime state
        const runtime = runtimeStates.current.get(gen.id)
        
        // Process the generator step using the registry
        const result = processGeneratorStep(
          gen,
          runtime,
          runtimeStates.current,
          ed,
          shapeRenderer
        )

        // Handle the result
        if (!result.shouldContinue) {
          store.pause(gen.id)
          return
        }

        // Set the main shape for tracking if provided
        if (result.mainShapeId) {
          store.setPreviewShape(gen.id, result.mainShapeId)
        }
      })
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTick.current = null
    }
  }, [store])

  // Clean up runtime states when generators are reset
  useEffect(() => {
    const unsubscribe = useGeneratorStore.subscribe(
      (state) => state.generators,
      (generators) => {
        // Remove runtime states for generators that no longer exist or are reset
        const runtimeIds = Array.from(runtimeStates.current.keys())
        
        runtimeIds.forEach(id => {
          const gen = generators[id]
          if (!gen || (!gen.running && !gen.previewShapeId)) {
            runtimeStates.current.delete(id)
          }
        })
      }
    )

    return unsubscribe
  }, [])
}
