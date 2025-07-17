import { type TLShape } from 'tldraw'
import { type TLModifier } from '../../../types/modifiers'
import { LinearArrayModifier } from '../modifiers/LinearArrayModifier'
import { CircularArrayModifier } from '../modifiers/CircularArrayModifier'
import { GridArrayModifier } from '../modifiers/GridArrayModifier'
import { MirrorModifier } from '../modifiers/MirrorModifier'
import { StackedModifier } from '../StackedModifier'

interface ModifierFactoryProps {
  shape: TLShape
  modifier: TLModifier
}

export function ModifierFactory({ shape, modifier }: ModifierFactoryProps) {
  // Handle individual modifier types
  switch (modifier.type) {
    case 'linear-array':
      return (
        <LinearArrayModifier
          shape={shape}
          settings={modifier.props}
          enabled={modifier.enabled}
        />
      )
    
    case 'circular-array':
      return (
        <CircularArrayModifier
          shape={shape}
          settings={modifier.props}
          enabled={modifier.enabled}
        />
      )
    
    case 'grid-array':
      return (
        <GridArrayModifier
          shape={shape}
          settings={modifier.props}
          enabled={modifier.enabled}
        />
      )
    
    case 'mirror':
      return (
        <MirrorModifier
          shape={shape}
          settings={modifier.props}
          enabled={modifier.enabled}
        />
      )
    
    default: {
      const exhaustiveCheck: never = modifier
      console.warn(`Unknown modifier type: ${(exhaustiveCheck as any).type}`)
      return null
    }
  }
} 