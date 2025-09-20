import { HTMLContainer, T, type TLBaseShape, type RecordProps, type VecLike } from 'tldraw'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'

export type CustomArrowShape = TLBaseShape<
  'custom-arrow',
  {
    w: number
    h: number
    color: string
    fillColor: string
    strokeWidth: number
    fill: boolean
    points?: VecLike[] // Optional path data for modified arrows
    renderAsPath?: boolean // Flag to render as path instead of geometry
  }
>

export class CustomArrowShapeUtil extends FlippableShapeUtil<CustomArrowShape> {
  static override type = 'custom-arrow' as const

  static override props: RecordProps<CustomArrowShape> = {
    w: T.number,
    h: T.number,
    color: T.string,
    fillColor: T.string,
    strokeWidth: T.number,
    fill: T.boolean,
  }

  override getDefaultProps(): CustomArrowShape['props'] {
    return {
      w: 150,
      h: 80,
      strokeWidth: 2, // Arrow uses thicker stroke by default
      ...this.getCommonDefaultProps(),
    }
  }

  override component(shape: CustomArrowShape) {
    const { w, h, color, fillColor, strokeWidth, fill } = shape.props
    
    // Get flip transform from the FlippableShapeUtil
    const flipTransform = this.getFlipTransform(shape)
    
    // Create asymmetrical arrow path - pointing right with notched tail
    // This will make flipping very obvious
    const pathData = [
      `M 0 ${h * 0.4}`,           // Start at left, middle-high
      `L ${w * 0.6} ${h * 0.4}`,  // Line to 60% right
      `L ${w * 0.6} ${h * 0.1}`,  // Line up to create arrowhead
      `L ${w} ${h * 0.5}`,        // Line to tip of arrow (right point)
      `L ${w * 0.6} ${h * 0.9}`,  // Line down to bottom of arrowhead
      `L ${w * 0.6} ${h * 0.6}`,  // Line down
      `L ${w * 0.2} ${h * 0.6}`,  // Line left to create notch
      `L ${w * 0.2} ${h * 0.8}`,  // Line down for tail bottom
      `L 0 ${h * 0.8}`,           // Line to left edge, bottom
      `L ${w * 0.1} ${h * 0.6}`,  // Diagonal cut in tail (asymmetric!)
      `Z`                         // Close path
    ].join(' ')
    
    return (
      <HTMLContainer>
        <svg 
          width={w} 
          height={h} 
          style={{ 
            overflow: 'visible',
            ...flipTransform
          }}
        >
          <path 
            d={pathData} 
            fill={fill ? fillColor : 'none'} 
            stroke={color} 
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Add a small dot to make orientation super obvious */}
          <circle
            cx={w * 0.3}
            cy={h * 0.2}
            r={3}
            fill={fillColor}
            opacity={0.7}
          />
          
          {/* Add text to show direction */}
          <text
            x={w * 0.25}
            y={h * 0.5}
            fontSize="12"
            fill={fillColor}
            textAnchor="middle"
            dominantBaseline="middle"
            opacity={0.8}
          >
            →
          </text>
        </svg>
      </HTMLContainer>
    )
  }

  override indicator(shape: CustomArrowShape) {
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

  getBounds(shape: CustomArrowShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  getCenter(shape: CustomArrowShape) {
    return {
      x: shape.props.w / 2,
      y: shape.props.h / 2,
    }
  }

  getOutline(shape: CustomArrowShape) {
    const { w, h } = shape.props
    // Return the key points of the arrow shape
    return [
      { x: 0, y: h * 0.4 },           // Left start
      { x: w * 0.6, y: h * 0.1 },     // Top of arrowhead
      { x: w, y: h * 0.5 },           // Arrow tip
      { x: w * 0.6, y: h * 0.9 },     // Bottom of arrowhead  
      { x: w * 0.2, y: h * 0.8 },     // Tail bottom
      { x: 0, y: h * 0.8 },           // Left bottom
      { x: w * 0.1, y: h * 0.6 },     // Asymmetric cut
    ]
  }

  // Custom flip behavior for arrow-specific properties
  protected override onFlipCustom(
    shape: CustomArrowShape, 
    // _direction: 'horizontal' | 'vertical',
    // _isFlippedX: boolean,
    // _isFlippedY: boolean
  ): CustomArrowShape {
    // For arrows, we don't need to adjust any internal properties
    // The CSS transform handles the visual flipping perfectly
    return shape
  }

  override canResize = () => true as const
  override canBind = () => true as const
}