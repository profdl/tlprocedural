import { type TLShapeId } from 'tldraw'
import { ShapeTreeItem } from './ShapeTreeItem'

interface ShapeTreeProps {
  shapeIds: TLShapeId[]
  selectedIds: TLShapeId[]
  depth: number
  parentIsHidden?: boolean
}

export function ShapeTree({
  shapeIds,
  selectedIds,
  depth,
  parentIsHidden = false
}: ShapeTreeProps) {
  if (shapeIds.length === 0) return null

  return (
    <div className="shape-tree">
      {shapeIds.map((shapeId) => (
        <ShapeTreeItem
          key={shapeId}
          shapeId={shapeId}
          depth={depth}
          isSelected={selectedIds.includes(shapeId)}
          parentIsHidden={parentIsHidden}
        />
      ))}
    </div>
  )
}