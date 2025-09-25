import type { CustomTrayItem } from '../hooks/useCustomShapes'

let customShapesRegistry: CustomTrayItem[] = []

/**
 * Update the shared registry of custom shapes so non-React modules can access definitions.
 */
export function setCustomShapesRegistry(shapes: CustomTrayItem[]): void {
  customShapesRegistry = shapes
}

/**
 * Get the current list of custom shapes from the shared registry.
 */
export function getCustomShapesRegistry(): CustomTrayItem[] {
  return customShapesRegistry
}

/**
 * Find a custom shape definition by id.
 */
export function getCustomShapeFromRegistry(id: string): CustomTrayItem | undefined {
  return customShapesRegistry.find(shape => shape.id === id)
}
