# Modifiers System Documentation

## Overview

The Modifiers System provides a flexible way to create and manage shape transformations in the tldraw application. It supports multiple modifier types including linear arrays, circular arrays, grid arrays, and mirror effects. The system uses **Zustand** for centralized state management and a unified processing architecture for better performance and maintainability.

## Architecture

### State Management

The system uses **Zustand** for centralized state management:

- **`useModifierStore`**: Central Zustand store managing all modifier data
- **`useModifierManager`**: Hook providing CRUD operations for modifiers
- **`useModifierStack`**: Hook for shape-specific modifier processing
- **`useAllModifierStacks`**: Hook for global modifier management

### Core Components

- **ModifierControls**: Main UI component for managing modifiers
- **ModifierRenderer**: Renders modifier effects on selected shapes
- **StackedModifier**: Component for processing multiple modifiers in sequence
- **ModifierStack**: Core processing logic for shape transformations
- **ModifierRegistry**: Registry system for managing available modifiers

### Modifier Types

1. **Linear Array**: Creates a series of shapes in a straight line
2. **Circular Array**: Creates shapes arranged in a circle
3. **Grid Array**: Creates shapes in a grid pattern
4. **Mirror**: Creates a mirrored copy of the original shape

## File Structure

```
src/
├── store/
│   ├── modifierStore.ts           # Zustand store for modifier state
│   └── modifierStack.ts           # Modifier processing logic
├── components/modifiers/
│   ├── ModifierControls.tsx       # Main controls UI
│   ├── ModifierRenderer.tsx       # Renders modifiers for selected shapes
│   ├── StackedModifier.tsx        # Processes multiple modifiers

│   ├── constants.ts               # Shared constants and defaults
│   ├── hooks/
│   │   ├── useModifierManager.ts  # Modifier management hooks
│   │   └── useModifierStack.ts    # Shape-specific modifier processing
│   ├── utils/
│   │   ├── shapeUtils.ts          # Utility functions for shape operations
│   │   └── errorBoundary.tsx      # Error handling component
│   ├── controls/
│   │   ├── ModifierPropertyInput.tsx # Reusable input component
│   │   ├── ModifierSlider.tsx     # Reusable slider component
│   │   ├── NumberInput.tsx        # Reusable number input
│   │   ├── ModifierCheckboxInput.tsx # Reusable checkbox input
│   │   ├── LinearArrayControls.tsx # Linear array specific controls
│   │   ├── CircularArrayControls.tsx # Circular array specific controls
│   │   ├── GridArrayControls.tsx  # Grid array specific controls
│   │   └── MirrorControls.tsx     # Mirror specific controls
│   ├── components/
│   │   ├── AddButton.tsx          # Add modifier button component
│   │   ├── AddButton.css          # Add button styles
│   │   └── index.ts               # Component exports
│   └── registry/
│       └── ModifierRegistry.ts    # Registry for available modifiers
└── types/
    └── modifiers.ts               # TypeScript type definitions
```

## Usage

### Basic Usage

```tsx
import { ModifierControls } from './components/modifiers/ModifierControls'
import { useModifierManager } from './components/modifiers/hooks/useModifierManager'

function App() {
  const [selectedShapes, setSelectedShapes] = useState([])
  const modifierManager = useModifierManager()
  
  return (
    <div>
      <TldrawCanvas />
      <ModifierControls selectedShapes={selectedShapes} />
    </div>
  )
}
```

### Using the Zustand Store Directly

```tsx
import { useModifierStore } from './store/modifierStore'

function MyComponent() {
  const { 
    createModifier, 
    getModifiersForShape, 
    updateModifier, 
    deleteModifier 
  } = useModifierStore()

  // Add a linear array modifier
  const modifier = createModifier(shapeId, 'linear-array', {
    count: 5,
    offsetX: 50,
    offsetY: 0,
    rotation: 0,
    spacing: 1.2,
    scaleStep: 1.1
  })

  // Get modifiers for a shape
  const modifiers = getModifiersForShape(shapeId)

  // Update a modifier
  updateModifier(modifier.id, { props: { count: 10 } })

  // Delete a modifier
  deleteModifier(modifier.id)
}
```

### Using the Hook API

```tsx
import { useModifierManager } from './components/modifiers/hooks/useModifierManager'

function MyComponent() {
  const { 
    addModifier, 
    getModifiers, 
    updateModifier, 
    removeModifier 
  } = useModifierManager()

  // Add a modifier
  const modifier = addModifier(shapeId, 'linear-array')

  // Get modifiers for a shape
  const modifiers = getModifiers(shapeId)

  // Update a modifier
  updateModifier(shapeId, modifier.id, { 
    props: { count: 10 } 
  })

  // Remove a modifier
  removeModifier(shapeId, modifier.id)
}
```

