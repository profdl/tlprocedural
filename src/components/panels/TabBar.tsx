import { useState, useRef } from "react";
import { TldrawUiButton, TldrawUiButtonIcon } from "tldraw";
import { type PanelId } from "../../store/panelStore";

interface TabBarProps {
  tabs: Array<{
    id: PanelId;
    title: string;
    isActive: boolean;
  }>;
  onTabClick: (tabId: PanelId) => void;
  onTabClose?: (tabId: PanelId) => void;
  onTabDragStart?: (tabId: PanelId, event: React.DragEvent) => void;
  onTabDragEnd?: () => void;
  onTabDrop?: (draggedTabId: PanelId, targetTabId: PanelId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function TabBar({
  tabs,
  onTabClick,
  onTabClose,
  onTabDragStart,
  onTabDragEnd,
  onTabDrop,
  isCollapsed,
  onToggleCollapse,
}: TabBarProps) {
  const [dragOverTab, setDragOverTab] = useState<PanelId | null>(null);
  const draggedTabRef = useRef<PanelId | null>(null);

  const handleTabDragStart = (tabId: PanelId, event: React.DragEvent) => {
    draggedTabRef.current = tabId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tabId);
    onTabDragStart?.(tabId, event);
  };

  const handleTabDragOver = (tabId: PanelId, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverTab(tabId);
  };

  const handleTabDragLeave = () => {
    setDragOverTab(null);
  };

  const handleTabDrop = (targetTabId: PanelId, event: React.DragEvent) => {
    event.preventDefault();
    const draggedTabId = draggedTabRef.current;

    if (draggedTabId && draggedTabId !== targetTabId) {
      onTabDrop?.(draggedTabId, targetTabId);
    }

    setDragOverTab(null);
    draggedTabRef.current = null;
  };

  const handleTabDragEnd = () => {
    setDragOverTab(null);
    draggedTabRef.current = null;
    onTabDragEnd?.();
  };

  return (
    <div
      className="tab-bar"
      style={{
        display: "flex",
        alignItems: "center",
        height: 28,
        background: "var(--color-panel)",
        borderBottom: "1px solid var(--color-low)",
        overflow: "hidden",
      }}
    >
      {/* Tabs container with scrolling if needed */}
      <div
        className="tab-bar__tabs"
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-bar__tab ${tab.isActive ? "tab-bar__tab--active" : ""} ${
              dragOverTab === tab.id ? "tab-bar__tab--drag-over" : ""
            }`}
            draggable={!isCollapsed}
            onDragStart={(e) => handleTabDragStart(tab.id, e)}
            onDragOver={(e) => handleTabDragOver(tab.id, e)}
            onDragLeave={handleTabDragLeave}
            onDrop={(e) => handleTabDrop(tab.id, e)}
            onDragEnd={handleTabDragEnd}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
              height: "100%",
              background: tab.isActive ? "var(--color-muted-1)" : "transparent",
              borderRight: "1px solid var(--color-low)",
              cursor: "pointer",
              userSelect: "none",
              position: "relative",
              minWidth: 0,
              maxWidth: 120,
              transition: "background-color 0.15s ease",
              ...(dragOverTab === tab.id && {
                background: "var(--color-accent)",
                color: "var(--color-background)",
              }),
            }}
            onClick={() => onTabClick(tab.id)}
            onMouseEnter={(e) => {
              if (!tab.isActive && dragOverTab !== tab.id) {
                e.currentTarget.style.backgroundColor = "var(--color-muted-2)";
              }
            }}
            onMouseLeave={(e) => {
              if (!tab.isActive && dragOverTab !== tab.id) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            {/* Tab title */}
            <span
              className="tab-bar__tab-title"
              style={{
                fontSize: "10px",
                fontWeight: 500,
                color: tab.isActive ? "var(--color-text-0)" : "var(--color-text-1)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {tab.title}
            </span>

            {/* Close button - only show on active tab or hover, and only if there are multiple tabs */}
            {tabs.length > 1 && (tab.isActive || dragOverTab === tab.id) && onTabClose && (
              <TldrawUiButton
                type="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                title={`Close ${tab.title}`}
                style={{
                  width: "12px",
                  height: "12px",
                  minWidth: "12px",
                  minHeight: "12px",
                  marginLeft: "4px",
                  padding: 0,
                }}
              >
                <TldrawUiButtonIcon icon="cross-2" />
              </TldrawUiButton>
            )}
          </div>
        ))}
      </div>

      {/* Collapse/Expand button */}
      <div
        className="tab-bar__actions"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 4px",
        }}
      >
        <TldrawUiButton
          type="icon"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand" : "Collapse"}
          style={{
            width: "16px",
            height: "16px",
            minWidth: "16px",
            minHeight: "16px",
          }}
        >
          <TldrawUiButtonIcon icon={isCollapsed ? "chevron-right" : "chevron-down"} />
        </TldrawUiButton>
      </div>

      {/* CSS for drag animations */}
      <style>
        {`
          .tab-bar__tab--drag-over {
            background: var(--color-accent) !important;
            color: var(--color-background) !important;
          }

          .tab-bar__tab--active {
            position: relative;
          }

          .tab-bar__tab--active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--color-accent);
          }

          .tab-bar__tab:hover .tab-bar__tab-title {
            color: var(--color-text-0);
          }
        `}
      </style>
    </div>
  );
}