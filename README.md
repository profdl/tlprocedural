# Tldraw React App

A modern React application built with Vite that integrates the powerful [tldraw](https://github.com/tldraw/tldraw) canvas for drawing, note-taking, and diagramming, featuring an advanced modifier system for shape transformations.

## Features

- **Full-featured Drawing Canvas**: Built on tldraw's powerful canvas engine
- **Interactive Toolbar**: Custom controls to interact with the canvas
- **Shape Management**: Track shape count in real-time
- **Advanced Modifier System**: Transform shapes with arrays, mirrors, and patterns
  - Linear Arrays: Create series of shapes in straight lines
  - Circular Arrays: Arrange shapes in circular patterns
  - Grid Arrays: Create rectangular grid patterns
  - Mirror Effects: Create mirrored copies of shapes
- **Canvas Actions**: 
  - Add random shapes programmatically
  - Clear the entire canvas
  - Export canvas as SVG
- **Responsive Design**: Full-screen layout optimized for drawing
- **TypeScript Support**: Fully typed for better development experience
- **Zustand State Management**: Centralized state management for modifiers

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm

### Installation

The project is already set up with all dependencies installed. To run the development server:

```bash
npm run dev
```

This will start the development server, typically on `http://localhost:5173`.

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the project for production
- `npm run preview` - Preview the production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/
│   ├── TldrawCanvas.tsx           # Main tldraw canvas component with controls
│   ├── CustomStylePanel.tsx       # Style and modifier management panel
│   ├── ModifierRenderer.tsx       # Renders modifiers for selected shapes
│   └── modifiers/                 # Modifier system components
│       ├── ModifierControls.tsx   # Main modifier UI controls
│       ├── StackedModifier.tsx    # Processes multiple modifiers in sequence

│       ├── README.md              # Detailed modifier system documentation
│       ├── constants.ts           # Shared constants and defaults
│       ├── hooks/
│       │   ├── useModifierManager.ts # Modifier management hooks
│       │   └── useModifierStack.ts   # Shape-specific modifier processing
│       ├── controls/              # Modifier-specific control components
│       │   ├── LinearArrayControls.tsx
│       │   ├── CircularArrayControls.tsx
│       │   ├── GridArrayControls.tsx
│       │   ├── MirrorControls.tsx
│       │   └── [shared components]
│       ├── components/            # Reusable UI components
│       │   └── AddButton.tsx      # Add modifier button component
│       ├── registry/
│       │   └── ModifierRegistry.ts # Registry for available modifiers
│       └── utils/
│           ├── shapeUtils.ts      # Utility functions for shape operations
│           └── errorBoundary.tsx  # Error handling component
├── store/
│   ├── modifierStore.ts           # Zustand store for modifier state
│   └── modifierStack.ts           # Modifier processing logic
├── types/
│   └── modifiers.ts               # TypeScript type definitions
├── App.tsx                        # Main application component
├── App.css                        # Application styles
├── index.css                      # Global styles
└── main.tsx                       # Application entry point
```

## Usage

### Basic Drawing

The app provides a full-featured drawing canvas where you can:
- Use various drawing tools (pen, shapes, text, etc.)
- Select and manipulate objects
- Create geometric shapes
- Add text and sticky notes
- Draw freehand

### Modifier System

The app includes an advanced modifier system for transforming shapes:

1. **Select a shape** on the canvas
2. **Open the Modifiers tab** in the style panel (right sidebar)
3. **Add modifiers** using the "+" button:
   - **Linear Array**: Creates copies in a straight line
   - **Circular Array**: Arranges copies in a circle
   - **Grid Array**: Creates a rectangular grid
   - **Mirror**: Creates mirrored copies
4. **Adjust settings** using the interactive controls
5. **Enable/disable** modifiers as needed

### Interactive Features

The custom toolbar provides several interactive features:

- **Shape Counter**: Shows the current number of shapes on the canvas
- **Add Random Shape**: Programmatically adds a random blue rectangle to the canvas
- **Export SVG**: Exports the current canvas as an SVG (check browser console)
- **Clear Canvas**: Removes all shapes from the canvas

### Customization

The `TldrawCanvas` component demonstrates how to:
- Access the tldraw editor instance
- Listen for canvas changes
- Programmatically create shapes
- Export canvas content
- Manipulate canvas state

## Architecture

### State Management

The app uses **Zustand** for centralized state management:

- **`useModifierStore`**: Central store for all modifier data
- **`useModifierManager`**: Hook for modifier CRUD operations
- **`useModifierStack`**: Hook for shape-specific modifier processing
- **`useAllModifierStacks`**: Hook for global modifier management

### Modifier System

The modifier system is built with a unified architecture:

1. **Store Layer**: Zustand store manages modifier state
2. **Processing Layer**: `ModifierStack` processes modifiers into shape instances
3. **Rendering Layer**: `ModifierRenderer` renders processed shapes on canvas
4. **UI Layer**: `ModifierControls` provides user interface

### Key Components

- **`ModifierControls`**: Main UI for managing modifiers
- **`ModifierRenderer`**: Renders modifier effects on selected shapes
- **`StackedModifier`**: Processes multiple modifiers in sequence
- **`ModifierStack`**: Core processing logic for shape transformations

## Tldraw Integration

This app uses the latest version of tldraw with:
- React 18 support
- TypeScript integration
- Custom event handling
- Programmatic shape creation
- Canvas state management
- Custom modifier system integration

## Development

To extend this app:

1. **Add Custom Tools**: Create custom tldraw tools by extending the base tool classes
2. **Custom Shapes**: Define your own shape types with custom rendering
3. **New Modifiers**: Add new modifier types by extending the modifier system
4. **State Persistence**: Save and load canvas state to/from localStorage or a backend
5. **Collaboration**: Add real-time collaboration features using tldraw's sync capabilities
6. **Custom UI**: Replace or extend the default tldraw UI components

## Learn More

- [Tldraw Documentation](https://tldraw.dev)
- [Tldraw Examples](https://github.com/tldraw/tldraw/tree/main/apps/examples)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

## License

This project is open source and available under the MIT License.
