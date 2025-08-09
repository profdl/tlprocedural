import { useEffect, useRef } from 'react'
import { useGeneratorStore } from '../../../store/generators/useGeneratorStore'
import { useEditor, type TLShapeId } from 'tldraw'

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

// Runtime state for random walk generators
interface RandomWalkRuntime {
  points: { x: number; y: number }[]
  heading: number
  rng: () => number
  stepCount: number
  lastResetTimestamp?: number
  lastSettingsHash?: string
  lastStepAtMs: number
  // Fixed viewport origin and size for stable rendering
  viewport: { x: number; y: number; size: number }
}

// Simple seeded random number generator
function createSeededRNG(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
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

      Object.values(generators).forEach((gen) => {
        if (!gen.running || gen.type !== 'random-walk') return

        // Create a hash of current settings to detect changes
        const settingsHash = JSON.stringify({
          steps: gen.settings.steps,
          stepLength: gen.settings.stepLength,
          seed: gen.settings.seed,
          startX: gen.settings.start.x,
          startY: gen.settings.start.y
        })

        // Get or create runtime state
        let runtime = runtimeStates.current.get(gen.id)
        const needsReset = !runtime || 
          runtime.lastSettingsHash !== settingsHash ||
          (gen.resetTimestamp && runtime.lastResetTimestamp !== gen.resetTimestamp)

        if (needsReset) {
          runtime = {
            points: [gen.settings.start],
            heading: 0,
            rng: createSeededRNG(gen.settings.seed),
            stepCount: 0,
            lastSettingsHash: settingsHash,
            lastResetTimestamp: gen.resetTimestamp,
            lastStepAtMs: now(),
            viewport: { x: 0, y: 0, size: 0 }, // Will be computed dynamically
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
          runtime.lastStepAtMs = (lastTick.current ?? now())

          // True random walk: pick a completely random direction for each step
          const randomAngle = runtime.rng() * 2 * Math.PI

          // Calculate next point using random direction
          const lastPoint = runtime.points[runtime.points.length - 1]
          const newPoint = {
            x: lastPoint.x + Math.cos(randomAngle) * gen.settings.stepLength,
            y: lastPoint.y + Math.sin(randomAngle) * gen.settings.stepLength
          }

          runtime.points.push(newPoint)
          runtime.stepCount++

          // Create or update preview shape after each step
          const shapeId = gen.previewShapeId
          
          // Position shape at origin and translate path to local coordinates
          const bounds = getBounds(runtime.points)
          const x = bounds.minX - 20 // add padding
          const y = bounds.minY - 20
          const w = bounds.width + 40
          const h = bounds.height + 40
          const d = generateLocalPath(runtime.points, bounds.minX - 20, bounds.minY - 20)

          if (!shapeId) {
            // Create new preview shape
            ed.run(() => {
              const created = ed.createShape({
                type: 'generated-path',
                x,
                y,
                isLocked: false,
                props: { 
                  d, 
                  isPreview: true, 
                  w, 
                  h,
                  stroke: '#222',
                  strokeWidth: 2
                },
                meta: { isGeneratorPreview: true, generatorId: gen.id },
              })
              store.setPreviewShape(gen.id, created.id as TLShapeId)
            }, { history: 'ignore' })
          } else {
            // Delete and recreate instead of update (tldraw update issue workaround)
            ed.run(() => {
              ed.deleteShapes([shapeId])
              const created = ed.createShape({
                type: 'generated-path',
                x,
                y,
                isLocked: false,
                props: { 
                  d, 
                  isPreview: true, 
                  w, 
                  h,
                  stroke: '#222',
                  strokeWidth: 2
                },
                meta: { isGeneratorPreview: true, generatorId: gen.id },
              })
              store.setPreviewShape(gen.id, created.id as TLShapeId)
            }, { history: 'ignore' })
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

function getBounds(points: { x: number; y: number }[]) {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 }
  
  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y

  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  }
}

function generateLocalPath(points: { x: number; y: number }[], originX: number, originY: number): string {
  if (points.length === 0) return ''
  
  let d = `M ${points[0].x - originX} ${points[0].y - originY}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x - originX} ${points[i].y - originY}`
  }
  return d
}


