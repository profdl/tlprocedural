# Custom Shapes System Documentation

## Overview

The custom shapes system allows users to create reusable shape templates from existing shapes on the canvas. These templates can be instantiated multiple times, and editing any instance updates all other instances automatically. The system supports both single shapes (like bezier curves) and multi-shape compositions.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Creating Custom Shapes](#creating-custom-shapes)
3. [Custom Shape Instance Management](#custom-shape-instance-management)
4. [Live Editing System](#live-editing-system)
5. [Storage and Persistence](#storage-and-persistence)
6. [Multi-Shape Custom Shapes](#multi-shape-custom-shapes)
7. [Technical Implementation](#technical-implementation)
8. [Troubleshooting](#troubleshooting)

## System Architecture

The custom shapes system consists of several key components:

### Core Components

- **CustomShapesProvider** - Context provider for shared state management
- **useCustomShapes** - Hook for managing custom shape definitions
- **useCustomShapeInstances** - Hook for managing instances on the canvas
- **useCustomShapeInstanceManager** - Hook for monitoring and synchronizing edits
- **DragAndDropTray** - UI component for creating and using custom shapes

### Data Flow

```
Shape Selection → Custom Shape Creation → Storage → Instance Creation → Live Editing → Synchronization
```

## Creating Custom Shapes

### From Single Shapes

1. **Select a shape** on the canvas (any shape type: bezier, rectangle, circle, etc.)
2. **Click the "+" button** that appears in the drag-and-drop tray
3. **Shape is converted** to a custom shape template with:
   - Auto-generated label (e.g., "Custom bezier")
   - SVG thumbnail for the tray
   - Normalized coordinates starting from origin (0,0)
   - Metadata for versioning and tracking

### From Multiple Shapes

1. **Select multiple shapes** on the canvas
2. **Click the "+" button** in the tray
3. **Multi-shape template** is created with:
   - Combined bounds calculation
   - Relative positioning preserved
   - Unified SVG thumbnail
   - `multi-shape` type designation

### Shape Conversion Process

#### Bezier Shapes
```typescript
// Points are normalized to start from origin
const { normalizedPoints } = normalizeBezierPoints(shape.props.points)

// SVG path is generated for thumbnail
const pathData = bezierPointsToPath(normalizedPoints, isClosed)
```

#### Other Shape Types
```typescript
// Shapes are converted to path data for thumbnails
const pathData = convertShapeToPath(shape, width, height)
```

## Custom Shape Instance Management

### Instance Creation

When dragging a custom shape from the tray:

```typescript
// Single shape instance
const baseShape = {
  id: shapeId,
  type: trayItem.shapeType,
  x: pagePoint.x - 50,
  y: pagePoint.y - 50,
  props: trayItem.defaultProps,
  meta: {
    customShapeId: trayItem.id,
    instanceId: generateInstanceId(),
    isCustomShapeInstance: true,
    version: trayItem.version
  }
}
```

### Instance Metadata

Each instance contains metadata linking it to its template:

```typescript
interface CustomShapeInstanceMetadata {
  customShapeId: string        // Reference to template
  instanceId: string           // Unique instance identifier
  isCustomShapeInstance: true  // Type guard
  version: number              // Template version for sync
}
```

### Instance Tracking

The system automatically tracks all instances:

```typescript
// Find all instances of a custom shape
const instances = useCustomShapeInstances()
const shapeInstances = instances.getInstancesForCustomShape(customShapeId)
```

## Live Editing System

### Edit Mode Detection

The system monitors all shapes for edit mode changes:

```typescript
const isInEditMode = shape.props.editMode === true
const wasInEditMode = editStateRef.current.get(shapeId) === true

// Detect edit mode transitions
if (wasInEditMode && !isInEditMode) {
  handleEditModeExit(shape)
}
```

### Live Property Synchronization

During edit mode, changes are propagated in real-time:

```typescript
// Normalize points to prevent position drift
const { normalizedPoints } = normalizeBezierPoints(shape.props.points)

// Calculate accurate bounds using bezier-js
const bounds = BezierBounds.getAccurateBounds(normalizedPoints, isClosed)

// Update all other instances
const liveProps = {
  w: Math.max(1, bounds.maxX - bounds.minX),
  h: Math.max(1, bounds.maxY - bounds.minY),
  points: normalizedPoints,
  // ... other properties
}
```

### Template Updates on Edit Exit

When exiting edit mode, the template is updated:

```typescript
// Convert edited shape back to template format
const updatedTemplate = bezierShapeToCustomTrayItem(shape, label)

// Update template definition
updateCustomShape(customShapeId, {
  iconSvg: updatedTemplate.iconSvg,
  defaultProps: updatedTemplate.defaultProps
})
```

### Shape Editing Implementation

The live editing system ensures that when one custom shape instance is edited, all other instances of the same template update in real-time while maintaining their positions.

#### Edit Mode State Tracking

The system tracks edit state transitions for all custom shape instances:

```typescript
// Monitor shape edit mode changes
const editStateRef = useRef<Map<string, boolean>>(new Map())
const originalBoundsRef = useRef<Map<string, BoundingBox>>(new Map())
const originalInstancePositionsRef = useRef<Map<string, Map<string, Position>>>(new Map())

// Detect when shape enters edit mode
if (!wasInEditMode && isInEditMode) {
  // Store original bounds for bounds offset calculation
  const originalBounds = BezierBounds.getAccurateBounds(shape.props.points, shape.props.isClosed)
  originalBoundsRef.current.set(shapeId, originalBounds)

  // Store original positions of ALL instances to prevent cumulative compensation
  const instances = getInstancesForCustomShape(customShapeId)
  const instancePositions = new Map()
  instances.forEach(instance => {
    instancePositions.set(instance.id, { x: instance.x, y: instance.y })
  })
  originalInstancePositionsRef.current.set(customShapeId, instancePositions)
}
```

#### Live Property Updates

During editing, property changes are propagated to other instances:

```typescript
const handleLivePropertyChange = (shape: BezierShape) => {
  // Get stored original bounds and instance positions
  const originalBounds = originalBoundsRef.current.get(shape.id)
  const originalPositions = originalInstancePositionsRef.current.get(customShapeId)

  // Calculate current bounds from edited points
  const currentBounds = BezierBounds.getAccurateBounds(shape.props.points, shape.props.isClosed)

  // Calculate bounds offset to compensate for coordinate system changes
  const boundsOffset = {
    x: currentBounds.minX - originalBounds.minX,
    y: currentBounds.minY - originalBounds.minY
  }

  // Normalize points for consistent coordinate system
  const { normalizedPoints } = normalizeBezierPoints(shape.props.points)
  const normalizedBounds = BezierBounds.getAccurateBounds(normalizedPoints, shape.props.isClosed)

  // Create live properties update
  const liveProps = {
    w: Math.max(1, normalizedBounds.maxX - normalizedBounds.minX),
    h: Math.max(1, normalizedBounds.maxY - normalizedBounds.minY),
    points: normalizedPoints,
    isClosed: shape.props.isClosed,
    // ... other properties
  }

  // Update all other instances with position compensation
  updateAllInstances(customShapeId, { props: liveProps }, shape.id, boundsOffset, originalPositions)
}
```

#### Position Compensation System

The critical challenge in live editing is preventing other instances from shifting position when the edited shape's bounds change. This happens because:

1. **Coordinate System Changes**: When points extend beyond original bounds (e.g., dragging left/up), the normalized coordinate system shifts
2. **Visual Position Drift**: Without compensation, other instances would appear to move as their local coordinates change
3. **Cumulative Errors**: Naive compensation can compound across updates, causing exponential movement

**Solution - Original Position Tracking**:

```typescript
const updateAllInstances = (customShapeId, updates, excludeShapeId, boundsOffset, originalPositions) => {
  const shapeUpdates = instancesToUpdate.map(instance => {
    const updatedShape = { ...instance }

    // Update shape properties (points, colors, etc.)
    if (updates.props) {
      updatedShape.props = { ...instance.props, ...updates.props }
    }

    // Apply position compensation using ORIGINAL positions
    if (boundsOffset && originalPositions) {
      const originalPos = originalPositions.get(instance.id)
      if (originalPos) {
        // Key insight: Apply offset to original position, not current position
        // This prevents cumulative compensation errors
        updatedShape.x = originalPos.x + boundsOffset.x
        updatedShape.y = originalPos.y + boundsOffset.y
      }
    }

    return updatedShape
  })

  // Batch update all instances
  editor.updateShapes(shapeUpdates)
}
```

#### Bounds Recalculation Prevention

For custom shape instances during live editing, bounds recalculation is skipped to prevent double compensation:

```typescript
// In BezierShape.tsx onBeforeUpdate
const isCustomShapeInstance = shape.meta?.isCustomShapeInstance === true

if (isCustomShapeInstance) {
  // Skip bounds recalculation for instances during live updates
  // Position compensation is handled by useCustomShapeInstanceManager
  return next
}

// Normal bounds recalculation for non-instances
return BezierBounds.recalculateShapeBounds(shape, ...)
```

#### Edit Mode Exit Handling

When editing ends, the template is updated and tracking state is cleaned up:

```typescript
const handleEditModeExit = (shape: BezierShape) => {
  // Convert edited shape back to template
  const updatedTemplate = bezierShapeToCustomTrayItem(shape, customShape.label)

  // Update template definition (increments version)
  updateCustomShape(customShapeId, {
    iconSvg: updatedTemplate.iconSvg,
    defaultProps: updatedTemplate.defaultProps
  })

  // Update other instances with final properties (no position compensation needed)
  updateAllInstances(customShapeId, { props: updatedTemplate.defaultProps }, shape.id)

  // Clean up tracking state
  originalBoundsRef.current.delete(shapeId)
  originalInstancePositionsRef.current.delete(customShapeId)
}
```

### Position Drift Prevention

The comprehensive position drift prevention system includes:

1. **Point Normalization** - Points are normalized to start at (0,0) using `normalizeBezierPoints()`
2. **Accurate Bounds Calculation** - Uses `BezierBounds.getAccurateBounds()` for precise curve bounds
3. **Original Position Tracking** - Stores instance positions when editing begins to prevent cumulative errors
4. **Bounds Offset Compensation** - Calculates and applies coordinate system changes
5. **Double Compensation Prevention** - Skips automatic bounds recalculation for instances during live updates
6. **Dimension Synchronization** - Width and height are recalculated consistently across all instances

### Key Technical Insights

#### Why Position Compensation is Complex

The live editing system must solve a fundamental coordinate system problem:

1. **Shape Local Coordinates**: Points are stored relative to shape bounds (normalized to start at 0,0)
2. **Canvas Global Coordinates**: Shapes are positioned on the infinite canvas using x,y coordinates
3. **Bounds Changes**: When editing extends shape bounds (e.g., dragging points left/up), the local coordinate system shifts
4. **Visual Stability**: Users expect other instances to stay visually in place during editing

#### Critical Implementation Details

**Bounds Offset Sign Convention**:
```typescript
// When bounds extend LEFT or UP, minX/minY becomes smaller (more negative)
// Example: originalBounds.minX = 50, currentBounds.minX = 25 (extended left by 25)
const boundsOffset = {
  x: currentBounds.minX - originalBounds.minX,  // 25 - 50 = -25
  y: currentBounds.minY - originalBounds.minY   // (negative when extending up/left)
}

// Compensation moves instances in SAME direction as bounds extension
// When bounds extend left (-25), move instances left (-25) to maintain visual position
compensatedX = originalX + boundsOffset.x  // originalX + (-25)
```

**Original vs Current Position Tracking**:
```typescript
// ❌ WRONG - Causes exponential movement
updatedShape.x = instance.x + boundsOffset.x  // instance.x may already be compensated

// ✅ CORRECT - Prevents cumulative errors
const originalPos = originalPositions.get(instance.id)
updatedShape.x = originalPos.x + boundsOffset.x  // Always from original position
```

**Double Compensation Prevention**:
```typescript
// In BezierShape.tsx - Skip automatic bounds adjustment for instances
if (isCustomShapeInstance) {
  return next  // Skip BezierBounds.recalculateShapeBounds()
}
// This prevents both manual AND automatic position adjustments
```

#### Lessons Learned

1. **State Consistency**: Track both bounds changes AND original positions to prevent cumulative errors
2. **Coordinate System Awareness**: Understand the difference between local shape coordinates and global canvas coordinates
3. **TLDraw Integration**: Work with TLDraw's automatic bounds management, don't fight it
4. **Single Responsibility**: Each compensation mechanism should handle one specific case
5. **Original State Preservation**: Always compensate from original state, never from current state during live updates

#### Performance Considerations

- **Batch Updates**: Use `editor.updateShapes()` for multiple instances
- **Reference Tracking**: Use `Map` and `Set` for O(1) lookups
- **Memory Cleanup**: Clear tracking state when editing ends
- **Minimal Recalculation**: Only recalculate bounds when necessary

## Storage and Persistence

### LocalStorage Schema

Custom shapes are persisted in localStorage:

```typescript
interface CustomTrayItem {
  id: string                    // Unique identifier
  label: string                 // Display name
  iconSvg: string              // SVG thumbnail
  shapeType: string            // Shape type or 'multi-shape'
  defaultProps: Record<string, unknown>  // Shape properties
  createdAt: number            // Creation timestamp
  version: number              // Version for instance sync
  lastModified: number         // Last edit timestamp
}
```

### Storage Operations

```typescript
// Save to localStorage
localStorage.setItem('tldraw-custom-shapes', JSON.stringify(shapes))

// Load and migrate on startup
const stored = localStorage.getItem('tldraw-custom-shapes')
const migrated = parsed.map(shape => ({
  ...shape,
  version: shape.version || 1,
  lastModified: shape.lastModified || shape.createdAt
}))
```

### Version Management

- **Template updates** increment version number
- **Outdated instances** are automatically synchronized
- **Orphaned instances** (template deleted) are cleaned up

## Multi-Shape Custom Shapes

### Creation Process

```typescript
// Calculate combined bounds
const combinedBounds = calculateCombinedBounds(shapes, editor)

// Store relative positions
const relativeShapes = shapes.map(shape => ({
  ...shape,
  x: shape.x - combinedBounds.x,
  y: shape.y - combinedBounds.y
}))
```

### Instance Creation

```typescript
// Create multiple shapes maintaining relationships
for (const shape of shapes) {
  const newShapeId = createShapeId()
  const newShape = {
    ...shape,
    id: newShapeId,
    x: pagePoint.x + shape.x + centerOffsetX,
    y: pagePoint.y + shape.y + centerOffsetY,
    meta: {
      customShapeId: trayItem.id,
      instanceId: generateInstanceId(),
      isCustomShapeInstance: true,
      version: trayItem.version
    }
  }
  editor.createShape(newShape)
}
```

## Technical Implementation

### Key Files

- `src/components/providers/CustomShapesProvider.tsx` - State management
- `src/components/hooks/useCustomShapeInstances.ts` - Instance tracking
- `src/components/hooks/useCustomShapeInstanceManager.ts` - Edit synchronization
- `src/components/utils/bezierToCustomShape.ts` - Bezier conversion utilities
- `src/components/utils/multiShapeToCustomShape.ts` - Multi-shape utilities

### Critical Patterns

#### Point Normalization
```typescript
// Always normalize points before applying to instances
const { normalizedPoints } = normalizeBezierPoints(shape.props.points)
```

#### Bounds Consistency
```typescript
// Use same bounds calculation as the shape itself
const bounds = BezierBounds.getAccurateBounds(points, isClosed)
```

#### History Management
```typescript
// Use appropriate history options for TLDraw
editor.run(() => {
  editor.updateShapes(updates)
}, { history: 'record-preserveRedoStack' })
```

### Performance Optimizations

- **Batch Operations** - Multiple shape updates in single `editor.run()`
- **Filtered Updates** - Only update shapes that actually changed
- **Efficient Tracking** - Use Maps and Sets for O(1) lookups
- **Normalized Coordinates** - Prevent redundant calculations

## Troubleshooting

### Common Issues

#### Position Drift During Editing
**Symptoms**: Other instances move when editing one instance
**Causes**:
- Bounds offset calculation errors
- Cumulative position compensation
- Double compensation (both automatic and manual)
- Using current positions instead of original positions for compensation
**Solutions**:
- Ensure original position tracking is working (`originalInstancePositionsRef`)
- Verify bounds offset calculation uses correct sign (`currentBounds.minX - originalBounds.minX`)
- Check that bounds recalculation is skipped for instances in `BezierShape.tsx`
- Confirm compensation uses original positions: `originalPos.x + boundsOffset.x`

#### Instance Sync Failures
**Symptoms**: Instances don't update when template changes
**Solution**: Check version numbers and metadata integrity

#### Missing Instances
**Symptoms**: Instances disappear or don't track properly
**Solution**: Verify `isCustomShapeInstance` metadata and instance IDs

### Debug Tools

#### Position Compensation Debugging
```typescript
// Debug bounds offset calculation
console.log('Original bounds:', originalBounds)
console.log('Current bounds:', currentBounds)
console.log('Bounds offset:', boundsOffset)

// Debug original position tracking
console.log('Original positions:', Array.from(originalPositions.entries()))
console.log('Current instance positions:', instances.map(i => ({ id: i.id, x: i.x, y: i.y })))

// Debug compensation application
instances.forEach(instance => {
  const originalPos = originalPositions.get(instance.id)
  const compensatedX = originalPos.x + boundsOffset.x
  const compensatedY = originalPos.y + boundsOffset.y
  console.log(`Instance ${instance.id}: ${originalPos.x} + ${boundsOffset.x} = ${compensatedX}`)
})
```

#### Edit Mode State Debugging
```typescript
// Check edit state tracking
console.log('Edit states:', Array.from(editStateRef.current.entries()))
console.log('Tracked bounds:', Array.from(originalBoundsRef.current.entries()))
console.log('Tracked positions:', Array.from(originalInstancePositionsRef.current.entries()))

// Verify shape metadata
const shape = editor.getShape(shapeId)
console.log('Shape metadata:', shape.meta)
console.log('Is custom shape instance:', shape.meta?.isCustomShapeInstance)
console.log('Custom shape ID:', shape.meta?.customShapeId)
```

#### Console Logging
```typescript
console.log('Live update for custom shape instance:', customShapeId)
console.log('Applying shape updates:', validatedUpdates.map(s => ({
  id: s.id,
  type: s.type,
  hasProps: !!s.props,
  position: { x: s.x, y: s.y }
})))
```

#### Instance Inspection
```typescript
// Check instance metadata and positions
const instances = getInstancesForCustomShape(customShapeId)
console.log('Instances:', instances.map(i => ({
  id: i.id,
  meta: i.meta,
  position: { x: i.x, y: i.y },
  bounds: editor.getShapePageBounds(i.id)
})))
```

#### Troubleshooting Checklist

**For Position Drift Issues**:
1. ✅ Check that `originalInstancePositionsRef` is populated when editing begins
2. ✅ Verify bounds offset calculation: `currentBounds.minX - originalBounds.minX`
3. ✅ Confirm compensation uses addition: `originalPos.x + boundsOffset.x`
4. ✅ Ensure `BezierShape.tsx` skips bounds recalculation for instances
5. ✅ Verify cleanup happens when editing ends

**For Exponential Movement**:
1. ✅ Check that compensation uses original positions, not current positions
2. ✅ Verify no double compensation (both manual and automatic)
3. ✅ Ensure tracking state is cleaned up properly
4. ✅ Check for multiple event handlers or duplicate updates

**For Missing Updates**:
1. ✅ Verify instance metadata contains `isCustomShapeInstance: true`
2. ✅ Check that `customShapeId` matches template ID
3. ✅ Ensure version numbers are consistent
4. ✅ Verify edit mode detection is working

### Best Practices

1. **Always normalize points** before applying to instances
2. **Use consistent bounds calculation** methods with `BezierBounds.getAccurateBounds()`
3. **Track original state** for all compensation calculations
4. **Batch shape operations** for performance using `editor.updateShapes()`
5. **Handle edit mode transitions** properly with state cleanup
6. **Validate shape updates** before applying to prevent TLDraw errors
7. **Clean up tracking state** when shapes are deleted or editing ends
8. **Prevent double compensation** by skipping automatic bounds recalculation for instances
9. **Use original positions** for all live compensation, never current positions
10. **Test edge cases** like extending bounds in all directions (left, right, up, down)

## Future Enhancements

### Planned Features

- **Custom Shape Categories** - Organize shapes into folders
- **Shape Libraries** - Import/export shape collections
- **Advanced Editing** - Edit templates without instances
- **Collaborative Editing** - Real-time multi-user editing
- **Shape Variations** - Create variants of existing templates

### Technical Improvements

- **Better Error Handling** - Comprehensive error boundaries
- **Performance Monitoring** - Track update performance
- **Memory Management** - Optimize instance tracking
- **Type Safety** - Stronger TypeScript definitions
- **Testing Coverage** - Comprehensive test suite

---

This documentation covers the complete custom shapes system. For implementation details, refer to the source code files mentioned in each section.