import { type TLShape, Editor } from 'tldraw'
import type { VirtualInstance } from '../TransformComposer'
import type { GroupContext } from '../../../../types/modifiers'
import { ArrayModifierUtils } from '../utils/ArrayModifierUtils'
import { UnifiedCompositionHandler } from '../utils/UnifiedCompositionHandler'

/**
 * Base class for array modifier processors
 * Contains shared functionality and common patterns used across all array modifiers
 */
export abstract class BaseArrayProcessor {
  /**
   * Shared method to process array modifier instances
   * Handles the unified vs individual composition logic
   */
  protected static processArrayInstances<T extends Record<string, unknown>>(
    instances: VirtualInstance[],
    settings: T,
    originalShape: TLShape,
    modifierType: string,
    generationLevel: number,
    unifiedProcessor: (
      collectiveCenter: { x: number; y: number },
      collectiveBounds: { width: number; height: number },
      sourceRotation: number,
      groupId: string,
      settings: T,
      instances: VirtualInstance[]
    ) => VirtualInstance[],
    individualProcessor: (
      instance: VirtualInstance,
      referenceCenter: { x: number; y: number },
      referenceBounds: { width: number; height: number },
      sourceRotation: number,
      settings: T,
      index: number
    ) => VirtualInstance[],
    groupContext?: GroupContext,
    editor?: Editor
  ): VirtualInstance[] {
    // Check if we should use unified composition
    const useUnified = UnifiedCompositionHandler.shouldUseUnifiedComposition(instances)

    if (useUnified) {
      // Unified composition: treat all existing instances as a single entity
      return UnifiedCompositionHandler.processUnifiedInstances(
        instances,
        originalShape,
        settings,
        modifierType,
        generationLevel,
        unifiedProcessor,
        editor
      )
    } else {
      // Individual processing: multiply each instance
      return UnifiedCompositionHandler.processIndividualInstances(
        instances,
        originalShape,
        settings,
        generationLevel,
        individualProcessor,
        groupContext,
        editor
      )
    }
  }

  /**
   * Calculate group scale for accumulation
   */
  protected static calculateGroupScale(
    scaleStep: number,
    index: number,
    count: number
  ): number {
    const progress = ArrayModifierUtils.calculateProgress(index, count)
    return ArrayModifierUtils.applyScaleStep(scaleStep, progress)
  }

  /**
   * Calculate group rotation for accumulation
   */
  protected static calculateGroupRotation(
    baseRotation: number,
    rotationIncrement: number,
    rotateAll: number,
    index: number,
    sourceRotation: number = 0
  ): number {
    const incrementalRotation = (rotationIncrement * index * Math.PI) / 180
    const uniformRotation = (rotateAll * Math.PI) / 180
    return baseRotation + incrementalRotation + uniformRotation + sourceRotation
  }

  /**
   * Log debug information for group processing (first few clones only)
   */
  protected static logGroupDebug(
    index: number,
    originalShape: TLShape,
    groupContext: GroupContext,
    newPos: { x: number; y: number },
    additionalData: Record<string, unknown> = {}
  ): void {
    if (index < 3) {
      console.log(`[${this.name}] Group clone ${index}: shape ${originalShape.id}`, {
        originalPos: { x: originalShape.x, y: originalShape.y },
        groupCenter: groupContext.groupCenter,
        newPos,
        ...additionalData
      })
    }
  }

  /**
   * Create base metadata for all array processors
   */
  protected static createBaseArrayMetadata(
    modifierType: string,
    index: number,
    sourceIndex: number,
    arrayIndex: number,
    targetRotation: number,
    targetScaleX: number,
    targetScaleY: number,
    generationLevel: number,
    groupId: string,
    fromUnifiedGroup: boolean
  ): Record<string, unknown> {
    return ArrayModifierUtils.createInstanceMetadata(
      modifierType,
      index,
      sourceIndex,
      arrayIndex,
      targetRotation,
      targetScaleX,
      targetScaleY,
      generationLevel,
      groupId,
      fromUnifiedGroup
    )
  }

  /**
   * Handle group context positioning calculations
   */
  protected static calculateGroupPosition(
    originalShape: TLShape,
    groupContext: GroupContext,
    groupScale: number,
    rotatedOffset: { x: number; y: number },
    formationRotation: number
  ): { x: number; y: number } {
    // Calculate shape's relative position to group center
    const shapeRelativeToGroupX = originalShape.x - groupContext.groupCenter.x
    const shapeRelativeToGroupY = originalShape.y - groupContext.groupCenter.y

    // Scale the relative positions (formation scaling)
    const scaledRelativeX = shapeRelativeToGroupX * groupScale
    const scaledRelativeY = shapeRelativeToGroupY * groupScale

    // Apply rotation to the scaled relative positions (group formation rotation)
    let finalRelativeX = scaledRelativeX
    let finalRelativeY = scaledRelativeY

    if (formationRotation !== 0) {
      const cos = Math.cos(formationRotation)
      const sin = Math.sin(formationRotation)
      finalRelativeX = scaledRelativeX * cos - scaledRelativeY * sin
      finalRelativeY = scaledRelativeX * sin + scaledRelativeY * cos
    }

    // New group center position after offset
    const newGroupCenterX = groupContext.groupCenter.x + rotatedOffset.x
    const newGroupCenterY = groupContext.groupCenter.y + rotatedOffset.y

    // Shape's new position with scaled and rotated relative offset
    return {
      x: newGroupCenterX + finalRelativeX,
      y: newGroupCenterY + finalRelativeY
    }
  }

  /**
   * Calculate position for individual shapes (non-group)
   */
  protected static calculateIndividualPosition(
    centerForRotation: { x: number; y: number },
    rotatedOffset: { x: number; y: number },
    shapeBounds: { width: number; height: number }
  ): { x: number; y: number } {
    return {
      x: centerForRotation.x + rotatedOffset.x - shapeBounds.width / 2,
      y: centerForRotation.y + rotatedOffset.y - shapeBounds.height / 2
    }
  }
}