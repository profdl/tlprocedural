import { type ReactNode } from "react";
import { usePanelStore, type PanelId, type TabGroupState } from "../../store/panelStore";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { useStackedTabGroup } from "./hooks/useStackedTabGroup";

interface TabbedPanelContainerProps {
  tabGroup: TabGroupState;
  panelContents: Record<PanelId, ReactNode>;
  className?: string;
}

// Helper function to get panel title
function getPanelTitle(panelId: PanelId): string {
  switch (panelId) {
    case 'properties':
      return 'Properties';
    case 'style':
      return 'Style';
    case 'modifiers':
      return 'Modifiers';
    default:
      return panelId;
  }
}

export function TabbedPanelContainer({
  tabGroup,
  panelContents,
  className = "",
}: TabbedPanelContainerProps) {
  const {
    setActiveTab,
    splitPanelFromTabGroup,
    reorderTabsInGroup,
    setTabGroupCollapsed,
  } = usePanelStore();

  const stackedTabGroupData = useStackedTabGroup({
    tabGroupId: tabGroup.id,
  });

  if (!stackedTabGroupData) return null;

  const {
    dragState,
    dragElementRef,
    containerRef,
    handleMouseDown,
    handleContainerClick,
    getContainerStyle,
    getDropZoneIndicators,
  } = stackedTabGroupData;

  const dropZoneIndicators = getDropZoneIndicators();
  const containerStyle = getContainerStyle();

  // Calculate effective height
  const effectiveHeight = tabGroup.isCollapsed ? 28 : tabGroup.size.height;

  // Prepare tab data
  const tabs = tabGroup.panelIds.map((panelId) => ({
    id: panelId,
    title: getPanelTitle(panelId),
    isActive: panelId === tabGroup.activeTabId,
  }));

  // Prepare tab content data
  const tabContents = tabGroup.panelIds.map((panelId) => ({
    id: panelId,
    content: panelContents[panelId] || null,
  }));

  const handleTabClick = (tabId: PanelId) => {
    setActiveTab(tabGroup.id, tabId);
  };

  const handleTabClose = (tabId: PanelId) => {
    splitPanelFromTabGroup(tabId);
  };

  const handleTabDrop = (draggedTabId: PanelId, targetTabId: PanelId) => {
    const fromIndex = tabGroup.panelIds.indexOf(draggedTabId);
    const toIndex = tabGroup.panelIds.indexOf(targetTabId);

    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      reorderTabsInGroup(tabGroup.id, fromIndex, toIndex);
    }
  };

  const handleToggleCollapse = () => {
    setTabGroupCollapsed(tabGroup.id, !tabGroup.isCollapsed);
  };

  return (
    <>
      {/* CSS Animation for drop zones */}
      <style>
        {`
          @keyframes dropZonePulse {
            from {
              opacity: 0.6;
              transform: scaleY(1);
            }
            to {
              opacity: 1;
              transform: scaleY(1.2);
            }
          }
          .tabbed-panel__drag-handle .tlui-button__icon,
          .tabbed-panel__drag-handle .tlui-button__icon svg,
          .tabbed-panel__drag-handle svg {
            width: 12px !important;
            height: 12px !important;
            min-width: 12px !important;
            min-height: 12px !important;
          }
        `}
      </style>

      {/* Drop zone indicators */}
      {dropZoneIndicators.map((indicator, index: number) => (
        <div
          key={index}
          className="tabbed-panel__drop-zone"
          style={{
            position: "absolute",
            top: indicator.y - 2,
            right: 8,
            width: 280,
            height: 4,
            backgroundColor: "#007acc",
            borderRadius: 2,
            zIndex: 2000,
            opacity: indicator.isActive ? 1 : 0,
            transition: "opacity 0.2s ease",
            boxShadow: "0 0 8px rgba(0, 122, 204, 0.5)",
            animation: indicator.isActive
              ? "dropZonePulse 1s ease-in-out infinite alternate"
              : "none",
          }}
        />
      ))}

      {/* Main tabbed panel container */}
      <div
        ref={containerRef}
        className={`tabbed-panel ${className} ${
          dragState.isDragging ? "tabbed-panel--dragging" : ""
        } ${tabGroup.isCollapsed ? "tabbed-panel--collapsed" : ""}`}
        style={{
          position: "absolute",
          top: tabGroup.position.y,
          right: 8,
          width: 280,
          height: effectiveHeight,
          backgroundColor: "var(--color-panel)",
          border: "1px solid var(--color-low)",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: dragState.isDragging
            ? "0 8px 24px rgba(0, 0, 0, 0.25)"
            : "-4px 0 6px rgba(0, 0, 0, 0.08)",
          transition: dragState.isDragging
            ? "box-shadow 0.2s ease"
            : "top 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease",
          ...containerStyle,
        }}
        onClick={handleContainerClick}
      >
        {/* Enhanced Tab Bar with drag handle */}
        <div
          className="tabbed-panel__header"
          style={{
            display: "flex",
            alignItems: "center",
            height: 28,
            background: "var(--color-panel)",
          }}
        >
          {/* Drag handle for moving the entire tabbed panel */}
          <div
            ref={dragElementRef}
            className="tabbed-panel__drag-handle"
            onMouseDown={handleMouseDown}
            style={{
              cursor: dragState.isDragging ? "grabbing" : "grab",
              padding: "2px 4px",
              fontSize: "14px",
              color: dragState.isDragging
                ? "var(--color-text-0)"
                : "var(--color-text-2)",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              borderRadius: "4px",
              backgroundColor: "var(--color-panel)",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-muted-1)";
              e.currentTarget.style.color = "var(--color-text-0)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-panel)";
              if (!dragState.isDragging) {
                e.currentTarget.style.color = "var(--color-text-2)";
              }
            }}
            title="Drag to reorder"
          >
            ⋮⋮
          </div>

          {/* Tab Bar */}
          <div style={{ flex: 1 }}>
            <TabBar
              tabs={tabs}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
              onTabDrop={handleTabDrop}
              isCollapsed={tabGroup.isCollapsed}
              onToggleCollapse={handleToggleCollapse}
            />
          </div>
        </div>

        {/* Tab Content */}
        <TabContent
          activeTabId={tabGroup.activeTabId}
          tabs={tabContents}
          height={effectiveHeight}
          isCollapsed={tabGroup.isCollapsed}
        />
      </div>
    </>
  );
}