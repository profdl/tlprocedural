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

This is a **TLDraw-based procedural shape manipulation app** built with React + TypeScript + Vite + Zustand. It is inspired by cuttle.xyz's shape-component and modifier system.

### Core Architecture

**State Management**: Uses **Zustand** with subscriptions for all modifier state

- `useModifierStore` - Central store for all modifier data and operations
- Store includes CRUD operations, reordering, import/export functionality

**Modifier System**: High-performance matrix-based transformation pipeline

- **TransformComposer** - Efficient O(n) matrix-based modifier processing using virtual instances
- **VirtualInstance** - Lightweight transform representation (no TLShape creation until materialization)
- **ModifierFactory** - Factory pattern for clean, maintainable modifier creation
- **PathModifier** - Base class for path-based modifiers (subdivide, smooth, noise-offset, simplify)
- **GroupContext** - Special processing context for grouped shapes

**Shape Processing Flow**:

1. Original shape → VirtualModifierState (single virtual instance with `modifierType: 'original'`)
2. TransformComposer processes modifiers sequentially using matrix composition
3. Each modifier creates new virtual instances mathematically (no intermediate TLShapes)
4. **Unified Composition**: When multiple instances exist from previous modifiers, they are treated as a single group entity
5. **Transform Accumulation**: Position, rotation, and scale accumulate across modifiers using metadata-first extraction
6. **Modifier Stacking Example**: LinearArray (count=3) + GridArray (2×2) = 12 total virtual instances arranged as 4 groups of 3
7. Virtual instances materialized to TLShapes only when needed (dramatic performance improvement)
8. useCloneManager hides original shape (opacity=0) and creates visible clones
9. Clones created with rotation=0, then rotated using `editor.rotateShapesBy()` for center-based rotation

### Key Files

**State Management**:

- `src/store/modifierStore.ts` - Zustand store with all modifier operations
- `src/types/modifiers.ts` - Complete type definitions for all modifier types

**Core Processing**:

- `src/store/modifiers/core/TransformComposer.ts` - Matrix-based modifier processing with virtual instances
- `src/store/modifiers/core/PathModifier.ts` - Base class for path-based modifiers
- `src/store/modifiers/processors/` - Path-based modifier implementations (subdivide, smooth, etc.)
- `src/factories/ModifierFactory.ts` - Factory pattern for modifier creation
- `src/store/modifiers/core/ShapeStateManager.ts` - Virtual state management utilities

**UI Components**:

- `src/components/TldrawCanvas.tsx` - Main tldraw integration
- `src/components/ModifierRenderer.tsx` - Renders modifier effects
- `src/components/modifiers/ModifierControls.tsx` - Main modifier UI
- `src/components/CustomStylePanel.tsx` - Right sidebar with modifiers tab
- `src/components/modifiers/hooks/useCloneManager.ts` - Manages clone creation/cleanup and original shape hiding
- `src/components/modifiers/hooks/useStackedModifier.ts` - Processes modifier stack for shapes

### Modifier Types

**Array Modifiers** (matrix-based, high performance):
1. **Linear Array** - Creates copies in a straight line with offset/rotation/scaling
2. **Circular Array** - Arranges copies in circular patterns with radius/angle controls
3. **Grid Array** - Creates rectangular grids with row/column spacing
4. **Mirror** - Creates mirrored copies along axes
5. **L-System** - Fractal generation using L-system rules

**Path Modifiers** (path-based, shape geometry modification):
6. **Subdivide** - Adds points to paths for smoother curves
7. **Noise Offset** - Adds procedural noise displacement to paths
8. **Smooth** - Smooths path corners and jagged edges
9. **Simplify** - Reduces path complexity by removing redundant points

### Group Processing

The system has special handling for grouped shapes:

- Detects when shapes are part of a group using `findTopLevelGroup()`
- Processes all shapes in the group together with shared context
- Uses `GroupContext` to maintain group bounds and positioning
- Calculates group bounds from child shapes, not the group container

### Important Implementation Notes

