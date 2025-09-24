import { type TLShape, type Editor } from 'tldraw'
import type { GroupContext } from '../../../types/modifiers'
import type { VirtualInstance } from './TransformComposer'

/**
 * ModifierContext provides a shared context for modifier processing
 * Centralizes common state and utilities used across different processors
 */
export class ModifierContext {
  readonly originalShape: TLShape
  readonly editor?: Editor
  readonly groupContext?: GroupContext
  readonly generationLevel: number

  private readonly processingMetadata: Map<string, unknown> = new Map()

  constructor(
    originalShape: TLShape,
    editor?: Editor,
    groupContext?: GroupContext,
    generationLevel: number = 0
  ) {
    this.originalShape = originalShape
    this.editor = editor
    this.groupContext = groupContext
    this.generationLevel = generationLevel
  }

  /**
   * Get shape bounds for percentage calculations
   */
  getShapeBounds(shape: TLShape = this.originalShape): { width: number; height: number } {
    // Handle different shape types
    if ('w' in shape.props && 'h' in shape.props) {
      return {
        width: shape.props.w as number,
        height: shape.props.h as number
      }
    }

    // Default fallback
    return { width: 100, height: 100 }
  }

  /**
   * Get visual bounds from editor if available
   */
  getVisualBounds(shape: TLShape) {
    if (this.editor) {
      return this.editor.getShapePageBounds(shape)
    }
    return null
  }

  /**
   * Get shape center considering rotation
   */
  getShapeCenter(shape: TLShape = this.originalShape): { x: number; y: number } {
    const bounds = this.getShapeBounds(shape)

    if (this.editor) {
      const visualBounds = this.getVisualBounds(shape)
      if (visualBounds) {
        return {
          x: visualBounds.x + visualBounds.width / 2,
          y: visualBounds.y + visualBounds.height / 2
        }
      }
    }

    // Fallback to calculated center
    return {
      x: shape.x + bounds.width / 2,
      y: shape.y + bounds.height / 2
    }
  }

  /**
   * Store processing metadata for sharing between processors
   */
  setMetadata(key: string, value: unknown): void {
    this.processingMetadata.set(key, value)
  }

  /**
   * Retrieve processing metadata
   */
  getMetadata<T = unknown>(key: string): T | undefined {
    return this.processingMetadata.get(key) as T | undefined
  }

  /**
   * Clear all processing metadata
   */
  clearMetadata(): void {
    this.processingMetadata.clear()
  }

  /**
   * Generate a unique ID for a modifier generation
   */
  generateGroupId(modifierType: string): string {
    return `${modifierType}-gen${this.generationLevel}-${Date.now()}`
  }

  /**
   * Check if instances should use unified composition
   */
  shouldUseUnifiedComposition(instances: VirtualInstance[]): boolean {
    // If we have multiple instances that are ALL from previous modifiers (no original),
    // they should be treated as a unified group
    const hasOriginal = instances.some(inst => inst.metadata.modifierType === 'original')
    const nonOriginalInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

    // Use unified composition if:
    // 1. We have multiple instances AND no original (output from previous modifier)
    // 2. OR we have multiple non-original instances with original (mixed case)
    if (!hasOriginal && instances.length > 1) {
      // All instances are from previous modifiers - treat as unified
      return true
    }

    if (hasOriginal && nonOriginalInstances.length > 1) {
      // Mixed case - multiple instances from previous modifier plus original
      return true
    }

    return false
  }

  /**
   * Calculate collective bounds from instances
   */
  calculateCollectiveBounds(
    instances: VirtualInstance[]
  ): { center: { x: number; y: number }; bounds: { width: number; height: number } } {
    const shapeBounds = this.getShapeBounds()

    if (instances.length === 0) {
      return {
        center: this.getShapeCenter(),
        bounds: shapeBounds
      }
    }

    // Calculate bounds from all instances
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    instances.forEach(instance => {
      const { x, y } = instance.transform.point()
      const instanceMinX = x
      const instanceMaxX = x + shapeBounds.width
      const instanceMinY = y
      const instanceMaxY = y + shapeBounds.height

      minX = Math.min(minX, instanceMinX)
      maxX = Math.max(maxX, instanceMaxX)
      minY = Math.min(minY, instanceMinY)
      maxY = Math.max(maxY, instanceMaxY)
    })

    const width = maxX - minX
    const height = maxY - minY
    const centerX = minX + width / 2
    const centerY = minY + height / 2

    return {
      center: { x: centerX, y: centerY },
      bounds: { width, height }
    }
  }

  /**
   * Clone context for a new generation level
   */
  nextGeneration(): ModifierContext {
    return new ModifierContext(
      this.originalShape,
      this.editor,
      this.groupContext,
      this.generationLevel + 1
    )
  }

  /**
   * Create a context for a specific shape
   */
  static fromShape(shape: TLShape, editor?: Editor): ModifierContext {
    return new ModifierContext(shape, editor)
  }
}