// no React imports needed for tldraw shape utils
import { BaseBoxShapeUtil, HTMLContainer, T } from 'tldraw'
import type { TLBaseShape, RecordProps } from 'tldraw'

export type GeneratedPathShape = TLBaseShape<
  'generated-path',
  {
    d: string
    stroke: string
    strokeWidth: number
    isPreview: boolean
    w: number
    h: number
  }
>

export class GeneratedPathShapeUtil extends BaseBoxShapeUtil<GeneratedPathShape> {
  static override type = 'generated-path' as const

  static override props: RecordProps<GeneratedPathShape> = {
    d: T.string,
    stroke: T.string,
    strokeWidth: T.number,
    isPreview: T.boolean,
    w: T.number,
    h: T.number,
  }

  override getDefaultProps(): GeneratedPathShape['props'] {
    return {
      d: '',
      stroke: '#222',
      strokeWidth: 2,
      isPreview: true,
      w: 1,
      h: 1,
    }
  }

  override component(shape: GeneratedPathShape) {
    const { d, stroke, strokeWidth } = shape.props
    return (
      <HTMLContainer>
        <svg width={shape.props.w} height={shape.props.h} style={{ overflow: 'visible' }}>
          <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      </HTMLContainer>
    )
  }

  override indicator(shape: GeneratedPathShape) {
    return <path d={shape.props.d} />
  }
}


