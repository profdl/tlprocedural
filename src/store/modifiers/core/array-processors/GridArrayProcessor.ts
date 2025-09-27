import { type TLShape, Editor } from 'tldraw'
import type { GridArraySettings, GroupContext } from '../../../../types/modifiers'
import type { VirtualInstance } from '../TransformComposer'
import { BaseArrayProcessor } from './BaseArrayProcessor'
import { ArrayModifierUtils } from '../utils/ArrayModifierUtils'

/**
 * Processor for Grid Array modifier
 * Creates rectangular grids with row/column spacing
 */
export class GridArrayProcessor extends BaseArrayProcessor {
  /**
   * Grid array using matrix composition (following Linear Array pattern)
   * CRITICAL: Preserves exact rotation, scale, and positioning logic from original
   */
  static applyGridArray(
    instances: VirtualInstance[],
    settings: GridArraySettings,
    originalShape: TLShape,
    groupContext?: GroupContext,
    editor?: Editor,
    generationLevel: number = 0
  ): VirtualInstance[] {
    return this.processArrayInstances(
      instances,
      { ...settings, generationLevel },
      originalShape,
      'grid-array',
      generationLevel,
      this.processUnifiedGridArray.bind(this),
      this.processIndividualGridArray.bind(this),
      groupContext,
      editor
    )
  }

