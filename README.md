# Tldraw React App

A modern React application built with Vite that integrates the powerful [tldraw](https://github.com/tldraw/tldraw) canvas for drawing, note-taking, and diagramming.

## Features

- **Full-featured Drawing Canvas**: Built on tldraw's powerful canvas engine
- **Interactive Toolbar**: Custom controls to interact with the canvas
- **Shape Management**: Track shape count in real-time
- **Canvas Actions**: 
  - Add random shapes programmatically
  - Clear the entire canvas
  - Export canvas as SVG
- **Responsive Design**: Full-screen layout optimized for drawing
- **TypeScript Support**: Fully typed for better development experience

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
│   └── TldrawCanvas.tsx    # Main tldraw canvas component with controls
├── App.tsx                 # Main application component
├── App.css                 # Application styles
├── index.css               # Global styles
└── main.tsx               # Application entry point
```

## Usage

### Basic Drawing

The app provides a full-featured drawing canvas where you can:
- Use various drawing tools (pen, shapes, text, etc.)
- Select and manipulate objects
- Create geometric shapes
- Add text and sticky notes
- Draw freehand

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

## Tldraw Integration

This app uses the latest version of tldraw with:
- React 18 support
- TypeScript integration
- Custom event handling
- Programmatic shape creation
- Canvas state management

## Development

To extend this app:

1. **Add Custom Tools**: Create custom tldraw tools by extending the base tool classes
2. **Custom Shapes**: Define your own shape types with custom rendering
3. **State Persistence**: Save and load canvas state to/from localStorage or a backend
4. **Collaboration**: Add real-time collaboration features using tldraw's sync capabilities
5. **Custom UI**: Replace or extend the default tldraw UI components

## Learn More

- [Tldraw Documentation](https://tldraw.dev)
- [Tldraw Examples](https://github.com/tldraw/tldraw/tree/main/apps/examples)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

## License

This project is open source and available under the MIT License.
