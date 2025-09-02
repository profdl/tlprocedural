# Shape Transforms in tldraw

## Overview

This document explains how shape transformations work in tldraw, particularly focusing on flipping behavior and transform controls.

## Transform Controls

### Handle Types
- **Corner handles**: Resize both width and height simultaneously
- **Edge handles**: Resize in one dimension only
  - Top/Bottom: Affect height (scaleY)
  - Left/Right: Affect width (scaleX)

### Transform Behavior

#### Normal Resizing
- Dragging handles away from center = positive scaling
- `scaleX > 0`, `scaleY > 0`
- Shape dimensions increase/decrease normally

#### Flipping via Negative Scaling
- Dragging handles past the opposite edge = negative scaling
- **Horizontal flip**: `scaleX < 0` (drag right handle past left edge, or left handle past right edge)
- **Vertical flip**: `scaleY < 0` (drag bottom handle past top edge, or top handle past bottom edge)

## Implementation Architecture

### BaseBoxShapeUtil
- Uses tldraw's `resizeBox()` function internally
- Handles negative width/height gracefully
- Automatically repositions shapes when flipping occurs
- Converts negative dimensions to positive and adjusts position

### FlippableShapeUtil
- Extends `BaseBoxShapeUtil`
- Detects flipping via `info.scaleX < 0` and `info.scaleY < 0`
- Stores flip state in shape metadata (`isFlippedX`, `isFlippedY`)
- Applies CSS transforms (`scaleX(-1)`, `scaleY(-1)`) for visual flipping

## Flip Detection Logic

```typescript
const isFlippedX = info.scaleX < 0  // Horizontal flip
const isFlippedY = info.scaleY < 0  // Vertical flip
```

### Transform Handle Mapping
| Handle Position | Direction | Scale Affected | Flip When |
|----------------|-----------|----------------|-----------|
| Top            | ↑ ↓       | scaleY        | Drag past bottom |
| Bottom         | ↑ ↓       | scaleY        | Drag past top |
| Left           | ← →       | scaleX        | Drag past right |
| Right          | ← →       | scaleX        | Drag past left |
| Top-Left       | ↖ ↘       | scaleX, scaleY| Drag past opposite corner |
| Top-Right      | ↗ ↙       | scaleX, scaleY| Drag past opposite corner |
| Bottom-Left    | ↙ ↗       | scaleX, scaleY| Drag past opposite corner |
| Bottom-Right   | ↘ ↖       | scaleX, scaleY| Drag past opposite corner |

## Visual Transform Methods

### CSS Transform Method (Recommended)
Used by FlippableShapeUtil and most custom shapes:

```typescript
const flipTransform = {
  transform: transforms.join(' '), // e.g., "scaleX(-1) scaleY(-1)"
  transformOrigin: `${w/2}px ${h/2}px`
}

<svg style={{...flipTransform}}>
  {/* Shape content */}
</svg>
```

**Pros:**
- Simple to implement
- Preserves original shape data
- Works with complex SVG paths
- Hardware accelerated

**Cons:**
- Text and images may appear reversed
- May affect text readability

### Coordinate Transformation Method
Used for shapes with control points (e.g., Bezier curves):

```typescript
const flippedPoints = points.map(point => ({
  ...point,
  x: isFlippedX ? width - point.x : point.x,
  y: isFlippedY ? height - point.y : point.y
}))
```

**Pros:**
- Maintains proper text/image orientation
- Real coordinate transformation
- Preserves semantic meaning

**Cons:**
- More complex implementation
- Requires shape-specific logic
- May need to transform control points

## Shape-Specific Implementations

### Simple Geometric Shapes (Circle, Triangle, Polygon)
- Use CSS transform method
- No special coordinate handling needed
- Flip metadata stored for reference

### Path-Based Shapes (Bezier, Draw)
- Use coordinate transformation method
- Transform all path points and control points
- More complex but maintains proper orientation

### Parametric Shapes (SineWave)
- Hybrid approach: CSS for visual + parameter adjustment
- Adjust phase for horizontal flip: `phase = (180 - phase) % 360`
- Use flip metadata for vertical amplitude inversion

## Integration with tldraw's Native Flip

### Native flipShapes API
```typescript
editor.flipShapes(shapeIds, 'horizontal')
editor.flipShapes(shapeIds, 'vertical')
```

### Custom Fallback Implementation
```typescript
const util = editor.getShapeUtil(shape)
if ('flipShape' in util) {
  const flipped = util.flipShape(shape, direction)
  editor.updateShape(flipped)
}
```

## Best Practices

### For Shape Authors
1. **Extend FlippableShapeUtil** for automatic flip support
2. **Use CSS transforms** for simple shapes
3. **Implement onFlipCustom** for complex coordinate transformations
4. **Test both transform handles and toolbar buttons**
5. **Consider text/image orientation** in your design

### For Complex Shapes
1. **Transform coordinates** rather than relying solely on CSS
2. **Handle control points** (Bezier curves, handles)
3. **Preserve semantic meaning** (arrows should point in new direction)
4. **Update shape parameters** if needed (phase, angles, etc.)

### Testing
1. **Create asymmetric test shapes** (like the CustomArrow)
2. **Test all transform handles** (corners and edges)
3. **Verify flip direction** matches user expectation
4. **Test combined transforms** (resize + flip simultaneously)
5. **Check toolbar flip buttons** work correctly

## Common Issues

### Flip Direction Confusion
- **Problem**: Dragging up flips horizontally instead of vertically
- **Cause**: Incorrect mapping of scaleX/scaleY to flip directions
- **Solution**: Ensure `scaleY < 0` → vertical flip, `scaleX < 0` → horizontal flip

### Text/Image Reversal
- **Problem**: Text appears backwards after horizontal flip
- **Cause**: CSS scaleX(-1) reverses everything
- **Solution**: Use coordinate transformation or add counter-transforms for text

### Position Shifts
- **Problem**: Shape jumps to wrong position after flip
- **Cause**: Not accounting for tldraw's automatic position adjustments
- **Solution**: Let BaseBoxShapeUtil handle positioning, focus on visual transforms

### Double Flipping
- **Problem**: Shape flips twice or doesn't flip at all
- **Cause**: Conflicting flip logic or incorrect state management
- **Solution**: Use single source of truth for flip state, clear metadata handling

## Debugging Tips

1. **Add console logs** to see scaleX/scaleY values
2. **Use asymmetric test shapes** to make flipping obvious
3. **Test incrementally** - start with CSS transforms, add complexity
4. **Compare with native shapes** for expected behavior
5. **Check browser dev tools** for applied CSS transforms

## Examples

See the following files for working implementations:
- `FlippableShapeUtil.ts` - Base flip functionality
- `CustomArrowShape.tsx` - Asymmetric test shape
- `BezierShape.tsx` - Coordinate transformation example
- `SineWaveShape.tsx` - Parametric shape with phase adjustment
- `CustomToolbar.tsx` - Toolbar flip button integration

## Future Improvements

1. **Better native tldraw integration** once flip API is documented
2. **Handle group flipping** for multiple selected shapes
3. **Animation support** for smooth flip transitions
4. **Undo/redo integration** for flip operations
5. **Keyboard shortcuts** for flip operations