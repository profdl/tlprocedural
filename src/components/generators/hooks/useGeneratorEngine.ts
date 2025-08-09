import { useEffect, useRef } from 'react'
import { useGeneratorStore } from '../../../store/generators/useGeneratorStore'
import { useEditor } from 'tldraw'
import { 
  type RandomWalkRuntime,
  initializeRuntime,
  needsRuntimeReset,
  stepRandomWalk
} from '../core/RandomWalkProcessor'
import { ShapeRenderer } from '../core/ShapeRenderer'

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
  const runtimeStates = useRef<Map<string, RandomWalkRuntime>>(new Map())

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
        if (!gen.running || gen.type !== 'random-walk') return

        // Get or create runtime state
        let runtime = runtimeStates.current.get(gen.id)
        
        if (needsRuntimeReset(runtime, gen.settings, gen.resetTimestamp)) {
          runtime = initializeRuntime(gen.settings)
          if (gen.resetTimestamp) {
            runtime.lastResetTimestamp = gen.resetTimestamp
          }
          runtimeStates.current.set(gen.id, runtime)
        }

        // TypeScript guard - runtime should never be undefined at this point
        if (!runtime) return

        // Check if we've reached the step limit
        if (runtime.stepCount >= gen.settings.steps) {
          store.pause(gen.id)
          return
        }

        // Time-based stepping using throttleFps
        const targetFps = Math.max(1, gen.settings.throttleFps || 30)
        const stepIntervalMs = 1000 / targetFps
        const elapsedSinceLastStep = (lastTick.current ?? now()) - runtime.lastStepAtMs
        
        if (runtime.stepCount < gen.settings.steps && elapsedSinceLastStep >= stepIntervalMs) {
          // Perform the random walk step
          const newPoint = stepRandomWalk(runtime, gen.settings)
          
          if (newPoint) {
            // Render the new point and update shapes
            const mainShapeId = shapeRenderer.renderRandomWalk(
              gen.id,
              runtime.points,
              gen.settings,
              true // isNewPoint
            )
            
            // Set the main shape for tracking on first step or when curve is updated
            if (mainShapeId && (runtime.stepCount === 1 || gen.settings.showCurve)) {
              store.setPreviewShape(gen.id, mainShapeId)
            }
          }
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
