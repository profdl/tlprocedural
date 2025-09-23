import { useMultiShapeInstanceManager } from './hooks/useMultiShapeInstanceManager'

/**
 * Component that manages custom shape instances (both single and multi-shape)
 * This must be rendered inside the Tldraw component to have access to the editor context
 */
export function CustomShapeInstanceManagerComponent() {
  // Initialize the enhanced multi-shape instance manager hook
  useMultiShapeInstanceManager()

  // This component doesn't render anything, it just manages instance state
  return null
}