import type { TLShape, Editor } from 'tldraw'
import type { 
  ShapeState, 
  ShapeInstance, 
  ModifierProcessor,
  GroupContext
} from '../../../types/modifiers'
import type { 
  PathData,
  PathModificationResult,
  PathModifierSettings
} from '../../../types/pathTypes'
import { 
  shapeToPath, 
  pathToShapeUpdates, 
  pathDataToBounds 
} from '../../../utils/pathExtractors'
import { 
  enhancedPathToShape
} from '../../../utils/shapeConversion'
import { canProcessShapeAsPaths } from '../../../types/pathTypes'

/**
 * Base class for all path-based modifiers
 * Handles common path extraction, modification, and shape updating logic
 */
export abstract class PathModifier<TSettings extends PathModifierSettings = PathModifierSettings> 
  implements ModifierProcessor<TSettings> {
  
  // Abstract method that each path modifier must implement
  protected abstract modifyPath(
    pathData: PathData, 
    settings: TSettings,
    shapeIndex: number,
    editor?: Editor
  ): PathModificationResult

  // Main processor interface implementation
  process(
    input: ShapeState,
    settings: TSettings,
    _groupContext?: GroupContext,
    editor?: Editor
  ): ShapeState {
    
    // Process each shape instance through path modification
    const newInstances: ShapeInstance[] = []
    
    for (const instance of input.instances) {
      const processedInstances = this.processInstance(
        instance, 
        settings, 
        input.instances.length, 
        editor
      )
      newInstances.push(...processedInstances)
    }
    
    return {
      ...input,
      instances: newInstances
    }
  }

  // Process a single shape instance
  private processInstance(
    instance: ShapeInstance,
    settings: TSettings,
    _totalInstances: number,
    editor?: Editor
  ): ShapeInstance[] {
    
    // Check if this shape can be processed as paths
    if (!canProcessShapeAsPaths(instance.shape.type)) {
      // Return original instance unchanged for non-path shapes
      return [instance]
    }

    // Extract path data from the shape
    const pathData = shapeToPath(instance.shape, editor)
    if (!pathData) {
      console.warn(`Could not extract path from ${instance.shape.type} shape`)
      return [instance]
    }

    try {
      // Apply the path modification
      const result = this.modifyPath(
        pathData,
        settings,
        instance.index,
        editor
      )

      // Try enhanced path-to-shape conversion first
      const enhancedResult = enhancedPathToShape(result.pathData, instance.shape)
      
      let updatedShape: TLShape
      
      if (enhancedResult && 'type' in enhancedResult) {
        // Full shape conversion (e.g., Triangle -> Bezier for complex paths)
        updatedShape = enhancedResult as TLShape
      } else {
        // Standard property updates
        const shapeUpdates = enhancedResult || pathToShapeUpdates(result.pathData, instance.shape)
        if (!shapeUpdates) {
          console.warn(`Could not convert modified path back to ${instance.shape.type} shape`)
          return [instance]
        }

        updatedShape = {
          ...instance.shape,
          ...shapeUpdates
        }
      }

      // Update transform if bounds changed
      let updatedTransform = instance.transform
      if (result.boundsChanged && result.newBounds) {
        updatedTransform = {
          ...instance.transform,
          // Adjust position if bounds changed
          x: instance.transform.x + (result.newBounds.x - (pathData.bounds?.x || 0)),
          y: instance.transform.y + (result.newBounds.y - (pathData.bounds?.y || 0))
        }
      }

      // Create new instance with modified shape
      const newInstance: ShapeInstance = {
        shape: updatedShape,
        transform: updatedTransform,
        index: instance.index,
        metadata: {
          ...instance.metadata,
          pathModified: true,
          originalPathBounds: pathData.bounds,
          newPathBounds: result.newBounds
        }
      }

      return [newInstance]
      
    } catch (error) {
      console.error(`Error processing path modification on ${instance.shape.type}:`, error)
      return [instance] // Return original on error
    }
  }

  // Utility methods for path modifiers

  protected calculateProgress(index: number, total: number): number {
    return total > 1 ? index / (total - 1) : 0
  }

  protected interpolateValue(
    startValue: number, 
    endValue: number, 
    progress: number
  ): number {
    return startValue + (endValue - startValue) * progress
  }

  // Common path operations that subclasses can use

  protected clonePathData(pathData: PathData): PathData {
    return {
      ...pathData,
      data: Array.isArray(pathData.data)
        ? [...pathData.data]
        : pathData.data,
      bounds: pathData.bounds ? { ...pathData.bounds } : undefined
    }
  }

  protected updatePathBounds(pathData: PathData): PathData {
    const bounds = pathDataToBounds(pathData)
    return {
      ...pathData,
      bounds
    }
  }

  // Validation helpers

  protected validatePathData(pathData: PathData): boolean {
    if (!pathData || !pathData.data) return false
    
    switch (pathData.type) {
      case 'points':
        return Array.isArray(pathData.data) && pathData.data.length > 0
      case 'bezier':
        return Array.isArray(pathData.data) && pathData.data.length > 0
      case 'svg':
        return typeof pathData.data === 'string' && pathData.data.length > 0
      default:
        return false
    }
  }

  protected validateSettings(settings: TSettings): boolean {
    return settings !== null && settings !== undefined
  }
}

// Helper function to determine if a modifier is a path modifier
export function isPathModifier(modifier: ModifierProcessor): modifier is PathModifier {
  return modifier instanceof PathModifier
}

// Path modifier type registry
export const PATH_MODIFIER_TYPES = [
  'subdivide',
  'noise-offset', 
  'smooth',
  'simplify'
] as const

export type PathModifierType = typeof PATH_MODIFIER_TYPES[number]

export function isPathModifierType(type: string): type is PathModifierType {
  return PATH_MODIFIER_TYPES.includes(type as PathModifierType)
}