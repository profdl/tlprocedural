import { 
  Tldraw, 
  type TLShape,
  type TldrawOptions,
  type Editor,
  type TLShapeId,
  DrawShapeUtil,
  type TLUiToolsContextType,
  type TLUiToolItem
} from 'tldraw'
import type { TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { CustomStylePanel } from './CustomStylePanel'
import { CustomToolbar } from './CustomToolbar'
import { ModifierOverlay } from './ModifierRenderer'
import { isArrayClone } from './modifiers/utils'

import { GeneratorEngine } from './generators/GeneratorEngine'
import { SineWaveShapeUtil } from './shapes/SineWaveShape'
import { SineWaveShapeTool } from './shapes/SineWaveTool'

// Try to configure DrawShapeUtil with smoothing (may not work in all versions)
const ConfiguredDrawShapeUtil = DrawShapeUtil.configure({
  // Try different potential smoothing options
  smoothing: true,
  strokeSmoothing: true,
  lineSmoothing: true
} as Record<string, unknown>) // Use type assertion for experimental features

const components: TLComponents = {
  StylePanel: CustomStylePanel,
  Toolbar: CustomToolbar,
}

// Custom assets: provide a custom icon for the sine-wave tool
const assetUrls = {
  icons: {
    'tool-sine-wave': '/sine-wave.svg',
  },
}

// Provide a UI tool item for the sine wave so it appears in the toolbar
const uiOverrides = {
  tools(editor: Editor, tools: TLUiToolsContextType): TLUiToolsContextType {
    const newTools = { ...tools }
    newTools['sine-wave'] = {
      id: 'sine-wave',
      label: 'Sine Wave',
      icon: 'tool-sine-wave',
      kbd: 'y',
      onSelect: () => editor.setCurrentTool('sine-wave'),
    } as TLUiToolItem
    return newTools
  },
}

// Editor options to potentially enable smoothing
const editorOptions: Partial<TldrawOptions> = {
  // Try to enable any smoothing-related options
  // Note: These options may not exist in the current tldraw version
  // but they're commonly used in drawing applications
}

export function TldrawCanvas() {
  const handleMount = (editor: Editor) => {
    // Set up side effects to keep array clone shapes locked and non-interactive
    
    // Prevent array clones from being unlocked
    const cleanupKeepArrayClonesLocked = editor.sideEffects.registerBeforeChangeHandler(
      'shape',
      (_prev: TLShape, next: TLShape) => {
        if (!isArrayClone(next)) return next
        if (next.isLocked) return next
        // Keep array clones locked
        return { ...next, isLocked: true }
      }
    )

    // Prevent array clones and generator previews from being selected by select-all
    const cleanupSelection = editor.sideEffects.registerAfterCreateHandler(
      'shape',
      () => {
        const selectedShapeIds = editor.getSelectedShapeIds()
        const filteredSelectedShapeIds = selectedShapeIds.filter((id: string) => {
          const shape = editor.getShape(id as TLShapeId)
          if (!shape) return false
          const isGenPreview = shape.meta?.isGeneratorPreview
          return !isArrayClone(shape) && !isGenPreview
        })
        
        if (selectedShapeIds.length !== filteredSelectedShapeIds.length) {
          editor.setSelectedShapes(filteredSelectedShapeIds)
        }
      }
    )

    // Return cleanup function
    return () => {
      cleanupKeepArrayClonesLocked()
      cleanupSelection()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw 
        components={components}
        shapeUtils={[ConfiguredDrawShapeUtil, SineWaveShapeUtil]}
        tools={[SineWaveShapeTool]}
        assetUrls={assetUrls}
        overrides={uiOverrides}
        options={editorOptions}
        onMount={handleMount}
      >
        <ModifierOverlay />
        <GeneratorEngine />
      </Tldraw>
    </div>
  )
}
