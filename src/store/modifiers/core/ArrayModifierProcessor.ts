import { type TLShape, Editor } from 'tldraw'
import type {
  LinearArraySettings,
  CircularArraySettings,
  GridArraySettings,
  MirrorSettings,
  GroupContext
} from '../../../types/modifiers'
import type { VirtualInstance } from './TransformComposer'
import { LinearArrayProcessor } from './array-processors/LinearArrayProcessor'
import { CircularArrayProcessor } from './array-processors/CircularArrayProcessor'
import { GridArrayProcessor } from './array-processors/GridArrayProcessor'
import { MirrorProcessor } from './array-processors/MirrorProcessor'

/**
 * Orchestrator for array-based modifiers (Linear, Circular, Grid, Mirror)
 * Delegates to specialized processors while maintaining the same public interface
 * CRITICAL: Preserves all existing functionality and behavior exactly
 */
export class ArrayModifierProcessor {

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
    try {
      return LinearArrayProcessor.applyLinearArray(instances, settings, originalShape, groupContext, editor, generationLevel)
    } catch (error) {
      console.error('[ArrayModifierProcessor] LinearArray error:', error)
      throw error
    }
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
    return CircularArrayProcessor.applyCircularArray(instances, settings, originalShape, groupContext, editor, generationLevel)
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
    return GridArrayProcessor.applyGridArray(instances, settings, originalShape, groupContext, editor, generationLevel)
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
    return MirrorProcessor.applyMirror(instances, settings, originalShape, groupContext, editor, generationLevel)
  }
}