- **Matrix-Based Processing**: TransformComposer uses matrix composition for O(n) performance instead of O(n²) shape multiplication
- **Virtual Instances**: Lightweight VirtualInstance objects defer TLShape creation until materialization (major performance gain)
- **Factory Pattern**: ModifierFactory provides clean, maintainable modifier creation with type safety
- **Path vs Array Modifiers**: Path modifiers modify shape geometry, array modifiers create spatial arrangements
- **Compounding Behavior**: Multiple modifiers multiply their effects using unified composition - LinearArray (3) + GridArray (2×2) = 12 total virtual instances arranged as 4 groups of 3
- **Group Processing**: Group modifiers process all shapes in a group simultaneously using shared `GroupContext`
- **Transform Composition**: Uses mathematical matrix composition rather than iterative shape manipulation
- **Stateless Design**: All processors are stateless and functional for predictable behavior
- **Clone Management**: `useCloneManager` handles original shape hiding (opacity=0) and visible clone creation/cleanup
- **Rotation System**: All rotations use `editor.rotateShapesBy()` for center-based rotation (details in TLDraw section below)

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

- **Modifier System**: Recently rebuilt with matrix-based architecture for significant performance improvements
- **Array Modifiers**: High-performance virtual instance system for linear, circular, grid, mirror, and L-system modifiers
- **Path Modifiers**: New path-based modifier system for shape geometry modification (subdivide, smooth, noise, simplify)
- **Factory Pattern**: Clean modifier creation system with type safety and maintainability
- **Custom Shapes**: Several custom shape tools are implemented but may not work reliably
- **Group Processing**: Group modifier support is partially implemented with edge cases
- **UI/UX**: Modifier controls UI is functional but needs refinement
- **Performance**: Major performance improvements from virtual instance system

### Known Issue Areas

- **Path Modifier Integration**: Path-based modifiers are new and may have edge cases with complex shapes
- **Group Bounds Calculation**: Group processing sometimes calculates incorrect bounds
- **Modifier Ordering**: Reordering modifiers can cause unexpected results
- **Memory Leaks**: Store subscriptions may not always clean up properly
- **Type Safety**: Path modifier type definitions may need refinement
- **Error Handling**: Limited error handling in path modification pipeline
- **Custom Shape Support**: Path modifiers may not work with all custom shape types

### Recent Major Changes

- **Complete Architecture Rebuild**: Replaced individual processor system with matrix-based TransformComposer for O(n) performance
- **Virtual Instance System**: Introduced VirtualInstance for lightweight transform representation (no TLShape creation until needed)
- **Factory Pattern**: Implemented ModifierFactory for clean, type-safe modifier creation
- **Path Modifier System**: Added new PathModifier base class and path-based modifiers (subdivide, smooth, noise-offset, simplify)
- **Performance Optimization**: Eliminated O(n²) shape multiplication in favor of mathematical matrix composition
- **Memory Efficiency**: Virtual instances dramatically reduce memory usage for complex modifier stacks
- **Center-Based Transformations**: Implemented proper center-based rotation and scaling using TLDraw's native methods
- **Transform Architecture**: Three-phase transformation system (Virtual → Materialization → Application) for optimal performance
- **Scale Steps Fix**: Fixed Linear Array scaling to work from shape centers using `editor.resizeShape()`
- **Apply All Improvements**: Fixed rotation loss and missing first clone issues in permanent shape application

### Development Priorities

1. **Path Modifier Refinement** - Stabilize path-based modifiers and expand shape type support
2. **Improve Group Processing** - Resolve group bounds and context issues
3. **Enhanced Error Handling** - Add comprehensive error boundaries and logging for path modifications
4. **Custom Shape Integration** - Ensure path modifiers work with all custom shape types
5. **UI Polish** - Improve modifier controls and user experience
6. **Performance Monitoring** - Add metrics to validate performance improvements from virtual instance system
7. **Documentation** - Update documentation for new architecture and path modifier system

**When working on this codebase**: Expect to encounter bugs, incomplete features, and areas needing significant refactoring. Always test modifier combinations thoroughly and be prepared to debug complex state synchronization issues.

## Shape Transformations in the Modifier System

Understanding how position, rotation, and scaling work in our modifier system is crucial for maintaining and extending the codebase. The system uses a sophisticated approach that leverages TLDraw's native transformation methods for optimal performance and user experience.

### Modifier Stacking and Transform Accumulation

The modifier system supports **stacking multiple modifiers** on a single shape, with each modifier building upon the results of previous modifiers. This is achieved through **unified composition** and **transform accumulation**.

#### Unified Composition Detection

The system automatically detects when multiple virtual instances from previous modifiers should be treated as a unified group:

