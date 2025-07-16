import { 
  type Editor,
  type TLShapeId
} from 'tldraw'
import { 
  type TLModifier, 
  type TLModifierId, 
  type TLLinearArrayModifier, 
  type LinearArraySettings
} from '../types/modifiers'
import { createModifierId } from '../types/modifiers'

// In-memory modifier storage (we'll use tldraw's meta system later)
const modifiersStore: Record<string, TLModifier> = {}

// Helper functions for working with modifiers
export class ModifierManager {
  private editor: Editor
  
  constructor(editor: Editor) {
    this.editor = editor
  }

  // Get all modifiers for a shape
  getModifiersForShape(shapeId: TLShapeId): TLModifier[] {
    return Object.values(modifiersStore)
      .filter(modifier => modifier.targetShapeId === shapeId)
      .sort((a, b) => a.order - b.order)
  }

  // Get a specific modifier by ID
  getModifier(id: TLModifierId): TLModifier | undefined {
    return modifiersStore[id]
  }

  // Create a new linear array modifier
  createLinearArrayModifier(
    targetShapeId: TLShapeId, 
    settings: Partial<LinearArraySettings> = {}
  ): TLLinearArrayModifier {
    const id = createModifierId()
    const modifier: TLLinearArrayModifier = {
      id,
      typeName: 'modifier',
      type: 'linear-array',
      targetShapeId,
      enabled: true,
      order: this.getNextOrder(targetShapeId),
      props: {
        count: 3,
        offsetX: 50,
        offsetY: 0,
        rotation: 0,
        spacing: 1,
        scaleStep: 1,
        ...settings
      }
    }
    
    modifiersStore[id] = modifier
    this.notifyChange()
    return modifier
  }

  // Update modifier settings
  updateModifier(id: TLModifierId, changes: Partial<TLModifier>): void {
    const existing = this.getModifier(id)
    if (existing) {
      const updated = { ...existing, ...changes }
      modifiersStore[id] = updated as TLModifier
      this.notifyChange()
    }
  }

  // Delete a modifier
  deleteModifier(id: TLModifierId): void {
    if (modifiersStore[id]) {
      delete modifiersStore[id]
      this.notifyChange()
    }
  }

  // Delete all modifiers for a shape
  deleteModifiersForShape(shapeId: TLShapeId): void {
    const modifiers = this.getModifiersForShape(shapeId)
    modifiers.forEach(modifier => {
      delete modifiersStore[modifier.id]
    })
    this.notifyChange()
  }

  // Get all modifiers
  getAllModifiers(): TLModifier[] {
    return Object.values(modifiersStore)
  }

  // Check if a shape has modifiers
  hasModifiers(shapeId: TLShapeId): boolean {
    return this.getModifiersForShape(shapeId).length > 0
  }

  // Get enabled modifiers for a shape
  getEnabledModifiersForShape(shapeId: TLShapeId): TLModifier[] {
    return this.getModifiersForShape(shapeId).filter(m => m.enabled)
  }

  // Get the next order number for a shape's modifiers
  private getNextOrder(shapeId: TLShapeId): number {
    const modifiers = this.getModifiersForShape(shapeId)
    return modifiers.length > 0 
      ? Math.max(...modifiers.map(m => m.order)) + 1 
      : 0
  }

  // Reorder modifiers
  reorderModifiers(_shapeId: TLShapeId, newOrder: TLModifierId[]): void {
    newOrder.forEach((id, index) => {
      this.updateModifier(id, { order: index })
    })
  }

  // Toggle modifier enabled state
  toggleModifier(id: TLModifierId): void {
    const modifier = this.getModifier(id)
    if (modifier) {
      this.updateModifier(id, { enabled: !modifier.enabled })
    }
  }

  // Notify tldraw that something changed (force re-render)
  private notifyChange(): void {
    // We can use editor's history system to trigger updates
    this.editor.mark('modifier-change')
  }

  // Clear all modifiers (useful for cleanup)
  clearAll(): void {
    Object.keys(modifiersStore).forEach(key => delete modifiersStore[key])
    this.notifyChange()
  }

  // Export modifiers as JSON (for persistence)
  exportModifiers(): string {
    return JSON.stringify(modifiersStore)
  }

  // Import modifiers from JSON
  importModifiers(json: string): void {
    try {
      const modifiers = JSON.parse(json) as Record<string, TLModifier>
      Object.keys(modifiersStore).forEach(key => delete modifiersStore[key])
      Object.assign(modifiersStore, modifiers)
      this.notifyChange()
    } catch (error) {
      console.error('Failed to import modifiers:', error)
    }
  }
} 