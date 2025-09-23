# Group Instance Editing Feature

This document describes the new group instance editing feature that allows users to edit multi-shape custom shape instances and have changes synchronize across all instances.

## Overview

The group instance editing feature extends the existing custom shapes system to support editing multi-shape custom shapes (composed of multiple individual shapes) in a group edit mode where changes to any shape within the group are automatically synchronized to all other instances of the same custom shape.

## How to Use

### Creating Multi-Shape Custom Shapes

1. **Select multiple shapes** on the canvas (any combination of shapes)
2. **Click the "+" button** in the drag-and-drop tray
3. A **multi-shape custom shape** is created and appears in the tray
4. The original shapes are converted to the first instance of this custom shape

### Entering Group Edit Mode

To edit a multi-shape custom shape instance:

1. **Select a multi-shape custom shape instance** on the canvas
2. **Press Ctrl+E (Windows) or Cmd+E (Mac)** to enter group edit mode
3. **Visual indicators** will appear:
   - Blue outlines around all shapes in the group
   - "Group Edit Mode" notification at the top-left
   - All shapes in the group become selected

### Editing in Group Edit Mode

Once in group edit mode, you can:

- **Move, rotate, or scale** any shape within the group
- **Edit shape properties** (colors, stroke width, etc.)
- **Modify bezier paths** (if the group contains bezier shapes)
- **Add or remove points** from bezier curves

**All changes are synchronized in real-time** to other instances of the same custom shape while maintaining each instance's global position.

### Exiting Group Edit Mode

You can exit group edit mode by:

- **Pressing the Escape key**
- **Clicking outside the group**
- **Clicking on a different shape** not part of the current group

When you exit group edit mode:
- The custom shape template is updated with your changes
- All other instances are updated with the final modifications
- Visual indicators disappear

## Technical Implementation

### Key Components

- **`useGroupEditMode`** - Hook that manages group edit state and keyboard shortcuts
- **`useMultiShapeInstanceManager`** - Extended instance manager supporting all shape types
- **`GroupEditIndicator`** - Visual component showing group edit mode indicators
- **`GroupEditManager`** - Component that activates group edit functionality

### Metadata Structure

Each custom shape instance now includes:
```typescript
meta: {
  customShapeId: string,
  instanceId: string,
  isCustomShapeInstance: true,
  version: number,
  groupEditMode: boolean,           // NEW: Indicates if shape is in group edit mode
  groupEditInstanceId?: string      // NEW: Reference to the group being edited
}
```

### Synchronization Flow

1. **Enter Group Edit Mode** → All shapes in the instance group get `groupEditMode: true`
2. **Detect Changes** → Monitor any property changes on shapes in the group
3. **Live Sync** → Update custom shape template and propagate to other instances
4. **Exit Group Edit** → Finalize template and clear group edit mode flags

### Shape Type Support

The system supports editing groups containing:
- **Bezier curves** (with full path editing support)
- **Basic shapes** (rectangles, circles, triangles, polygons)
- **Custom shapes** (sine waves, arrows, etc.)
- **Mixed groups** (combinations of different shape types)

## Features

### Live Synchronization
- Changes appear in real-time across all instances
- Position compensation ensures instances stay in their global positions
- Property changes (colors, strokes, etc.) sync immediately

### Visual Feedback
- Blue outline highlights during group edit mode
- Clear notification showing current mode
- Smooth transitions and animations

### Keyboard Shortcuts
- **Ctrl/Cmd + E** - Enter group edit mode (on selected multi-shape instance)
- **Escape** - Exit group edit mode

### Robust Error Handling
- Graceful fallback if custom shape template is missing
- Cleanup of tracking state when shapes are deleted
- Prevention of infinite update loops

## Benefits

1. **Consistent Design** - Edit once, update everywhere
2. **Efficient Workflow** - No need to manually update each instance
3. **Visual Feedback** - Clear indication of what's being edited
4. **Non-Destructive** - Original template is preserved and enhanced
5. **Flexible** - Works with any combination of shape types

## Future Enhancements

Potential improvements could include:
- Double-click to enter group edit mode (currently uses keyboard shortcut)
- Nested group editing support
- Selective shape editing within groups
- Visual diff indicators showing what changed
- Collaborative editing support

## Usage Tips

1. **Create logical groups** - Group related shapes that should be edited together
2. **Use consistent naming** - Give your custom shapes descriptive names
3. **Test changes** - Enter group edit mode, make small changes, and verify synchronization
4. **Backup work** - The system supports undo/redo for group edits
5. **Performance** - For very complex groups, changes may take a moment to propagate

This feature significantly enhances the custom shapes workflow by allowing designers to maintain consistency across multiple instances while making iterative improvements to their designs.