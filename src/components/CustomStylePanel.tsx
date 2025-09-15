import { type TLUiStylePanelProps } from 'tldraw'
import { FloatingPanelSystem } from './panels/FloatingPanelSystem'

export const CustomStylePanel = (props: TLUiStylePanelProps) => {
  console.log('CustomStylePanel props:', props)
  return <FloatingPanelSystem />
}
