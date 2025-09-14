import { type TLUiStylePanelProps } from 'tldraw'
import { PanelSystem } from './panels/PanelSystem'

export const CustomStylePanel = (props: TLUiStylePanelProps) => {
  console.log('CustomStylePanel props:', props)
  return <PanelSystem />
}
