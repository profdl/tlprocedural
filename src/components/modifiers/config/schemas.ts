import type { 
  LinearArraySettings, 
  CircularArraySettings, 
  GridArraySettings, 
  MirrorSettings, 
  LSystemSettings 
} from '../../../types/modifiers'
import { INPUT_CONSTRAINTS, MIRROR_AXIS_OPTIONS } from '../constants'

// Input configuration types
export interface NumberInputConfig {
  type: 'number'
  label: string
  field: string
  min: number
  max: number
  step: number
  precision?: number
  unit?: string
  fullWidth?: boolean
}

export interface CheckboxInputConfig {
  type: 'checkbox'
  label: string
  field: string
  fullWidth?: boolean
}

export interface SelectInputConfig {
  type: 'select'
  label: string
  field: string
  options: Array<{ value: any; label: string }>
  fullWidth?: boolean
}

export type InputConfig = NumberInputConfig | CheckboxInputConfig | SelectInputConfig

// Schema type for modifier UI configuration
export interface ModifierSchema<T = any> {
  inputs: InputConfig[]
  validate?: (settings: T) => boolean
}

// Type-safe schema mapping
export interface ModifierSchemas {
  'linear-array': ModifierSchema<LinearArraySettings>
  'circular-array': ModifierSchema<CircularArraySettings>
  'grid-array': ModifierSchema<GridArraySettings>
  'mirror': ModifierSchema<MirrorSettings>
  'lsystem': ModifierSchema<LSystemSettings>
}

