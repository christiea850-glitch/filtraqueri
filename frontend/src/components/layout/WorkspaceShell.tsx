import { useEffect, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type {
  ActiveView,
  DatasetMetadata,
  DatasetSession,
  WorkspaceMode,
} from "../../features/dataset/datasetTypes";
import type { WorkspaceRuntimeContext } from "../../features/workspaceRuntime";

type AnalystNavItem = {
  view: ActiveView;
  label: string;
  previewBadge?: string;
};

type HubId = "home" | "data" | "explore" | "build" | "results" | "analyst" | "settings";

type HubItem = {
  id: HubId;
  label: string;
  icon: IconName;
  defaultView: ActiveView;
  mode: WorkspaceMode;
  subItems: Array<{
    view: ActiveView;
    label: string;
    description: string;
  }>;
};

type HubSection = {
  label: string;
  hubIds: HubId[];
};

type IconName =
  | "home"
  | "data"
  | "explore"
  | "build"
  | "results"
  | "analyst"
  | "settings"
  | "upload"
  | "collapse"
  | "expand";

type WorkspaceShellProps = {
  activeView: ActiveView;
  workspaceMode: WorkspaceMode;
  dataset: DatasetMetadata | null;
  recentDatasets: DatasetSession[];
  analystViews: AnalystNavItem[];
  errorMessage: string;
  runtimeContext: WorkspaceRuntimeContext;
  isRuntimePanelCollapsed: boolean;
  children: ReactNode;
  onOpenFile: () => void;
  onViewChange: (view: ActiveView) => void;
  onModeChange: (mode: WorkspaceMode) => void;
  onRecentDatasetClick: (datasetId: string) => void;
  onRuntimePanelToggle: () => void;
  onRuntimeTrailSelect: (
    trailItemId: string,
    targetView: ActiveView,
    targetMode: WorkspaceMode,
  ) => void;
};

const SIDEBAR_MIN_WIDTH = 112;
const SIDEBAR_MAX_WIDTH = 140;
const SIDEBAR_DEFAULT_WIDTH = 128;

const hubSections: HubSection[] = [
  { label: "Workspace", hubIds: ["home", "data"] },
  { label: "Analytics", hubIds: ["explore", "build", "results"] },
  { label: "Advanced", hubIds: ["analyst"] },
  { label: "System", hubIds: ["settings"] },
];

const workspaceHubs: HubItem[] = [
  {
    id: "home",
    label: "Home",
    icon: "home",
    defaultView: "welcome",
    mode: "human",
    subItems: [{ view: "welcome", label: "Open data", description: "Choose CSV" }],
  },
  {
    id: "data",
    label: "Data",
    icon: "data",
    defaultView: "dataset",
    mode: "human",
    subItems: [{ view: "dataset", label: "Data", description: "Current dataset" }],
  },
  {
    id: "explore",
    label: "Explore",
    icon: "explore",
    defaultView: "filters",
    mode: "human",
    subItems: [{ view: "filters", label: "Filters", description: "Refine rows" }],
  },
  {
    id: "build",
    label: "Build",
    icon: "build",
    defaultView: "queryBuilder",
    mode: "human",
    subItems: [{ view: "queryBuilder", label: "Build query", description: "Group and aggregate" }],
  },
  {
    id: "results",
    label: "Results",
    icon: "results",
    defaultView: "results",
    mode: "human",
    subItems: [
      { view: "results", label: "Results", description: "Preview and output" },
      { view: "history", label: "Activity", description: "Session log" },
      { view: "export", label: "Export", description: "Download CSV" },
    ],
  },
  {
    id: "analyst",
    label: "Analyst",
    icon: "analyst",
    defaultView: "sqlWorkspace",
    mode: "analyst",
    subItems: [],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    defaultView: "settings",
    mode: "human",
    subItems: [{ view: "settings", label: "Settings", description: "Preferences" }],
  },
];

function WorkspaceIcon({ name }: { name: IconName }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === "home" && (
        <path {...commonProps} d="M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4v-8.5Z" />
      )}
      {name === "data" && (
        <>
          <ellipse {...commonProps} cx="12" cy="6" rx="7" ry="3" />
          <path {...commonProps} d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
          <path {...commonProps} d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </>
      )}
      {name === "explore" && (
        <>
          <circle {...commonProps} cx="11" cy="11" r="6" />
          <path {...commonProps} d="m16 16 4 4" />
        </>
      )}
      {name === "build" && (
        <>
          <path {...commonProps} d="M4 7h16M7 4v6M12 4v6M17 4v6" />
          <path {...commonProps} d="M6 14h5v5H6zM14 14h4v5h-4z" />
        </>
      )}
      {name === "results" && (
        <>
          <path {...commonProps} d="M5 19V5M5 19h15" />
          <path {...commonProps} d="M8 16v-4M12 16V8M16 16v-6" />
        </>
      )}
      {name === "analyst" && (
        <>
          <path {...commonProps} d="M4 7h16M4 12h16M4 17h10" />
          <path {...commonProps} d="m16 16 2 2 3-4" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle {...commonProps} cx="12" cy="12" r="3" />
          <path {...commonProps} d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a7 7 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" />
        </>
      )}
      {name === "upload" && (
        <>
          <path {...commonProps} d="M12 16V4" />
          <path {...commonProps} d="m7 9 5-5 5 5" />
          <path {...commonProps} d="M5 20h14" />
        </>
      )}
      {name === "collapse" && <path {...commonProps} d="m15 6-6 6 6 6" />}
      {name === "expand" && <path {...commonProps} d="m9 6 6 6-6 6" />}
    </svg>
  );
}

