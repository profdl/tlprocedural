# Bezier Path Tool - Developer Reference

## Overview

This document outlines the bezier path functionality implemented in the TLDraw-based procedural shape manipulation app. The bezier tool provides a professional-grade pen tool similar to Adobe Illustrator for creating and editing bezier curves.

## Architecture

### Core Components

#### 1. BezierTool (`src/components/shapes/tools/BezierTool.ts`)
- Main state machine coordinator for bezier tool
- **States**: `idle`, `creating`, `editing`
- **Shape Type**: `bezier`
- **Lockable**: No (allows creation while other tools are locked)

#### 2. BezierShape (`src/components/shapes/BezierShape.tsx`)
- **Shape Definition**: Defines the bezier shape type and its properties
- **Rendering**: Handles SVG path generation and visual representation
- **Edit Mode UI**: Renders control points, handles, and interactive elements
- **Bounds Calculation**: Accurate bounds using bezier mathematics
- **Handle Management**: TLDraw handles for interactive point manipulation

#### 3. State Nodes

**BezierIdle** (`src/components/shapes/tools/states/BezierIdle.ts`)
- Initial state when bezier tool is selected
- Handles tool activation and transitions

**BezierCreating** (`src/components/shapes/tools/states/BezierCreating.ts`)
- Path creation state
- Point placement and handle generation
- Curve closing logic with snap detection

**BezierEditing** (`src/components/shapes/tools/states/BezierEditing.ts`)
- Edit mode interactions
- Point selection, deletion, and type changes
- Handle dragging and curve modification

## Bezier Point Data Structure

```typescript
export interface BezierPoint {
  x: number
  y: number
  cp1?: { x: number; y: number } // Control point 1 (incoming)
  cp2?: { x: number; y: number } // Control point 2 (outgoing)
}
```

### Point Types
- **Corner Point**: No control points (`cp1` and `cp2` are undefined)
- **Smooth Point**: Both control points present, creating curved segments
- **Asymmetric Point**: Control points can be manipulated independently (Alt key during creation/editing)

## Working Features

### ✅ Pen Tool Creation
- **Click to place points**: Creates bezier path points
- **Click + Drag**: Creates curved points with control handles
- **Modifier Keys**:
  - `Alt`: Creates asymmetric handles (only outgoing for new points)
  - `Shift`: Constrains handle angles to 45° increments
- **Path Closing**: 
  - Click near first point to close path (creates closed shape)
  - Automatic snap detection with visual feedback
  - `C` key to close path
- **Completion**:
  - `Enter` or double-click to complete open path
  - `Escape` to cancel creation

### ✅ Edit Mode (Double-click to enter)
- **Point Selection**:
  - Single-click to select individual points
  - `Shift + click` to multi-select points
  - Selected points highlighted in blue
- **Point Deletion**:
  - Select points and press `Delete` or `Backspace`
  - Maintains minimum 2 points per path
- **Point Type Toggle**:
  - **Double-click point** to toggle between corner and smooth
  - Corner → Smooth: Adds symmetric control handles
  - Smooth → Corner: Removes all control handles
- **Handle Manipulation**:
  - Drag control point handles to adjust curves
  - Default: Symmetric handle behavior (mirrored)
  - `Alt + drag`: Break symmetry for asymmetric handles
- **Point Movement**:
  - Drag anchor points to reposition
  - Control handles move with anchor points

### ✅ Visual Feedback
- **Edit Mode Indicators**:
  - Dashed stroke outline
  - Blue control point handles and connection lines
  - Orange hover preview for point addition
  - Selected points highlighted in blue
- **Creation Mode**:
  - Real-time curve preview
  - Snap zone visualization when approaching start point

### ✅ Shape Integration
- **Transform Controls**: Resize, rotate, and move when not in edit mode
- **Bounds Calculation**: Accurate bounds including control points
- **Flip Operations**: Proper coordinate flipping for bezier points
- **Style Properties**: Color, stroke width, fill (for closed paths)

