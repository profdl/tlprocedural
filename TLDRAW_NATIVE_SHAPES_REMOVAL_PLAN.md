# TLDraw Native Shapes Removal Implementation Plan

## Overview
This document outlines the implementation plan for removing native tldraw shapes and drawing tools, replacing them with custom SVG-based shapes while maintaining the existing modifier system and procedural generation capabilities.

## Current State Analysis

### Current Custom Shapes
- **SineWaveShape**: SVG-based sine wave with parameters (frequency, amplitude, phase, etc.)
- **TriangleShape**: SVG-based triangle with fill/stroke options
- **FlippableShapeUtil**: Base utility class for shapes with flip support

### Current Native Shapes Usage
- **draw**: Currently used in CustomToolbar and MirrorProcessor 
- **eraser**: Currently used in CustomToolbar
- **arrow**: Currently used in CustomToolbar and MirrorProcessor
- **line**: Currently used in CustomToolbar and MirrorProcessor
- **select**: Essential navigation tool (keep)
- **hand**: Essential navigation tool (keep)
- **zoom**: Essential navigation tool (keep)

### Dependencies
- **tldraw**: v3.14.2
- **Custom components**: CustomToolbar, CustomStylePanel, modifier system
- **Shape utilities**: FlippableShapeUtil, existing custom shape implementations

## Implementation Plan

### Phase 1: Custom Shape Creation
**Goal**: Create SVG-based replacements for native shapes

#### 1.1 Replace Draw Tool
- **File**: `src/components/shapes/DrawShape.tsx`
- **Tool**: `src/components/shapes/DrawTool.ts`
- **Implementation**: 
  - Custom SVG path-based drawing shape
  - Smooth curve generation from pointer events
  - Stroke customization (width, color, style)

#### 1.3 Replace Line Shape
- **File**: `src/components/shapes/LineShape.tsx`  
- **Tool**: `src/components/shapes/LineTool.ts`
- **Implementation**:
  - Simple SVG line with handles
  - Support for different line styles (solid, dashed, dotted)
  - Maintain existing line functionality from MirrorProcessor

#### 1.4 Create Rectangle Shape
- **File**: `src/components/shapes/RectangleShape.tsx`
- **Tool**: `src/components/shapes/RectangleTool.ts`
- **Implementation**:
  - SVG-based rectangle with fill/stroke options
  - Corner radius support
  - Extends FlippableShapeUtil

#### 1.5 Create Ellipse Shape
- **File**: `src/components/shapes/EllipseShape.tsx`
- **Tool**: `src/components/shapes/EllipseTool.ts`
- **Implementation**:
  - SVG-based ellipse/circle with fill/stroke options
  - Extends FlippableShapeUtil


### Phase 2: Remove Native Dependencies
**Goal**: Remove all native tldraw shape references

#### 2.1 Update TldrawCanvas.tsx
- Remove `DrawShapeUtil` import and configuration
- Add all custom shape utilities to `shapeUtils` array
- Add all custom tools to `tools` array
- Update `uiOverrides` to include new custom tools

#### 2.2 Update CustomToolbar.tsx
- Replace native shape tool references (`'draw'`, `'arrow'`, `'line'`) with custom equivalents
- Remove `'eraser'` tool (implement as custom if needed)
- Maintain essential tools: `'select'`, `'hand'`, `'zoom'`
- Add new custom shape tools: `'rectangle'`, `'ellipse'`, `'text'`, `'custom-draw'`

#### 2.3 Update CustomStylePanel.tsx
- Ensure style panel works with new custom shapes
- Add style options for new shapes (fill, stroke, text properties)

### Phase 3: Update Modifier System
**Goal**: Ensure modifier processors work with custom shapes

#### 3.1 Update MirrorProcessor.ts
- Replace native shape type checks (`'draw'`, `'arrow'`, `'line'`) with custom equivalents
- Update shape-specific mirroring logic for new custom shapes
- Test mirroring with all new shapes

#### 3.2 Update Other Processors
- **LinearArrayProcessor.ts**: Ensure compatibility with new shapes
- **lSystemProcessor.ts**: Update if it references specific shape types
- Test all processors with new custom shapes

### Phase 4: Asset and UI Updates
**Goal**: Provide proper icons and UI integration

#### 4.1 Create Icons
- Design SVG icons for new tools
- Add icons to `assetUrls` in TldrawCanvas.tsx
- Ensure consistent visual styling

#### 4.2 Update UI Overrides
- Add keyboard shortcuts for new tools
- Update tool labels and descriptions
- Ensure proper tool selection and highlighting

### Phase 5: Testing and Validation
**Goal**: Ensure all functionality works correctly

#### 5.1 Shape Testing
- Test creation, editing, and deletion of all custom shapes
- Test resizing, rotating, and flipping functionality
- Test style customization for each shape type

#### 5.2 Modifier Testing
- Test all modifier types with new custom shapes
- Verify mirroring works correctly with draw paths and arrows
- Test complex modifier combinations

#### 5.3 Integration Testing
- Test copy/paste functionality
- Test undo/redo operations
- Test selection and grouping
- Test export/import if applicable

## Implementation Order

### Recommended Implementation Sequence:
1. **DrawShape** (most complex, high priority for existing functionality)
2. **RectangleShape** (fundamental shape, widely used)
3. **EllipseShape** (fundamental shape, widely used)  
4. **LineShape** (replace existing native usage)
5. **ArrowShape** (replace existing native usage)
6. **TextShape** (additional functionality)
7. **Update modifier processors**
8. **Remove native dependencies**
9. **Testing and validation**

## Technical Considerations

### SVG Implementation Standards
- All shapes should use SVG for consistency and customization
- Implement proper bounds, center, and outline methods
- Support for styling (stroke, fill, opacity)
- Proper resize and transform handling

### Shape Utility Base Class
- Consider extending FlippableShapeUtil for all new shapes
- Implement consistent property naming and structure
- Ensure proper serialization and deserialization

### Performance Considerations  
- Optimize SVG rendering for complex shapes
- Consider shape caching for complex draw paths
- Maintain smooth interaction performance

### Backward Compatibility
- Ensure existing modifier system continues to work
- Preserve existing project files if possible
- Plan migration strategy for existing shapes

## Risks and Mitigation

### Potential Risks:
1. **Functionality Loss**: Native shapes may have features not replicated in custom implementation
2. **Performance Impact**: Custom SVG shapes might perform differently than native shapes
3. **Modifier Compatibility**: Existing modifiers might not work properly with new shapes
4. **User Experience**: Tool behavior might feel different from native tools

### Mitigation Strategies:
1. **Incremental Implementation**: Implement and test one shape at a time
2. **Feature Parity Checking**: Carefully document and replicate native shape features
3. **Performance Testing**: Profile performance during implementation
4. **Comprehensive Testing**: Test all modifier combinations with new shapes

## Success Criteria
- [ ] All native tldraw shapes successfully replaced with custom SVG implementations
- [ ] All existing modifier functionality works with new shapes
- [ ] No performance degradation in normal usage
- [ ] UI remains intuitive and consistent
- [ ] All existing project functionality preserved
- [ ] Code is maintainable and follows established patterns

## Estimated Timeline
- **Phase 1**: 5-7 days (shape creation)
- **Phase 2**: 2-3 days (dependency removal)
- **Phase 3**: 2-3 days (modifier updates)
- **Phase 4**: 1-2 days (UI/assets)
- **Phase 5**: 2-3 days (testing)
- **Total**: 12-18 days