function WorkspaceShell({
  activeView,
  workspaceMode,
  dataset,
  analystViews,
  errorMessage,
  runtimeContext,
  isRuntimePanelCollapsed,
  children,
  onOpenFile,
  onViewChange,
  onModeChange,
  onRuntimePanelToggle,
  onRuntimeTrailSelect,
}: WorkspaceShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const hubs = workspaceHubs.map((hub) =>
    hub.id === "analyst"
      ? {
          ...hub,
          subItems: analystViews.map((item) => ({
            view: item.view,
            label: item.label,
            description: item.previewBadge || "Analyst tool",
          })),
        }
      : hub,
  );
  const activeHub =
    hubs.find((hub) => hub.subItems.some((item) => item.view === activeView)) ||
    hubs.find((hub) => hub.id === (workspaceMode === "analyst" ? "analyst" : "home")) ||
    hubs[0];
  const activeSubItem =
    activeHub.subItems.find((item) => item.view === activeView) || activeHub.subItems[0];
  const groupedHubs = hubSections
    .map((section) => ({
      ...section,
      hubs: section.hubIds
        .map((hubId) => hubs.find((hub) => hub.id === hubId))
        .filter((hub): hub is HubItem => Boolean(hub)),
    }))
    .filter((section) => section.hubs.length > 0);
  const activeSectionLabel =
    groupedHubs.find((section) => section.hubs.some((hub) => hub.id === activeHub.id))?.label ||
    "Workspace";
  const investigationFocusLabel =
    runtimeContext.selectedContextualObject?.label || activeSubItem?.label || activeHub.label;
  const investigationBreadcrumb = `${activeSectionLabel} / ${activeHub.label}`;
  const isLoadedHome = activeView === "welcome" && Boolean(dataset);
  const workflowLabel = isLoadedHome
    ? "Continue"
    : activeView === "filters"
      ? "Choose question"
      : activeView === "queryBuilder"
        ? "Build query"
        : activeView === "results"
          ? "Review result"
          : activeView === "sqlWorkspace"
            ? "Inspect SQL"
        : activeSubItem?.label || activeHub.label;
  const workflowDescription =
    isLoadedHome
      ? "Pick up the current investigation or open another file."
      : activeView === "filters"
        ? "Start with a business question, then narrow the rows that matter."
        : activeView === "queryBuilder"
          ? "Choose fields, shape the result, and run only when ready."
          : activeView === "results"
            ? "Review what the result means, then choose the next investigation move."
            : activeView === "sqlWorkspace"
              ? "Inspect SQL, runtime context, readiness, and warnings before execution."
      : workspaceMode === "analyst"
      ? "SQL and runtime context stay inspectable without automatic execution."
      : "Business flow, results, and next steps stay connected.";
  const activeWorksheetLabel =
    runtimeContext.snapshot.workbook.activeWorksheetName ||
    (runtimeContext.snapshot.workbook.hasWorkbook ? "Workbook worksheet" : "Dataset table");
  const datasetShapeLabel = dataset
    ? `${dataset.row_count.toLocaleString()} rows / ${dataset.column_count.toLocaleString()} columns`
    : "No rows loaded";
  const workspaceIdentityLabel =
    dataset?.original_filename || (workspaceMode === "analyst" ? "Analyst workspace" : "Workspace");
  const primaryRecommendationItem = runtimeContext.recommendationGroups[0]?.items[0] || null;
  const compactTrail = runtimeContext.trail.slice(-5);

  const changeHub = (hub: HubItem) => {
    if (hub.mode !== workspaceMode) onModeChange(hub.mode);
    onViewChange(hub.defaultView);
  };

  useEffect(() => {
    if (!isResizingSidebar) return undefined;

    const resizeSidebar = (event: PointerEvent | globalThis.PointerEvent) => {
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, event.clientX),
      );
      setSidebarWidth(nextWidth);
    };
    const stopResize = () => setIsResizingSidebar(false);

    window.addEventListener("pointermove", resizeSidebar);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    document.body.classList.add("is-resizing-sidebar");

    return () => {
      window.removeEventListener("pointermove", resizeSidebar);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      document.body.classList.remove("is-resizing-sidebar");
    };
  }, [isResizingSidebar]);

  const startSidebarResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (isSidebarCollapsed) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizingSidebar(true);
  };

  return (
    <div
      className={[
        "app",
        isSidebarCollapsed ? "is-sidebar-collapsed" : "",
        `view-${activeView}`,
        `mode-${workspaceMode}`,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <header className="top-menu-bar">
        <div className="workspace-brand">
          <div className="brand-mark compact-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img">
              <path
                className="mark-funnel"
                d="M9 11h30L28 24.5v8.7l-8 4.3v-13L9 11Z"
              />
              <path className="mark-search" d="M30 29.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
              <path className="mark-handle" d="m34.5 34.5 5 5" />
            </svg>
          </div>
          <strong>FiltraQueri</strong>
        </div>
        <button
          type="button"
          className="workspace-switcher"
          aria-label="Workspace identity"
          onClick={() => (dataset ? onViewChange("dataset") : onOpenFile())}
        >
          <strong>{workspaceIdentityLabel}</strong>
        </button>
        <div className="mode-switcher" aria-label="Workspace mode">
          <button
            type="button"
            className={workspaceMode === "human" ? "is-active" : ""}
            onClick={() => onModeChange("human")}
          >
            Human Mode
          </button>
          <button
            type="button"
            className={workspaceMode === "analyst" ? "is-active" : ""}
            onClick={() => onModeChange("analyst")}
          >
            Analyst Mode
          </button>
        </div>
        <button type="button" className="settings-button" onClick={() => onViewChange("settings")}>
          Settings
        </button>
      </header>

      <div className="workspace-shell">
        <aside className="left-sidebar" aria-label="Workspace navigation">
          <div className="sidebar-shell-controls">
            <button
              type="button"
              className="sidebar-collapse-toggle"
              onClick={() => setIsSidebarCollapsed((currentValue) => !currentValue)}
              aria-label={isSidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
            >
              <span className="nav-icon" aria-hidden="true">
                <WorkspaceIcon name={isSidebarCollapsed ? "expand" : "collapse"} />
              </span>
              <span className="nav-label">{isSidebarCollapsed ? "Expand" : "Collapse"}</span>
            </button>
          </div>

          <nav className="hub-nav" aria-label="Workspace navigation">
            {groupedHubs.map((section) => (
              <section key={section.label} className="sidebar-nav-section">
                {!isSidebarCollapsed && <p>{section.label}</p>}
                <div>
                  {section.hubs.map((hub) => (
                    <button
                      type="button"
                      key={hub.id}
                      className={activeHub.id === hub.id ? "is-active" : ""}
                      onClick={() => changeHub(hub)}
                      title={hub.label}
                    >
                      <span className="nav-icon" aria-hidden="true">
                        <WorkspaceIcon name={hub.icon} />
                      </span>
                      <span className="nav-label">{hub.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>
        <button
          type="button"
          className="sidebar-resize-handle"
          aria-label="Resize sidebar"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          onPointerDown={startSidebarResize}
          disabled={isSidebarCollapsed}
        />

        <main className="workspace-canvas">
          <section
            className={[
              "workspace-page-heading",
              workspaceMode === "analyst" ? "is-analyst-workflow" : "is-human-workflow",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Workspace heading"
          >
            <div>
              <p>{investigationBreadcrumb}</p>
              <h1>{workflowLabel}</h1>
            </div>
            <span>{workflowDescription}</span>
          </section>

          <section className="workspace-context-strip" aria-label="Workspace context">
            <span>
              <small>Dataset</small>
              <strong>{dataset ? dataset.original_filename : "No dataset open"}</strong>
            </span>
            <span>
              <small>Worksheet</small>
              <strong>{activeWorksheetLabel}</strong>
            </span>
            <span>
              <small>Rows / columns</small>
              <strong>{datasetShapeLabel}</strong>
            </span>
            <span>
              <small>Focus</small>
              <strong>{investigationFocusLabel}</strong>
            </span>
          </section>

          <section className="workspace-active-flow" aria-label="Active workflow">
            {errorMessage && activeView !== "welcome" && (
              <p className="error-message workspace-error">{errorMessage}</p>
            )}
            {children}
          </section>
        </main>

        <aside
          className={[
            "runtime-context-panel",
            workspaceMode === "analyst" ? "is-analyst-mode" : "is-human-mode",
            isRuntimePanelCollapsed ? "is-collapsed" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Workspace runtime context"
        >
          <button
            type="button"
            className="runtime-panel-toggle"
            onClick={onRuntimePanelToggle}
            aria-expanded={!isRuntimePanelCollapsed}
          >
            {isRuntimePanelCollapsed ? "Investigation" : "Hide investigation"}
          </button>
          {!isRuntimePanelCollapsed && (
            <div className="runtime-context-body">
              <div className="runtime-context-header">
                <p className="section-label">Investigation</p>
                <h2>{workflowLabel}</h2>
                <span>{investigationFocusLabel}</span>
              </div>

              <section className="runtime-investigation-surface" aria-label="Suggested next step">
                {primaryRecommendationItem && (
                  <div className="runtime-next-steps">
                    <div className="runtime-section-heading">
                      <span>Suggested next action</span>
                      <small>Choose when you are ready</small>
                    </div>
                    <div className="runtime-guidance-list">
                      <button
                        type="button"
                        onClick={() =>
                          onRuntimeTrailSelect(
                            primaryRecommendationItem.continuationLink.continuationId,
                            primaryRecommendationItem.continuationLink.targetView,
                            primaryRecommendationItem.continuationLink.targetMode,
                          )
                        }
                      >
                        <strong>{primaryRecommendationItem.title}</strong>
                        <span>{primaryRecommendationItem.summary}</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="runtime-trail-section" aria-label="Investigation trail">
                <div className="runtime-section-heading">
                  <span>Trail</span>
                  <small>Move through the current investigation</small>
                </div>
                <div className="runtime-trail-list" aria-label="Workspace path">
                  {compactTrail.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={[
                        item.status === "current" ? "is-current" : "",
                        runtimeContext.selectedTrailItemId === item.id ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => onRuntimeTrailSelect(item.id, item.view, item.mode)}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.summary}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default WorkspaceShell;
