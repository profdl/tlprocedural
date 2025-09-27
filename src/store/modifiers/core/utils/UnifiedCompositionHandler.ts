import { type TLShape, Editor } from 'tldraw'
import type { VirtualInstance } from '../TransformComposer'
import type { GroupContext } from '../../../../types/modifiers'
import { ArrayModifierUtils } from './ArrayModifierUtils'

/**
 * Handles unified composition logic for array modifiers
 * When multiple instances from previous modifiers should be treated as a unified group
 */
export class UnifiedCompositionHandler {
  /**
   * Detect if instances represent multiple groups that should be treated as one unified entity
   */
  static shouldUseUnifiedComposition(instances: VirtualInstance[]): boolean {
    // If we have multiple instances that are ALL from previous modifiers (no original),
    // they should be treated as a unified group
    const hasOriginal = instances.some(inst => inst.metadata.modifierType === 'original')
    const nonOriginalInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

    // Check for group members (from group processing)
    const hasGroupMembers = instances.some(inst => inst.metadata.modifierType === 'group-member')

    // Use unified composition if:
    // 1. We have group members (from unified group processing)
    if (hasGroupMembers && instances.length > 1) {
      console.log(`[UnifiedCompositionHandler] Using unified composition for group members: ${instances.length} instances`)
      return true
    }

    // 2. We have multiple instances AND no original (output from previous modifier)
    if (!hasOriginal && instances.length > 1) {
      // All instances are from previous modifiers - treat as unified
      return true
    }

    // 3. Mixed case - multiple instances from previous modifier plus original
    if (hasOriginal && nonOriginalInstances.length > 1) {
      // Mixed case - multiple instances from previous modifier plus original
      return true
    }

    return false
  }

  /**
   * Calculate collective bounds from a group of virtual instances for unified composition
   */
  static calculateCollectiveBounds(
    instances: VirtualInstance[],
    originalShape: TLShape,
    _editor?: Editor  // eslint-disable-line @typescript-eslint/no-unused-vars
  ): { center: { x: number; y: number }; bounds: { width: number; height: number } } {
    const shapeBounds = ArrayModifierUtils.getShapeBounds(originalShape)

    if (instances.length === 0) {
      return {
        center: { x: originalShape.x + shapeBounds.width / 2, y: originalShape.y + shapeBounds.height / 2 },
        bounds: shapeBounds
      }
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    const halfWidth = shapeBounds.width / 2
    const halfHeight = shapeBounds.height / 2

    instances.forEach(instance => {
      const bounds = ArrayModifierUtils.getInstanceBounds(instance, halfWidth, halfHeight)
      minX = Math.min(minX, bounds.minX)
      maxX = Math.max(maxX, bounds.maxX)
      minY = Math.min(minY, bounds.minY)
      maxY = Math.max(maxY, bounds.maxY)
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
   * Process instances using unified composition approach
   * All existing instances are treated as a single group entity
   */
  static processUnifiedInstances<T extends Record<string, unknown>>(
    instances: VirtualInstance[],
    originalShape: TLShape,
    settings: T,
    modifierType: string,
    generationLevel: number,
    processFunction: (
      collectiveCenter: { x: number; y: number },
      collectiveBounds: { width: number; height: number },
      sourceRotation: number,
      groupId: string,
      settings: T,
      instances: VirtualInstance[]
    ) => VirtualInstance[],
    editor?: Editor
  ): VirtualInstance[] {
    // Calculate collective bounds for unified composition
    const { center: collectiveCenter, bounds: collectiveBounds } =
      this.calculateCollectiveBounds(instances, originalShape, editor)

    // Get source rotation from the original shape
    const sourceRotation = originalShape.rotation || 0

    // Generate a unique group ID for this generation
    const groupId = ArrayModifierUtils.generateGroupId(modifierType, generationLevel)

    // Call the modifier-specific processing function
    return processFunction(
      collectiveCenter,
      collectiveBounds,
      sourceRotation,
      groupId,
      settings,
      instances
    )
  }

  /**
   * Process instances using individual approach (original behavior)
   * Each instance is processed separately
   */
  static processIndividualInstances<T extends Record<string, unknown>>(
    instances: VirtualInstance[],
    originalShape: TLShape,
    settings: T,
    generationLevel: number,
    processFunction: (
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
    const newInstances: VirtualInstance[] = []

    // Use group bounds if we're processing a group, otherwise use shape bounds
    let boundsForOffset
    let centerForRotation

    if (groupContext) {
      // Use group bounds for offset calculations and group center for rotation
      boundsForOffset = groupContext.groupBounds
      centerForRotation = groupContext.groupCenter
    } else {
      // Use individual shape bounds (existing behavior)
      const shapeBounds = ArrayModifierUtils.getShapeBounds(originalShape)
      boundsForOffset = shapeBounds
      centerForRotation = ArrayModifierUtils.getShapeCenter(originalShape, editor)
    }

    const sourceRotation = originalShape.rotation || 0

    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i]
      const instanceResults = processFunction(
        instance,
        centerForRotation,
        boundsForOffset,
        sourceRotation,
        settings,
        i
      )
      newInstances.push(...instanceResults)
    }

    return newInstances
  }

  /**
   * Filter instances for processing (remove originals in unified mode)
   */
  static filterInstancesForProcessing(
    instances: VirtualInstance[],
    useUnified: boolean
  ): VirtualInstance[] {
    return useUnified
      ? instances.filter(inst => inst.metadata.modifierType !== 'original')
      : instances
  }

}