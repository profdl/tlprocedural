import { useCustomShapeInstanceManager } from './hooks/useCustomShapeInstanceManager'

/**
 * Component that manages custom shape instances
 * This must be rendered inside the Tldraw component to have access to the editor context
 */
export function CustomShapeInstanceManagerComponent() {
  // Initialize the instance manager hook
  useCustomShapeInstanceManager()

  // This component doesn't render anything, it just manages instance state
  return null
}