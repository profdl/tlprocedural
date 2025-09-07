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