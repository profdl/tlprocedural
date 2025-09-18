import { 
  Tldraw, 
  type TLShape,
  type TldrawOptions,
  type Editor,
  type TLShapeId,
  type TLUiToolsContextType,
  type TLUiToolItem,
  useEditor,
  useIsDarkMode,
  useValue,
  approximately
} from 'tldraw'
import type { TLComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { useMemo, useLayoutEffect, useRef } from 'react'
import { CustomStylePanel } from './CustomStylePanel'
import { CustomToolbar } from './CustomToolbar'
import { ModifierOverlay } from './ModifierRenderer'
import { isArrayClone } from './modifiers/utils'
import { useModifierStore } from '../store/modifierStore'
import { BezierEditModeService } from './shapes/services/BezierEditModeService'

import { SineWaveShapeUtil } from './shapes/SineWaveShape'
import { SineWaveShapeTool } from './shapes/SineWaveTool'
import { TriangleShapeUtil } from './shapes/TriangleShape'
import { TriangleTool } from './shapes/TriangleTool'
import { PolygonShapeUtil } from './shapes/PolygonShape'
import { PolygonTool } from './shapes/PolygonTool'
import { CircleShapeUtil } from './shapes/CircleShape'
import { CircleTool } from './shapes/CircleTool'
import { LineShapeUtil } from './shapes/LineShape'
import { LineTool } from './shapes/tools/LineTool'
import { DrawShapeUtil as CustomDrawShapeUtil } from './shapes/DrawShape'
import { DrawTool as CustomDrawTool } from './shapes/tools/DrawTool'
import { BezierShapeUtil } from './shapes/BezierShape'
import { BezierTool } from './shapes/tools/BezierTool'
import { RemovePointTool } from './shapes/tools/RemovePointTool'
import { CustomArrowShapeUtil } from './shapes/ArrowShape'
import { CustomArrowTool } from './shapes/ArrowTool'

// Using only custom shapes - no native tldraw shapes

// Custom Grid Component inspired by cuttle.xyz
const CuttleGrid = (camera: { x: number; y: number; z: number }) => {
  const editor = useEditor()

  const screenBounds = useValue('screenBounds', () => editor.getViewportScreenBounds(), [])
  const devicePixelRatio = useValue('dpr', () => editor.getInstanceState().devicePixelRatio, [])
  const isGridMode = useValue('isGridMode', () => editor.getInstanceState().isGridMode, [])
  const isDarkMode = useIsDarkMode()

  // Use a default visual grid size for display, independent of snap calculations
  const visualGridSize = 10

  const canvas = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    if (!canvas.current || !isGridMode) return
    
    const canvasW = screenBounds.w * devicePixelRatio
    const canvasH = screenBounds.h * devicePixelRatio
    canvas.current.width = canvasW
    canvas.current.height = canvasH

    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasW, canvasH)

    const pageViewportBounds = editor.getViewportPageBounds()

    const startPageX = Math.ceil(pageViewportBounds.minX / visualGridSize) * visualGridSize
    const startPageY = Math.ceil(pageViewportBounds.minY / visualGridSize) * visualGridSize
    const endPageX = Math.floor(pageViewportBounds.maxX / visualGridSize) * visualGridSize
    const endPageY = Math.floor(pageViewportBounds.maxY / visualGridSize) * visualGridSize
    const numRows = Math.round((endPageY - startPageY) / visualGridSize)
    const numCols = Math.round((endPageX - startPageX) / visualGridSize)

    // Colors for cuttle.xyz style grid
    const minorLineColor = isDarkMode ? '#333' : '#f0f0f0'
    const majorLineColor = isDarkMode ? '#555' : '#ddd'
    const axisLineColor = isDarkMode ? '#777' : '#aaa'

    // Draw minor grid lines (every grid unit)
    ctx.strokeStyle = minorLineColor
    ctx.lineWidth = 1

    for (let row = 0; row <= numRows; row++) {
      const pageY = startPageY + row * visualGridSize
      const canvasY = (pageY + camera.y) * camera.z * devicePixelRatio

      ctx.beginPath()
      ctx.moveTo(0, canvasY)
      ctx.lineTo(canvasW, canvasY)
      ctx.stroke()
    }

    for (let col = 0; col <= numCols; col++) {
      const pageX = startPageX + col * visualGridSize
      const canvasX = (pageX + camera.x) * camera.z * devicePixelRatio

      ctx.beginPath()
      ctx.moveTo(canvasX, 0)
      ctx.lineTo(canvasX, canvasH)
      ctx.stroke()
    }

    // Draw major grid lines (every 10 grid units)
    ctx.strokeStyle = majorLineColor
    ctx.lineWidth = 1

    for (let row = 0; row <= numRows; row++) {
      const pageY = startPageY + row * visualGridSize
      if (approximately(pageY % (visualGridSize * 10), 0)) {
        const canvasY = (pageY + camera.y) * camera.z * devicePixelRatio

        ctx.beginPath()
        ctx.moveTo(0, canvasY)
        ctx.lineTo(canvasW, canvasY)
        ctx.stroke()
      }
    }

    for (let col = 0; col <= numCols; col++) {
      const pageX = startPageX + col * visualGridSize
      if (approximately(pageX % (visualGridSize * 10), 0)) {
        const canvasX = (pageX + camera.x) * camera.z * devicePixelRatio

        ctx.beginPath()
        ctx.moveTo(canvasX, 0)
        ctx.lineTo(canvasX, canvasH)
        ctx.stroke()
      }
    }

    // Draw center axis lines at origin (0,0) - darker than major lines
    ctx.strokeStyle = axisLineColor
    ctx.lineWidth = 2

    // Draw X-axis (horizontal line at Y=0 in page space)
    const originCanvasY = (0 + camera.y) * camera.z * devicePixelRatio
    if (originCanvasY >= 0 && originCanvasY <= canvasH) {
      ctx.beginPath()
      ctx.moveTo(0, originCanvasY)
      ctx.lineTo(canvasW, originCanvasY)
      ctx.stroke()
    }

    // Draw Y-axis (vertical line at X=0 in page space)
    const originCanvasX = (0 + camera.x) * camera.z * devicePixelRatio
    if (originCanvasX >= 0 && originCanvasX <= canvasW) {
      ctx.beginPath()
      ctx.moveTo(originCanvasX, 0)
      ctx.lineTo(originCanvasX, canvasH)
      ctx.stroke()
    }

  }, [screenBounds, camera, visualGridSize, devicePixelRatio, editor, isDarkMode, isGridMode])

  return <canvas className="tl-grid" ref={canvas} />
}

