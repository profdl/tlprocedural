import type { Vec2, RandomWalkSettings } from '../../../types/generators'

export interface RandomWalkRuntime {
  points: Vec2[]
  heading: number
  rng: () => number
  stepCount: number
  lastResetTimestamp?: number
  lastSettingsHash?: string
  lastStepAtMs: number
}

/**
 * Simple seeded random number generator using Linear Congruential Generator
 */
export function createSeededRNG(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/**
 * Creates a hash string from generator settings to detect changes
 */
export function createSettingsHash(settings: RandomWalkSettings): string {
  return JSON.stringify({
    steps: settings.steps,
    stepLength: settings.stepLength,
    seed: settings.seed,
    startX: settings.start.x,
    startY: settings.start.y,
    showPoints: Boolean(settings.showPoints),
    showCurve: Boolean(settings.showCurve)
  })
}

/**
 * Initializes runtime state for a random walk generator
 */
export function initializeRuntime(settings: RandomWalkSettings): RandomWalkRuntime {
  return {
    points: [settings.start],
    heading: 0,
    rng: createSeededRNG(settings.seed),
    stepCount: 0,
    lastSettingsHash: createSettingsHash(settings),
    lastStepAtMs: performance.now(),
  }
}

/**
 * Checks if runtime needs to be reset based on settings changes
 */
export function needsRuntimeReset(
  runtime: RandomWalkRuntime | undefined,
  settings: RandomWalkSettings,
  resetTimestamp?: number
): boolean {
  if (!runtime) return true
  
  const currentHash = createSettingsHash(settings)
  return (
    runtime.lastSettingsHash !== currentHash ||
    (resetTimestamp !== undefined && runtime.lastResetTimestamp !== resetTimestamp)
  )
}

/**
 * Performs a single step in the random walk
 */
export function stepRandomWalk(
  runtime: RandomWalkRuntime,
  settings: RandomWalkSettings
): Vec2 | null {
  if (runtime.stepCount >= settings.steps) {
    return null // Walk is complete
  }

  // Generate random direction (true random walk)
  const randomAngle = runtime.rng() * 2 * Math.PI

  // Calculate next point
  const lastPoint = runtime.points[runtime.points.length - 1]
  const newPoint: Vec2 = {
    x: lastPoint.x + Math.cos(randomAngle) * settings.stepLength,
    y: lastPoint.y + Math.sin(randomAngle) * settings.stepLength
  }

  runtime.points.push(newPoint)
  runtime.stepCount++
  runtime.lastStepAtMs = performance.now()

  return newPoint
}

/**
 * Converts points array to SVG path data
 */
export function pointsToSVGPath(points: Vec2[]): string {
  if (points.length === 0) return ''
  
  const [first, ...rest] = points
  let path = `M${first.x},${first.y}`
  
  for (const point of rest) {
    path += ` L${point.x},${point.y}`
  }
  
  return path
}

/**
 * Converts points to tldraw draw segments format
 */
export function pointsToDrawSegments(points: Vec2[]) {
  return points.map(point => ({
    type: 'free' as const,
    points: [{ x: point.x, y: point.y, z: 0.5 }]
  }))
}
