# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server (Vite)
npm run build        # Build for production (tsc + vite build)
npm run preview      # Preview production build
npm run lint         # Run ESLint

# Development server runs on http://localhost:5173
```

## Project Architecture

This is a **TLDraw-based procedural shape manipulation app** built with React + TypeScript + Vite + Zustand.

### Core Architecture

**State Management**: Uses **Zustand** with subscriptions for all modifier state
- `useModifierStore` - Central store for all modifier data and operations
- Store includes CRUD operations, reordering, import/export functionality

**Modifier System**: Advanced shape transformation pipeline
- **ModifierStack** - Processes multiple modifiers in sequence on shapes
- **Processors** - Individual modifier implementations (LinearArray, CircularArray, GridArray, Mirror, LSystem)
- **ShapeState** - Immutable state passed between processors containing shape instances and transforms
- **GroupContext** - Special processing context for grouped shapes

**Shape Processing Flow**:
1. Original shape → ShapeState (with single instance)
2. Each enabled modifier processes ShapeState sequentially
3. Each processor creates new instances (e.g., LinearArray creates `count` instances including index 0)
4. Final ShapeState contains all transformed instances for rendering
5. useCloneManager hides original shape (opacity=0) and creates visible clones
6. Clones are created with rotation=0, then rotated using `editor.rotateShapesBy()`

### Key Files

**State Management**:
- `src/store/modifierStore.ts` - Zustand store with all modifier operations
- `src/types/modifiers.ts` - Complete type definitions for all modifier types

**Core Processing**:
- `src/store/modifiers/core/ModifierStack.ts` - Main processing orchestrator
- `src/store/modifiers/processors/` - Individual modifier processors
- `src/store/modifiers/core/ShapeStateManager.ts` - Shape state utilities

**UI Components**:
- `src/components/TldrawCanvas.tsx` - Main tldraw integration
- `src/components/ModifierRenderer.tsx` - Renders modifier effects 
- `src/components/modifiers/ModifierControls.tsx` - Main modifier UI
- `src/components/CustomStylePanel.tsx` - Right sidebar with modifiers tab
- `src/components/modifiers/hooks/useCloneManager.ts` - Manages clone creation/cleanup and original shape hiding
- `src/components/modifiers/hooks/useStackedModifier.ts` - Processes modifier stack for shapes

### Modifier Types

1. **Linear Array** - Creates copies in a straight line with offset/rotation/scaling
2. **Circular Array** - Arranges copies in circular patterns with radius/angle controls
3. **Grid Array** - Creates rectangular grids with row/column spacing
4. **Mirror** - Creates mirrored copies along axes
5. **L-System** - Fractal generation using L-system rules

### Group Processing

The system has special handling for grouped shapes:
- Detects when shapes are part of a group using `findTopLevelGroup()`
- Processes all shapes in the group together with shared context
- Uses `GroupContext` to maintain group bounds and positioning
- Calculates group bounds from child shapes, not the group container

### Important Implementation Notes

- Modifiers process **ShapeState** objects, not raw TLDraw shapes
- Multiple modifiers compound - each processes the output of the previous
- Group modifiers work on all shapes in a group simultaneously
- The system uses coordinate transforms rather than direct shape manipulation
- All processors are stateless and functional
- **Original Shape Hiding**: When modifiers are active, the original shape is hidden (opacity=0) to prevent "double" rendering
- **Clone Management**: useCloneManager creates/destroys clones and manages original shape visibility
- **Rotation Handling**: All rotations use `editor.rotateShapesBy()` for center-based rotation, never direct rotation property assignment

## TLDraw Integration

Uses TLDraw 3.x with:
- Custom shape tools and rendering
- Programmatic shape creation and manipulation
- Custom UI panel integration
- Editor state management for modifier updates

### TLDraw Documentation References

For TLDraw-specific development, reference these included documentation files:
- `@tldraw-sdk.txt` - Complete TLDraw SDK documentation including:
  - Editor API and methods (`Editor.createShapes`, `Editor.updateShapes`, etc.)
  - Shape utilities and custom shape creation
  - Tools and state chart system
  - Camera controls and coordinate systems
  - Persistence and store management
  - User interface customization
  - Asset handling and exports

- `@tldraw-examples.txt` - Comprehensive examples covering:
  - Basic Tldraw component usage
  - Configuration options (camera, shapes, assets)
  - Custom shapes and tools implementation
  - Editor API usage patterns
  - State management and persistence
  - UI customization and overrides

**Key TLDraw Concepts**:
- **Editor** - Main god object for canvas control (`editor.createShapes()`, `editor.select()`, etc.)
- **ShapeUtils** - Classes that define shape behavior and rendering
- **Tools** - State nodes that handle user interactions
- **Store** - Reactive data store containing all canvas state
- **Components** - Customizable UI elements and canvas components

**Common TLDraw Patterns in this project**:
- Use `editor.createShapes()` for programmatic shape creation
- Access shape data via `editor.getShape()` and `editor.getSelectedShapes()`
- Custom tools extend `StateNode` for interaction handling
- Shape state changes trigger modifier processing via store subscriptions

## Development Status & Known Issues

⚠️ **This project is actively under development** - The modifier system and custom shapes are experimental and contain numerous bugs and incomplete features.

### Current State
- **Modifier System**: Core architecture is functional but has stability issues
- **Custom Shapes**: Several custom shape tools are implemented but may not work reliably
- **Group Processing**: Group modifier support is partially implemented with edge cases
- **UI/UX**: Modifier controls UI is functional but needs refinement
- **Performance**: Complex modifier stacks may cause performance issues

### Known Issue Areas
- **Shape State Synchronization**: Modifiers may not always sync correctly with TLDraw's store
- **Group Bounds Calculation**: Group processing sometimes calculates incorrect bounds
- **Modifier Ordering**: Reordering modifiers can cause unexpected results
- **Memory Leaks**: Store subscriptions may not always clean up properly
- **Type Safety**: Some modifier type definitions may be incomplete
- **Error Handling**: Limited error handling in modifier processing pipeline

### Recent Fixes
- **Linear Array Extra Clone**: Fixed issue where LinearArrayProcessor created extra untransformed clones by properly hiding original shape when modifiers are active
- **Clone Rotation**: Ensured all clones use `editor.rotateShapesBy()` for proper center-based rotation
- **Rotated Shape Positioning**: Fixed clone positioning when original shape is rotated by calculating from visual center using `editor.getShapePageBounds()` instead of top-left corner

### Development Priorities
1. **Stabilize Core Modifier System** - Fix shape state synchronization issues
2. **Improve Group Processing** - Resolve group bounds and context issues  
3. **Enhanced Error Handling** - Add comprehensive error boundaries and logging
4. **Performance Optimization** - Optimize modifier processing for complex stacks
5. **UI Polish** - Improve modifier controls and user experience
6. **Documentation** - Add inline documentation for complex modifier logic

**When working on this codebase**: Expect to encounter bugs, incomplete features, and areas needing significant refactoring. Always test modifier combinations thoroughly and be prepared to debug complex state synchronization issues.

## TLDraw Shape Transforms & Coordinates

Understanding TLDraw's coordinate system and shape transforms is **critical** for the modifier system. The modifier processors must work correctly with TLDraw's transform model.

### Key TLDraw Shape Properties

**Base Transform Properties** (every shape has these):
- `x, y` - Shape position in parent space (NOT screen coordinates)
- `rotation` - Rotation in radians around shape's origin point  
- `opacity` - Shape transparency (0-1)
- Shape dimensions in `props` (e.g., `w`, `h` for width/height)

**Shape Origins & Positioning**:
- Shapes are positioned by their **top-left corner** by default
- The `x, y` coordinates are in "parent space" (page coordinates for top-level shapes)
- Shape rotation happens around the shape's geometric center, not the x,y position

### Critical TLDraw Methods for Modifier System

**Getting Shape Geometry & Transforms**:
```typescript
// Get shape's geometry bounds in local coordinates
editor.getShapeGeometry(shape).bounds  // Rectangle2d bounds

