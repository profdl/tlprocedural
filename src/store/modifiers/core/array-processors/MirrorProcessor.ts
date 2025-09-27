import { type TLShape, Editor } from 'tldraw'
import type { MirrorSettings, GroupContext } from '../../../../types/modifiers'
import type { VirtualInstance } from '../TransformComposer'
import { BaseArrayProcessor } from './BaseArrayProcessor'
import { ArrayModifierUtils } from '../utils/ArrayModifierUtils'
import { UnifiedCompositionHandler } from '../utils/UnifiedCompositionHandler'

/**
 * Processor for Mirror modifier
 * Creates mirrored copies along axes
 */
export class MirrorProcessor extends BaseArrayProcessor {
  /**
   * Mirror modifier using matrix composition
   * CRITICAL: Preserves exact rotation, scale, and positioning logic from original
   */
  static applyMirror(
    instances: VirtualInstance[],
    settings: MirrorSettings,
    originalShape: TLShape,
    groupContext?: GroupContext,
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    const { axis, offset } = settings

    if (axis !== 'x' && axis !== 'y') {
      return instances
    }

    const newInstances: VirtualInstance[] = []

    // Check if we should use unified composition
    const useUnified = UnifiedCompositionHandler.shouldUseUnifiedComposition(instances)

    // Get reference center and bounds
    let referenceCenter: { x: number; y: number }
    if (useUnified) {
      const { center } = UnifiedCompositionHandler.calculateCollectiveBounds(instances, originalShape, editor)
      referenceCenter = center
    } else {
      // Original behavior
      referenceCenter = ArrayModifierUtils.getShapeCenter(originalShape, editor)
    }

    // Generate group ID
    const groupId = ArrayModifierUtils.generateGroupId('mirror', generationLevel)

    // Always preserve existing instances first (both unified and non-unified modes)
    // Mirror modifier should keep the original group AND create mirrored copies
    instances.forEach(instance => {
      // Skip original instances in unified mode (they were already processed by previous modifiers)
      if (useUnified && instance.metadata.modifierType === 'original') {
        return
      }

      newInstances.push({
        sourceShapeId: instance.sourceShapeId,
        transform: instance.transform,
        metadata: {
          ...instance.metadata,
          index: newInstances.length
        }
      })
    })

    // Determine which instances to mirror
    const processInstances = useUnified
      ? instances.filter(inst => inst.metadata.modifierType !== 'original')
      : instances

    // Then create mirrored copies of processed instances
    processInstances.forEach(instance => {
      const { currentRotation, existingScale } = ArrayModifierUtils.extractInstanceTransforms(instance)

      // Calculate mirror position
      let newX: number, newY: number

      if (useUnified) {
        // For unified composition, mirror relative to collective center
        const { x: instanceX, y: instanceY } = instance.transform.point()
        if (axis === 'x') {
          newX = referenceCenter.x + offset + (referenceCenter.x - instanceX)
          newY = instanceY
        } else {
          newX = instanceX
          newY = referenceCenter.y + offset + (referenceCenter.y - instanceY)
        }
      } else {
        // Original behavior
        const shapeBounds = ArrayModifierUtils.getShapeBounds(originalShape)
        if (axis === 'x') {
          newX = referenceCenter.x + offset - shapeBounds.width / 2
          newY = referenceCenter.y - shapeBounds.height / 2
        } else {
          newX = referenceCenter.x - shapeBounds.width / 2
          newY = referenceCenter.y + offset - shapeBounds.height / 2
        }
      }

      // Calculate rotation for the mirrored clone
      // For proper mirror effect, always apply rotation mirroring based on mirror axis
      // Horizontal (X-axis) mirror: invert rotation to create opposite rotation direction
      // Vertical (Y-axis) mirror: invert rotation for correct vertical mirror effect
      const targetRotation = axis === 'x' ? -currentRotation : -currentRotation

      // Create transform that preserves accumulated scale from previous modifiers
      const composedTransform = ArrayModifierUtils.createComposedTransform(
        newX,
        newY,
        existingScale.scaleX,
        existingScale.scaleY
      )

      newInstances.push({
        sourceShapeId: instance.sourceShapeId,
        transform: composedTransform,
        metadata: ArrayModifierUtils.createInstanceMetadata(
          'mirror',
          newInstances.length,
          processInstances.indexOf(instance),
          0, // arrayIndex
          targetRotation,
          existingScale.scaleX,
          existingScale.scaleY,
          generationLevel,
          groupId,
          useUnified,
          {
            isMirrored: true,
            mirrorAxis: axis,
            mirrorOffset: offset,
            isFlippedX: axis === 'x',
            isFlippedY: axis === 'y'
          }
        )
      })
    })

    return newInstances
  }
}