import { type TLShape, Editor } from 'tldraw'
import type { LinearArraySettings, GroupContext } from '../../../../types/modifiers'
import type { VirtualInstance } from '../TransformComposer'
import { BaseArrayProcessor } from './BaseArrayProcessor'
import { ArrayModifierUtils } from '../utils/ArrayModifierUtils'
import { UnifiedCompositionHandler } from '../utils/UnifiedCompositionHandler'

/**
 * Processor for Linear Array modifier
 * Creates copies in a straight line with offset/rotation/scaling
 */
export class LinearArrayProcessor extends BaseArrayProcessor {
  /**
   * Linear array using matrix composition
   * CRITICAL: Preserves exact rotation, scale, and positioning logic from original
   */
  static applyLinearArray(
    instances: VirtualInstance[],
    settings: LinearArraySettings,
    originalShape: TLShape,
    groupContext?: GroupContext,
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    const extendedSettings = { ...settings, generationLevel }
    return this.processArrayInstances(
      instances,
      extendedSettings,
      originalShape,
      'linear-array',
      generationLevel,
      this.processUnifiedLinearArray.bind(this),
      this.processIndividualLinearArray.bind(this),
      groupContext,
      editor
    )
  }

  /**
   * Process linear array using unified composition approach
   */
  private static processUnifiedLinearArray(
    collectiveCenter: { x: number; y: number },
    collectiveBounds: { width: number; height: number },
    sourceRotation: number,
    groupId: string,
    settings: LinearArraySettings & { generationLevel: number },
    instances: VirtualInstance[]
  ): VirtualInstance[] {
    const { count, offsetX, offsetY, rotationIncrement, rotateAll, scaleStep, generationLevel } = settings
    const newInstances: VirtualInstance[] = []

    // Calculate pixel offsets based on collective bounds
    const { pixelOffsetX, pixelOffsetY } = ArrayModifierUtils.calculatePixelOffsets(
      offsetX,
      offsetY,
      collectiveBounds
    )

    // Create copies of the entire group
    for (let i = 0; i < count; i++) {
      // Calculate offset from collective center
      const centerOffsetX = pixelOffsetX * i
      const centerOffsetY = pixelOffsetY * i

      // Apply rotation to the offset vector if shape is rotated
      const { rotatedOffsetX, rotatedOffsetY } = ArrayModifierUtils.applySourceRotationToOffset(
        centerOffsetX,
        centerOffsetY,
        sourceRotation
      )

      // For each copy, create instances for all input instances
      instances.forEach((instance, instanceIndex) => {
        if (instance.metadata.modifierType === 'original') return // Skip original when in unified mode

        const { x: instanceX, y: instanceY } = instance.transform.point()
        const { currentRotation, existingScale } = ArrayModifierUtils.extractInstanceTransforms(instance)

        // Calculate offset from collective center to instance position
        const relativeX = instanceX - collectiveCenter.x
        const relativeY = instanceY - collectiveCenter.y

        // Calculate GROUP-LEVEL rotation for this linear array position
        // This rotation applies to the entire group as a rigid body
        const uniformRotation = (rotateAll * Math.PI) / 180
        const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
        const groupRotationAdjustment = uniformRotation + incrementalRotation + sourceRotation

        // Calculate GROUP-LEVEL scale for this linear array position
        const groupScale = this.calculateGroupScale(scaleStep, i, count)

        // Apply GROUP scale to relative positions (true group scaling)
        // This scales the formation size as well as individual shapes
        const scaledRelativeX = relativeX * groupScale
        const scaledRelativeY = relativeY * groupScale

        // Apply orbital rotation to scaled relative positions
        // This rotates the entire scaled group formation around each linear position
        const { rotatedRelativeX, rotatedRelativeY } = ArrayModifierUtils.applyOrbitalRotation(
          scaledRelativeX,
          scaledRelativeY,
          groupRotationAdjustment
        )

        // New position = collective center + group offset + rotated scaled relative position
        const newX = collectiveCenter.x + rotatedOffsetX + rotatedRelativeX
        const newY = collectiveCenter.y + rotatedOffsetY + rotatedRelativeY

        // Apply GROUP orbital rotation to maintain shape orientation (same as relative position rotation)
        const totalRotation = currentRotation + groupRotationAdjustment

        // Apply GROUP scale to individual shapes (accumulated with existing scale)
        const accumulatedScaleX = existingScale.scaleX * groupScale
        const accumulatedScaleY = existingScale.scaleY * groupScale

        const composedTransform = ArrayModifierUtils.createComposedTransform(
          newX,
          newY,
          accumulatedScaleX,
          accumulatedScaleY
        )

        newInstances.push({
          sourceShapeId: instance.sourceShapeId,
          transform: composedTransform,
          metadata: ArrayModifierUtils.createInstanceMetadata(
            'linear-array',
            newInstances.length,
            instanceIndex,
            i,
            totalRotation,
            accumulatedScaleX,
            accumulatedScaleY,
            generationLevel,
            groupId,
            true,
            {
              linearArrayIndex: i
            }
          )
        })
      })
    }

    return newInstances
  }

  /**
   * Process linear array using individual instance approach
   */
  private static processIndividualLinearArray(
    instance: VirtualInstance,
    referenceCenter: { x: number; y: number },
    referenceBounds: { width: number; height: number },
    sourceRotation: number,
    settings: LinearArraySettings & { generationLevel: number },
    instanceIndex: number
  ): VirtualInstance[] {
    const { count, offsetX, offsetY, rotationIncrement, rotateAll, scaleStep, generationLevel } = settings
    const newInstances: VirtualInstance[] = []

    const { pixelOffsetX, pixelOffsetY } = ArrayModifierUtils.calculatePixelOffsets(
      offsetX,
      offsetY,
      referenceBounds
    )

    const { currentRotation, existingScale } = ArrayModifierUtils.extractInstanceTransforms(instance)

    for (let i = 0; i < count; i++) {
      // Calculate offset from center in local coordinate space
      const centerOffsetX = pixelOffsetX * i
      const centerOffsetY = pixelOffsetY * i

      // Apply rotation to the offset vector if shape is rotated
      const { rotatedOffsetX, rotatedOffsetY } = ArrayModifierUtils.applySourceRotationToOffset(
        centerOffsetX,
        centerOffsetY,
        sourceRotation
      )

      // Calculate new position based on reference center
      const newX = referenceCenter.x + rotatedOffsetX - referenceBounds.width / 2
      const newY = referenceCenter.y + rotatedOffsetY - referenceBounds.height / 2

      // Calculate total rotation for individual shapes
      const totalRotation = this.calculateGroupRotation(
        currentRotation,
        rotationIncrement,
        rotateAll,
        i
      )

      // Calculate scale
      const newScale = this.calculateGroupScale(scaleStep, i, count)

      // Accumulate scale with existing scale
      const accumulatedScaleX = existingScale.scaleX * newScale
      const accumulatedScaleY = existingScale.scaleY * newScale

      const composedTransform = ArrayModifierUtils.createComposedTransform(
        newX,
        newY,
        accumulatedScaleX,
        accumulatedScaleY
      )

      newInstances.push({
        sourceShapeId: instance.sourceShapeId,
        transform: composedTransform,
        metadata: ArrayModifierUtils.createInstanceMetadata(
          'linear-array',
          newInstances.length,
          instanceIndex,
          i,
          totalRotation,
          accumulatedScaleX,
          accumulatedScaleY,
          generationLevel,
          instance.metadata.groupId || 'original',
          false,
          {
            linearArrayIndex: i
          }
        )
      })
    }

    return newInstances
  }
}