// Get shape's page-space bounding box  
editor.getShapePageBounds(shapeId)     // Box in page coordinates

// Get shape's complete page transform matrix
editor.getShapePageTransform(shapeId)  // Matrix transform
```

**Coordinate Space Conversions**:
```typescript
// Convert point from shape's local space to page space
editor.getShapePageTransform(shapeId).applyToPoint(localPoint)

// Convert point from page space to shape's local space  
editor.getPointInShapeSpace(shapeId, pagePoint)

// Convert between parent space and shape space
editor.getPointInParentSpace(shapeId, pointInShapeSpace)
```

### TLDraw Coordinate Spaces

1. **Screen Space** - Pixel coordinates relative to the canvas viewport
2. **Page Space** - Coordinates on the infinite canvas (unaffected by camera zoom/pan)
3. **Parent Space** - Coordinates relative to a shape's parent (page for top-level shapes)
4. **Shape/Local Space** - Coordinates relative to the shape's origin (0,0 at top-left)

### Transform Matrix Application

TLDraw uses 2D transformation matrices for all shape positioning:
```typescript
// Getting and applying transforms
const transform = editor.getShapePageTransform(shapeId)
// Matrix contains: translation, rotation, and scale in one transform
// Use transform.applyToPoint(point) to transform coordinates
```

### TLDraw Rotation System

**Critical Understanding**: TLDraw has two different rotation behaviors:

1. **Direct `rotation` property assignment**: Rotates around shape's top-left corner (origin) - **NOT USED IN THIS CODEBASE**
2. **`editor.rotateShapesBy()` method**: Rotates around shape's center (like transform handles) - **THIS IS THE ONLY METHOD WE USE**

**The Problem with Manual Rotation**:
```typescript
// ❌ NEVER DO THIS - rotates around top-left corner (not what users expect)
const shape = { ...originalShape, rotation: Math.PI / 4 }
editor.updateShape(shape)

