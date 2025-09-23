import { useGroupEditMode } from './hooks/useGroupEditMode'

/**
 * Component that manages group edit mode functionality
 * This component should be rendered inside the TldrawCanvas to activate group editing
 */
export function GroupEditManager() {
  // Initialize the group edit mode hook
  useGroupEditMode()

  // This component doesn't render anything visible
  // It just sets up the event listeners and state management for group editing
  return null
}