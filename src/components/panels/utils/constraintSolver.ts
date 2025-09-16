import { type PanelId, type PanelPosition, type PanelSize, type PanelState } from '../../../store/panelStore'

interface Constraint {
  id: string
  sourcePanel: PanelId
  targetPanel: PanelId
  type: 'above' | 'below' | 'left' | 'right' | 'align-left' | 'align-right' | 'align-top' | 'align-bottom'
  gap: number
  priority: number // Higher numbers have higher priority
}

interface ConstraintSolverContext {
  panels: Record<PanelId, PanelState>
  viewport: { width: number; height: number }
  constraints: Constraint[]
}

/**
 * A simplified constraint-based layout system for panels.
 * Instead of complex recursive updates, we maintain a set of constraints
 * and solve them declaratively when changes occur.
 */
export class ConstraintSolver {
  private constraints: Map<string, Constraint> = new Map()

  /**
   * Add a constraint between two panels
   */
  addConstraint(constraint: Constraint): void {
    this.constraints.set(constraint.id, constraint)
  }

  /**
   * Remove a constraint
   */
  removeConstraint(constraintId: string): void {
    this.constraints.delete(constraintId)
  }

  /**
   * Remove all constraints involving a specific panel
   */
  removeConstraintsForPanel(panelId: PanelId): void {
    for (const [id, constraint] of this.constraints.entries()) {
      if (constraint.sourcePanel === panelId || constraint.targetPanel === panelId) {
        this.constraints.delete(id)
      }
    }
  }

  /**
   * Get all constraints
   */
  getConstraints(): Constraint[] {
    return Array.from(this.constraints.values())
  }

  /**
   * Solve all constraints and return updated panel positions
   */
  solve(context: ConstraintSolverContext): Record<PanelId, PanelPosition> {
    const result: Record<PanelId, PanelPosition> = {
      properties: { x: 0, y: 0 },
      style: { x: 0, y: 0 },
      modifiers: { x: 0, y: 0 }
    }

    // Start with current positions
    for (const [panelId, panel] of Object.entries(context.panels)) {
      result[panelId as PanelId] = { ...panel.position }
    }

    // Sort constraints by priority (higher priority first)
    const sortedConstraints = Array.from(this.constraints.values())
      .sort((a, b) => b.priority - a.priority)

    // Apply constraints iteratively
    for (let iteration = 0; iteration < 10; iteration++) {
      let anyChange = false

      for (const constraint of sortedConstraints) {
        const sourcePanel = context.panels[constraint.sourcePanel]
        const targetPanel = context.panels[constraint.targetPanel]

        if (!sourcePanel || !targetPanel) continue

        const newPosition = this.applyConstraint(
          constraint,
          result[constraint.sourcePanel],
          result[constraint.targetPanel],
          this.getEffectiveSize(sourcePanel),
          this.getEffectiveSize(targetPanel)
        )

        // Check if position changed significantly (>1px to avoid micro-adjustments)
        if (
          Math.abs(newPosition.x - result[constraint.sourcePanel].x) > 1 ||
          Math.abs(newPosition.y - result[constraint.sourcePanel].y) > 1
        ) {
          result[constraint.sourcePanel] = this.constrainToViewport(
            newPosition,
            this.getEffectiveSize(sourcePanel),
            context.viewport
          )
          anyChange = true
        }
      }

      // If no changes in this iteration, we've converged
      if (!anyChange) break
    }

    return result
  }

  /**
   * Apply a single constraint between two panels
   */
  private applyConstraint(
    constraint: Constraint,
    sourcePos: PanelPosition,
    targetPos: PanelPosition,
    sourceSize: PanelSize,
    targetSize: PanelSize
  ): PanelPosition {
    const newPosition = { ...sourcePos }

    switch (constraint.type) {
      case 'above':
        newPosition.y = targetPos.y - sourceSize.height - constraint.gap
        break

      case 'below':
        newPosition.y = targetPos.y + targetSize.height + constraint.gap
        break

      case 'left':
        newPosition.x = targetPos.x - sourceSize.width - constraint.gap
        break

      case 'right':
        newPosition.x = targetPos.x + targetSize.width + constraint.gap
        break

      case 'align-left':
        newPosition.x = targetPos.x
        break

      case 'align-right':
        newPosition.x = targetPos.x + targetSize.width - sourceSize.width
        break

      case 'align-top':
        newPosition.y = targetPos.y
        break

      case 'align-bottom':
        newPosition.y = targetPos.y + targetSize.height - sourceSize.height
        break
    }

    return newPosition
  }

  /**
   * Get effective size accounting for collapsed state
   */
  private getEffectiveSize(panel: PanelState): PanelSize {
    if (panel.isCollapsed) {
      return {
        width: panel.size.width,
        height: 32 // Collapsed header height
      }
    }
    return panel.size
  }

  /**
   * Constrain position to viewport bounds
   */
  private constrainToViewport(
    position: PanelPosition,
    size: PanelSize,
    viewport: { width: number; height: number }
  ): PanelPosition {
    return {
      x: Math.max(0, Math.min(position.x, viewport.width - size.width)),
      y: Math.max(0, Math.min(position.y, viewport.height - size.height))
    }
  }

  /**
   * Create constraints from snap state
   */
  createConstraintsFromSnapState(panels: Record<PanelId, PanelState>): void {
    // Clear existing constraints
    this.constraints.clear()

    for (const panel of Object.values(panels)) {
      if (!panel.snapState) continue

      let priority = 100 // Base priority

      // Create constraints for panel-to-panel snapping
      for (const snap of panel.snapState.snappedToPanels) {
        const constraintId = `${panel.id}-${snap.panelId}-${snap.edge}`

        let constraintType: Constraint['type']
        switch (snap.edge) {
          case 'top':
            constraintType = 'above'
            break
          case 'bottom':
            constraintType = 'below'
            break
          case 'left':
            constraintType = 'left'
            break
          case 'right':
            constraintType = 'right'
            break
        }

        this.addConstraint({
          id: constraintId,
          sourcePanel: panel.id,
          targetPanel: snap.panelId,
          type: constraintType,
          gap: 8, // Standard gap
          priority: priority++
        })
      }
    }
  }

  /**
   * Get panels that would be affected by moving a specific panel
   */
  getAffectedPanels(panelId: PanelId): PanelId[] {
    const affected = new Set<PanelId>()
    const visited = new Set<PanelId>()

    const findAffected = (id: PanelId) => {
      if (visited.has(id)) return
      visited.add(id)

      for (const constraint of this.constraints.values()) {
        if (constraint.targetPanel === id && !affected.has(constraint.sourcePanel)) {
          affected.add(constraint.sourcePanel)
          findAffected(constraint.sourcePanel)
        }
      }
    }

    findAffected(panelId)
    return Array.from(affected)
  }
}

// Export a global instance
export const constraintSolver = new ConstraintSolver()

// Helper function to create constraint ID
export function createConstraintId(sourcePanel: PanelId, targetPanel: PanelId, type: string): string {
  return `${sourcePanel}-${targetPanel}-${type}`
}