### Shape-Specific Modifier Management

```tsx
import { useShapeModifiers } from './components/modifiers/hooks/useModifierManager'

function ShapeModifierPanel({ shapeId }) {
  const {
    modifiers,
    enabledModifiers,
    hasModifiers,
    addModifier,
    updateModifier,
    removeModifier,
    toggleModifier
  } = useShapeModifiers(shapeId)

  return (
    <div>
      {hasModifiers && (
        <div>
          {modifiers.map(modifier => (
            <div key={modifier.id}>
              <input 
                type="checkbox"
                checked={modifier.enabled}
                onChange={() => toggleModifier(modifier.id)}
              />
              <span>{modifier.type}</span>
              <button onClick={() => removeModifier(modifier.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      
      <button onClick={() => addModifier('linear-array')}>
        Add Linear Array
      </button>
    </div>
  )
}
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
  pointToCenter: false
}
```

### Grid Array

Creates shapes in a rectangular grid pattern.

**Properties:**
- `rows`: Number of rows (1-20)
- `columns`: Number of columns (1-20)
- `spacingX`: Horizontal spacing between shapes (10-200)
- `spacingY`: Vertical spacing between shapes (10-200)
- `offsetX`: Horizontal offset for the entire grid (-200 to 200)
- `offsetY`: Vertical offset for the entire grid (-200 to 200)

**Example:**
```tsx
const gridSettings = {
  rows: 3,
  columns: 4,
  spacingX: 80,
  spacingY: 60,
  offsetX: 0,
  offsetY: 0
}
```

### Mirror

Creates a mirrored copy of the original shape.

**Properties:**
- `axis`: Mirror axis ('x', 'y', or 'both')
- `offset`: Distance between original and mirrored shape (0-200)
- `mergeThreshold`: Distance threshold for merging overlapping shapes (0-50)

**Example:**
```tsx
const mirrorSettings = {
  axis: 'x',
  offset: 20,
  mergeThreshold: 5
}
```

## Processing Architecture

The modifier system uses a unified processing architecture:

1. **ModifierStack**: Processes modifiers into shape instances
2. **StackedModifier**: Manages the processing lifecycle
3. **ModifierRenderer**: Renders processed shapes on the canvas

### Processing Flow

1. **Input**: Original shape + modifier settings
2. **Processing**: ModifierStack applies transformations
3. **Output**: Array of shape instances with transforms
4. **Rendering**: ModifierRenderer creates tldraw shapes

### Performance Optimizations

- **Memoization**: Processing results are memoized based on shape and modifier state
- **Batch Updates**: Multiple shape updates are batched for better performance
- **Selective Re-rendering**: Only affected shapes are re-processed

## Error Handling

The system includes comprehensive error handling:

- **Error Boundaries**: Catches and displays errors gracefully
- **Validation**: Input validation for modifier settings
- **Fallbacks**: Graceful degradation when processing fails
- **Logging**: Detailed logging for debugging

## Development

### Adding New Modifier Types

1. **Define the type** in `types/modifiers.ts`
2. **Add controls** in `controls/` directory
3. **Implement processor** in `store/modifierStack.ts`
4. **Update registry** in `registry/ModifierRegistry.ts`
5. **Add to UI** in `ModifierControls.tsx`

### Testing

- **Unit Tests**: Test individual modifier processors
- **Integration Tests**: Test modifier system integration
- **UI Tests**: Test modifier controls and interactions

## Migration from Legacy System

The legacy modifier system (individual modifier components) has been removed. The new system provides:

- **Better Performance**: Unified processing architecture
- **Easier Maintenance**: Single codebase for all modifiers
- **Better State Management**: Zustand-based state management
- **Improved UX**: Consistent UI and behavior

## Troubleshooting

### Common Issues

1. **Modifiers not appearing**: Check if the shape is selected
2. **Performance issues**: Reduce modifier count or complexity
3. **Visual artifacts**: Check for overlapping shapes or extreme settings

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG_MODIFIERS=true npm run dev
```

## Contributing

When contributing to the modifier system:

1. **Follow the architecture**: Use the existing patterns
2. **Add tests**: Include unit and integration tests
3. **Update documentation**: Keep docs in sync with changes
4. **Consider performance**: Test with large numbers of shapes
5. **Maintain compatibility**: Don't break existing functionality 