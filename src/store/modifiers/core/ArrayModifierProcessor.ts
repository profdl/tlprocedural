import { Mat, type TLShape, Editor } from 'tldraw'
import type {
  LinearArraySettings,
  CircularArraySettings,
  GridArraySettings,
  MirrorSettings,
  GroupContext
} from '../../../types/modifiers'
import type { VirtualInstance } from './TransformComposer'

/**
 * Dedicated processor for array-based modifiers (Linear, Circular, Grid, Mirror)
 * Extracted from TransformComposer to improve maintainability while preserving
 * all critical rotation, scale, and positioning logic
 */
export class ArrayModifierProcessor {
  /**
   * Helper to get shape bounds for percentage calculations
   */
  private static getShapeBounds(shape: TLShape): { width: number; height: number } {
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
   * Calculate collective bounds from a group of virtual instances for unified composition
   */
  private static calculateCollectiveBounds(
    instances: VirtualInstance[],
    originalShape: TLShape,
    _editor?: Editor  // eslint-disable-line @typescript-eslint/no-unused-vars
  ): { center: { x: number; y: number }; bounds: { width: number; height: number } } {
    const shapeBounds = this.getShapeBounds(originalShape)

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
      const bounds = this.getInstanceBounds(instance, halfWidth, halfHeight)
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
   * Calculate the axis-aligned bounds for a virtual instance, accounting for rotation & scale.
   */
  private static getInstanceBounds(
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
   * Detect if instances represent multiple groups that should be treated as one unified entity
   */
  private static shouldUseUnifiedComposition(instances: VirtualInstance[]): boolean {
    // If we have multiple instances that are ALL from previous modifiers (no original),
    // they should be treated as a unified group
    const hasOriginal = instances.some(inst => inst.metadata.modifierType === 'original')
    const nonOriginalInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

    // NEW: Check for group members (from group processing)
    const hasGroupMembers = instances.some(inst => inst.metadata.modifierType === 'group-member')

    // Use unified composition if:
    // 1. We have group members (from unified group processing)
    if (hasGroupMembers && instances.length > 1) {
      console.log(`[ArrayModifierProcessor] Using unified composition for group members: ${instances.length} instances`)
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
    const { count, offsetX, offsetY, rotationIncrement, rotateAll, scaleStep } = settings

    const newInstances: VirtualInstance[] = []

    // Check if we should use unified composition (treating all instances as one group)
    const useUnified = this.shouldUseUnifiedComposition(instances)

    if (useUnified) {
      // Unified composition: treat all existing instances as a single entity
      const { center: collectiveCenter, bounds: collectiveBounds } = this.calculateCollectiveBounds(instances, originalShape, editor)

      // Calculate pixel offsets based on collective bounds
      const pixelOffsetX = (offsetX / 100) * collectiveBounds.width
      const pixelOffsetY = (offsetY / 100) * collectiveBounds.height

      // Get source rotation from the original shape
      const sourceRotation = originalShape.rotation || 0

      // Generate a unique group ID for this generation
      const groupId = `linear-array-gen${generationLevel}-${Date.now()}`

      // Create copies of the entire group
      for (let i = 0; i < count; i++) {
        // Calculate offset from collective center
        const centerOffsetX = pixelOffsetX * i
        const centerOffsetY = pixelOffsetY * i

        // Apply rotation to the offset vector if shape is rotated
        let rotatedOffsetX = centerOffsetX
        let rotatedOffsetY = centerOffsetY

        if (sourceRotation !== 0) {
          const cos = Math.cos(sourceRotation)
          const sin = Math.sin(sourceRotation)
          rotatedOffsetX = centerOffsetX * cos - centerOffsetY * sin
          rotatedOffsetY = centerOffsetX * sin + centerOffsetY * cos
        }

        // For each copy, create instances for all input instances
        instances.forEach((instance, instanceIndex) => {
          if (instance.metadata.modifierType === 'original') return // Skip original when in unified mode

          const { x: instanceX, y: instanceY } = instance.transform.point()
          const existingTransform = instance.transform

          // Extract transforms from metadata first (where previous modifiers store them), fall back to matrix
          const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
          const existingScale = {
            scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
            scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
          }

          // Calculate offset from collective center to instance position
          const relativeX = instanceX - collectiveCenter.x
          const relativeY = instanceY - collectiveCenter.y

          // Calculate GROUP-LEVEL rotation for this linear array position
          // This rotation applies to the entire group as a rigid body
          const uniformRotation = (rotateAll * Math.PI) / 180
          const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
          const groupRotationAdjustment = uniformRotation + incrementalRotation + sourceRotation

          // Calculate GROUP-LEVEL scale for this linear array position
          const progress = count > 1 ? i / (count - 1) : 0
          const groupScale = 1 + ((scaleStep / 100) - 1) * progress

          // Apply GROUP scale to relative positions (true group scaling)
          // This scales the formation size as well as individual shapes
          const scaledRelativeX = relativeX * groupScale
          const scaledRelativeY = relativeY * groupScale

          // Apply orbital rotation to scaled relative positions
          // This rotates the entire scaled group formation around each linear position
          let rotatedRelativeX = scaledRelativeX
          let rotatedRelativeY = scaledRelativeY

          if (groupRotationAdjustment !== 0) {
            const cos = Math.cos(groupRotationAdjustment)
            const sin = Math.sin(groupRotationAdjustment)
            rotatedRelativeX = scaledRelativeX * cos - scaledRelativeY * sin
            rotatedRelativeY = scaledRelativeX * sin + scaledRelativeY * cos
          }

          // New position = collective center + group offset + rotated scaled relative position
          const newX = collectiveCenter.x + rotatedOffsetX + rotatedRelativeX
          const newY = collectiveCenter.y + rotatedOffsetY + rotatedRelativeY

          // Apply GROUP orbital rotation to maintain shape orientation (same as relative position rotation)
          const totalRotation = currentRotation + groupRotationAdjustment

          // Apply GROUP scale to individual shapes (accumulated with existing scale)
          const accumulatedScaleX = existingScale.scaleX * groupScale
          const accumulatedScaleY = existingScale.scaleY * groupScale

          const composedTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(accumulatedScaleX, accumulatedScaleY)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: composedTransform,
            metadata: {
              modifierType: 'linear-array',
              index: newInstances.length,
              sourceIndex: instanceIndex,
              arrayIndex: i,
              linearArrayIndex: i,
              targetRotation: totalRotation,
              generationLevel,
              groupId,
              fromUnifiedGroup: true,
              // Preserve existing metadata and accumulate scale
              targetScaleX: accumulatedScaleX,
              targetScaleY: accumulatedScaleY
            }
          })
        })
      }
    } else {
      // Original behavior: multiply each instance (but only create clones, not preserve original)

      // Use group bounds if we're processing a group, otherwise use shape bounds
      let boundsForOffset
      let centerForRotation

      if (groupContext) {
        // Use group bounds for offset calculations and group center for rotation
        boundsForOffset = groupContext.groupBounds
        centerForRotation = groupContext.groupCenter
      } else {
        // Use individual shape bounds (existing behavior)
        const shapeBounds = this.getShapeBounds(originalShape)
        boundsForOffset = shapeBounds

        // Get original shape center for orbital rotation calculations
        if (editor) {
          const visualBounds = editor.getShapePageBounds(originalShape.id)
          if (visualBounds) {
            centerForRotation = {
              x: visualBounds.x + visualBounds.width / 2,
              y: visualBounds.y + visualBounds.height / 2
            }
          } else {
            centerForRotation = {
              x: originalShape.x + shapeBounds.width / 2,
              y: originalShape.y + shapeBounds.height / 2
            }
          }
        } else {
          centerForRotation = {
            x: originalShape.x + shapeBounds.width / 2,
            y: originalShape.y + shapeBounds.height / 2
          }
        }
      }

      const pixelOffsetX = (offsetX / 100) * boundsForOffset.width
      const pixelOffsetY = (offsetY / 100) * boundsForOffset.height

      const sourceRotation = originalShape.rotation || 0

      for (const instance of instances) {
        // Extract existing transform components for accumulation
        const existingTransform = instance.transform

        // Extract transforms from metadata first (where previous modifiers store them), fall back to matrix
        const baseRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
        const existingScale = {
          scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
          scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
        }

        for (let i = 0; i < count; i++) {
          // Calculate offset from center in local coordinate space
          const centerOffsetX = pixelOffsetX * i
          const centerOffsetY = pixelOffsetY * i

          // Apply rotation to the offset vector if shape is rotated
          let rotatedOffsetX = centerOffsetX
          let rotatedOffsetY = centerOffsetY

          if (sourceRotation !== 0) {
            const cos = Math.cos(sourceRotation)
            const sin = Math.sin(sourceRotation)
            rotatedOffsetX = centerOffsetX * cos - centerOffsetY * sin
            rotatedOffsetY = centerOffsetX * sin + centerOffsetY * cos
          }

          // Calculate new position based on whether we're processing a group or individual shape
          let newX, newY

          if (groupContext) {
            // For groups, scale both formation and individual shapes
            const progress = count > 1 ? i / (count - 1) : 0
            const groupScale = 1 + ((scaleStep / 100) - 1) * progress

            // Calculate shape's relative position to group center
            const shapeRelativeToGroupX = originalShape.x - groupContext.groupCenter.x
            const shapeRelativeToGroupY = originalShape.y - groupContext.groupCenter.y

            // Scale the relative positions (formation scaling)
            const scaledRelativeX = shapeRelativeToGroupX * groupScale
            const scaledRelativeY = shapeRelativeToGroupY * groupScale

            // Apply rotation to the scaled relative positions (group formation rotation)
            const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
            const uniformRotation = (rotateAll * Math.PI) / 180
            const groupFormationRotation = incrementalRotation + uniformRotation

            let finalRelativeX = scaledRelativeX
            let finalRelativeY = scaledRelativeY

            if (groupFormationRotation !== 0) {
              const cos = Math.cos(groupFormationRotation)
              const sin = Math.sin(groupFormationRotation)
              finalRelativeX = scaledRelativeX * cos - scaledRelativeY * sin
              finalRelativeY = scaledRelativeX * sin + scaledRelativeY * cos
            }

            // New group center position after offset
            const newGroupCenterX = groupContext.groupCenter.x + rotatedOffsetX
            const newGroupCenterY = groupContext.groupCenter.y + rotatedOffsetY

            // Shape's new position with scaled and rotated relative offset
            newX = newGroupCenterX + finalRelativeX
            newY = newGroupCenterY + finalRelativeY

            // Debug logging for first few clones
            if (i < 3) {
              console.log(`[ArrayModifierProcessor] Group clone ${i}: shape ${originalShape.id}`, {
                originalPos: { x: originalShape.x, y: originalShape.y },
                groupCenter: groupContext.groupCenter,
                relativeToGroup: { x: shapeRelativeToGroupX, y: shapeRelativeToGroupY },
                scaledRelative: { x: scaledRelativeX, y: scaledRelativeY },
                finalRelative: { x: finalRelativeX, y: finalRelativeY },
                groupScale,
                groupFormationRotation: groupFormationRotation * (180 / Math.PI), // Convert to degrees for readability
                offset: { x: rotatedOffsetX, y: rotatedOffsetY },
                newGroupCenter: { x: newGroupCenterX, y: newGroupCenterY },
                newPos: { x: newX, y: newY }
              })
            }
          } else {
            // For individual shapes, adjust for shape bounds (existing behavior)
            const shapeBounds = this.getShapeBounds(originalShape)
            newX = centerForRotation.x + rotatedOffsetX - shapeBounds.width / 2
            newY = centerForRotation.y + rotatedOffsetY - shapeBounds.height / 2
          }

          // Calculate total rotation for individual shapes
          let totalRotation
          if (groupContext) {
            // For groups, individual shapes get the same formation rotation as their relative positions
            const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
            const uniformRotation = (rotateAll * Math.PI) / 180
            totalRotation = baseRotation + incrementalRotation + uniformRotation
          } else {
            // For individual shapes, calculate rotation normally
            const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
            const uniformRotation = (rotateAll * Math.PI) / 180
            totalRotation = baseRotation + incrementalRotation + uniformRotation
          }

          // Calculate scale (reuse groupScale if we're processing a group)
          let newScale
          if (groupContext) {
            // Use the same scale we calculated for formation scaling
            const progress = count > 1 ? i / (count - 1) : 0
            newScale = 1 + ((scaleStep / 100) - 1) * progress
          } else {
            // For individual shapes, calculate scale normally
            const progress = count > 1 ? i / (count - 1) : 0
            newScale = 1 + ((scaleStep / 100) - 1) * progress
          }

          // Accumulate scale with existing scale
          const accumulatedScaleX = existingScale.scaleX * newScale
          const accumulatedScaleY = existingScale.scaleY * newScale

          // Create new transform that multiplies with existing transform
          const newTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(accumulatedScaleX, accumulatedScaleY)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: newTransform,
            metadata: {
              modifierType: 'linear-array',
              index: newInstances.length,
              sourceIndex: instances.indexOf(instance),
              arrayIndex: i,
              linearArrayIndex: i,
              targetRotation: totalRotation,
              generationLevel,
              groupId: instance.metadata.groupId || 'original',
              // Preserve and accumulate existing metadata
              targetScaleX: accumulatedScaleX,
              targetScaleY: accumulatedScaleY
            }
          })
        }
      }
    }

    return newInstances
  }

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
    const { count, radius, startAngle, endAngle, centerX, centerY, rotateAll, rotateEach, alignToCenter } = settings
    const newInstances: VirtualInstance[] = []