## Known Issues & Limitations

### ⚠️ Adding Points Functionality
**Status**: Not working correctly - needs refactoring

The current point addition system has architectural problems:

#### Current Implementation Problems
1. **Segment Handle System**: Uses invisible TLDraw handles on path segments
2. **Hover Preview Conflicts**: Preview system interferes with handle detection
3. **State Synchronization**: Point addition triggers during drag operations unexpectedly
4. **Performance Issues**: Continuous hover calculations affect responsiveness

#### Files Affected
- `BezierShape.tsx`: Lines 549-596 (segment handle generation)
- `BezierShape.tsx`: Lines 622-693 (onHandleDrag point addition logic)
- `BezierShape.tsx`: Lines 135-177 (hover preview system)

#### Recommended Refactoring Approach
1. **Remove Segment Handles**: Eliminate invisible TLDraw handles for point addition
2. **Direct Click Detection**: Implement click-based point addition in `BezierEditing.ts`
3. **Simplified Preview**: Use pure visual preview without handle system interference
4. **Gesture-Based Addition**: Consider alt+click or dedicated modifier for point addition

## File Structure

```
src/components/shapes/
├── BezierShape.tsx              # Main shape definition and rendering
├── tools/
│   ├── BezierTool.ts           # Tool coordinator
│   └── states/
│       ├── BezierIdle.ts       # Initial/inactive state
│       ├── BezierCreating.ts   # Path creation logic
│       └── BezierEditing.ts    # Edit mode interactions
└── utils/
    └── bezierUtils.ts          # Mathematical utilities (curves, bounds, etc.)
```

## Key Implementation Details

### Coordinate Systems
- **Page Coordinates**: Used during creation and editing
- **Shape-Local Coordinates**: Points normalized to shape bounds
- **Handle Positioning**: TLDraw handles positioned in shape-local space

### Edit Mode State Management
```typescript
// Shape properties for edit mode
editMode?: boolean                    // Enables edit UI
selectedPointIndices?: number[]       // Currently selected points
hoverPoint?: BezierPoint             // Preview point for addition
hoverSegmentIndex?: number           // Segment being hovered for addition
```

### Bounds Recalculation
- Triggered when exiting edit mode
- Uses `getAccurateBounds()` from bezierUtils
- Normalizes points to new bounds origin
- Updates shape position and dimensions

### Handle Types in TLDraw
- **vertex**: Anchor point handles (draggable points)
- **virtual**: Control point handles (bezier handles)
- **create**: Segment handles for point addition (problematic)

## Usage Examples

### Creating a Bezier Path
1. Select bezier tool from toolbar
2. Click to place first point
3. Click + drag for curved segments
4. Continue adding points
5. Click near start point to close, or Enter/double-click to complete

### Editing a Bezier Path
1. Double-click bezier shape to enter edit mode
2. Click points to select (Shift for multi-select)
3. Double-click points to toggle corner/smooth
4. Drag handles to adjust curves
5. Press Delete to remove selected points
6. Escape or Enter to exit edit mode

## Development Notes

- **Performance**: Edit mode uses requestAnimationFrame for hover detection
- **Memory Management**: Cleanup required for animation frames and event listeners
- **State Persistence**: Edit mode state maintained during tool switches
- **Keyboard Shortcuts**: Full keyboard support for creation and editing workflows
- **Integration**: Works with modifier system for array operations and transformations

## Testing Considerations

When testing bezier functionality:

1. **Creation Workflows**: Test various point placement patterns
2. **Edit Mode Transitions**: Verify state persistence and cleanup
3. **Handle Behavior**: Test symmetric/asymmetric handle manipulation
4. **Point Selection**: Test single and multi-select operations
5. **Keyboard Shortcuts**: Verify all keyboard interactions
6. **Transform Operations**: Test resize/rotate behavior
7. **Performance**: Monitor edit mode responsiveness with complex paths

**Note**: Avoid testing point addition functionality until the architectural issues are resolved.