```typescript
// From TransformComposer.shouldUseUnifiedComposition()
const hasOriginal = instances.some(inst => inst.metadata.modifierType === 'original')
const nonOriginalInstances = instances.filter(inst => inst.metadata.modifierType !== 'original')

// Use unified composition when:
// 1. Multiple instances with no original (pure output from previous modifier)
// 2. Multiple non-original instances mixed with original
if (!hasOriginal && instances.length > 1) {
  return true  // Treat as unified group
}
```

#### Transform Accumulation Strategy

**Metadata-First Approach**: Each modifier preserves exact transform values from previous modifiers in virtual instance metadata, avoiding precision loss from matrix decomposition:

```typescript
// Extract transforms from metadata first, fall back to matrix only if needed
const currentRotation = (instance.metadata.targetRotation as number) ??
                       existingTransform.rotation()
const existingScale = {
  scaleX: (instance.metadata.targetScaleX as number) ??
          existingTransform.decomposed().scaleX,
  scaleY: (instance.metadata.targetScaleY as number) ??
          existingTransform.decomposed().scaleY
}
```

**Multiplicative Scale Accumulation**: Scales multiply across modifiers:
- Original shape: scale = 1.0
- Linear Array with 20% scale step: some instances → scale = 1.2
- Grid Array with 50% scale step: final scale = 1.2 × 1.5 = 1.8

**Additive Rotation Accumulation**: Rotations add across modifiers:
- Linear Array rotation + Grid Array rotation + group orbital rotation

#### Example: Linear Array + Grid Array Stacking

**Step 1**: Original shape → 1 virtual instance (`modifierType: 'original'`)

**Step 2**: Linear Array (count=3) → 3 virtual instances
- Uses non-unified mode (only 1 input instance)
- Creates 3 instances with accumulated transforms
- Each instance stores `targetRotation`, `targetScaleX/Y` in metadata

**Step 3**: Grid Array (2×2) → 12 virtual instances
- Detects unified composition (3 instances, no original)
- Calculates collective bounds from Linear Array group
- Creates 4 copies of entire 3-instance group at grid positions
- Maintains rigid body relationships within each group
- Accumulates transforms: Grid transforms × Linear transforms

### Transformation Architecture Overview

The modifier system processes transformations through a **three-phase approach**:

1. **Virtual Phase**: Matrix-based transform calculations using `VirtualInstance` objects
2. **Materialization Phase**: Converting virtual instances to TLShape objects with metadata
3. **Application Phase**: Applying transformations using TLDraw's native methods

### Position Handling

**Matrix Composition**:
- Positions are calculated mathematically using `Mat.Translate()` in `TransformComposer`
- For array modifiers, offsets are applied incrementally: `newX = currentPos.x + (pixelOffsetX * (i + 1))`
- Percentage-based offsets are converted to pixels using shape bounds: `pixelOffsetX = (offsetX / 100) * shapeBounds.width`

**Orbital Rotation Support**:
- When the source shape is rotated, clone positions are calculated using orbital rotation around the source center
- Uses `calculateOrbitalPosition()` function to apply source rotation to clone positions
- This ensures clones maintain their relative positions when the original shape rotates

**Position Extraction**:
- During materialization, positions are extracted using `instance.transform.decomposed()`
- Returns `{ x, y, scaleX, scaleY, rotation }` from the composed matrix
- Position values are applied directly to shape `x, y` properties

### Rotation Handling

**Three-Stage Rotation Process**:

1. **Calculation Phase** (`TransformComposer.applyLinearArray`):
   ```typescript
   const incrementalRotation = (rotationIncrement * i * Math.PI) / 180
   const uniformRotation = (rotateAll * Math.PI) / 180
   const totalRotation = currentRotation + incrementalRotation + uniformRotation
   ```

2. **Storage Phase** (`materializeInstances`):
   ```typescript
   rotation: 0, // Always create shapes with 0 rotation
   meta: {
     targetRotation: targetRotation as number // Store actual rotation in metadata
   }
   ```

3. **Application Phase** (`useCloneManager` & `useModifierManager`):
   ```typescript
   // Apply rotation using TLDraw's center-based rotation
   applyRotationToShapes(editor, [shapeId], targetRotation)
   ```

