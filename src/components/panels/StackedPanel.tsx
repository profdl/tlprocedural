import { type ReactNode } from "react";
import { TldrawUiButton, TldrawUiButtonIcon } from "tldraw";
import { type PanelId } from "../../store/panelStore";
import { useStackedPanel } from "./hooks/useStackedPanel";

interface StackedPanelProps {
  id: PanelId;
  title: string;
  children: ReactNode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export function StackedPanel({
  id,
  title,
  children,
  isCollapsed,
  onToggleCollapse,
  className = "",
}: StackedPanelProps) {
  const stackedPanelData = useStackedPanel({
    panelId: id,
  });

  if (!stackedPanelData) return null;

  const {
    panel,
    dragState,
    dragElementRef,
    panelRef,
    handleMouseDown,
    handlePanelClick,
    getPanelStyle,
    getDropZoneIndicators,
  } = stackedPanelData;

  const dropZoneIndicators = getDropZoneIndicators();
  const panelStyle = getPanelStyle();

  // Calculate effective height
  const effectiveHeight = isCollapsed ? 28 : panel.size.height;

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
          .stacked-panel__toggle .tlui-button__icon,
          .stacked-panel__toggle .tlui-button__icon svg,
          .stacked-panel__toggle svg {
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
          className={`stacked-panel__drop-zone ${
            indicator.isMergeZone ? "stacked-panel__drop-zone--merge" : ""
          }`}
          style={{
            position: "absolute",
            top: indicator.y - (indicator.isMergeZone ? 12 : 2),
            right: 8,
            width: 280,
            height: indicator.isMergeZone ? 24 : 4,
            backgroundColor: indicator.isMergeZone ? "#ff6b35" : "#007acc",
            borderRadius: indicator.isMergeZone ? 4 : 2,
            zIndex: 2000,
            opacity: indicator.isActive ? 1 : 0,
            transition: "opacity 0.2s ease",
            boxShadow: indicator.isMergeZone
              ? "0 0 12px rgba(255, 107, 53, 0.6)"
              : "0 0 8px rgba(0, 122, 204, 0.5)",
            animation: indicator.isActive
              ? "dropZonePulse 1s ease-in-out infinite alternate"
              : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "10px",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {indicator.isMergeZone && "Merge"}
        </div>
      ))}

      {/* Main panel */}
      <div
        ref={panelRef}
        className={`stacked-panel ${className} ${
          dragState.isDragging ? "stacked-panel--dragging" : ""
        } ${isCollapsed ? "stacked-panel--collapsed" : ""}`}
        style={{
          position: "absolute",
          top: panel.position.y,
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
          ...panelStyle,
        }}
        onClick={handlePanelClick}
      >
        {/* Panel Header */}
        <div
          className="stacked-panel__header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px 5px 8px",
            height: 28,
            background: "var(--color-panel)",
          }}
        >
          <div
            className="stacked-panel__header-left"
            style={{
              display: "flex",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            {/* Drag handle */}
            <div
              ref={dragElementRef}
              className="stacked-panel__drag-handle"
              onMouseDown={handleMouseDown}
              style={{
                cursor: dragState.isDragging ? "grabbing" : "grab",
                padding: "2px",
                marginRight: "4px",
                fontSize: "14px",
                color: dragState.isDragging
                  ? "var(--color-text-0)"
                  : "var(--color-text-2)",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                borderRadius: "4px",
                backgroundColor: "var(--color-panel)",
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

            {/* Title */}
            <span
              className="stacked-panel__title"
              style={{
                fontSize: "10px",
                fontWeight: 500,
                color: "var(--color-text-1)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {title}
            </span>
          </div>

          <div
            className="stacked-panel__header-right"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {/* Collapse/Expand button */}
            <TldrawUiButton
              type="icon"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand" : "Collapse"}
              className="stacked-panel__toggle"
              style={{
                width: "16px",
                height: "16px",
                minWidth: "16px",
                minHeight: "16px"
              }}
            >
              <TldrawUiButtonIcon
                icon={isCollapsed ? "chevron-right" : "chevron-down"}
              />
            </TldrawUiButton>
          </div>
        </div>

        {/* Panel Content */}
        {!isCollapsed && (
          <div
            className="stacked-panel__content"
            style={{
              padding: "8px",
              height: effectiveHeight - 28, // Subtract header height
              overflow: "auto",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </>
  );
}
