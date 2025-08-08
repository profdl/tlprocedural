## Random Walk Generator — Implementation Plan (Checklist)

This plan introduces a modular, performant Random Walk generator with live preview using a custom shape, then “bake” to native tldraw shapes. It aligns with project rules (React + TypeScript, tldraw patterns, Vite).

### Scope & Goals
- [ ] Live, deterministic random-walk preview as a custom shape
- [ ] Start/Pause/Reset controls; configurable settings
- [ ] Bake preview to native shapes compatible with existing Modifiers
- [ ] Maintain clean undo/redo and selection behavior

### Definition of Done
- [ ] Users can add a Random Walk generator, see a live path, tweak params, and bake to shapes
- [ ] Preview shapes remain non-interactive and excluded from select-all
- [ ] Baked output is a single polyline (or multiple) with correct style and position
- [ ] Deterministic across reloads given the same seed

---

### M0 – Project Readiness
- [ ] Confirm tldraw version and available shape props for `geo`/`draw` polylines
- [ ] Decide bake target: `geo` polyline vs `draw` shape (default: `geo` polyline)
- [ ] Agree on deterministic RNG approach (`d3-random` + seeded source)

### M1 – Types & Scaffolding
- [ ] Create `src/types/generators.ts`
  - [ ] `GeneratorType = 'random-walk' | ...`
  - [ ] `RandomWalkSettings`: `steps`, `stepLength`, `turnJitterDeg`, `boundsMode`, `start`, `seed`, `throttleFps`
  - [ ] `GeneratorProcessor<TSettings>` interface
- [ ] Create store: `src/store/generators/useGeneratorStore.ts`
  - [ ] CRUD: `createGenerator`, `updateGenerator`, `toggle`, `start`, `pause`, `reset`, `bake`, `clear`
  - [ ] Track: `enabled`, `running`, `settings`, `state`, `previewShapeId?`
- [ ] Register editor in generator store on mount
- [ ] Extend side-effects in `TldrawCanvas` to treat preview shapes as locked and excluded from select-all (e.g., `meta.isGeneratorPreview === true`)

### M2 – Custom Shape: GeneratedPath
- [ ] Create `src/components/generators/shapes/GeneratedPathShape.tsx`
  - [ ] Extend `BaseBoxShapeUtil` (or appropriate util) with `type: 'generated-path'`
  - [ ] `defaultProps`: `points: {x,y}[]`, `stroke`, `strokeWidth`, `isPreview`
  - [ ] `getGeometry` / `getBounds` based on points
  - [ ] `component` renders polyline/path (SVG)
  - [ ] `indicator` for selection outline
- [ ] Register util in `TldrawCanvas` `shapeUtils` alongside `ConfiguredDrawShapeUtil`
- [ ] Smoke-test: manually create a shape with a few points

### M3 – Engine & Processor
- [ ] Create `src/components/generators/hooks/useGeneratorEngine.ts`
  - [ ] RAF loop or fixed timestep with `throttleFps`
  - [ ] Batch prop updates via `editor.run(..., { history: 'ignore' })`
  - [ ] Cleanup on unmount/stop
- [ ] Random Walk processor `src/store/generators/processors/randomWalk.ts`
  - [ ] Runtime state: `rng`, `points: Vec2[]`, cursor heading, bounds handler (wrap/reflect/clamp)
  - [ ] `init(settings, seed)` creates deterministic RNG and initial state
  - [ ] `step(state, dt)` appends points at a controlled rate (steps/tick)
  - [ ] `generate(state)` returns TLShapePartial for `generated-path` (with `meta.isGeneratorPreview: true`)
- [ ] Dynamic import the processor to keep initial bundle small

### M4 – UI Controls
- [ ] Create `src/components/generators/GeneratorControls.tsx`
  - [ ] Add/remove Random Walk generator
  - [ ] Inputs: `steps`, `stepLength`, `turnJitterDeg`, `boundsMode`, `seed`
  - [ ] Actions: `Start / Pause / Reset / Bake`
- [ ] Mount alongside existing modifiers UI (panel/overlay)

### M5 – Preview Lifecycle
- [ ] On `start`: create or reuse a single `generated-path` preview shape; lock and hide from select-all
- [ ] On tick: update `points` in shape props via engine
- [ ] On `pause`: halt stepping; keep preview shape
- [ ] On `reset`: clear preview points and runtime state
- [ ] Ensure cleanup when switching pages or unmounting

### M6 – Baking
- [ ] Implement `bake` to produce a native polyline shape from current points
  - [ ] Map `generated-path` points to `geo` polyline (or `draw`) props
  - [ ] Create shape(s) under current page or selected frame/group as needed
  - [ ] Remove preview shape and stop engine
- [ ] Verify undo/redo correctness (bake should be a single undoable action)
- [ ] Post-bake UX: toast with count and quick actions (optional)

### M7 – Performance & Limits
- [ ] Cap maximum points (e.g., ≤ 2,000) and steps/tick
- [ ] Throttle updates (default 30fps)
- [ ] Prefer single polyline over many shapes
- [ ] Ensure preview updates don’t bloat history (`history: 'ignore'`)

### M8 – Interop & Polishing
- [ ] After bake, ensure output works with existing `ModifierStack` (arrays/mirror)
- [ ] Optional: "Generate into group" to bake inside a selected group
- [ ] Styling options (stroke color/width) in controls

### M9 – Testing & Docs
- [ ] Unit test: random walk determinism by seed (same points for same seed)
- [ ] Unit test: bounds mode behavior (wrap/reflect/clamp)
- [ ] Docs: README section with usage and screenshots

---

### Dependencies (defer install until implementation)
- [ ] `d3-random` for deterministic RNG (with seeded source)
- [ ] Optional: `seedrandom` to seed `d3-random` sources

Example (later): dynamic import within processor
```ts
const { randomNormal, randomUniform } = await import('d3-random')
```

---

### Open Questions
- [ ] Bake target finalization: `geo` polyline vs `draw` shape?
- [ ] Where to mount `GeneratorControls` in UI hierarchy for best UX?

---

### Progress Log
- [ ] M0 created plan file
- [ ] Pending: confirm bake target and RNG approach


