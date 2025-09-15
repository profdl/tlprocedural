import { type TLUiStylePanelProps } from 'tldraw'
import { StackedPanelSystem } from './panels/StackedPanelSystem'

export const CustomStylePanel = (props: TLUiStylePanelProps) => {
  console.log('CustomStylePanel props:', props)
  return <StackedPanelSystem />
}
