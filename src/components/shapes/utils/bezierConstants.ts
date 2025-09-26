/**
 * Configuration constants for the Bezier shape system
 */

// Debug mode - set to true to enable console logging
export const BEZIER_DEBUG = false

// Interaction thresholds (in pixels, will be scaled by zoom level)
export const BEZIER_THRESHOLDS = {
  // Point selection/hover detection
  ANCHOR_POINT: 5,
  ANCHOR_POINT_HOVER: 7,
  CONTROL_POINT: 5,
  
  // Segment interaction
  SEGMENT_HOVER: 8,
  SEGMENT_CLICK: 10,
  PATH_SEGMENT: 10,
  SEGMENT_ANCHOR_EXCLUSION: 12, // Don't show segment hover near anchors
  
  // Snap behavior for closing curves
  SNAP_TO_START: 12,
  SNAP_RELEASE: 15,
  CLOSE_CURVE: 10,
  
  // Drag behavior
  CORNER_POINT_DRAG: 3, // Pixels before creating control points
  
  // Visual sizes
  ANCHOR_RADIUS: 2.4,
  ANCHOR_RADIUS_SELECTED: 4,
  CONTROL_RADIUS: 2.2,
  CONTROL_RADIUS_SELECTED: 3.2,
  HOVER_PREVIEW_RADIUS: 2.4,
  HOVER_PREVIEW_RING: 5,
} as const

// Visual styles
export const BEZIER_STYLES = {
  // Colors
  CONTROL_LINE_COLOR: '#34a0ff',
  CONTROL_POINT_STROKE: '#34a0ff',
  CONTROL_POINT_FILL: 'white',
  CONTROL_POINT_FILL_SELECTED: '#34a0ff',
  CONTROL_POINT_STROKE_SELECTED: '#ffffff',
  ANCHOR_POINT_FILL: 'white',
  ANCHOR_POINT_STROKE: '#34a0ff',
  ANCHOR_POINT_FILL_SELECTED: '#34a0ff',
  ANCHOR_POINT_STROKE_SELECTED: '#ffffff',
  HOVER_PREVIEW_COLOR: '#00ff88',
  
  // Stroke styles
  CONTROL_LINE_WIDTH: 1.5,
  CONTROL_LINE_DASH: '2 2',
  EDIT_MODE_DASH: '5 3',
  EDIT_MODE_OPACITY: 0.7,
  CONTROL_OPACITY: 0.8,
  HOVER_OPACITY: 0.9,
  HOVER_RING_OPACITY: 0.4,
  SEGMENT_HIGHLIGHT_COLOR: '#ff9800',
  SEGMENT_HIGHLIGHT_WIDTH: 3,
  SEGMENT_HIGHLIGHT_OPACITY: 0.9,
  SEGMENT_HIGHLIGHT_DASH: 'none',
  
  // Stroke widths
  ANCHOR_STROKE: 1.4,
  ANCHOR_STROKE_SELECTED: 0,
  CONTROL_STROKE: 0.9,
  CONTROL_STROKE_SELECTED: 0,
  HOVER_PREVIEW_STROKE: 1.2,
  HOVER_RING_STROKE: 1,
} as const

// Handle generation
export const BEZIER_HANDLES = {
  DEFAULT_CONTROL_OFFSET: 100, // Default distance for new control points
  CONTROL_POINT_SCALE: 0.3, // Scale factor for auto-generated control points
  
  // Handle length calculation
  SEGMENT_HANDLE_LENGTH: 0.15, // 15% of segment length for balanced handles
} as const

// Utility functions for debug logging
export function bezierLog(category: string, ...args: unknown[]) {
  if (BEZIER_DEBUG) {
    console.log(`[Bezier:${category}]`, ...args)
  }
}

export function bezierWarn(category: string, ...args: unknown[]) {
  if (BEZIER_DEBUG) {
    console.warn(`[Bezier:${category}]`, ...args)
  }
}
