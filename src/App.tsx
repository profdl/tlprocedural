import { TldrawCanvas } from './components/TldrawCanvas'
import { CustomShapesProvider } from './components/providers/CustomShapesProvider'
import './App.css'

function App() {
  return (
    <div className="app">
      <CustomShapesProvider>
        <TldrawCanvas />
      </CustomShapesProvider>
    </div>
  )
}

export default App
