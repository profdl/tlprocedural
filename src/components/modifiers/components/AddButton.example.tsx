import { AddButton, type AddButtonOption } from './AddButton'

/**
 * Example usage of AddButton for different features
 */

// Example 1: Adding tools
export function ToolsExample() {
  const toolOptions: AddButtonOption[] = [
    {
      id: 'brush',
      label: 'Brush Tool',
      icon: 'brush'
    },
    {
      id: 'eraser',
      label: 'Eraser',
      icon: 'eraser'
    },
    {
      id: 'text',
      label: 'Text Tool',
      icon: 'text'
    }
  ]

  const handleToolSelect = (toolId: string) => {
    console.log('Selected tool:', toolId)
  }

  return (
    <AddButton
      label="Add Tool"
      icon="plus"
      options={toolOptions}
      onSelect={handleToolSelect}
    />
  )
}

// Example 2: Adding layers
export function LayersExample() {
  const layerOptions: AddButtonOption[] = [
    {
      id: 'background',
      label: 'Background Layer',
      icon: 'layer'
    },
    {
      id: 'foreground',
      label: 'Foreground Layer',
      icon: 'layer'
    },
    {
      id: 'overlay',
      label: 'Overlay Layer',
      icon: 'layer'
    }
  ]

  const handleLayerSelect = (layerId: string) => {
    console.log('Selected layer:', layerId)
  }

  return (
    <AddButton
      label="Add Layer"
      icon="plus"
      options={layerOptions}
      onSelect={handleLayerSelect}
    />
  )
}

// Example 3: Adding effects
export function EffectsExample() {
  const effectOptions: AddButtonOption[] = [
    {
      id: 'shadow',
      label: 'Drop Shadow',
      icon: 'shadow'
    },
    {
      id: 'glow',
      label: 'Glow Effect',
      icon: 'glow'
    },
    {
      id: 'blur',
      label: 'Blur Effect',
      icon: 'blur'
    }
  ]

  const handleEffectSelect = (effectId: string) => {
    console.log('Selected effect:', effectId)
  }

  return (
    <AddButton
      label="Add Effect"
      icon="plus"
      options={effectOptions}
      onSelect={handleEffectSelect}
    />
  )
} 