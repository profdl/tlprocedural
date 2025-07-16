import type { BaseRecord, TLShapeId, RecordId } from 'tldraw'

// Modifier ID type
export type TLModifierId = RecordId<TLModifierRecord>

// Base modifier record type
export interface TLModifierRecord extends BaseRecord<'modifier', TLModifierId> {
  targetShapeId: TLShapeId
  enabled: boolean
  order: number // For modifier stack ordering
}

// Linear Array Modifier Settings
export interface LinearArraySettings {
  count: number
  offsetX: number
  offsetY: number
  rotation: number // in degrees
  spacing: number
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

// Union of all modifier types
export type TLModifier = 
  | TLLinearArrayModifier
  | TLCircularArrayModifier
  | TLGridArrayModifier
  | TLMirrorModifier

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