import { BaseBoxShapeUtil, type TLResizeInfo, type TLBaseShape } from 'tldraw'

/**
 * A mixin utility that adds flipping support to any BaseBoxShapeUtil-based shape
 * 
 * Usage:
 * export class MyShapeUtil extends FlippableShapeUtil<MyShape> {
 *   // Your shape implementation
 * }
 */
export abstract class FlippableShapeUtil<T extends TLBaseShape<string, { w: number; h: number } & Record<string, any>>> extends BaseBoxShapeUtil<T> {
  
  override onResize = (shape: T, info: TLResizeInfo<T>) => {
    const { scaleX, scaleY } = info
    
    // Check for negative scaling (flipping)
    const isFlippedX = scaleX < 0
    const isFlippedY = scaleY < 0
    
    // Use absolute values for dimensions
    const absScaleX = Math.abs(scaleX)
    const absScaleY = Math.abs(scaleY)
    
    // Calculate new dimensions
    const newW = Math.max(10, Math.round((shape.props.w as number) * absScaleX))
    const newH = Math.max(10, Math.round((shape.props.h as number) * absScaleY))
    
    // Create base resized shape
    const resizedShape = {
      ...shape,
      props: {
        ...shape.props,
        w: newW,
        h: newH,
      },
      meta: {
        ...shape.meta,
        isFlippedX,
        isFlippedY,
      }
    }
    
    // Allow subclasses to customize flip behavior
    return this.onFlip ? this.onFlip(resizedShape, isFlippedX, isFlippedY, absScaleX, absScaleY) : resizedShape
  }
  
  /**
   * Override this method in your shape util to customize flip behavior
   * Called when a flip operation occurs during resize
   */
  protected onFlip?(
    shape: T, 
    isFlippedX: boolean, 
    isFlippedY: boolean, 
    scaleX: number, 
    scaleY: number
  ): T
  
  /**
   * Utility method to check if shape is flipped horizontally
   */
  protected isFlippedX(shape: T): boolean {
    return shape.meta?.isFlippedX === true
  }
  
  /**
   * Utility method to check if shape is flipped vertically
   */
  protected isFlippedY(shape: T): boolean {
    return shape.meta?.isFlippedY === true
  }
  
  /**
   * Utility method to apply CSS transform for horizontal flipping
   */
  protected getFlipTransform(shape: T): { transform?: string; transformOrigin?: string } {
    const isFlippedX = this.isFlippedX(shape)
    const isFlippedY = this.isFlippedY(shape)
    
    if (!isFlippedX && !isFlippedY) return {}
    
    const transforms: string[] = []
    if (isFlippedX) transforms.push('scaleX(-1)')
    if (isFlippedY) transforms.push('scaleY(-1)')
    
    return {
      transform: transforms.join(' '),
      transformOrigin: `${(shape.props.w as number) / 2}px ${(shape.props.h as number) / 2}px`
    }
  }
}

/**
 * Helper method to add flipping support to onResize handler
 * Use this in your shape's onResize method for simple flipping support
 * 
 * Usage:
 * override onResize = (shape: MyShape, info: TLResizeInfo<MyShape>) => {
 *   return addFlippingSupport(shape, info)
 * }
 */
export function addFlippingSupport<T extends TLBaseShape<string, { w: number; h: number } & Record<string, any>>>(
  shape: T, 
  info: TLResizeInfo<T>
): T {
  const { scaleX, scaleY } = info
  
  // Check for negative scaling (flipping)
  const isFlippedX = scaleX < 0
  const isFlippedY = scaleY < 0
  
  // Use absolute values for dimensions
  const absScaleX = Math.abs(scaleX)
  const absScaleY = Math.abs(scaleY)
  
  // Calculate new dimensions
  const newW = Math.max(10, Math.round((shape.props.w as number) * absScaleX))
  const newH = Math.max(10, Math.round((shape.props.h as number) * absScaleY))
  
  return {
    ...shape,
    props: {
      ...shape.props,
      w: newW,
      h: newH,
    },
    meta: {
      ...shape.meta,
      isFlippedX,
      isFlippedY,
    }
  } as T
}
