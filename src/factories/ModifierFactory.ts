import { type TLShapeId } from 'tldraw'
import {
  type TLModifier,
  type TLModifierId,
  type TLLinearArrayModifier,
  type TLCircularArrayModifier,
  type TLGridArrayModifier,
  type TLMirrorModifier,
  type TLBooleanModifier,
  type ModifierType,
  createModifierId
} from '../types/modifiers'

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
        count: 10,
        offsetX: 48,
        offsetY: 1,
        rotationIncrement: 7,
        rotateAll: 0,
        scaleStep: 45,
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
        alignToTangent: true,
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
        rows: 3,
        columns: 3,
        spacingX: 120, // 120% = 1.2x shape width spacing
        spacingY: 120, // 120% = 1.2x shape height spacing
        rotateEach: 0,
        rotateAll: 0,
        rotateEachRow: 0,
        rotateEachColumn: 0,
        scaleStep: 100, // 100% = no scaling by default
        rowScaleStep: 100, // 100% = no row scaling by default
        columnScaleStep: 100, // 100% = no column scaling by default
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
 * Boolean Modifier Factory
 */
export class BooleanModifierFactory extends BaseModifierFactory<TLBooleanModifier> {
  createModifier(
    id: TLModifierId,
    targetShapeId: TLShapeId,
    order: number,
    settings: Partial<TLBooleanModifier['props']> = {}
  ): TLBooleanModifier {
    return {
      ...this.createBaseModifier(id, 'boolean', targetShapeId, order),
      type: 'boolean',
      props: {
        operation: 'union',
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
    'boolean': new BooleanModifierFactory()
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
      throw new Error(`Unknown modifier type: ${type}. Available types: ${Object.keys(this.factories).join(', ')}`)
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