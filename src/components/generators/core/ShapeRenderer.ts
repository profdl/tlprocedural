import type { Editor, TLShapeId } from 'tldraw'
import type { Vec2, RandomWalkSettings } from '../../../types/generators'
import { pointsToDrawSegments } from './RandomWalkProcessor'

/**
 * Handles rendering random walk data as tldraw shapes
 */
export class ShapeRenderer {
  private editor: Editor

  constructor(editor: Editor) {
    this.editor = editor
  }

  /**
   * Creates or updates shapes for a random walk generator
   */
  renderRandomWalk(
    generatorId: string,
    points: Vec2[],
    settings: RandomWalkSettings,
    isNewPoint: boolean = false
  ): TLShapeId | undefined {
    let mainShapeId: TLShapeId | undefined

    this.editor.run(() => {
      // Create dot for the latest point (if enabled and we have a new point)
      if (settings.showPoints && isNewPoint && points.length > 0) {
        const currentPoint = points[points.length - 1]
        const dotShape = this.editor.createShape({
          type: 'geo',
          x: currentPoint.x - 1,
          y: currentPoint.y - 1,
          props: {
            w: 2,
            h: 2,
            geo: 'ellipse',
            color: 'red',
            fill: 'solid',
            size: 's'
          },
          meta: { 
            isGeneratorPreview: true, 
            generatorId, 
            isPoint: true 
          },
        })
        
        if (!mainShapeId) mainShapeId = dotShape.id as TLShapeId
      }
      
      // Create/update the connecting curve through all points (if enabled)
      if (settings.showCurve && points.length >= 2) {
        // Remove any existing curve
        this.removeExistingCurve(generatorId)
        
        // Create new curve through all points
        const curveShape = this.editor.createShape({
          type: 'draw',
          x: 0,
          y: 0,
          props: {
            segments: pointsToDrawSegments(points),
            color: 'black',
            size: 'm',
            isComplete: true,
          },
          meta: { 
            isGeneratorPreview: true, 
            generatorId, 
            isCurve: true 
          },
        })
        
        // Prefer curve as main shape for tracking
        mainShapeId = curveShape.id as TLShapeId
      }
    }, { history: 'ignore' })

    return mainShapeId
  }

  /**
   * Removes existing curve shape for a generator
   */
  private removeExistingCurve(generatorId: string): void {
    const allShapes = this.editor.getCurrentPageShapes()
    const existingCurve = allShapes.find(shape => 
      shape.meta?.isGeneratorPreview && 
      shape.meta?.generatorId === generatorId && 
      shape.meta?.isCurve
    )
    
    if (existingCurve) {
      this.editor.deleteShapes([existingCurve.id])
    }
  }

  /**
   * Removes all shapes associated with a generator
   */
  removeGeneratorShapes(generatorId: string): void {
    const allShapes = this.editor.getCurrentPageShapes()
    const generatorShapes = allShapes.filter(shape => 
      shape.meta?.isGeneratorPreview && shape.meta?.generatorId === generatorId
    )
    
    if (generatorShapes.length > 0) {
      this.editor.run(() => {
        this.editor.deleteShapes(generatorShapes.map(s => s.id))
      }, { history: 'ignore', ignoreShapeLock: true })
    }
  }
}
