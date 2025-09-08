# Bezier Tool Roadmap: Illustrator-Style Path Creation & Editing

## Current State Assessment ✅

### What We Already Have (Well Implemented)
- **Custom BezierShape**: Full cubic bezier support with control points (cp1/cp2)
- **Pen Tool Creation Workflow**: Click-and-drag curve creation during path drawing
- **Real-time Curve Creation**: Proper bezier math for control point generation
- **Path Continuation**: Sequential point addition with curve continuity
- **Path Closing**: Distance-based detection and closing functionality
- **Interactive Handle Editing**: Illustrator-style symmetric handles with Alt-key asymmetric override
- **Visual Feedback**: Edit mode with dashed paths, visible control points, handle lines
- **Keyboard Shortcuts**: Enter (finish), Escape (cancel), 'c' (close path)
- **Preview System**: Shows next segment during creation

### Current File Structure
```
src/components/shapes/
├── BezierShape.tsx          ✅ Well implemented
├── BezierTool.ts            ❌ NEEDS FIX (wrong base class)
└── tools/
    ├── BezierTool.ts        ✅ Good state structure  
    └── states/
        ├── BezierIdle.ts    ✅ Basic but functional
        └── BezierCreating.ts ✅ Excellent implementation
```

---

## Implementation Phases

### Phase 1: Fix Tool Structure 🔴 CRITICAL
**Priority**: Immediate
**Files**: `src/components/shapes/BezierTool.ts`

**Issue**: Currently extends `BaseBoxShapeTool` but should use custom state nodes

**Solution**:
```ts
import { StateNode, type TLStateNodeConstructor } from '@tldraw/editor'
import { BezierIdle } from './states/BezierIdle'
import { BezierCreating } from './states/BezierCreating'

export class BezierTool extends StateNode {
  static override id = 'bezier'
  static override initial = 'idle'
  static override isLockable = false
  static override children(): TLStateNodeConstructor[] {
    return [BezierIdle, BezierCreating]
  }
  override shapeType = 'bezier'
}
```

**Testing**: Verify pen tool still works after this change

---

### Phase 2: Enhanced Creation Modifiers 🔴 CRITICAL
**Priority**: High  
**Files**: `src/components/shapes/tools/states/BezierCreating.ts`

#### 2.1 Alt Key for Asymmetric Handles
**Feature**: Break handle symmetry during creation
**Implementation**:
- Detect `this.editor.inputs.altKey` in `onPointerMove()`
- When Alt pressed, only create outgoing handle (cp2), not incoming (cp1)
- Update control point calculation logic

#### 2.2 Shift Key for Angle Constraints  
**Feature**: Snap to 45° increments during handle creation
**Implementation**:
- Detect `this.editor.inputs.shiftKey` in `onPointerMove()`
- Constrain control point angles to 0°, 45°, 90°, 135°, 180°, etc.
- Apply constraint to both handles when symmetric

#### 2.3 Click Without Drag for Corner Points
**Feature**: Create sharp corner points when not dragging
**Implementation**:
- Track drag distance in `onPointerMove()`
- If `onPointerUp()` without significant movement, create point without handles
- Define threshold (e.g., < 3 pixels = no handles)

**Expected Behavior**: 
- Click = corner point (no handles)
- Click + drag = smooth curve point (with handles)
- Alt + drag = asymmetric handles  
- Shift + drag = constrained angles

---

### Phase 3: Path Point Addition/Removal 🔴 CRITICAL
**Priority**: High
**Files**: New state `BezierEditing.ts`, enhance `BezierShape.tsx`

#### 3.1 Add Points to Existing Paths
**Feature**: Click on path segments to insert new anchor points
**Implementation**:
- Create `BezierEditing` state for post-creation editing
- Path intersection detection for segment clicks
- Insert point at click position with smooth handles
- Maintain curve continuity at insertion point

#### 3.2 Remove Points from Paths  
**Feature**: Click on anchor points to remove them
**Implementation**:
- Detect clicks on anchor point circles (hit testing)
- Remove point from points array
- Reconnect adjacent segments with smooth transition
- Handle edge cases (minimum 2 points for open paths)

