import { BaseBoxShapeUtil, HTMLContainer, T, type TLBaseShape, type RecordProps } from 'tldraw'

export type SineWaveShape = TLBaseShape<
  'sine-wave',
  {
    w: number
    h: number
    length: number
    amplitude: number
    frequency: number
    phase: number
    strokeWidth: number
    color: string
  }
>

export class SineWaveShapeUtil extends BaseBoxShapeUtil<SineWaveShape> {
  static override type = 'sine-wave' as const

  static override props: RecordProps<SineWaveShape> = {
    w: T.number,
    h: T.number,
    length: T.number,
    amplitude: T.number,
    frequency: T.number,
    phase: T.number,
    strokeWidth: T.number,
    color: T.string,
  }

  override getDefaultProps(): SineWaveShape['props'] {
    return {
      w: 200,
      h: 100,
      length: 200,
      amplitude: 40,
      frequency: 1,
      phase: 0,
      strokeWidth: 2,
      color: 'black',
    }
  }

  override component(shape: SineWaveShape) {
    const { frequency, phase, strokeWidth, color } = shape.props
    
    // Use the drawn box as the container for the wave
    const waveWidth = shape.props.w
    const amplitude = Math.max(1, shape.props.h / 2)
    const waveHeight = amplitude * 2
    
    // Generate sine wave path
    const points: string[] = []
    const steps = Math.max(50, waveWidth) // Ensure smooth curve
    
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * waveWidth
      const radians = (phase * Math.PI / 180) + (x * frequency * 2 * Math.PI / waveWidth)
      const y = amplitude + amplitude * Math.sin(radians)
      
      if (i === 0) {
        points.push(`M${x},${y}`)
      } else {
        points.push(`L${x},${y}`)
      }
    }
    
    const pathData = points.join(' ')
    
    return (
      <HTMLContainer>
        <svg 
          width={waveWidth} 
          height={waveHeight} 
          style={{ overflow: 'visible' }}
        >
          <path 
            d={pathData} 
            fill="none" 
            stroke={color} 
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </HTMLContainer>
    )
  }

  override indicator(shape: SineWaveShape) {
    return (
      <rect 
        width={shape.props.w} 
        height={shape.props.h} 
        fill="none" 
        stroke="var(--color-selection-stroke)" 
        strokeWidth={1}
      />
    )
  }

  getBounds(shape: SineWaveShape) {
    const waveWidth = shape.props.w
    const waveHeight = shape.props.h
    return {
      x: 0,
      y: 0,
      w: waveWidth,
      h: waveHeight,
    }
  }

  getCenter(shape: SineWaveShape) {
    const waveWidth = shape.props.w
    const waveHeight = shape.props.h
    return {
      x: waveWidth / 2,
      y: waveHeight / 2,
    }
  }

  getOutline(shape: SineWaveShape) {
    const waveWidth = shape.props.w
    const waveHeight = shape.props.h
    return [
      { x: 0, y: 0 },
      { x: waveWidth, y: 0 },
      { x: waveWidth, y: waveHeight },
      { x: 0, y: waveHeight },
    ]
  }

  // Keep internal parameters in sync with the drawn bounds
  // - If the user changes w/h (drag draw or resize), update length/amplitude from w/h
  // - If the controls change length/amplitude, update w/h to match

  // Update w and h when wave parameters change (but not during resize)
  override onBeforeUpdate = (prev: SineWaveShape, next: SineWaveShape) => {
    // If user edited the drawn box (w/h changed), derive logical params
    if (prev.props.w !== next.props.w || prev.props.h !== next.props.h) {
      const derivedLength = Math.max(50, Math.round(next.props.w))
      const derivedAmplitude = Math.max(2, Math.round(next.props.h / 2))
      return {
        ...next,
        props: {
          ...next.props,
          length: derivedLength,
          amplitude: derivedAmplitude,
        },
      }
    }

    // If logical params changed via controls, sync the box
    const waveWidth = next.props.length
    const waveHeight = next.props.amplitude * 2

    if (next.props.w !== waveWidth || next.props.h !== waveHeight) {
      return {
        ...next,
        props: {
          ...next.props,
          w: waveWidth,
          h: waveHeight,
        },
      }
    }

    return next
  }

  override canResize = () => true as const
  override canBind = () => false as const
}
