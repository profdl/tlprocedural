/**
 * Default properties shared across all custom shapes
 * Provides a single source of truth for common shape properties
 */

export interface CommonShapeProps {
  color: string
  fillColor: string
  strokeWidth: number
  fill: boolean
}

/**
 * Default properties for all fillable shapes
 */
export const DEFAULT_SHAPE_PROPS: CommonShapeProps = {
  color: '#000000',        // Black stroke
  fillColor: '#ffffff',    // White fill
  strokeWidth: 1,          // 1px stroke width
  fill: true,              // Fill enabled by default
}

/**
 * Default properties for stroke-only shapes (like sine wave)
 */
export const DEFAULT_STROKE_ONLY_PROPS = {
  color: '#000000',
  strokeWidth: 1,
}

/**
 * Merges common defaults with shape-specific props
 */
export function mergeWithDefaults<T extends Record<string, unknown>>(
  shapeSpecificProps: T
): T & CommonShapeProps {
  return {
    ...DEFAULT_SHAPE_PROPS,
    ...shapeSpecificProps,
  }
}