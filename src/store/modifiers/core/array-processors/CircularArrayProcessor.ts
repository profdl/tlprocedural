import { type TLShape, Editor } from 'tldraw'
import type { CircularArraySettings, GroupContext } from '../../../../types/modifiers'
import type { VirtualInstance } from '../TransformComposer'
import { BaseArrayProcessor } from './BaseArrayProcessor'
import { ArrayModifierUtils } from '../utils/ArrayModifierUtils'

/**
 * Processor for Circular Array modifier
 * Arranges copies in circular patterns with radius/angle controls
 */
export class CircularArrayProcessor extends BaseArrayProcessor {
  /**
   * Circular array using matrix composition (following Linear Array pattern)
   * CRITICAL: Preserves exact rotation, scale, and positioning logic from original
   */
  static applyCircularArray(
    instances: VirtualInstance[],
    settings: CircularArraySettings,
    originalShape: TLShape,
    groupContext?: GroupContext,
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    const processingId = `CA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log(`[CircularArray] ${processingId} Processing ${instances.length} instances`, {
      instances: instances.map(i => ({
        type: i.metadata.modifierType,
        sourceId: i.sourceShapeId,
        groupId: i.metadata.groupId,
        index: i.metadata.index
      })),
      processingId
    })

    const result = this.processArrayInstances(
      instances,
      { ...settings, processingId, generationLevel },
      originalShape,
      'circular-array',
      generationLevel,
      this.processUnifiedCircularArray.bind(this),
      this.processIndividualCircularArray.bind(this),
      groupContext,
      editor
    )

    console.log(`[CircularArray] ${processingId} Completed: Created ${result.length} instances`)
    return result
  }

  /**
   * Process circular array using unified composition approach
   */
  private static processUnifiedCircularArray(
    collectiveCenter: { x: number; y: number },
    collectiveBounds: { width: number; height: number },
    sourceRotation: number,
    groupId: string,
    settings: CircularArraySettings & { processingId: string; generationLevel: number },
    instances: VirtualInstance[]
  ): VirtualInstance[] {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToCenter, processingId, generationLevel } = settings
    // rotateEach is intentionally not used in unified mode to preserve rigid body behavior
    const newInstances: VirtualInstance[] = []

    // Find the instance that represents the original shape position (linearArrayIndex: 0)
    // This gives us the equivalent of originalShape.x/y for circle center calculation
    const originalPositionInstance = instances.find(inst =>
      inst.metadata.linearArrayIndex === 0
    )

    let referenceCenter = collectiveCenter
    if (originalPositionInstance) {
      // Use the position of the "first" linear array instance as reference
      const { x: refX, y: refY } = originalPositionInstance.transform.point()
      referenceCenter = { x: refX, y: refY }
    }

    // Calculate circle center relative to original position (not collective center)
    // This ensures "Align to Center" points towards the intended circle center
    const circleCenter = {
      x: referenceCenter.x + (centerX || 0),
      y: referenceCenter.y + (centerY || 0)
    }

    // Create circular copies of the entire group
    for (let i = 0; i < count; i++) {
      // Calculate angle for this position
      const totalAngle = endAngle - startAngle
      const isFullCircle = Math.abs(totalAngle) >= 360
      const angleStep = count > 1 ? (isFullCircle ? totalAngle / count : totalAngle / (count - 1)) : 0
      const angle = (startAngle + angleStep * i) * Math.PI / 180

      // Calculate circular position relative to circle center
      const circularOffsetX = Math.cos(angle) * radius
      const circularOffsetY = Math.sin(angle) * radius

      // Apply source rotation to the circular offset if shape is rotated
      const { rotatedOffsetX, rotatedOffsetY } = ArrayModifierUtils.applySourceRotationToOffset(
        circularOffsetX,
        circularOffsetY,
        sourceRotation
      )

      // Calculate GROUP-LEVEL rotation for this circular position
      // In unified mode: only apply group-level rotations (rotateAll + alignToCenter)
      // Individual rotations (rotateEach) should NOT be applied to preserve rigid body behavior
      const uniformRotation = (rotateAll * Math.PI) / 180
      let groupOrbitAngle = 0
      if (alignToCenter) {
        // Orient the group to point towards the center of the circle
        // angle + Math.PI points outward from center, + Math.PI/2 (90°) rotates to point inward
        groupOrbitAngle = angle + Math.PI + Math.PI / 2
      }

      const groupRotationAdjustment = uniformRotation + groupOrbitAngle + sourceRotation

      // Filter out original instances for unified composition
      const groupInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

      // For each instance in the group, create it at this circular position
      groupInstances.forEach((instance, instanceIndex) => {
        const { x: instanceX, y: instanceY } = instance.transform.point()
        const { currentRotation, existingScale } = ArrayModifierUtils.extractInstanceTransforms(instance)

        // Calculate offset from collective center to instance position
        const relativeX = instanceX - collectiveCenter.x
        const relativeY = instanceY - collectiveCenter.y

        // Apply orbital rotation around the circular position center
        // This creates orbital motion of the group formation around each circular position
        const { rotatedRelativeX, rotatedRelativeY } = ArrayModifierUtils.applyOrbitalRotation(
          relativeX,
          relativeY,
          groupRotationAdjustment
        )

        // New position = circle center + circular offset + (rotated) relative position
        const newX = circleCenter.x + rotatedOffsetX + rotatedRelativeX
        const newY = circleCenter.y + rotatedOffsetY + rotatedRelativeY

        // Apply GROUP orbital rotation to maintain shape orientation (same as relative position rotation)
        const totalRotation = currentRotation + groupRotationAdjustment

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
            'circular-array',
            newInstances.length,
            instanceIndex,
            i,
            totalRotation,
            existingScale.scaleX,
            existingScale.scaleY,
            generationLevel,
            groupId,
            true,
            {
              circularArrayIndex: i,
              processingId
            }
          )
        })
      })
    }

    return newInstances
  }

  /**
   * Process circular array using individual instance approach
   */
  private static processIndividualCircularArray(
    instance: VirtualInstance,
    referenceCenter: { x: number; y: number },
    referenceBounds: { width: number; height: number },
    sourceRotation: number,
    settings: CircularArraySettings & { processingId?: string; generationLevel: number },
    instanceIndex: number
  ): VirtualInstance[] {
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToCenter, generationLevel } = settings
    const newInstances: VirtualInstance[] = []

    const { currentRotation, existingScale } = ArrayModifierUtils.extractInstanceTransforms(instance)

    // Calculate circle center (offset from shape center)
    const circleCenter = {
      x: referenceCenter.x + (centerX || 0),
      y: referenceCenter.y + (centerY || 0)
    }

    for (let i = 0; i < count; i++) {
      // Calculate angle for this position
      const totalAngle = endAngle - startAngle
      const isFullCircle = Math.abs(totalAngle) >= 360
      const angleStep = count > 1 ? (isFullCircle ? totalAngle / count : totalAngle / (count - 1)) : 0
      const angle = (startAngle + angleStep * i) * Math.PI / 180

      // Calculate circular position relative to circle center
      const circularOffsetX = Math.cos(angle) * radius
      const circularOffsetY = Math.sin(angle) * radius

      // Apply source rotation to the circular offset if shape is rotated
      const { rotatedOffsetX, rotatedOffsetY } = ArrayModifierUtils.applySourceRotationToOffset(
        circularOffsetX,
        circularOffsetY,
        sourceRotation
      )

      const newX = circleCenter.x + rotatedOffsetX - referenceBounds.width / 2
      const newY = circleCenter.y + rotatedOffsetY - referenceBounds.height / 2

      let totalRotation = currentRotation

      if (alignToCenter) {
        // Orient to point towards the center of the circle
        // angle + Math.PI points outward from center, + Math.PI/2 (90°) rotates to point inward
        totalRotation += angle + Math.PI + Math.PI / 2
      }
      if (rotateAll) {
        totalRotation += (rotateAll * Math.PI / 180)
      }
      if (rotateEach) {
        totalRotation += (rotateEach * i * Math.PI / 180)
      }

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
          'circular-array',
          newInstances.length,
          instanceIndex,
          i,
          totalRotation,
          existingScale.scaleX,
          existingScale.scaleY,
          generationLevel,
          instance.metadata.groupId || 'original',
          false,
          {
            circularArrayIndex: i
          }
        )
      })
    }

    return newInstances
  }
}