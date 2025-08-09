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

          // Create a simple circle for the new point
          const currentPoint = runtime.points[runtime.points.length - 1]
          
          ed.run(() => {
            let mainShape: any = null
            
            // Create dot for the point (if enabled)
            if (gen.settings.showPoints) {
              const dotShape = ed.createShape({
                type: 'geo',
                x: currentPoint.x - 1,
                y: currentPoint.y - 1,
                props: {
                  w: 2,
                  h: 2,
                  geo: 'ellipse',
                  color: 'red',
                  fill: 'solid',
                  size: 's'
                },
                meta: { isGeneratorPreview: true, generatorId: gen.id, isPoint: true },
              })
              
              if (!mainShape) mainShape = dotShape
            }
            
            // Create/update the connecting curve through all points (if enabled)
            if (gen.settings.showCurve && runtime.points.length >= 2) {
              // Remove any existing curve
              const allShapes = ed.getCurrentPageShapes()
              const existingCurve = allShapes.find(shape => 
                shape.meta?.isGeneratorPreview && 
                shape.meta?.generatorId === gen.id && 
                shape.meta?.isCurve
              )
              
              if (existingCurve) {
                ed.deleteShapes([existingCurve.id])
              }
              
              // Create new curve through all points
              const curveShape = ed.createShape({
                type: 'draw',
                x: 0,
                y: 0,
                props: {
                  segments: convertPointsToDrawSegments(runtime.points),
                  color: 'black',
                  size: 'm',
                  isComplete: true,
                },
                meta: { isGeneratorPreview: true, generatorId: gen.id, isCurve: true },
              })
              
              // Prefer curve as main shape for tracking
              mainShape = curveShape
            }
            
            // Set the main shape for tracking (curve preferred, then dot)
            if (mainShape && runtime.stepCount === 1) {
              store.setPreviewShape(gen.id, mainShape.id as TLShapeId)
            } else if (mainShape && gen.settings.showCurve && runtime.points.length >= 2) {
              store.setPreviewShape(gen.id, mainShape.id as TLShapeId)
            }
          }, { history: 'ignore' })
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

function convertPointsToDrawSegments(points: { x: number; y: number }[]) {
  if (points.length === 0) return []
  
  const segments = []
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    
    if (i === 0) {
      // First point - start the path
      segments.push({
        type: 'free',
        points: [{ x: point.x, y: point.y, z: 0.5 }]
      })
    } else {
      // Subsequent points - continue the path
      segments.push({
        type: 'free',
        points: [{ x: point.x, y: point.y, z: 0.5 }]
      })
    }
  }
  
  return segments
}






