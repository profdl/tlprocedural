# Modifiers System Documentation

## Overview

The Modifiers System provides a flexible way to create and manage shape transformations in the tldraw application. It supports multiple modifier types including linear arrays, circular arrays, grid arrays, and mirror effects.

## Architecture

### Core Components

- **ModifierControls**: Main UI component for managing modifiers
- **ModifierFactory**: Factory component that renders the appropriate modifier based on type
- **ModifierRegistry**: Registry system for managing available modifiers
- **StackedModifier**: Component for processing multiple modifiers in sequence

### Modifier Types

1. **Linear Array**: Creates a series of shapes in a straight line
2. **Circular Array**: Creates shapes arranged in a circle
3. **Grid Array**: Creates shapes in a grid pattern
4. **Mirror**: Creates a mirrored copy of the original shape

## File Structure

```
src/components/modifiers/
├── ModifierControls.tsx          # Main controls UI
├── ModifierRenderer.tsx          # Renders modifiers for selected shapes
├── StackedModifier.tsx           # Processes multiple modifiers
├── ModifierFactory.tsx           # Factory for creating modifier components
├── ModifierRegistry.tsx          # Registry for available modifiers
├── ErrorBoundary.tsx             # Error handling component
├── constants.ts                  # Shared constants and defaults
├── utils/
│   └── shapeUtils.ts            # Utility functions for shape operations
├── controls/
│   ├── ModifierPropertyInput.tsx # Reusable input component
│   ├── ModifierSlider.tsx        # Reusable slider component
│   ├── NumberInput.tsx           # Reusable number input
│   ├── LinearArrayControls.tsx   # Linear array specific controls
│   ├── CircularArrayControls.tsx # Circular array specific controls
│   ├── GridArrayControls.tsx     # Grid array specific controls
│   └── MirrorControls.tsx        # Mirror specific controls
├── modifiers/
│   ├── LinearArrayModifier.tsx   # Linear array implementation
│   ├── CircularArrayModifier.tsx # Circular array implementation
│   ├── GridArrayModifier.tsx     # Grid array implementation
│   └── MirrorModifier.tsx        # Mirror implementation
└── factory/
    └── ModifierFactory.tsx       # Factory component
```

## Usage

### Basic Usage

```tsx
import { ModifierControls } from './components/modifiers/ModifierControls'

function App() {
  const [selectedShapes, setSelectedShapes] = useState([])
  
  return (
    <div>
      <TldrawCanvas />
      <ModifierControls selectedShapes={selectedShapes} />
    </div>
  )
}
```

### Adding Modifiers Programmatically

```tsx
import { addModifier, getShapeModifiers } from './components/modifiers/ModifierControls'

// Add a linear array modifier
const modifier = {
  id: createModifierId(),
  type: 'linear-array',
  targetShapeId: shapeId,
  enabled: true,
  props: {
    count: 5,
    offsetX: 50,
    offsetY: 0,
    rotation: 0,
    spacing: 1.2,
    scaleStep: 1.1
  }
}

addModifier(shapeId, modifier)

// Get modifiers for a shape
const modifiers = getShapeModifiers(shapeId)
```

## Modifier Types

### Linear Array

Creates a series of shapes in a straight line with configurable spacing and scaling.

**Properties:**
- `count`: Number of copies to create (2-50)
- `offsetX`: Horizontal offset between copies (-200 to 200)
- `offsetY`: Vertical offset between copies (-200 to 200)
- `rotation`: Rotation angle for each copy (-180 to 180 degrees)
- `spacing`: Spacing multiplier (0.1 to 3.0)
- `scaleStep`: Scale factor for each copy (0.8 to 1.5)

**Example:**
```tsx
const linearSettings = {
  count: 5,
  offsetX: 60,
  offsetY: 0,
  rotation: 0,
  spacing: 1.2,
  scaleStep: 1.1
}
```

### Circular Array

Creates shapes arranged in a circle around a center point.

**Properties:**
- `count`: Number of copies to create (2-50)
- `radius`: Distance from center (10-500)
- `startAngle`: Starting angle in degrees (0-360)
- `endAngle`: Ending angle in degrees (0-360)
- `rotateAll`: Rotation applied to all shapes (-180 to 180)
- `rotateEach`: Rotation applied to each individual shape (-180 to 180)
- `pointToCenter`: Whether shapes should point toward center (boolean)

