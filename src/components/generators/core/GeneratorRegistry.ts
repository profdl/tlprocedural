import type { Editor, TLShapeId } from 'tldraw'
import type { AnyGenerator, RandomWalkGenerator, SineWaveGenerator } from '../../../types/generators'
import { 
  type RandomWalkRuntime,
  initializeRuntime as initializeRandomWalkRuntime,
  needsRuntimeReset as needsRandomWalkRuntimeReset,
  stepRandomWalk
} from './RandomWalkProcessor'
import { ShapeRenderer } from './ShapeRenderer'

// Generic runtime state type
export type GeneratorRuntime = RandomWalkRuntime | unknown

// Generator processor interface
export interface GeneratorProcessor<TGenerator extends AnyGenerator, TRuntime> {
  initializeRuntime: (generator: TGenerator) => TRuntime
  needsRuntimeReset: (runtime: TRuntime | undefined, generator: TGenerator, resetTimestamp?: number) => boolean
  processStep: (runtime: TRuntime, generator: TGenerator, editor: Editor, shapeRenderer: ShapeRenderer) => {
    shouldContinue: boolean
    mainShapeId?: TLShapeId
  }
}

// Random Walk Processor
const randomWalkProcessor: GeneratorProcessor<RandomWalkGenerator, RandomWalkRuntime> = {
  initializeRuntime: (generator) => {
    const runtime = initializeRandomWalkRuntime(generator.settings)
    if (generator.resetTimestamp) {
      runtime.lastResetTimestamp = generator.resetTimestamp
    }
    return runtime
  },

  needsRuntimeReset: (runtime, generator, resetTimestamp) => {
    return needsRandomWalkRuntimeReset(runtime, generator.settings, resetTimestamp)
  },

  processStep: (runtime, generator, _editor, shapeRenderer) => {
    // Check if we've reached the step limit
    if (runtime.stepCount >= generator.settings.steps) {
      return { shouldContinue: false }
    }

    // Time-based stepping using throttleFps
    const targetFps = Math.max(1, generator.settings.throttleFps || 30)
    const stepIntervalMs = 1000 / targetFps
    const now = performance.now()
    const elapsedSinceLastStep = now - runtime.lastStepAtMs
    
    if (runtime.stepCount < generator.settings.steps && elapsedSinceLastStep >= stepIntervalMs) {
      // Perform the random walk step
      const newPoint = stepRandomWalk(runtime, generator.settings)
      
      if (newPoint) {
        // Render the new point and update shapes
        const mainShapeId = shapeRenderer.renderRandomWalk(
          generator.id,
          runtime.points,
          generator.settings,
          true // isNewPoint
        )
        
        return { 
          shouldContinue: true, 
          mainShapeId: (runtime.stepCount === 1 || generator.settings.showCurve) ? mainShapeId : undefined
        }
      }
    }

    return { shouldContinue: true }
  }
}

// Sine Wave Processor
interface SineWaveRuntime {
  points: { x: number; y: number }[]
  currentStep: number
  lastStepAtMs: number
  lastResetTimestamp?: number
}

const sineWaveProcessor: GeneratorProcessor<SineWaveGenerator, SineWaveRuntime> = {
  initializeRuntime: (generator) => {
    return {
      points: [],
      currentStep: 0,
      lastStepAtMs: performance.now(),
      lastResetTimestamp: generator.resetTimestamp
    }
  },

  needsRuntimeReset: (runtime, _generator, resetTimestamp) => {
    return !runtime || (resetTimestamp !== undefined && runtime.lastResetTimestamp !== resetTimestamp)
  },

  processStep: (runtime, generator, _editor, shapeRenderer) => {
    const settings = generator.settings
    const totalSteps = Math.floor(settings.length / 2) // Generate points every 2 pixels
    
    // Check if we've generated all points
    if (runtime.currentStep >= totalSteps) {
      return { shouldContinue: false }
    }

    // Time-based stepping using throttleFps
    const targetFps = Math.max(1, settings.throttleFps || 30)
    const stepIntervalMs = 1000 / targetFps
    const now = performance.now()
    const elapsedSinceLastStep = now - runtime.lastStepAtMs
    
    if (elapsedSinceLastStep >= stepIntervalMs) {
      runtime.lastStepAtMs = now
      
      // Calculate the next point on the sine wave
      const progress = runtime.currentStep / totalSteps
      const x = progress * settings.length
      const radians = (settings.phase * Math.PI / 180) + (x * settings.frequency * 2 * Math.PI / settings.length)
      const y = Math.sin(radians) * settings.amplitude
      
      // Apply direction rotation
      const directionRadians = settings.direction * Math.PI / 180
      const rotatedX = x * Math.cos(directionRadians) - y * Math.sin(directionRadians)
      const rotatedY = x * Math.sin(directionRadians) + y * Math.cos(directionRadians)
      
      // Add to starting position
      const point = {
        x: settings.start.x + rotatedX,
        y: settings.start.y + rotatedY
      }
      
      runtime.points.push(point)
      runtime.currentStep++
      
      // Render the sine wave using generic point rendering
      const mainShapeId = shapeRenderer.renderRandomWalk(
        generator.id,
        runtime.points,
        {
          showPoints: settings.showPoints,
          showCurve: settings.showCurve,
          steps: totalSteps,
          stepLength: 2,
          seed: 1,
          throttleFps: settings.throttleFps,
          start: settings.start
        },
        true // isNewPoint
      )
      
      return { 
        shouldContinue: true, 
        mainShapeId: (runtime.currentStep === 1 || settings.showCurve) ? mainShapeId : undefined
      }
    }

    return { shouldContinue: true }
  }
}

// Registry of processors
const processorRegistry = {
  'random-walk': randomWalkProcessor,
  'sine-wave': sineWaveProcessor
} as const

/**
 * Gets the appropriate processor for a generator type
 */
export function getProcessor<T extends AnyGenerator>(generator: T): GeneratorProcessor<T, unknown> {
  return processorRegistry[generator.type] as GeneratorProcessor<T, unknown>
}

/**
 * Processes a single generator step using the appropriate processor
 */
export function processGeneratorStep(
  generator: AnyGenerator,
  runtime: GeneratorRuntime | undefined,
  runtimeStates: Map<string, GeneratorRuntime>,
  editor: Editor,
  shapeRenderer: ShapeRenderer
): {
  shouldContinue: boolean
  mainShapeId?: TLShapeId
  newRuntime?: GeneratorRuntime
} {
  const processor = getProcessor(generator)
  
  // Check if runtime needs reset or initialization
  if (processor.needsRuntimeReset(runtime, generator, generator.resetTimestamp)) {
    const newRuntime = processor.initializeRuntime(generator)
    runtimeStates.set(generator.id, newRuntime)
    runtime = newRuntime
  }

  if (!runtime) {
    return { shouldContinue: false }
  }

  // Process the step
  const result = processor.processStep(runtime, generator, editor, shapeRenderer)
  
  return {
    shouldContinue: result.shouldContinue,
    mainShapeId: result.mainShapeId,
    newRuntime: runtime
  }
}
