import { type ModifierType } from '../../../types/modifiers'
import { MODIFIER_DISPLAY_NAMES, DEFAULT_SETTINGS } from '../constants'

// Registry entry interface
export interface ModifierRegistryEntry {
  type: ModifierType
  displayName: string
  defaultSettings: Record<string, unknown>
  component: React.ComponentType<Record<string, unknown>>
  controlsComponent: React.ComponentType<Record<string, unknown>>
}

// Registry type
export type ModifierRegistry = Record<ModifierType, ModifierRegistryEntry>

// Create the registry (to be populated when components are imported)
export const modifierRegistry: Partial<ModifierRegistry> = {}

// Helper function to register a modifier
export function registerModifier(entry: ModifierRegistryEntry): void {
  modifierRegistry[entry.type] = entry
}

// Helper function to get a modifier entry
export function getModifierEntry(type: ModifierType): ModifierRegistryEntry | undefined {
  return modifierRegistry[type]
}

// Helper function to get all registered modifier types
export function getRegisteredModifierTypes(): ModifierType[] {
  return Object.keys(modifierRegistry) as ModifierType[]
}

// Helper function to get display name for a modifier type
export function getModifierDisplayName(type: ModifierType): string {
  return MODIFIER_DISPLAY_NAMES[type] || type
}

// Helper function to get default settings for a modifier type
export function getModifierDefaultSettings(type: ModifierType): Record<string, unknown> {
  return DEFAULT_SETTINGS[type] || {}
} 