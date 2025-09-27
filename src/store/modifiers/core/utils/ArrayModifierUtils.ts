import { Mat, type TLShape, Editor } from 'tldraw'
import type { VirtualInstance } from '../TransformComposer'

/**
 * Common utility functions for array modifiers
 * Extracted from ArrayModifierProcessor to reduce code duplication
 */
export class ArrayModifierUtils {
  /**
   * Helper to get shape bounds for percentage calculations
   */
  static getShapeBounds(shape: TLShape): { width: number; height: number } {
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
   * Calculate the axis-aligned bounds for a virtual instance, accounting for rotation & scale.
   */
  static getInstanceBounds(
    instance: VirtualInstance,
    halfWidth: number,
    halfHeight: number
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const decomposed = instance.transform.decomposed()
    const scaleX = (instance.metadata.targetScaleX as number) ?? decomposed.scaleX ?? 1
    const scaleY = (instance.metadata.targetScaleY as number) ?? decomposed.scaleY ?? 1
    const rotation = (instance.metadata.targetRotation as number) ?? decomposed.rotation ?? 0

    const scaledHalfWidth = Math.abs(halfWidth * scaleX)
    const scaledHalfHeight = Math.abs(halfHeight * scaleY)

    const cos = Math.abs(Math.cos(rotation))
    const sin = Math.abs(Math.sin(rotation))

    const extentX = scaledHalfWidth * cos + scaledHalfHeight * sin
    const extentY = scaledHalfWidth * sin + scaledHalfHeight * cos

    const center = Mat.applyToPoint(instance.transform, { x: halfWidth, y: halfHeight })

    return {
      minX: center.x - extentX,
      maxX: center.x + extentX,
      minY: center.y - extentY,
      maxY: center.y + extentY
    }
  }

  /**
   * Convert percentage-based offsets to pixel values
   */
  static calculatePixelOffsets(
    offsetX: number,
    offsetY: number,
    bounds: { width: number; height: number }
  ): { pixelOffsetX: number; pixelOffsetY: number } {
    return {
      pixelOffsetX: (offsetX / 100) * bounds.width,
      pixelOffsetY: (offsetY / 100) * bounds.height
    }
  }

  /**
   * Apply source rotation to offset vector
   */
  static applySourceRotationToOffset(
    offsetX: number,
    offsetY: number,
    sourceRotation: number
  ): { rotatedOffsetX: number; rotatedOffsetY: number } {
    if (sourceRotation === 0) {
      return { rotatedOffsetX: offsetX, rotatedOffsetY: offsetY }
    }

    const cos = Math.cos(sourceRotation)
    const sin = Math.sin(sourceRotation)

    return {
      rotatedOffsetX: offsetX * cos - offsetY * sin,
      rotatedOffsetY: offsetX * sin + offsetY * cos
    }
  }

  /**
   * Extract transforms from metadata first (where previous modifiers store them), fall back to matrix
   */
  static extractInstanceTransforms(instance: VirtualInstance): {
    currentRotation: number
    existingScale: { scaleX: number; scaleY: number }
  } {
    const existingTransform = instance.transform

    return {
      currentRotation: (instance.metadata.targetRotation as number) ?? existingTransform.rotation(),
      existingScale: {
        scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
        scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
      }
    }
  }

  /**
   * Get shape center considering rotation and editor bounds
   */
  static getShapeCenter(
    shape: TLShape,
    editor?: Editor
  ): { x: number; y: number } {
    const shapeBounds = this.getShapeBounds(shape)

    if (editor) {
      const visualBounds = editor.getShapePageBounds(shape.id)
      if (visualBounds) {
        return {
          x: visualBounds.x + visualBounds.width / 2,
          y: visualBounds.y + visualBounds.height / 2
        }
      }
    }

    // Fallback to calculated center
    return {
      x: shape.x + shapeBounds.width / 2,
      y: shape.y + shapeBounds.height / 2
    }
  }

  /**
   * Calculate progress value for scaling operations
   */
  static calculateProgress(index: number, total: number): number {
    return total > 1 ? index / (total - 1) : 0
  }

  /**
   * Apply scale step to calculate new scale value
   */
  static applyScaleStep(scaleStep: number, progress: number): number {
    return 1 + ((scaleStep / 100) - 1) * progress
  }

  /**
   * Create composed transform matrix
   */
  static createComposedTransform(
    x: number,
    y: number,
    scaleX: number,
    scaleY: number
  ): Mat {
    return Mat.Compose(
      Mat.Translate(x, y),
      Mat.Scale(scaleX, scaleY)
    )
  }

  /**
   * Generate unique group ID for modifier generation
   */
  static generateGroupId(modifierType: string, generationLevel: number): string {
    return `${modifierType}-gen${generationLevel}-${Date.now()}`
  }

  /**
   * Apply orbital rotation to relative positions
   */
  static applyOrbitalRotation(
    relativeX: number,
    relativeY: number,
    rotationAngle: number
  ): { rotatedRelativeX: number; rotatedRelativeY: number } {
    if (rotationAngle === 0) {
      return { rotatedRelativeX: relativeX, rotatedRelativeY: relativeY }
    }

    const cos = Math.cos(rotationAngle)
    const sin = Math.sin(rotationAngle)

    return {
      rotatedRelativeX: relativeX * cos - relativeY * sin,
      rotatedRelativeY: relativeX * sin + relativeY * cos
    }
  }

  /**
   * Create metadata for virtual instance
   */
  static createInstanceMetadata(
    modifierType: string,
    index: number,
    sourceIndex: number,
    arrayIndex: number,
    targetRotation: number,
    targetScaleX: number,
    targetScaleY: number,
    generationLevel: number,
    groupId: string,
    fromUnifiedGroup = false,
    additionalMetadata: Record<string, unknown> = {}
  ): {
    modifierType: string
    index: number
    sourceIndex?: number
    arrayIndex?: number
    groupId?: string
    generationLevel?: number
    fromUnifiedGroup?: boolean
    [key: string]: unknown
  } {
    return {
      modifierType,
      index,
      sourceIndex,
      arrayIndex,
      targetRotation,
      targetScaleX,
      targetScaleY,
      generationLevel,
      groupId,
      fromUnifiedGroup,
      ...additionalMetadata
    }
  }
}