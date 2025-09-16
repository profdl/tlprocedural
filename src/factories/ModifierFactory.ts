import { type TLShapeId } from 'tldraw'
import {
  type TLModifier,
  type TLModifierId,
  type TLLinearArrayModifier,
  type TLCircularArrayModifier,
  type TLGridArrayModifier,
  type TLMirrorModifier,
  type TLLSystemModifier,
  type TLSubdivideModifier,
  type TLNoiseOffsetModifier,
  type TLSmoothModifier,
  type TLSimplifyModifier,
  type ModifierType,
  createModifierId
} from '../types/modifiers'
import {
  type SubdivideSettings,
  type NoiseOffsetSettings,
  type SmoothSettings,
  type SimplifySettings
} from '../types/pathTypes'

/**
 * Factory interface for creating specific modifier types
 */
export interface ModifierFactoryInterface<T extends TLModifier = TLModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings?: Partial<T['props']>
  ): T
}

/**
 * Base factory class providing common modifier properties
 */
abstract class BaseModifierFactory<T extends TLModifier> implements ModifierFactoryInterface<T> {
  abstract createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings?: Partial<T['props']>
  ): T

  protected createBaseModifier(
    id: TLModifierId,
    type: ModifierType,
    targetShapeId: TLShapeId,
    order: number
  ) {
    return {
      id,
      typeName: 'modifier' as const,
      type,
      targetShapeId,
      enabled: true,
      order
    }
  }
}

/**
 * Linear Array Modifier Factory
 */
export class LinearArrayModifierFactory extends BaseModifierFactory<TLLinearArrayModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<TLLinearArrayModifier['props']> = {}
  ): TLLinearArrayModifier {
    return {
      ...this.createBaseModifier(id, 'linear-array', targetShapeId, order),
      type: 'linear-array',
      props: {
        count: 3,
        offsetX: 50,
        offsetY: 0,
        rotation: 0,
        scaleStep: 1.0,
        ...settings
      }
    }
  }
}

/**
 * Circular Array Modifier Factory
 */
export class CircularArrayModifierFactory extends BaseModifierFactory<TLCircularArrayModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<TLCircularArrayModifier['props']> = {}
  ): TLCircularArrayModifier {
    return {
      ...this.createBaseModifier(id, 'circular-array', targetShapeId, order),
      type: 'circular-array',
      props: {
        count: 6,
        radius: 100,
        startAngle: 0,
        endAngle: 360,
        centerX: 0,
        centerY: 0,
        rotateEach: 0,
        rotateAll: 0,
        alignToTangent: false,
        ...settings
      }
    }
  }
}

/**
 * Grid Array Modifier Factory
 */
export class GridArrayModifierFactory extends BaseModifierFactory<TLGridArrayModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<TLGridArrayModifier['props']> = {}
  ): TLGridArrayModifier {
    return {
      ...this.createBaseModifier(id, 'grid-array', targetShapeId, order),
      type: 'grid-array',
      props: {
        rows: 2,
        columns: 2,
        spacingX: 50,
        spacingY: 50,
        offsetX: 0,
        offsetY: 0,
        ...settings
      }
    }
  }
}

/**
 * Mirror Modifier Factory
 */
export class MirrorModifierFactory extends BaseModifierFactory<TLMirrorModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<TLMirrorModifier['props']> = {}
  ): TLMirrorModifier {
    return {
      ...this.createBaseModifier(id, 'mirror', targetShapeId, order),
      type: 'mirror',
      props: {
        axis: 'x',
        offset: 0,
        mergeThreshold: 0,
        ...settings
      }
    }
  }
}

/**
 * L-System Modifier Factory
 */
export class LSystemModifierFactory extends BaseModifierFactory<TLLSystemModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<TLLSystemModifier['props']> = {}
  ): TLLSystemModifier {
    return {
      ...this.createBaseModifier(id, 'lsystem', targetShapeId, order),
      type: 'lsystem',
      props: {
        axiom: 'F',
        rules: { F: 'F+F−F−F+F' },
        iterations: 6,
        angle: 20,
        stepPercent: 100,
        scalePerIteration: 1.0,
        ...settings
      }
    }
  }
}

/**
 * Subdivide Modifier Factory
 */
export class SubdivideModifierFactory extends BaseModifierFactory<TLSubdivideModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<SubdivideSettings> = {}
  ): TLSubdivideModifier {
    return {
      ...this.createBaseModifier(id, 'subdivide', targetShapeId, order),
      type: 'subdivide',
      props: {
        iterations: 1,
        factor: 0.5,
        smooth: false,
        ...settings
      }
    }
  }
}

/**
 * Noise Offset Modifier Factory
 */
export class NoiseOffsetModifierFactory extends BaseModifierFactory<TLNoiseOffsetModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<NoiseOffsetSettings> = {}
  ): TLNoiseOffsetModifier {
    return {
      ...this.createBaseModifier(id, 'noise-offset', targetShapeId, order),
      type: 'noise-offset',
      props: {
        amplitude: 10,
        frequency: 0.1,
        octaves: 3,
        seed: 123,
        direction: 'both',
        ...settings
      }
    }
  }
}

/**
 * Smooth Modifier Factory
 */
export class SmoothModifierFactory extends BaseModifierFactory<TLSmoothModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<SmoothSettings> = {}
  ): TLSmoothModifier {
    return {
      ...this.createBaseModifier(id, 'smooth', targetShapeId, order),
      type: 'smooth',
      props: {
        iterations: 1,
        factor: 0.5,
        preserveCorners: true,
        cornerThreshold: 90,
        ...settings
      }
    }
  }
}

/**
 * Simplify Modifier Factory
 */
export class SimplifyModifierFactory extends BaseModifierFactory<TLSimplifyModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<SimplifySettings> = {}
  ): TLSimplifyModifier {
    return {
      ...this.createBaseModifier(id, 'simplify', targetShapeId, order),
      type: 'simplify',
      props: {
        tolerance: 5,
        preserveCorners: true,
        minPoints: 3,
        ...settings
      }
    }
  }
}

/**
 * Main Modifier Factory Registry
 * Manages all modifier factories using a registry pattern
 */
export class ModifierFactory {
  private static factories: Record<ModifierType, ModifierFactoryInterface> = {
    'linear-array': new LinearArrayModifierFactory(),
    'circular-array': new CircularArrayModifierFactory(),
    'grid-array': new GridArrayModifierFactory(),
    'mirror': new MirrorModifierFactory(),
    'lsystem': new LSystemModifierFactory(),
    'subdivide': new SubdivideModifierFactory(),
    'noise-offset': new NoiseOffsetModifierFactory(),
    'smooth': new SmoothModifierFactory(),
    'simplify': new SimplifyModifierFactory()
  }

  /**
   * Create a modifier of the specified type
   */
  static createModifier(
    type: ModifierType,
    targetShapeId: TLShapeId,
    order: number,
    settings?: object
  ): TLModifier {
    const factory = this.factories[type]
    if (!factory) {
      throw new Error(`Unknown modifier type: ${type}`)
    }

    const id = createModifierId()
    return factory.createModifier(id, targetShapeId, order, settings)
  }

  /**
   * Get all available modifier types
   */
  static getAvailableTypes(): ModifierType[] {
    return Object.keys(this.factories) as ModifierType[]
  }

  /**
   * Check if a modifier type is supported
   */
  static isTypeSupported(type: string): type is ModifierType {
    return type in this.factories
  }

  /**
   * Register a custom modifier factory
   */
  static registerFactory(type: ModifierType, factory: ModifierFactoryInterface): void {
    this.factories[type] = factory
  }
}