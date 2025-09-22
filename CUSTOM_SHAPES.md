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

### Position Drift Prevention

The system prevents position drift through:

1. **Point Normalization** - Points are normalized to start at (0,0)
2. **Accurate Bounds** - Uses `BezierBounds.getAccurateBounds` for precise curve bounds
3. **Dimension Synchronization** - Width and height are recalculated and updated together

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
**Solution**: Ensure points are normalized and bounds are calculated consistently

#### Instance Sync Failures
**Symptoms**: Instances don't update when template changes
**Solution**: Check version numbers and metadata integrity

#### Missing Instances
**Symptoms**: Instances disappear or don't track properly
**Solution**: Verify `isCustomShapeInstance` metadata and instance IDs

### Debug Tools

#### Console Logging
```typescript
console.log('Live update for custom shape instance:', customShapeId)
console.log('Applying shape updates:', validatedUpdates.map(s => ({
  id: s.id,
  type: s.type,
  hasProps: !!s.props
})))
```

#### Instance Inspection
```typescript
// Check instance metadata
const instances = getInstancesForCustomShape(customShapeId)
console.log('Instances:', instances.map(i => i.meta))
```

### Best Practices

1. **Always normalize points** before applying to instances
2. **Use consistent bounds calculation** methods
3. **Batch shape operations** for performance
4. **Handle edit mode transitions** properly
5. **Validate shape updates** before applying
6. **Clean up tracking state** when shapes are deleted

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