**Why This Approach**:
- TLDraw's `editor.rotateShapesBy()` rotates around shape centers (like UI handles)
- Direct `rotation` property assignment rotates around top-left corner (incorrect)
- Our approach ensures all rotations are center-based and match user expectations

### Scaling Handling

**Center-Based Scaling Implementation**:

The scaling system was redesigned to use TLDraw's native `editor.resizeShape()` method for proper center-based scaling.

1. **Matrix Storage** (`TransformComposer`):
   ```typescript
   // Scale calculated and stored in transform matrix
   const scale = 1 + ((scaleStep / 100) - 1) * progress
   const composedTransform = Mat.Compose(
     Mat.Translate(newX, newY),
     Mat.Scale(scale, scale)
   )
   ```

2. **Metadata Storage** (`materializeInstances`):
   ```typescript
   // Extract scale from matrix and store in metadata
   const { x, y, scaleX, scaleY } = decomposed
   return {
     ...originalShape,
     props: originalShape.props, // Keep original dimensions
     meta: {
       targetScaleX: scaleX, // Store scale for later application
       targetScaleY: scaleY
     }
   }
   ```

3. **Center-Based Application**:
   ```typescript
   // Apply scaling using TLDraw's resizeShape for center-based scaling
   if (targetScaleX !== 1 || targetScaleY !== 1) {
     editor.resizeShape(shapeId, new Vec(targetScaleX, targetScaleY))
   }
   ```

**Previous vs Current Approach**:
- **Before**: Direct dimension scaling (`w: originalW * scaleX`) caused top-left scaling
- **After**: `editor.resizeShape()` provides automatic center-based scaling with position adjustment

### Transform Synchronization

**Preview vs Applied Shapes**:
- **Preview clones** (`useCloneManager`): Apply transformations immediately for real-time feedback
- **Applied shapes** (`useModifierManager`): Apply transformations after permanent creation
- Both use identical transformation logic for consistency

**Live Updates**:
- `updateExistingClones()` re-applies transformations when modifiers change
- Batch operations for performance: position updates, then rotation, then scaling
- Uses `editor.run()` with `{ history: 'ignore' }` to prevent undo history pollution

### Performance Optimizations

**Virtual Instance Benefits**:
- Transforms calculated mathematically without creating TLShape objects
- Memory usage reduced dramatically for complex modifier stacks
- O(n) complexity instead of O(n²) shape multiplication

**Batch Operations**:
- All shapes created in single `editor.createShapes()` call
- Transformations applied in batches by type (rotation, then scaling)
- Reduces store mutations and improves responsiveness

**Transform Caching**:
- Virtual instances cache transform matrices
- Reuse calculations when possible
- Avoid redundant matrix compositions

### Metadata Schema

**Shape Metadata Structure**:
```typescript
meta: {
  stackProcessed: true,           // Marks shape as modifier-generated
  originalShapeId: string,        // Reference to source shape
  targetRotation: number,         // Rotation to apply via rotateShapesBy
  targetScaleX: number,          // X-scale to apply via resizeShape
  targetScaleY: number,          // Y-scale to apply via resizeShape
  arrayIndex: number,            // Position in modifier array
  modifierType: string,          // Type of modifier that created this
  appliedFromModifier: boolean   // Marks permanently applied shapes
}
```

**Metadata Usage**:
- **Preview identification**: `stackProcessed && !appliedFromModifier`
- **Cleanup filtering**: Used to identify shapes for deletion
- **Transform application**: Source of truth for deferred transformations
- **Debugging**: Provides traceability for modifier-generated shapes

### Best Practices for Modifier Development

**Position Calculations**:
- Always use percentage-based offsets converted to pixels
- Account for shape bounds when calculating positions
- Consider orbital rotation for rotated source shapes
- Use `Mat.Translate()` for mathematical precision

**Rotation Implementation**:
- NEVER set `rotation` property directly on shapes
- Always store target rotation in metadata
- Use `applyRotationToShapes()` utility for center-based rotation
- Test with various rotation combinations

**Scaling Implementation**:
- Store scale values in metadata, not shape properties
- Use `editor.resizeShape(shapeId, new Vec(scaleX, scaleY))` for center-based scaling
- Avoid direct dimension manipulation (`w`, `h` properties)
- Validate scale values before application

