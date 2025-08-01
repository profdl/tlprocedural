import { ModifierRendererCore } from './modifiers/components/ModifierRendererCore'
import { MirrorTransformOverlay } from './modifiers/components/MirrorTransformOverlay'

/**
 * Refactored ModifierRenderer component
 * Uses extracted components for better separation of concerns
 */
export function ModifierRenderer() {
  return <ModifierRendererCore />
}

/**
 * Helper component to integrate with tldraw's UI zones
 */
export function ModifierOverlay() {
  return (
    <div 
      className="modifier-overlay"
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000, // Above canvas but below UI
      }}
    >
      <ModifierRenderer />
      <MirrorTransformOverlay />
    </div>
  )
} 