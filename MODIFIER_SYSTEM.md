# Tldraw Modifier System

A powerful Blender-style modifier system for tldraw that allows you to create parametric effects like arrays, mirrors, and deformations.

## 🚀 Features

- **Linear Array Modifier**: Create repeated copies of shapes with customizable spacing, rotation, and scaling
- **Live Parameter Control**: Real-time adjustment of modifier settings with immediate visual feedback
- **Performance Optimized**: Virtual rendering system that doesn't create actual shape records
- **Extensible Architecture**: Easy to add new modifier types
- **Tldraw Integration**: Seamlessly integrated with tldraw's UI and styling system

## 📋 How to Use

### 1. Select a Shape
Click on any shape in the tldraw canvas to select it.

### 2. Open the Style Panel
The style panel should appear on the right side of the screen when a shape is selected.

### 3. Access Modifiers
Scroll to the bottom of the style panel to find the "Modifiers" section.

### 4. Add a Linear Array Modifier
- Click the "+" button in the Modifiers section
- This will add a Linear Array modifier with default settings

### 5. Adjust Parameters
Use the controls to adjust the array:
- **Count**: Number of copies (2-50)
- **Offset X**: Horizontal spacing between copies
- **Offset Y**: Vertical spacing between copies  
- **Rotation**: Rotation increment per copy (degrees)
- **Spacing**: Multiplier for offset distances
- **Scale Step**: Scale change per copy

### 6. Live Preview
- Changes are applied in real-time as you adjust the sliders
- Virtual copies appear as dashed outlines with copy numbers
- Original shape remains editable

### 7. Remove Modifiers
- Click the "×" button next to any modifier to remove it

## 🎛️ Modifier Parameters

### Linear Array Settings
- `count`: Number of copies including the original (min: 2, max: 50)
- `offsetX`: Horizontal offset per copy in pixels (-200 to 200)
- `offsetY`: Vertical offset per copy in pixels (-200 to 200)
- `rotation`: Rotation increment per copy in degrees (-180 to 180)
- `spacing`: Multiplier for spacing (0.1 to 3.0)
- `scaleStep`: Scale multiplier per copy (0.5 to 2.0)

## 🎨 Visual Indicators

- **Virtual Copies**: Shown as dashed rectangles with copy numbers
- **Transparency**: Virtual copies are semi-transparent (60% opacity)
- **Non-Interactive**: Virtual copies don't respond to mouse interactions
- **Real-time Updates**: Immediately reflect parameter changes

## 🔧 Technical Architecture

### Core Components
- `useModifierStore`: Zustand store for centralized state management
- `useModifierManager`: Hook providing CRUD operations for modifiers
- `useModifierStack`: Hook for shape-specific modifier processing
- `StackedModifier`: Processes multiple modifiers in sequence
- `ModifierControls`: UI for parameter adjustment
- `ModifierRenderer`: Renders visualizations on canvas

### Performance Features
- **Virtual Rendering**: No actual shape records created for copies
- **Throttled Updates**: Smooth parameter adjustment without lag
- **Selective Re-rendering**: Only updates when settings change
- **Memory Efficient**: Reuses original shape data

### Storage System
- In-memory modifier storage (expandable to persistent storage)
- Automatic cleanup when shapes are deleted
- Export/import capabilities for persistence

## 🚀 Future Enhancements

### Planned Modifier Types
- **Radial Array**: Circular arrangements
- **Mirror**: Symmetrical copies across axes
- **Deform**: Bend, twist, wave effects
- **Instance**: Reference-based copying

### Advanced Features
- **Modifier Stack**: Multiple modifiers per shape
- **Modifier Chaining**: Output of one modifier as input to another
- **Presets**: Save and load common modifier configurations
- **Animation**: Animated parameter changes

## 🛠️ Development

### Adding New Modifier Types
1. Define the modifier type in `types/modifiers.ts`
2. Create calculation logic in `components/modifiers/`
3. Add UI controls in `ModifierControls.tsx`
4. Register in the modifier renderer

### Performance Considerations
- Use `useMemo` for expensive calculations
- Throttle rapid parameter changes
- Implement viewport culling for large arrays
- Consider LOD for distant copies

## 🎯 Use Cases

- **Technical Drawings**: Bolt patterns, grid layouts
- **Design Systems**: Component repetition with variations
- **Architecture**: Window arrays, structural patterns
- **Art & Illustration**: Pattern creation, symmetrical designs
- **UI Design**: Button arrays, navigation elements

Enjoy creating amazing parametric effects with the tldraw modifier system! 🎨 