const components: TLComponents = {
  StylePanel: CustomStylePanel,
  Toolbar: CustomToolbar,
  Grid: CuttleGrid,
  SnapIndicator: null, // Disable built-in snap indicators
  SnapLine: null, // Disable snap lines to fully prevent automatic grid snapping
}

// Helper function to create SVG data URLs for Lucide icons
const createIconDataUrl = (iconSvg: string) => {
  const svgString = iconSvg
    .replace(/stroke="currentColor"/g, 'stroke="black"')
    .replace(/fill="currentColor"/g, 'fill="black"')
  return `data:image/svg+xml;base64,${btoa(svgString)}`
}

// SVG strings for Lucide icons (16x16)
const lucideIcons = {
  mousePointer: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>',
  hand: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
  zoomIn: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>',
  circle: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
  pentagon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.7c-.7.5-1 1.4-.7 2.2l2.8 8.7c.3.8 1 1.4 1.9 1.4h9c.9 0 1.6-.6 1.9-1.4l2.8-8.7c.3-.8 0-1.7-.7-2.2L12 2.2c-.7-.5-1.7-.5-2.4 0Z"/></svg>',
  triangle: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>',
  minus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
  penTool: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/><path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/></svg>',
  pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  waves: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
  spline: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/></svg>',
  arrow: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  removePoint: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><circle cx="12" cy="12" r="9"/></svg>'
}