#### 3.3 Edit Mode Activation
**Trigger**: Double-click existing bezier shape OR dedicated edit tool
**Visual Changes**: 
- Show all anchor points and handles
- Enable point manipulation
- Different cursor states

---

### Phase 4: Direct Selection Tool 🔴 CRITICAL
**Priority**: Medium-High
**Files**: New `BezierDirectSelectionTool.ts` and states

#### 4.1 Point-Level Selection
**Feature**: Select individual points instead of entire shapes
**Implementation**:
- New tool separate from main selection tool
- Click individual anchor points to select
- Multi-select with Shift/Cmd modifiers
- Visual feedback (highlighted selected points)

#### 4.2 Selected Point Manipulation
**Feature**: Edit only selected points' handles
**Implementation**:
- Show handles only for selected points
- Allow independent handle editing
- Group operations on multiple selected points

#### 4.3 Integration with Existing Handle System
**Build on**: Current `onHandleDrag` logic in `BezierShape.tsx`
**Enhance**: Make handle visibility dependent on point selection state

---

### Phase 5: Anchor Point Type Conversion 🟡 IMPORTANT
**Priority**: Medium
**Files**: Enhance `BezierShape.tsx` handle logic

#### 5.1 Smooth ↔ Corner Conversion
**Feature**: Alt+click anchor points to toggle handle types
**Implementation**:
- Detect Alt+click on anchor points
- Toggle between smooth (handles present) and corner (no handles)
- Maintain path continuity where possible

#### 5.2 Cusp Point Support
**Feature**: Independent handle manipulation without symmetry
**Implementation**:
- Add point type property to `BezierPoint` interface
- Support three types: smooth, corner, cusp
- Different handle behaviors per type

#### 5.3 Convert Anchor Point Tool
**Feature**: Dedicated tool for point type conversion
**Implementation**:
- New tool or modifier mode
- Click to cycle through point types
- Visual feedback for current point type

---

### Phase 6: Path Operations 🟡 IMPORTANT  
**Priority**: Medium
**Files**: New utility functions, UI integration

#### 6.1 Join Paths
**Feature**: Connect endpoints of open paths
**Implementation**:
- Detect when two path endpoints are near each other
- Join with straight line or smooth curve
- Combine paths into single shape

#### 6.2 Average Anchor Points
**Feature**: Move selected points to average position
**Implementation**:
- Calculate centroid of selected points
- Move all selected points to average position
- Maintain handle relationships

#### 6.3 Path Simplification
**Feature**: Reduce anchor points with Douglas-Peucker algorithm
**Implementation**:
- User-specified tolerance parameter
- Remove redundant points while preserving curve shape
- Integration with modifier system

---

## Development Workflow

### Phase Implementation Order
1. **Week 1**: Phase 1 (fix tool structure) + Phase 2 (creation modifiers)
2. **Week 2**: Phase 3 (point add/remove) 
3. **Week 3**: Phase 4 (direct selection tool)
4. **Week 4**: Phase 5-6 (conversions and operations)

### Testing Strategy
- Test each phase against Illustrator behavior
- Ensure backward compatibility with existing shapes
- Verify performance with complex paths
- Test modifier system integration

### Integration Points
- **Modifier System**: Path operations should work with existing modifiers
- **UI Integration**: Add tools to toolbar and context menus  
- **Keyboard Shortcuts**: Follow Illustrator conventions where possible
- **Undo/Redo**: Ensure all operations are properly tracked

---

## Technical Notes

### Key Design Decisions
- Build on existing excellent pen tool foundation
- Maintain consistency with tldraw patterns
- Preserve integration with modifier system
- Follow Illustrator UX patterns where beneficial

### Potential Challenges
- Path intersection detection for point addition
- Performance with many control points
- Complex undo/redo for multi-step operations
- UI space for additional tools

### Success Criteria
- Smooth workflow matching Illustrator pen tool
- Reliable point addition/removal
- Intuitive handle manipulation
- Good performance with complex paths
- Seamless integration with existing features

---

## Future Enhancements (Post-Implementation)
- Path boolean operations (union, subtract, intersect)
- Bezier handle length/angle numerical input
- Path outline stroke conversion
- Advanced path effects and live trace
- Integration with Cuttle.xyz-style parametric features