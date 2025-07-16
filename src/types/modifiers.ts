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

// Radial Array Modifier Settings (for future)
export interface RadialArraySettings {
  count: number
  radius: number
  startAngle: number
  endAngle: number
  centerX: number
  centerY: number
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
  | TLRadialArrayModifier
  | TLMirrorModifier

// Specific modifier types
export interface TLLinearArrayModifier extends TLModifierRecord {
  type: 'linear-array'
  props: LinearArraySettings
}

export interface TLRadialArrayModifier extends TLModifierRecord {
  type: 'radial-array'
  props: RadialArraySettings
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