// Provide UI tool items for custom shapes so they appear in the toolbar
const uiOverrides = {
  tools(editor: Editor, tools: TLUiToolsContextType): TLUiToolsContextType {
    const newTools = { ...tools }
    
    // Override default tool icons with Lucide icons
    if (newTools['select']) {
      newTools['select'] = { ...newTools['select'], icon: 'tool-select' }
    }
    if (newTools['hand']) {
      newTools['hand'] = { ...newTools['hand'], icon: 'tool-hand' }
    }
    if (newTools['zoom']) {
      newTools['zoom'] = { ...newTools['zoom'], icon: 'tool-zoom' }
    }
    
    newTools['sine-wave'] = {
      id: 'sine-wave',
      label: 'Sine Wave',
      icon: 'tool-sine-wave',
      kbd: 'y',
      onSelect: () => editor.setCurrentTool('sine-wave'),
    } as TLUiToolItem
    
    newTools['triangle'] = {
      id: 'triangle',
      label: 'Triangle',
      icon: 'tool-triangle',
      kbd: 'r',
      onSelect: () => editor.setCurrentTool('triangle'),
    } as TLUiToolItem
    
    newTools['polygon'] = {
      id: 'polygon',
      label: 'Polygon',
      icon: 'tool-polygon',
      kbd: 'p',
      onSelect: () => editor.setCurrentTool('polygon'),
    } as TLUiToolItem
    
    newTools['circle'] = {
      id: 'circle',
      label: 'Circle',
      icon: 'tool-circle',
      kbd: 'c',
      onSelect: () => editor.setCurrentTool('circle'),
    } as TLUiToolItem
    
    newTools['custom-line'] = {
      id: 'custom-line',
      label: 'Line',
      icon: 'tool-line',
      kbd: 'l',
      onSelect: () => editor.setCurrentTool('custom-line'),
    } as TLUiToolItem
    
    newTools['custom-draw'] = {
      id: 'custom-draw',
      label: 'Draw',
      icon: 'tool-draw',
      kbd: 'd',
      onSelect: () => editor.setCurrentTool('custom-draw'),
    } as TLUiToolItem
    
    newTools['bezier'] = {
      id: 'bezier',
      label: 'Pen',
      icon: 'tool-bezier',
      kbd: 'b',
      onSelect: () => editor.setCurrentTool('bezier'),
    } as TLUiToolItem
    
    newTools['remove-point'] = {
      id: 'remove-point',
      label: 'Remove Point',
      icon: 'tool-remove-point',
      kbd: '-',
      onSelect: () => editor.setCurrentTool('remove-point'),
    } as TLUiToolItem
    
    newTools['custom-arrow'] = {
      id: 'custom-arrow',
      label: 'Arrow',
      icon: 'tool-arrow',
      kbd: 'a',
      onSelect: () => editor.setCurrentTool('custom-arrow'),
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
  const modifierStore = useModifierStore()

  // Create custom asset URLs using memoization to prevent recreation on every render
  const customAssetUrls = useMemo(() => ({
    icons: {
      'tool-select': createIconDataUrl(lucideIcons.mousePointer),
      'tool-hand': createIconDataUrl(lucideIcons.hand),
      'tool-zoom': createIconDataUrl(lucideIcons.zoomIn),
      'tool-circle': createIconDataUrl(lucideIcons.circle),
      'tool-polygon': createIconDataUrl(lucideIcons.pentagon),
      'tool-triangle': createIconDataUrl(lucideIcons.triangle),
      'tool-line': createIconDataUrl(lucideIcons.minus),
      'tool-draw': createIconDataUrl(lucideIcons.pencil),
      'tool-bezier': createIconDataUrl(lucideIcons.penTool),
      'tool-remove-point': createIconDataUrl(lucideIcons.removePoint),
      'tool-sine-wave': createIconDataUrl(lucideIcons.waves),
      'tool-arrow': createIconDataUrl(lucideIcons.arrow),
    }
  }), [])
  const handleMount = (editor: Editor) => {
    // Connect the editor to the modifier store
    modifierStore.setEditor(editor)

    // Separate grid visibility from snapping behavior
    // Grid visibility is controlled by the isGridMode preference (shows/hides our CuttleGrid)
    // Snapping is controlled by the isSnapMode user preference
    // We need to prevent TLDraw's built-in grid-snap coupling by managing gridSize dynamically

    // Core insight: TLDraw uses document.gridSize for internal snap calculations
    // Setting gridSize to 0 disables internal grid snapping while preserving grid visibility
    const DEFAULT_GRID_SIZE = 10

    const updateGridSnapBehavior = () => {
      const isGridMode = editor.getInstanceState().isGridMode
      const isSnapMode = editor.user.getUserPreferences().isSnapMode

      // Logic for grid size based on grid mode and snap preferences:
      // - Grid visible + Snap enabled: use default gridSize for snapping
      // - Grid visible + Snap disabled: use very small gridSize to prevent division by zero
      // - Grid hidden: gridSize doesn't matter for snapping, but keep it consistent
      const shouldEnableGridSnapping = isGridMode && isSnapMode
      const targetGridSize = shouldEnableGridSnapping ? DEFAULT_GRID_SIZE : 0.001

      // Only update if necessary to avoid unnecessary renders
      const currentGridSize = editor.getDocumentSettings().gridSize
      if (currentGridSize !== targetGridSize) {
        editor.updateDocumentSettings({ gridSize: targetGridSize })
      }
    }

    // Set up listener for instance state changes (grid mode changes)
    const cleanupGridModeListener = editor.store.listen((entry) => {
      // Check if instance state changed (includes isGridMode)
      const hasInstanceChange = Object.keys(entry.changes.updated).some(key =>
        key.includes('instance') || entry.changes.added[key] || entry.changes.removed[key]
      )
      if (hasInstanceChange) {
        updateGridSnapBehavior()
      }
    })

    // Set up listener for user preference changes (snap mode changes)
    // TLDraw doesn't expose a direct way to listen to user preference changes,
    // so we'll use a polling approach or side effect handler
    const cleanupUserPrefListener = editor.sideEffects.registerAfterChangeHandler(
      'instance',
      () => {
        // This gets called on instance changes, we can check if we need to update
        updateGridSnapBehavior()
      }
    )

    // Set default grid and snap preferences
    editor.updateInstanceState({ isGridMode: true })
    editor.user.updateUserPreferences({ isSnapMode: false })

    // Initial setup
    updateGridSnapBehavior()

    const cleanupSnapControl = () => {
      cleanupGridModeListener()
      cleanupUserPrefListener()
    }

    // Center the view on the origin (0,0)
    editor.zoomToFit()
    editor.resetZoom()
    const viewportBounds = editor.getViewportScreenBounds()
    editor.setCamera({
      x: viewportBounds.w / 2,
      y: viewportBounds.h / 2,
      z: editor.getCamera().z
    })
    
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

    // Register delete handler to prevent shape deletion in bezier edit mode
    const cleanupDeleteHandler = editor.sideEffects.registerBeforeDeleteHandler('shape', (shape) => {
      // Check if this is a bezier shape in edit mode
      if (shape.type === 'bezier' && 'editMode' in shape.props && shape.props.editMode) {
        // Return false to prevent deletion
        return false
      }
      // Allow deletion for all other shapes
      return
    })

    // Prevent array clones from being selected by select-all
    const cleanupSelection = editor.sideEffects.registerAfterCreateHandler(
      'shape',
      () => {
        const selectedShapeIds = editor.getSelectedShapeIds()
        const filteredSelectedShapeIds = selectedShapeIds.filter((id: string) => {
          const shape = editor.getShape(id as TLShapeId)
          if (!shape) return false
          return !isArrayClone(shape)
        })
        
        if (selectedShapeIds.length !== filteredSelectedShapeIds.length) {
          editor.setSelectedShapes(filteredSelectedShapeIds)
        }
      }
    )

    // Initialize the Bezier Edit Mode Service to handle complex edit mode interactions
    // This replaces the previously complex inline logic with a clean service pattern
    const bezierEditModeService = new BezierEditModeService(editor)

    // Return cleanup function
    return () => {
      cleanupKeepArrayClonesLocked()
      cleanupDeleteHandler()
      cleanupSelection()
      cleanupSnapControl()
      bezierEditModeService.destroy()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw 
        components={components}
        shapeUtils={[
          SineWaveShapeUtil, 
          TriangleShapeUtil, 
          PolygonShapeUtil, 
          CircleShapeUtil, 
          LineShapeUtil, 
          CustomDrawShapeUtil, 
          BezierShapeUtil,
          CustomArrowShapeUtil
        ]}
        tools={[
          SineWaveShapeTool, 
          TriangleTool, 
          PolygonTool, 
          CircleTool, 
          LineTool, 
          CustomDrawTool, 
          BezierTool,
          RemovePointTool,
          CustomArrowTool
        ]}
        overrides={uiOverrides}
        options={editorOptions}
        assetUrls={customAssetUrls}
        onMount={handleMount}
      >
        <ModifierOverlay />
      </Tldraw>
    </div>
  )
}