    // Check if we should use unified composition (treating all instances as one group)
    const useUnified = this.shouldUseUnifiedComposition(instances)

    const processingId = `CA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log(`[CircularArray] ${processingId} Processing ${instances.length} instances, useUnified: ${useUnified}`, {
      instances: instances.map(i => ({
        type: i.metadata.modifierType,
        sourceId: i.sourceShapeId,
        groupId: i.metadata.groupId,
        index: i.metadata.index
      })),
      processingId
    })

    if (useUnified) {
      // Unified composition: treat all existing instances as a single entity
      const { center: collectiveCenter } = this.calculateCollectiveBounds(instances, originalShape, editor)

      // Get source rotation from the original shape
      const sourceRotation = originalShape.rotation || 0

      // Use STABLE source shape center as circular array origin (not collective center)
      // This ensures circular array center doesn't shift when linear array parameters change
      // Use same manual calculation as CircularArrayGraphics to avoid hidden shape bounds issues
      const shapeWidth = 'w' in originalShape.props ? (originalShape.props.w as number) : 100
      const shapeHeight = 'h' in originalShape.props ? (originalShape.props.h as number) : 100
      const localCenterX = shapeWidth / 2
      const localCenterY = shapeHeight / 2
      const rotation = originalShape.rotation || 0
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)

      // Transform the local center to world coordinates (same as CircularArrayGraphics)
      const stableCenter = {
        x: originalShape.x + (localCenterX * cos - localCenterY * sin),
        y: originalShape.y + (localCenterX * sin + localCenterY * cos)
      }

      // Calculate circle center (offset from stable source shape center)
      const circleCenter = {
        x: stableCenter.x + (centerX || 0),
        y: stableCenter.y + (centerY || 0)
      }

      // Generate a unique group ID for this generation
      const groupId = `circular-array-gen${generationLevel}-${Date.now()}`

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
        let rotatedOffsetX = circularOffsetX
        let rotatedOffsetY = circularOffsetY

        if (sourceRotation !== 0) {
          const cos = Math.cos(sourceRotation)
          const sin = Math.sin(sourceRotation)
          rotatedOffsetX = circularOffsetX * cos - circularOffsetY * sin
          rotatedOffsetY = circularOffsetX * sin + circularOffsetY * cos
        }

        // Calculate GROUP-LEVEL rotation for this circular position (following Grid Array pattern)
        const uniformRotation = (rotateAll * Math.PI) / 180
        const incrementalRotation = (rotateEach * i * Math.PI) / 180
        let groupOrbitAngle = 0
        if (alignToCenter) {
          // Orient the group to point towards the center of the circle
          // angle + Math.PI points outward from center, + Math.PI/2 (90°) rotates to point inward
          groupOrbitAngle = angle + Math.PI + Math.PI / 2
        }

        const groupRotationAdjustment = uniformRotation + incrementalRotation + groupOrbitAngle + sourceRotation

        // Filter out original instances for unified composition
        const groupInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

        // For each instance in the group, create it at this circular position
        groupInstances.forEach((instance, instanceIndex) => {
          const { x: instanceX, y: instanceY } = instance.transform.point()
          const existingTransform = instance.transform

          // Extract transforms from metadata first (where Linear Array stores them), fall back to matrix
          const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
          const existingScale = {
            scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
            scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
          }

          // Calculate offset from collective center to instance position
          const relativeX = instanceX - collectiveCenter.x
          const relativeY = instanceY - collectiveCenter.y

          // Apply orbital rotation around the circular position center
          // This creates orbital motion of the group formation around each circular position
          let rotatedRelativeX = relativeX
          let rotatedRelativeY = relativeY

          if (groupRotationAdjustment !== 0) {
            const cos = Math.cos(groupRotationAdjustment)
            const sin = Math.sin(groupRotationAdjustment)
            rotatedRelativeX = relativeX * cos - relativeY * sin
            rotatedRelativeY = relativeX * sin + relativeY * cos
          }

          // New position = circle center + circular offset + (rotated) relative position
          const newX = circleCenter.x + rotatedOffsetX + rotatedRelativeX
          const newY = circleCenter.y + rotatedOffsetY + rotatedRelativeY

          // Apply GROUP orbital rotation to maintain shape orientation (same as relative position rotation)
          const totalRotation = currentRotation + groupRotationAdjustment

          // Preserve existing scale (circular array doesn't add scale by default)
          const composedTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(existingScale.scaleX, existingScale.scaleY)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: composedTransform,
            metadata: {
              modifierType: 'circular-array',
              index: newInstances.length,
              sourceIndex: instanceIndex,
              arrayIndex: i,
              circularArrayIndex: i,
              targetRotation: totalRotation,
              generationLevel,
              groupId,
              fromUnifiedGroup: true,
              // Preserve existing metadata transforms
              targetScaleX: existingScale.scaleX,
              targetScaleY: existingScale.scaleY,
              // Add processing ID for debugging
              processingId
            }
          })
        })
      }
    } else {
      // Original behavior: multiply each instance
      const shapeBounds = this.getShapeBounds(originalShape)

      // Get original shape center for orbital rotation calculations
      let originalShapeCenter
      if (editor) {
        const visualBounds = editor.getShapePageBounds(originalShape.id)
        if (visualBounds) {
          originalShapeCenter = {
            x: visualBounds.x + visualBounds.width / 2,
            y: visualBounds.y + visualBounds.height / 2
          }
        } else {
          originalShapeCenter = {
            x: originalShape.x + shapeBounds.width / 2,
            y: originalShape.y + shapeBounds.height / 2
          }
        }
      } else {
        originalShapeCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }

      const sourceRotation = originalShape.rotation || 0

      // Calculate circle center (offset from shape center)
      const circleCenter = {
        x: originalShapeCenter.x + (centerX || 0),
        y: originalShapeCenter.y + (centerY || 0)
      }

      for (const instance of instances) {
        // Extract existing transform components for accumulation
        const existingTransform = instance.transform

        // Extract transforms from metadata first (where previous modifiers store them), fall back to matrix
        const baseRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
        const existingScale = {
          scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
          scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
        }

        for (let i = 0; i < count; i++) {
          const currentRotation = baseRotation

          // Calculate angle for this position
          const totalAngle = endAngle - startAngle
          const isFullCircle = Math.abs(totalAngle) >= 360
          const angleStep = count > 1 ? (isFullCircle ? totalAngle / count : totalAngle / (count - 1)) : 0
          const angle = (startAngle + angleStep * i) * Math.PI / 180

          // Calculate circular position relative to circle center
          const circularOffsetX = Math.cos(angle) * radius
          const circularOffsetY = Math.sin(angle) * radius

          // Apply source rotation to the circular offset if shape is rotated
          let rotatedOffsetX = circularOffsetX
          let rotatedOffsetY = circularOffsetY

          if (sourceRotation !== 0) {
            const cos = Math.cos(sourceRotation)
            const sin = Math.sin(sourceRotation)
            rotatedOffsetX = circularOffsetX * cos - circularOffsetY * sin
            rotatedOffsetY = circularOffsetX * sin + circularOffsetY * cos
          }

          const newX = circleCenter.x + rotatedOffsetX - shapeBounds.width / 2
          const newY = circleCenter.y + rotatedOffsetY - shapeBounds.height / 2

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

          // Preserve existing scale
          const composedTransform = Mat.Compose(
            Mat.Translate(newX, newY),
            Mat.Scale(existingScale.scaleX, existingScale.scaleY)
          )

          newInstances.push({
            sourceShapeId: instance.sourceShapeId,
            transform: composedTransform,
            metadata: {
              modifierType: 'circular-array',
              index: newInstances.length,
              sourceIndex: instances.indexOf(instance),
              arrayIndex: i,
              circularArrayIndex: i,
              targetRotation: totalRotation,
              generationLevel,
              groupId: instance.metadata.groupId || 'original',
              // Preserve existing scale
              targetScaleX: existingScale.scaleX,
              targetScaleY: existingScale.scaleY
            }
          })
        }
      }
    }

    console.log(`[CircularArray] ${processingId} Completed: Created ${newInstances.length} instances (unified: ${useUnified})`)
    return newInstances
  }

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
    const { rows, columns, spacingX, spacingY, rotateEach, rotateAll, rotateEachRow, rotateEachColumn, scaleStep, rowScaleStep, columnScaleStep } = settings
    const newInstances: VirtualInstance[] = []

    // Check if we should use unified composition (treating all instances as one group)
    const useUnified = this.shouldUseUnifiedComposition(instances)

    // If using unified composition, calculate collective bounds
    const { center: collectiveCenter, bounds: collectiveBounds } = useUnified
      ? this.calculateCollectiveBounds(instances, originalShape, editor)
      : { center: { x: 0, y: 0 }, bounds: { width: 100, height: 100 } }

    // Get shape dimensions for percentage-based spacing
    const shapeBounds = this.getShapeBounds(originalShape)
    const referenceWidth = useUnified ? collectiveBounds.width : shapeBounds.width
    const referenceHeight = useUnified ? collectiveBounds.height : shapeBounds.height
    const pixelSpacingX = (spacingX / 100) * referenceWidth
    const pixelSpacingY = (spacingY / 100) * referenceHeight

    // Get original shape center for orbital rotation calculations
    let originalShapeCenter
    if (useUnified) {
      originalShapeCenter = collectiveCenter
    } else {
      // Original behavior
      if (editor) {
        const visualBounds = editor.getShapePageBounds(originalShape.id)
        if (visualBounds) {
          originalShapeCenter = {
            x: visualBounds.x + visualBounds.width / 2,
            y: visualBounds.y + visualBounds.height / 2
          }
        } else {
          originalShapeCenter = {
            x: originalShape.x + shapeBounds.width / 2,
            y: originalShape.y + shapeBounds.height / 2
          }
        }
      } else {
        originalShapeCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }
    }

    // Get source rotation from the original shape
    const sourceRotation = originalShape.rotation || 0

    // Calculate grid starting position so first clone (0,0) aligns with source shape
    const gridStartX = originalShapeCenter.x
    const gridStartY = originalShapeCenter.y

    // Generate a unique group ID for this generation
    const groupId = `grid-array-gen${generationLevel}-${Date.now()}`

    // Handle unified composition differently - grid loops on outside, instances on inside
    if (useUnified) {
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
          let rotatedOffsetX = gridOffsetX
          let rotatedOffsetY = gridOffsetY

          if (sourceRotation !== 0) {
            const cos = Math.cos(sourceRotation)
            const sin = Math.sin(sourceRotation)
            rotatedOffsetX = gridOffsetX * cos - gridOffsetY * sin
            rotatedOffsetY = gridOffsetX * sin + gridOffsetY * cos
          }

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

          const linearScale = 1 + ((scaleStep / 100) - 1) * linearProgress
          const rowScale = 1 + ((rowScaleStep / 100) - 1) * rowProgress
          const columnScale = 1 + ((columnScaleStep / 100) - 1) * columnProgress
          const groupScale = linearScale * rowScale * columnScale

          // Inner loop: Create each instance in the group at this grid position
          groupInstances.forEach((instance, instanceIndex) => {
            const existingTransform = instance.transform

            // Extract transforms from metadata first, fall back to matrix
            const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
            const existingScale = {
              scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
              scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
            }

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
            let rotatedRelativeX = scaledRelativeX
            let rotatedRelativeY = scaledRelativeY

            if (groupRotationAdjustment !== 0) {
              const cos = Math.cos(groupRotationAdjustment)
              const sin = Math.sin(groupRotationAdjustment)
              rotatedRelativeX = scaledRelativeX * cos - scaledRelativeY * sin
              rotatedRelativeY = scaledRelativeX * sin + scaledRelativeY * cos
            }

            // Position at grid location center + rotated relative position
            const newX = gridPositionCenterX + rotatedRelativeX
            const newY = gridPositionCenterY + rotatedRelativeY

            // Apply GROUP orbital rotation to maintain shape orientation (same as relative position rotation)
            const totalRotation = currentRotation + groupRotationAdjustment

            // Apply GROUP scale (accumulated with existing)
            const accumulatedScaleX = existingScale.scaleX * groupScale
            const accumulatedScaleY = existingScale.scaleY * groupScale

            // Create transform with position and accumulated scale
            const composedTransform = Mat.Compose(
              Mat.Translate(newX, newY),
              Mat.Scale(accumulatedScaleX, accumulatedScaleY)
            )

            newInstances.push({
              sourceShapeId: instance.sourceShapeId,
              transform: composedTransform,
              metadata: {
                modifierType: 'grid-array',
                index: newInstances.length,
                sourceIndex: instanceIndex,
                arrayIndex: linearIndex,
                gridArrayIndex: linearIndex,
                gridPosition: { row, col },
                targetRotation: totalRotation,
                targetScaleX: accumulatedScaleX,
                targetScaleY: accumulatedScaleY,
                generationLevel,
                groupId,
                fromUnifiedGroup: useUnified
              }
            })
          })
        }
      }
    } else {
      // Non-unified mode: Original behavior - process each instance individually
      const processInstances = instances

      for (const instance of processInstances) {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < columns; col++) {
            // Extract existing transform components
            const existingTransform = instance.transform
            const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
            const existingScale = {
              scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
              scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
            }

            // Calculate grid position
            const gridOffsetX = col * pixelSpacingX
            const gridOffsetY = row * pixelSpacingY

            // Apply rotation to grid offset if source is rotated
            let rotatedOffsetX = gridOffsetX
            let rotatedOffsetY = gridOffsetY

            if (sourceRotation !== 0) {
              const cos = Math.cos(sourceRotation)
              const sin = Math.sin(sourceRotation)
              rotatedOffsetX = gridOffsetX * cos - gridOffsetY * sin
              rotatedOffsetY = gridOffsetX * sin + gridOffsetY * cos
            }

            // Position at grid location
            const newX = gridStartX + rotatedOffsetX - shapeBounds.width / 2
            const newY = gridStartY + rotatedOffsetY - shapeBounds.height / 2

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

            const linearScale = 1 + ((scaleStep / 100) - 1) * linearProgress
            const rowScale = 1 + ((rowScaleStep / 100) - 1) * rowProgress
            const columnScale = 1 + ((columnScaleStep / 100) - 1) * columnProgress
            const newScale = linearScale * rowScale * columnScale

            const accumulatedScaleX = existingScale.scaleX * newScale
            const accumulatedScaleY = existingScale.scaleY * newScale

            // Create transform
            const composedTransform = Mat.Compose(
              Mat.Translate(newX, newY),
              Mat.Scale(accumulatedScaleX, accumulatedScaleY)
            )

            newInstances.push({
              sourceShapeId: instance.sourceShapeId,
              transform: composedTransform,
              metadata: {
                modifierType: 'grid-array',
                index: newInstances.length,
                sourceIndex: processInstances.indexOf(instance),
                arrayIndex: linearIndex,
                gridArrayIndex: linearIndex,
                gridPosition: { row, col },
                targetRotation: totalRotation,
                targetScaleX: accumulatedScaleX,
                targetScaleY: accumulatedScaleY,
                generationLevel,
                groupId,
                fromUnifiedGroup: false
              }
            })
          }
        }
      }
    }

    return newInstances
  }

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
    const useUnified = this.shouldUseUnifiedComposition(instances)

    // Get reference center and bounds
    let referenceCenter: { x: number; y: number }
    if (useUnified) {
      const { center } = this.calculateCollectiveBounds(instances, originalShape, editor)
      referenceCenter = center
    } else {
      // Original behavior
      const shapeBounds = this.getShapeBounds(originalShape)
      if (editor) {
        const visualBounds = editor.getShapePageBounds(originalShape.id)
        if (visualBounds) {
          referenceCenter = {
            x: visualBounds.x + visualBounds.width / 2,
            y: visualBounds.y + visualBounds.height / 2
          }
        } else {
          referenceCenter = {
            x: originalShape.x + shapeBounds.width / 2,
            y: originalShape.y + shapeBounds.height / 2
          }
        }
      } else {
        referenceCenter = {
          x: originalShape.x + shapeBounds.width / 2,
          y: originalShape.y + shapeBounds.height / 2
        }
      }
    }

    // Generate group ID
    const groupId = `mirror-gen${generationLevel}-${Date.now()}`

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
      const existingTransform = instance.transform

      // Extract transforms from metadata first (where previous modifiers store them), fall back to matrix
      const currentRotation = (instance.metadata.targetRotation as number) ?? existingTransform.rotation()
      const existingScale = {
        scaleX: (instance.metadata.targetScaleX as number) ?? existingTransform.decomposed().scaleX,
        scaleY: (instance.metadata.targetScaleY as number) ?? existingTransform.decomposed().scaleY
      }

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
        const shapeBounds = this.getShapeBounds(originalShape)
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
      const composedTransform = Mat.Compose(
        Mat.Translate(newX, newY),
        Mat.Scale(existingScale.scaleX, existingScale.scaleY)
      )

      newInstances.push({
        sourceShapeId: instance.sourceShapeId,
        transform: composedTransform,
        metadata: {
          ...instance.metadata,
          modifierType: 'mirror',
          index: newInstances.length,
          isMirrored: true,
          mirrorAxis: axis,
          mirrorOffset: offset,
          sourceIndex: processInstances.indexOf(instance),
          targetRotation: targetRotation,
          arrayIndex: 0,
          generationLevel,
          groupId,
          fromUnifiedGroup: useUnified,
          isFlippedX: axis === 'x',
          isFlippedY: axis === 'y',
          // Preserve existing scale from previous modifiers
          targetScaleX: existingScale.scaleX,
          targetScaleY: existingScale.scaleY
        }
      })
    })

    return newInstances
  }
}