// ✅ ALWAYS DO THIS - rotates around center (matches UI behavior)
editor.rotateShapesBy([shapeId], Math.PI / 4)
```

**Our Rotation Approach**:
```typescript
// Create shapes without rotation
const shapes = [{ ...shapeData, rotation: 0 }]
editor.createShapes(shapes)

// Then rotate around center using TLDraw's API
const shapeIds = shapes.map(s => s.id)
editor.rotateShapesBy(shapeIds, rotationInRadians)
```

**Implementation in Modifiers**:
- All modifier processors store rotation values in their transforms
- The `useCloneManager` hook creates shapes with `rotation: 0`
- After creation, it applies the stored rotation using `editor.rotateShapesBy()`
- This ensures all rotations are center-based, matching user expectations

### Important TLDraw Shape Constraints

**No Negative Scaling**: 
- TLDraw does not support negative scale values
- Flipping is handled through separate flip operations, not negative scale
- Use `editor.flipShapes()` for shape flipping operations

**Shape Bounds vs Geometry**:
- `getShapePageBounds()` - Axis-aligned bounding box in page space
- `getShapeGeometry().bounds` - Local geometry bounds (may be rotated)
- Always use appropriate method for your coordinate space needs

### Critical Pattern: Handling Rotated Shapes in Modifiers

**When calculating positions for clones of rotated shapes**:
```typescript
// ✅ CORRECT - Calculate from visual center for rotated shapes
const shapeRotation = originalShape.rotation || 0
if (editor && shapeRotation !== 0) {
  const bounds = editor.getShapePageBounds(originalShape.id)
  if (bounds) {
    // Use the center of the rotated shape
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    // Calculate clone positions from this center
    // Then convert back to top-left for positioning
  }
}

// ❌ WRONG - Using top-left corner directly
const x = originalShape.x + offset // This moves when shape rotates!
```

**This pattern is critical because**:
- When a shape rotates, its `x, y` (top-left corner) position changes
- Calculating clone positions from the moving top-left causes incorrect positioning
- Using the visual center (from `getShapePageBounds`) provides stable reference point
- All array processors (Linear, Circular, Grid) must follow this pattern

### Modifier System Implications

**Critical for modifier processors**:
1. **Coordinate Consistency**: Modifiers must maintain correct coordinate spaces
2. **Transform Composition**: Multiple modifiers create compound transforms
3. **Group Bounds**: Group shapes have special bounds calculation rules
4. **Performance**: Avoid unnecessary coordinate space conversions
5. **Rotated Shape Handling**: Always calculate from visual center for rotated shapes

**Common Pitfalls**:
- Mixing coordinate spaces (e.g., applying page coordinates as local coordinates)
- Not accounting for shape rotation when calculating positions  
- Using screen coordinates instead of page coordinates for shape manipulation
- Attempting negative scaling (use flipping operations instead)

**Best Practices for Modifier Development**:
- Always work in consistent coordinate space (preferably page space)
- Use TLDraw's transform methods rather than manual coordinate calculations
- **For rotation**: ALWAYS use `editor.rotateShapesBy()` for center-based rotation
- **For positioning**: When shape is rotated, use `editor.getShapePageBounds()` to get visual center
- Test with rotated shapes and nested groups
- Account for different shape types having different origin behaviors
- Prefer TLDraw's built-in APIs (`getShapePageBounds`, `getShapePageTransform`) over manual calculations
- All position calculation functions in `transformUtils.ts` must handle rotated shapes correctly