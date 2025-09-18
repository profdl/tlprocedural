import { type ReactNode } from "react";
import { type PanelId } from "../../store/panelStore";

interface TabContentProps {
  activeTabId: PanelId;
  tabs: Array<{
    id: PanelId;
    content: ReactNode;
  }>;
  height: number;
  isCollapsed: boolean;
}

export function TabContent({ activeTabId, tabs, height, isCollapsed }: TabContentProps) {
  if (isCollapsed) {
    return null;
  }

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  if (!activeTab) {
    return (
      <div
        className="tab-content tab-content--empty"
        style={{
          height: height - 28, // Subtract tab bar height
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-2)",
          fontSize: "12px",
        }}
      >
        No tab selected
      </div>
    );
  }

  return (
    <div
      className="tab-content"
      style={{
        height: height - 28, // Subtract tab bar height
        overflow: "auto",
        position: "relative",
      }}
    >
      {/* Active tab content */}
      <div
        className="tab-content__panel"
        style={{
          padding: "8px",
          height: "100%",
          overflow: "auto",
        }}
      >
        {activeTab.content}
      </div>

      {/* Hidden tabs for maintaining state (optional - depends on requirements) */}
      {tabs
        .filter((tab) => tab.id !== activeTabId)
        .map((tab) => (
          <div
            key={tab.id}
            className="tab-content__panel tab-content__panel--hidden"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              padding: "8px",
              overflow: "auto",
              visibility: "hidden",
              pointerEvents: "none",
              zIndex: -1,
            }}
          >
            {tab.content}
          </div>
        ))}
    </div>
  );
}