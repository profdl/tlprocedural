import type { TLShape } from 'tldraw'
import type { TLModifier } from '../../../types/modifiers'
import type { VirtualInstance } from './TransformComposer'

/**
 * Base class for modifier-related errors
 */
export class ModifierError extends Error {
  readonly code: string
  readonly modifier?: TLModifier
  readonly shape?: TLShape
  readonly details?: unknown

  constructor(
    message: string,
    code: string,
    details?: {
      modifier?: TLModifier
      shape?: TLShape
      [key: string]: unknown
    }
  ) {
    super(message)
    this.name = 'ModifierError'
    this.code = code
    this.modifier = details?.modifier
    this.shape = details?.shape
    this.details = details
  }
}

/**
 * Error thrown when modifier processing fails
 */
export class ModifierProcessingError extends ModifierError {
  constructor(
    message: string,
    modifier: TLModifier,
    shape: TLShape,
    cause?: Error
  ) {
    super(
      `Failed to process ${modifier.type} modifier: ${message}`,
      'MODIFIER_PROCESSING_FAILED',
      { modifier, shape, cause }
    )
    this.name = 'ModifierProcessingError'
  }
}

/**
 * Error thrown when boolean operation fails
 */
export class BooleanOperationError extends ModifierError {
  readonly operation: string
  readonly instances: VirtualInstance[]

  constructor(
    message: string,
    operation: string,
    instances: VirtualInstance[],
    cause?: Error
  ) {
    super(
      `Boolean operation '${operation}' failed: ${message}`,
      'BOOLEAN_OPERATION_FAILED',
      { operation, instances, cause }
    )
    this.name = 'BooleanOperationError'
    this.operation = operation
    this.instances = instances
  }
}

/**
 * Error thrown when materialization fails
 */
export class MaterializationError extends ModifierError {
  readonly virtualInstances: VirtualInstance[]

  constructor(
    message: string,
    virtualInstances: VirtualInstance[],
    cause?: Error
  ) {
    super(
      `Failed to materialize virtual instances: ${message}`,
      'MATERIALIZATION_FAILED',
      { virtualInstances, cause }
    )
    this.name = 'MaterializationError'
    this.virtualInstances = virtualInstances
  }
}

/**
 * Error recovery strategies
 */
export const RecoveryStrategy = {
  SKIP_MODIFIER: 'SKIP_MODIFIER',
  USE_FALLBACK: 'USE_FALLBACK',
  ABORT_PROCESSING: 'ABORT_PROCESSING',
  RETRY_ONCE: 'RETRY_ONCE'
} as const

export type RecoveryStrategy = typeof RecoveryStrategy[keyof typeof RecoveryStrategy]

/**
 * Error handler for modifier processing
 */
export class ModifierErrorHandler {
  private static readonly MAX_RETRIES = 1
  private static retryCount = new Map<string, number>()

  /**
   * Handle modifier processing errors with recovery strategies
   */
  static handle(
    error: Error,
    context: {
      modifier?: TLModifier
      shape?: TLShape
      strategy?: RecoveryStrategy
    }
  ): { recovered: boolean; fallback?: unknown } {
    console.error('🚨 Modifier Error:', {
      error: error.message,
      modifier: context.modifier?.type,
      shapeId: context.shape?.id,
      strategy: context.strategy
    })

    // Log full error in development (check if we're in dev mode)
    // @ts-ignore - process may not be defined in all environments
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.error('Full error details:', error)
    }

    const strategy = context.strategy || RecoveryStrategy.SKIP_MODIFIER

    switch (strategy) {
      case RecoveryStrategy.SKIP_MODIFIER:
        console.warn('⚠️ Skipping modifier due to error')
        return { recovered: true }

      case RecoveryStrategy.USE_FALLBACK:
        console.warn('⚠️ Using fallback for modifier')
        return { recovered: true, fallback: [] }

      case RecoveryStrategy.RETRY_ONCE:
        const key = `${context.modifier?.id}-${context.shape?.id}`
        const retries = this.retryCount.get(key) || 0

        if (retries < this.MAX_RETRIES) {
          this.retryCount.set(key, retries + 1)
          console.warn(`⚠️ Retrying modifier (attempt ${retries + 1})`)
          return { recovered: false }
        } else {
          console.warn('⚠️ Max retries reached, skipping modifier')
          this.retryCount.delete(key)
          return { recovered: true }
        }

      case RecoveryStrategy.ABORT_PROCESSING:
      default:
        console.error('❌ Aborting modifier processing')
        throw error
    }
  }

  /**
   * Wrap a processing function with error handling
   */
  static wrap<T>(
    fn: () => T,
    context: {
      modifier?: TLModifier
      shape?: TLShape
      strategy?: RecoveryStrategy
    }
  ): T | undefined {
    try {
      return fn()
    } catch (error) {
      const result = this.handle(error as Error, context)
      if (result.recovered) {
        return result.fallback as T
      }
      // If not recovered and strategy is RETRY_ONCE, caller should retry
      throw error
    }
  }

  /**
   * Clear retry counts
   */
  static clearRetries(): void {
    this.retryCount.clear()
  }
}

/**
 * Performance monitoring for modifier processing
 */
export class ModifierPerformanceMonitor {
  private static timings = new Map<string, number[]>()
  private static readonly MAX_SAMPLES = 100

  /**
   * Start timing a modifier operation
   */
  static startTiming(modifierType: string, shapeId: string): () => void {
    const key = `${modifierType}-${shapeId}`
    const startTime = performance.now()

    return () => {
      const duration = performance.now() - startTime
      this.recordTiming(key, duration)

      if (duration > 100) {
        console.warn(`⚠️ Slow modifier processing: ${modifierType} took ${duration.toFixed(2)}ms`)
      }
    }
  }

  /**
   * Record a timing sample
   */
  private static recordTiming(key: string, duration: number): void {
    const samples = this.timings.get(key) || []
    samples.push(duration)

    // Keep only recent samples
    if (samples.length > this.MAX_SAMPLES) {
      samples.shift()
    }

    this.timings.set(key, samples)
  }

  /**
   * Get performance statistics for a modifier
   */
  static getStats(modifierType: string, shapeId: string): {
    avg: number
    min: number
    max: number
    samples: number
  } | null {
    const key = `${modifierType}-${shapeId}`
    const samples = this.timings.get(key)

    if (!samples || samples.length === 0) {
      return null
    }

    const sum = samples.reduce((a, b) => a + b, 0)
    return {
      avg: sum / samples.length,
      min: Math.min(...samples),
      max: Math.max(...samples),
      samples: samples.length
    }
  }

  /**
   * Clear all timing data
   */
  static clear(): void {
    this.timings.clear()
  }

  /**
   * Log performance report
   */
  static report(): void {
    console.group('📊 Modifier Performance Report')

    this.timings.forEach((samples, key) => {
      const stats = {
        avg: samples.reduce((a, b) => a + b, 0) / samples.length,
        min: Math.min(...samples),
        max: Math.max(...samples),
        samples: samples.length
      }

      console.log(`${key}: avg=${stats.avg.toFixed(2)}ms, min=${stats.min.toFixed(2)}ms, max=${stats.max.toFixed(2)}ms (${stats.samples} samples)`)
    })

    console.groupEnd()
  }
}