**Common Pitfalls**:
- ❌ Direct property assignment: `shape.rotation = angle`
- ❌ Top-left scaling: `shape.props.w = w * scale`
- ❌ Custom properties at shape root level (TLDraw validation errors)
- ✅ Use TLDraw's transformation methods
- ✅ Store custom data in `meta` object
- ✅ Apply transformations after shape creation

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
editor.getShapeGeometry(shape).bounds; // Rectangle2d bounds

// Get shape's page-space bounding box
editor.getShapePageBounds(shapeId); // Box in page coordinates

// Get shape's complete page transform matrix
editor.getShapePageTransform(shapeId); // Matrix transform
```

**Coordinate Space Conversions**:

```typescript
// Convert point from shape's local space to page space
editor.getShapePageTransform(shapeId).applyToPoint(localPoint);

// Convert point from page space to shape's local space
editor.getPointInShapeSpace(shapeId, pagePoint);

// Convert between parent space and shape space
editor.getPointInParentSpace(shapeId, pointInShapeSpace);
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
const transform = editor.getShapePageTransform(shapeId);
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
const shape = { ...originalShape, rotation: Math.PI / 4 };
editor.updateShape(shape);

// ✅ ALWAYS DO THIS - rotates around center (matches UI behavior)
editor.rotateShapesBy([shapeId], Math.PI / 4);
```

**Our Rotation Approach**:

```typescript
// Create shapes without rotation
const shapes = [{ ...shapeData, rotation: 0 }];
editor.createShapes(shapes);

// Then rotate around center using TLDraw's API
const shapeIds = shapes.map((s) => s.id);
editor.rotateShapesBy(shapeIds, rotationInRadians);
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
const shapeRotation = originalShape.rotation || 0;
if (editor && shapeRotation !== 0) {
  const bounds = editor.getShapePageBounds(originalShape.id);
  if (bounds) {
    // Use the center of the rotated shape
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    // Calculate clone positions from this center
    // Then convert back to top-left for positioning
  }
}

// ❌ WRONG - Using top-left corner directly
const x = originalShape.x + offset; // This moves when shape rotates!
```

**This pattern is critical because**:

- When a shape rotates, its `x, y` (top-left corner) position changes
- Calculating clone positions from the moving top-left causes incorrect positioning
- Using the visual center (from `getShapePageBounds`) provides stable reference point
- All array processors (Linear, Circular, Grid) must follow this pattern

### Modifier System Implications

**Critical for modifier system**:

1. **Matrix Composition**: TransformComposer uses mathematical matrix operations for efficiency
2. **Virtual Instance Management**: Defer TLShape materialization until absolutely necessary
3. **Path vs Array Processing**: Path modifiers modify geometry, array modifiers create spatial arrangements
4. **Transform Composition**: Multiple modifiers create compound transforms via matrix multiplication
5. **Group Bounds**: Group shapes have special bounds calculation rules
6. **Performance**: Virtual instances provide O(n) complexity instead of O(n²)
7. **Rotated Shape Handling**: Always calculate from visual center for rotated shapes

**Common Pitfalls**:

- Mixing coordinate spaces (e.g., applying page coordinates as local coordinates)
- Not accounting for shape rotation when calculating positions
- Using screen coordinates instead of page coordinates for shape manipulation
- Attempting negative scaling (use flipping operations instead)

**Best Practices for Modifier Development**:

- **Transformations**: See the "Shape Transformations in the Modifier System" section above for detailed guidance on position, rotation, and scaling
- **Array Modifiers**: Use TransformComposer and VirtualInstance system for performance
- **Path Modifiers**: Extend PathModifier base class for shape geometry modifications
- **Factory Pattern**: Use ModifierFactory for creating new modifier types
- Always work in consistent coordinate space (preferably page space)
- Use TLDraw's transform methods rather than manual coordinate calculations
- **For rotation**: ALWAYS use `editor.rotateShapesBy()` for center-based rotation
- **For scaling**: ALWAYS use `editor.resizeShape()` for center-based scaling
- **For positioning**: When shape is rotated, use `editor.getShapePageBounds()` to get visual center
- Test with rotated shapes and nested groups
- Account for different shape types having different origin behaviors
- Prefer TLDraw's built-in APIs (`getShapePageBounds`, `getShapePageTransform`) over manual calculations
- Leverage matrix composition for transform calculations rather than iterative shape manipulation
- Store custom data in shape `meta` object, never at root level (TLDraw validation)
- Consider path vs array modifier type when planning new modifiers