  /**
   * Process grid array using unified composition approach
   */
  private static processUnifiedGridArray(
    collectiveCenter: { x: number; y: number },
    collectiveBounds: { width: number; height: number },
    sourceRotation: number,
    groupId: string,
    settings: GridArraySettings & { generationLevel: number },
    instances: VirtualInstance[]
  ): VirtualInstance[] {
    const { rows, columns, spacingX, spacingY, rotateEach, rotateAll, rotateEachRow, rotateEachColumn, scaleStep, rowScaleStep, columnScaleStep, generationLevel } = settings
    const newInstances: VirtualInstance[] = []

    // Get shape dimensions for percentage-based spacing
    const referenceWidth = collectiveBounds.width
    const referenceHeight = collectiveBounds.height
    const pixelSpacingX = (spacingX / 100) * referenceWidth
    const pixelSpacingY = (spacingY / 100) * referenceHeight

    // Calculate grid starting position so first clone (0,0) aligns with source shape
    const gridStartX = collectiveCenter.x
    const gridStartY = collectiveCenter.y

    // Filter out original for unified composition
    const groupInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

    // Outer loops: Grid positions (each position gets a copy of the entire group)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const linearIndex = row * columns + col

        // Calculate grid position for this group
        const gridOffsetX = col * pixelSpacingX
        const gridOffsetY = row * pixelSpacingY

        // Apply source rotation to grid offset if needed
        const { rotatedOffsetX, rotatedOffsetY } = ArrayModifierUtils.applySourceRotationToOffset(
          gridOffsetX,
          gridOffsetY,
          sourceRotation
        )

        // Calculate GROUP-LEVEL rotation for this grid position
        // This rotation applies to the entire group as a rigid body
        const uniformRotation = (rotateAll * Math.PI) / 180
        const incrementalRotation = (rotateEach * linearIndex * Math.PI) / 180
        const rowRotation = (rotateEachRow * row * Math.PI) / 180
        const columnRotation = (rotateEachColumn * col * Math.PI) / 180

        const groupRotationAdjustment = uniformRotation + incrementalRotation +
                                       rowRotation + columnRotation + sourceRotation

        // Calculate GROUP-LEVEL scale for this grid position
        const totalItems = rows * columns
        const linearProgress = totalItems > 1 ? linearIndex / (totalItems - 1) : 0
        const rowProgress = rows > 1 ? row / (rows - 1) : 0
        const columnProgress = columns > 1 ? col / (columns - 1) : 0

        const linearScale = ArrayModifierUtils.applyScaleStep(scaleStep, linearProgress)
        const rowScale = ArrayModifierUtils.applyScaleStep(rowScaleStep, rowProgress)
        const columnScale = ArrayModifierUtils.applyScaleStep(columnScaleStep, columnProgress)
        const groupScale = linearScale * rowScale * columnScale

        // Inner loop: Create each instance in the group at this grid position
        groupInstances.forEach((instance, instanceIndex) => {
          const { currentRotation, existingScale } = ArrayModifierUtils.extractInstanceTransforms(instance)

          // Calculate the center of THIS grid position (where the group will be placed)
          const gridPositionCenterX = gridStartX + rotatedOffsetX
          const gridPositionCenterY = gridStartY + rotatedOffsetY

          // Calculate instance position relative to original group center
          const { x: instanceX, y: instanceY } = instance.transform.point()
          const relativeX = instanceX - collectiveCenter.x
          const relativeY = instanceY - collectiveCenter.y

          // Apply GROUP scale to relative positions (true group scaling)
          // This scales the formation size as well as individual shapes
          const scaledRelativeX = relativeX * groupScale
          const scaledRelativeY = relativeY * groupScale

          // Apply orbital rotation around the grid position center
          // This creates orbital motion of the scaled group formation around each grid position
          const { rotatedRelativeX, rotatedRelativeY } = ArrayModifierUtils.applyOrbitalRotation(
            scaledRelativeX,
            scaledRelativeY,
            groupRotationAdjustment
          )

          // Position at grid location center + rotated relative position
          const newX = gridPositionCenterX + rotatedRelativeX
          const newY = gridPositionCenterY + rotatedRelativeY

          // Apply GROUP orbital rotation to maintain shape orientation (same as relative position rotation)
          const totalRotation = currentRotation + groupRotationAdjustment

          // Apply GROUP scale (accumulated with existing)
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
              'grid-array',
              newInstances.length,
              instanceIndex,
              linearIndex,
              totalRotation,
              accumulatedScaleX,
              accumulatedScaleY,
              generationLevel,
              groupId,
              true,
              {
                gridArrayIndex: linearIndex,
                gridPosition: { row, col }
              }
            )
          })
        })
      }
    }

    return newInstances
  }

  /**
   * Process grid array using individual instance approach
   */
  private static processIndividualGridArray(
    instance: VirtualInstance,
    referenceCenter: { x: number; y: number },
    referenceBounds: { width: number; height: number },
    sourceRotation: number,
    settings: GridArraySettings & { generationLevel: number },
    instanceIndex: number
  ): VirtualInstance[] {
    const { rows, columns, spacingX, spacingY, rotateEach, rotateAll, rotateEachRow, rotateEachColumn, scaleStep, rowScaleStep, columnScaleStep, generationLevel } = settings
    const newInstances: VirtualInstance[] = []

    // Get shape dimensions for percentage-based spacing
    const referenceWidth = referenceBounds.width
    const referenceHeight = referenceBounds.height
    const pixelSpacingX = (spacingX / 100) * referenceWidth
    const pixelSpacingY = (spacingY / 100) * referenceHeight

    // Calculate grid starting position so first clone (0,0) aligns with source shape
    const gridStartX = referenceCenter.x
    const gridStartY = referenceCenter.y

    const { currentRotation, existingScale } = ArrayModifierUtils.extractInstanceTransforms(instance)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        // Calculate grid position
        const gridOffsetX = col * pixelSpacingX
        const gridOffsetY = row * pixelSpacingY

        // Apply rotation to grid offset if source is rotated
        const { rotatedOffsetX, rotatedOffsetY } = ArrayModifierUtils.applySourceRotationToOffset(
          gridOffsetX,
          gridOffsetY,
          sourceRotation
        )

        // Position at grid location
        const newX = gridStartX + rotatedOffsetX - referenceBounds.width / 2
        const newY = gridStartY + rotatedOffsetY - referenceBounds.height / 2

        // Calculate new rotation
        const linearIndex = row * columns + col
        const incrementalRotation = (rotateEach * linearIndex * Math.PI) / 180
        const rowRotation = (rotateEachRow * row * Math.PI) / 180
        const columnRotation = (rotateEachColumn * col * Math.PI) / 180
        const uniformRotation = (rotateAll * Math.PI) / 180
        const totalRotation = currentRotation + incrementalRotation + rowRotation + columnRotation + uniformRotation

        // Calculate scale
        const totalItems = rows * columns
        const linearProgress = totalItems > 1 ? linearIndex / (totalItems - 1) : 0
        const rowProgress = rows > 1 ? row / (rows - 1) : 0
        const columnProgress = columns > 1 ? col / (columns - 1) : 0

        const linearScale = ArrayModifierUtils.applyScaleStep(scaleStep, linearProgress)
        const rowScale = ArrayModifierUtils.applyScaleStep(rowScaleStep, rowProgress)
        const columnScale = ArrayModifierUtils.applyScaleStep(columnScaleStep, columnProgress)
        const newScale = linearScale * rowScale * columnScale

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
            'grid-array',
            newInstances.length,
            instanceIndex,
            linearIndex,
            totalRotation,
            accumulatedScaleX,
            accumulatedScaleY,
            generationLevel,
            instance.metadata.groupId || 'original',
            false,
            {
              gridArrayIndex: linearIndex,
              gridPosition: { row, col }
            }
          )
        })
      }
    }

    return newInstances
  }
}