**Example:**
```tsx
const circularSettings = {
  count: 8,
  radius: 100,
  startAngle: 0,
  endAngle: 360,
  rotateAll: 0,
  rotateEach: 45,
  pointToCenter: true
}
```

### Grid Array

Creates shapes in a rectangular grid pattern.

**Properties:**
- `rows`: Number of rows (1-20)
- `columns`: Number of columns (1-20)
- `spacingX`: Horizontal spacing between shapes (10-500)
- `spacingY`: Vertical spacing between shapes (10-500)

**Example:**
```tsx
const gridSettings = {
  rows: 3,
  columns: 4,
  spacingX: 80,
  spacingY: 60
}
```

### Mirror

Creates a mirrored copy of the original shape.

**Properties:**
- `axis`: Mirror axis ('x', 'y', or 'diagonal')
- `offset`: Distance offset from original (0-200)
- `mergeThreshold`: Threshold for merging overlapping shapes (0-50)

**Example:**
```tsx
const mirrorSettings = {
  axis: 'x',
  offset: 20,
  mergeThreshold: 10
}
```

## Utility Functions

### Shape Utilities

The `shapeUtils.ts` file provides utility functions for common shape operations:

```tsx
import { 
  getShapeDimensions,
  calculateLinearPosition,
  calculateCircularPosition,
  applyShapeScaling,
  logShapeOperation
} from './utils/shapeUtils'

// Get shape dimensions
const { width, height } = getShapeDimensions(shape)

// Calculate position for linear array
const position = calculateLinearPosition(
  basePosition, 
  offset, 
  index, 
  spacing
)

// Calculate position for circular array
const position = calculateCircularPosition(
  center, 
  radius, 
  angle
)

// Apply scaling to shape
const scaledShape = applyShapeScaling(shape, scaleX, scaleY)

// Log shape operations
logShapeOperation('Operation Name', shapeId, { data: 'value' })
```

### Constants

The `constants.ts` file contains shared constants and default values:

```tsx
import { 
  MODIFIER_TYPES,
  DEFAULT_SETTINGS,
  MODIFIER_DISPLAY_NAMES,
  INPUT_CONSTRAINTS
} from './constants'

// Available modifier types
console.log(MODIFIER_TYPES) // ['linear-array', 'circular-array', 'grid-array', 'mirror']

// Default settings for each type
console.log(DEFAULT_SETTINGS['linear-array'])

// Display names for UI
console.log(MODIFIER_DISPLAY_NAMES['linear-array']) // 'Linear Array'

// Input constraints for validation
console.log(INPUT_CONSTRAINTS.count) // { min: 2, max: 50, step: 1 }
```

## Error Handling

The system includes an ErrorBoundary component to handle errors gracefully:

```tsx
import { ModifierErrorBoundary } from './components/modifiers/ErrorBoundary'

function App() {
  return (
    <ModifierErrorBoundary>
      <ModifierControls selectedShapes={selectedShapes} />
    </ModifierErrorBoundary>
  )
}
```

## Performance Considerations

1. **Shape Cloning**: Modifiers create clones of shapes rather than modifying originals
2. **Efficient Updates**: Only affected shapes are updated when modifier settings change
3. **Cleanup**: Unused clones are automatically cleaned up when modifiers are disabled
4. **Batch Operations**: Multiple shape operations are batched for better performance

## Best Practices

1. **Use Stacked Modifiers**: For complex transformations, use the stacked modifier system
2. **Limit Clone Count**: Keep the number of clones reasonable (under 50) for performance
3. **Clean Up**: Remove unused modifiers to free up resources
4. **Test Thoroughly**: Test modifiers with different shape types and sizes

## Troubleshooting

### Common Issues

1. **Shapes not appearing**: Check if the modifier is enabled and the shape is selected
2. **Performance issues**: Reduce the number of clones or disable unused modifiers
3. **Incorrect positioning**: Verify offset and spacing values are appropriate for your use case
4. **Scaling not working**: Ensure the shape type supports scaling operations

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
DEBUG_MODIFIERS=true
```

This will log detailed information about modifier operations to the console.

## Contributing

When adding new modifier types:

1. Create the modifier component in `modifiers/`
2. Create the controls component in `controls/`
3. Add the modifier to the registry in `ModifierRegistry.tsx`
4. Update the factory in `ModifierFactory.tsx`
5. Add tests and documentation
6. Update constants and types as needed 