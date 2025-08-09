import type { TLShapeId } from 'tldraw'

export type GeneratorType = 'random-walk'

export type BoundsMode = 'page' | 'wrap' | 'reflect' | 'clamp'

export interface Vec2 {
  x: number
  y: number
}

export interface RandomWalkSettings {
  steps: number
  stepLength: number
  start: Vec2
  seed: number
  throttleFps: number
  showPoints: boolean
  showCurve: boolean
}

export type GeneratorTarget =
  | { mode: 'page' }
  | { mode: 'shape'; shapeId: TLShapeId }

export interface TLGeneratorBase<TSettings> {
  id: string
  type: GeneratorType
  target: GeneratorTarget
  enabled: boolean
  running: boolean
  settings: TSettings
  // runtime fields (non-persistent)
  previewShapeId?: TLShapeId
  resetTimestamp?: number
}

export interface GeneratorProcessor<TSettings, TRuntime = unknown> {
  init: (settings: TSettings, seed: number) => TRuntime
  step?: (runtime: TRuntime, dtMs: number) => void
  generate: (runtime: TRuntime) => { points: Vec2[] }
}

export type RandomWalkGenerator = TLGeneratorBase<RandomWalkSettings>

export function getDefaultRandomWalkSettings(): RandomWalkSettings {
  return {
    steps: 500,
    stepLength: 20,
    start: { x: 400, y: 300 },
    seed: 1,
    throttleFps: 30,
    showPoints: false,
    showCurve: true,
  }
}