// Modifier UI schemas configuration
export const MODIFIER_SCHEMAS: ModifierSchemas = {
  'linear-array': {
    inputs: [
      {
        type: 'number',
        label: 'Count',
        field: 'count',
        min: INPUT_CONSTRAINTS.count.min,
        max: INPUT_CONSTRAINTS.count.max,
        step: INPUT_CONSTRAINTS.count.step,
        precision: 0
      },
      {
        type: 'number',
        label: 'Offset X',
        field: 'offsetX',
        min: INPUT_CONSTRAINTS.offsetX.min,
        max: INPUT_CONSTRAINTS.offsetX.max,
        step: INPUT_CONSTRAINTS.offsetX.step,
        precision: 1,
        unit: '%'
      },
      {
        type: 'number',
        label: 'Offset Y',
        field: 'offsetY',
        min: INPUT_CONSTRAINTS.offsetY.min,
        max: INPUT_CONSTRAINTS.offsetY.max,
        step: INPUT_CONSTRAINTS.offsetY.step,
        precision: 1,
        unit: '%'
      },
      {
        type: 'number',
        label: 'Rotation',
        field: 'rotation',
        min: INPUT_CONSTRAINTS.rotation.min,
        max: INPUT_CONSTRAINTS.rotation.max,
        step: INPUT_CONSTRAINTS.rotation.step,
        precision: 2,
        unit: '°'
      },
      {
        type: 'number',
        label: 'Scale Step',
        field: 'scaleStep',
        min: INPUT_CONSTRAINTS.scaleStep.min,
        max: INPUT_CONSTRAINTS.scaleStep.max,
        step: INPUT_CONSTRAINTS.scaleStep.step,
        precision: INPUT_CONSTRAINTS.scaleStep.precision
      }
    ]
  },
  
  'circular-array': {
    inputs: [
      {
        type: 'number',
        label: 'Count',
        field: 'count',
        min: INPUT_CONSTRAINTS.count.min,
        max: INPUT_CONSTRAINTS.count.max,
        step: INPUT_CONSTRAINTS.count.step,
        precision: 0
      },
      {
        type: 'number',
        label: 'Radius',
        field: 'radius',
        min: INPUT_CONSTRAINTS.radius.min,
        max: INPUT_CONSTRAINTS.radius.max,
        step: INPUT_CONSTRAINTS.radius.step,
        precision: 1
      },
      {
        type: 'number',
        label: 'Start Angle',
        field: 'startAngle',
        min: INPUT_CONSTRAINTS.startAngle.min,
        max: INPUT_CONSTRAINTS.startAngle.max,
        step: INPUT_CONSTRAINTS.startAngle.step,
        precision: 1,
        unit: '°'
      },
      {
        type: 'number',
        label: 'End Angle',
        field: 'endAngle',
        min: INPUT_CONSTRAINTS.endAngle.min,
        max: INPUT_CONSTRAINTS.endAngle.max,
        step: INPUT_CONSTRAINTS.endAngle.step,
        precision: 1,
        unit: '°'
      },
      {
        type: 'number',
        label: 'Center X',
        field: 'centerX',
        min: INPUT_CONSTRAINTS.centerX.min,
        max: INPUT_CONSTRAINTS.centerX.max,
        step: INPUT_CONSTRAINTS.centerX.step,
        precision: 1
      },
      {
        type: 'number',
        label: 'Center Y',
        field: 'centerY',
        min: INPUT_CONSTRAINTS.centerY.min,
        max: INPUT_CONSTRAINTS.centerY.max,
        step: INPUT_CONSTRAINTS.centerY.step,
        precision: 1
      },
      {
        type: 'number',
        label: 'Rotate Each',
        field: 'rotateEach',
        min: INPUT_CONSTRAINTS.rotateEach.min,
        max: INPUT_CONSTRAINTS.rotateEach.max,
        step: INPUT_CONSTRAINTS.rotateEach.step,
        precision: 1,
        unit: '°'
      },
      {
        type: 'number',
        label: 'Rotate All',
        field: 'rotateAll',
        min: INPUT_CONSTRAINTS.rotateAll.min,
        max: INPUT_CONSTRAINTS.rotateAll.max,
        step: INPUT_CONSTRAINTS.rotateAll.step,
        precision: 1,
        unit: '°'
      },
      {
        type: 'checkbox',
        label: 'Align to Tangent',
        field: 'alignToTangent',
        fullWidth: true
      }
    ]
  },
  
  'grid-array': {
    inputs: [
      {
        type: 'number',
        label: 'Rows',
        field: 'rows',
        min: INPUT_CONSTRAINTS.rows.min,
        max: INPUT_CONSTRAINTS.rows.max,
        step: INPUT_CONSTRAINTS.rows.step,
        precision: 0
      },
      {
        type: 'number',
        label: 'Columns',
        field: 'columns',
        min: INPUT_CONSTRAINTS.columns.min,
        max: INPUT_CONSTRAINTS.columns.max,
        step: INPUT_CONSTRAINTS.columns.step,
        precision: 0
      },
      {
        type: 'number',
        label: 'Spacing X',
        field: 'spacingX',
        min: INPUT_CONSTRAINTS.spacingX.min,
        max: INPUT_CONSTRAINTS.spacingX.max,
        step: INPUT_CONSTRAINTS.spacingX.step,
        precision: 1
      },
      {
        type: 'number',
        label: 'Spacing Y',
        field: 'spacingY',
        min: INPUT_CONSTRAINTS.spacingY.min,
        max: INPUT_CONSTRAINTS.spacingY.max,
        step: INPUT_CONSTRAINTS.spacingY.step,
        precision: 1
      },
      {
        type: 'number',
        label: 'Offset X',
        field: 'offsetX',
        min: INPUT_CONSTRAINTS.offsetX.min,
        max: INPUT_CONSTRAINTS.offsetX.max,
        step: INPUT_CONSTRAINTS.offsetX.step,
        precision: 1
      },
      {
        type: 'number',
        label: 'Offset Y',
        field: 'offsetY',
        min: INPUT_CONSTRAINTS.offsetY.min,
        max: INPUT_CONSTRAINTS.offsetY.max,
        step: INPUT_CONSTRAINTS.offsetY.step,
        precision: 1
      }
    ]
  },
  
  'mirror': {
    inputs: [
      {
        type: 'select',
        label: 'Mirror Axis',
        field: 'axis',
        options: MIRROR_AXIS_OPTIONS.map(option => ({
          value: option.value,
          label: option.label
        })),
        fullWidth: true
      },
      {
        type: 'number',
        label: 'Offset',
        field: 'offset',
        min: INPUT_CONSTRAINTS.offset.min,
        max: INPUT_CONSTRAINTS.offset.max,
        step: INPUT_CONSTRAINTS.offset.step,
        precision: 1
      },
      {
        type: 'number',
        label: 'Merge Threshold',
        field: 'mergeThreshold',
        min: INPUT_CONSTRAINTS.mergeThreshold.min,
        max: INPUT_CONSTRAINTS.mergeThreshold.max,
        step: INPUT_CONSTRAINTS.mergeThreshold.step,
        precision: 1
      }
    ]
  },
  
  'lsystem': {
    inputs: [
      // L-System inputs are more complex and may need special handling
      // For now, we'll add basic numeric inputs
      {
        type: 'number',
        label: 'Iterations',
        field: 'iterations',
        min: 1,
        max: 10,
        step: 1,
        precision: 0
      },
      {
        type: 'number',
        label: 'Angle',
        field: 'angle',
        min: 0,
        max: 180,
        step: 1,
        precision: 0,
        unit: '°'
      },
      {
        type: 'number',
        label: 'Step %',
        field: 'stepPercent',
        min: 10,
        max: 200,
        step: 5,
        precision: 0,
        unit: '%'
      },
      {
        type: 'number',
        label: 'Length Decay',
        field: 'lengthDecay',
        min: 0.1,
        max: 2,
        step: 0.01,
        precision: 2
      },
      {
        type: 'number',
        label: 'Scale/Iteration',
        field: 'scalePerIteration',
        min: 0.1,
        max: 2,
        step: 0.01,
        precision: 2
      }
    ]
  }
}

// Helper function to get schema for a modifier type
export function getModifierSchema(type: keyof ModifierSchemas): ModifierSchema {
  return MODIFIER_SCHEMAS[type]
}

// Type guard functions
export function isNumberInputConfig(config: InputConfig): config is NumberInputConfig {
  return config.type === 'number'
}

export function isCheckboxInputConfig(config: InputConfig): config is CheckboxInputConfig {
  return config.type === 'checkbox'
}

export function isSelectInputConfig(config: InputConfig): config is SelectInputConfig {
  return config.type === 'select'
}