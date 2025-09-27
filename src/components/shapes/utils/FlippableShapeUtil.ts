import { BaseBoxShapeUtil, type TLResizeInfo, type TLBaseShape, resizeBox } from 'tldraw'
import { DEFAULT_SHAPE_PROPS, type CommonShapeProps } from '../constants/defaultShapeProps'

/**
 * A mixin utility that adds flipping support to any BaseBoxShapeUtil-based shape
 * Supports both resize-based flipping and tldraw's native flipShapes method
 * 
 * Usage:
 * export class MyShapeUtil extends FlippableShapeUtil<MyShape> {
 *   // Your shape implementation
 * }
 */
export abstract class FlippableShapeUtil<T extends TLBaseShape<string, { w: number; h: number } & Record<string, unknown>>> extends BaseBoxShapeUtil<T> {
  
  override onResize = (shape: T, info: TLResizeInfo<T>) => {
    // Use TLDraw's native resizeBox for center-based scaling
    // BaseBoxShapeUtil.onResize uses resizeBox internally
    const resizedShape = resizeBox(shape, info) as T

    // Check for negative scaling which indicates flipping
    const isFlippedX = info.scaleX < 0
    const isFlippedY = info.scaleY < 0

    // If flipping is detected, store it in metadata
    if (isFlippedX || isFlippedY) {
      const currentFlippedX = this.isFlippedX(shape)
      const currentFlippedY = this.isFlippedY(shape)

      const flippedShape = {
        ...resizedShape,
        meta: {
          ...resizedShape.meta,
          isFlippedX: isFlippedX ? !currentFlippedX : currentFlippedX,
          isFlippedY: isFlippedY ? !currentFlippedY : currentFlippedY,
        }
      } as T

      // Allow subclasses to customize flip behavior
      // Determine the primary flip direction (if both are flipping, prioritize the most recent)
      const flipDirection = isFlippedY ? 'vertical' : 'horizontal'

      return this.onFlipCustom ?
        this.onFlipCustom(flippedShape, flipDirection,
          flippedShape.meta?.isFlippedX === true, flippedShape.meta?.isFlippedY === true) :
        flippedShape
    }

    return resizedShape
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

  /**
   * Native tldraw flip support - called by editor.flipShapes()
   * This method supports the native flipShapes functionality
   */
  flipShape = (shape: T, direction: 'horizontal' | 'vertical') => {
    const currentFlippedX = this.isFlippedX(shape)
    const currentFlippedY = this.isFlippedY(shape)
    
    let newFlippedX = currentFlippedX
    let newFlippedY = currentFlippedY
    
    if (direction === 'horizontal') {
      newFlippedX = !currentFlippedX
    } else {
      newFlippedY = !currentFlippedY
    }
    
    const flippedShape = {
      ...shape,
      meta: {
        ...shape.meta,
        isFlippedX: newFlippedX,
        isFlippedY: newFlippedY,
      }
    } as T
    
    // Allow subclasses to customize flip behavior
    return this.onFlipCustom ? this.onFlipCustom(flippedShape, direction, newFlippedX, newFlippedY) : flippedShape
  }

  /**
   * Override this method in your shape util to customize flip behavior
   * Called when a flip operation occurs via flipShapes or during resize
   */
  protected onFlipCustom?(
    shape: T,
    direction: 'horizontal' | 'vertical',
    isFlippedX: boolean,
    isFlippedY: boolean
  ): T

  /**
   * Helper method to get common default props for all shapes
   * Shapes can merge these with their specific defaults
   */
  protected getCommonDefaultProps(): CommonShapeProps {
    return DEFAULT_SHAPE_PROPS
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
export function addFlippingSupport<T extends TLBaseShape<string, { w: number; h: number } & Record<string, unknown>>>(
  shape: T,
  info: TLResizeInfo<T>
): T {
  // Use TLDraw's native resizeBox for center-based scaling
  const resizedShape = resizeBox(shape, info) as T

  // Check for negative scaling (flipping)
  const isFlippedX = info.scaleX < 0
  const isFlippedY = info.scaleY < 0

  // Add flip metadata to the resized shape
  return {
    ...resizedShape,
    meta: {
      ...resizedShape.meta,
      isFlippedX,
      isFlippedY,
    }
  } as T
}
