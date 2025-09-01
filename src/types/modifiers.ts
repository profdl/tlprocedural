import type { BaseRecord, TLShapeId, RecordId, TLShape } from 'tldraw'

// Modifier ID type
export type TLModifierId = RecordId<TLModifierRecord>

// Base modifier record type
export interface TLModifierRecord extends BaseRecord<'modifier', TLModifierId> {
  targetShapeId: TLShapeId
  enabled: boolean
  order: number // For modifier stack ordering
}

// NEW: Transform representation for modifier processing
export interface Transform {
  x: number
  y: number
  rotation: number // in radians
  scaleX: number
  scaleY: number
}

// NEW: Individual shape instance in a modifier stack
export interface ShapeInstance {
  shape: TLShape
  transform: Transform
  index: number
  metadata?: Record<string, unknown>
}

// NEW: State object passed between modifiers in the stack
export interface ShapeState {
  originalShape: TLShape
  instances: ShapeInstance[]
  metadata?: Record<string, unknown>
}

// Group context for modifier processing
export interface GroupContext {
  groupCenter: { x: number; y: number }
  groupTopLeft: { x: number; y: number }
  groupShapes: TLShape[]
  groupBounds: { 
    minX: number; maxX: number; minY: number; maxY: number;
    width: number; height: number; centerX: number; centerY: number 
  }
  groupTransform?: {
    x: number; y: number; rotation: number
  }
}

// NEW: Interface that all modifiers must implement for stacking
export interface ModifierProcessor<T = LinearArraySettings | CircularArraySettings | GridArraySettings | MirrorSettings | LSystemSettings> {
  process(input: ShapeState, settings: T, groupContext?: GroupContext): ShapeState
}

// Linear Array Modifier Settings
export interface LinearArraySettings {
  count: number
  offsetX: number
  offsetY: number
  rotation: number // in degrees
  scaleStep: number // scale change per copy
}

// Circular Array Modifier Settings
export interface CircularArraySettings {
  count: number
  radius: number
  startAngle: number
  endAngle: number
  centerX: number
  centerY: number
  rotateEach: number // rotation per clone in degrees
  rotateAll: number // rotation applied to all clones in degrees
  pointToCenter: boolean // automatically rotate shapes to point away from center
}

// Grid Array Modifier Settings
export interface GridArraySettings {
  rows: number
  columns: number
  spacingX: number
  spacingY: number
  offsetX: number
  offsetY: number
}

// Mirror Modifier Settings (for future)
export interface MirrorSettings {
  axis: 'x' | 'y' | 'diagonal'
  offset: number
  mergeThreshold: number
}

// L-System Modifier Settings
export interface LSystemSettings {
  axiom: string
  rules: Record<string, string>
  iterations: number
  angle: number // degrees
  stepPercent: number // percent of shape size used as base step
  scalePerIteration?: number // multiplicative scale applied to the shape each level (0..1)
  branches?: readonly number[] // explicit branch angles in degrees, relative to heading
  angleJitter?: number // degrees, applied per branch
  branchProbability?: number // 0..1 probability per branch
  continueTrunk?: boolean // add a 0° branch to continue trunk
  seed?: number
}

// Union of all modifier types
export type TLModifier = 
  | TLLinearArrayModifier
  | TLCircularArrayModifier
  | TLGridArrayModifier
  | TLMirrorModifier
  | TLLSystemModifier

// Specific modifier types
export interface TLLinearArrayModifier extends TLModifierRecord {
  type: 'linear-array'
  props: LinearArraySettings
}

export interface TLCircularArrayModifier extends TLModifierRecord {
  type: 'circular-array'
  props: CircularArraySettings
}

export interface TLGridArrayModifier extends TLModifierRecord {
  type: 'grid-array'
  props: GridArraySettings
}

export interface TLMirrorModifier extends TLModifierRecord {
  type: 'mirror'
  props: MirrorSettings
}

export interface TLLSystemModifier extends TLModifierRecord {
  type: 'lsystem'
  props: LSystemSettings
}

// Utility types
export type ModifierType = TLModifier['type']

export interface ModifierInstance {
  id: TLModifierId
  type: ModifierType
  position: { x: number; y: number }
  rotation: number
  scale: { x: number; y: number }
  index: number // which copy in the array
}

// Helper to create modifier IDs
export function createModifierId(id?: string): TLModifierId {
  return `modifier:${id ?? Math.random().toString(36).substr(2, 9)}` as TLModifierId
}
