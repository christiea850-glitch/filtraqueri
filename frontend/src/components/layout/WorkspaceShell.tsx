import { useEffect, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type {
  ActiveView,
  DatasetMetadata,
  DatasetSession,
  WorkspaceMode,
} from "../../features/dataset/datasetTypes";
import type { WorkspaceRuntimeContext } from "../../features/workspaceRuntime";
import CommandLauncher, { type CommandLauncherItem } from "./CommandLauncher";

type AnalystNavItem = {
  view: ActiveView;
  label: string;
  previewBadge?: string;
};

type ProductDestinationId = "home" | "data" | "analyze" | "insights" | "analyst" | "settings";

type ProductDestination = {
  id: ProductDestinationId;
  label: string;
  icon: IconName;
  defaultView: ActiveView;
  mode: WorkspaceMode;
};

type IconName =
  | "home"
  | "data"
  | "analyze"
  | "insights"
  | "analyst"
  | "settings"
  | "upload"
  | "collapse"
  | "expand"
  | "spreadsheet"
  | "chevronDown"
  | "support";

type WorkspaceShellProps = {
  activeView: ActiveView;
  workspaceMode: WorkspaceMode;
  dataset: DatasetMetadata | null;
  recentDatasets: DatasetSession[];
  analystViews: AnalystNavItem[];
  errorMessage: string;
  runtimeContext: WorkspaceRuntimeContext;
  isRuntimePanelCollapsed: boolean;
  commandItems: CommandLauncherItem[];
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

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 300;
const SIDEBAR_DEFAULT_WIDTH = 240;

const productDestinations: ProductDestination[] = [
  {
    id: "home",
    label: "Home",
    icon: "home",
    defaultView: "welcome",
    mode: "human",
  },
  {
    id: "data",
    label: "Data",
    icon: "data",
    defaultView: "dataset",
    mode: "human",
  },
  {
    id: "analyze",
    label: "Investigate",
    icon: "analyze",
    defaultView: "queryBuilder",
    mode: "human",
  },
  {
    id: "insights",
    label: "Insights",
    icon: "insights",
    defaultView: "results",
    mode: "human",
  },
  {
    id: "analyst",
    label: "Analyst",
    icon: "analyst",
    defaultView: "sqlWorkspace",
    mode: "analyst",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    defaultView: "settings",
    mode: "human",
  },
];

const destinationByActiveView: Record<ActiveView, ProductDestinationId> = {
  welcome: "home",
  dataset: "data",
  filters: "analyze",
  queryBuilder: "analyze",
  results: "insights",
  history: "insights",
  export: "insights",
  settings: "settings",
  sqlWorkspace: "analyst",
  savedQueries: "analyst",
  queryExplain: "analyst",
  dataCleaning: "analyst",
  diagnostics: "analyst",
  normalization: "analyst",
};

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
      {name === "analyze" && (
        <>
          <circle {...commonProps} cx="11" cy="11" r="6" />
          <path {...commonProps} d="m16 16 4 4" />
        </>
      )}
      {name === "insights" && (
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
      {name === "spreadsheet" && (
        <>
          <rect {...commonProps} x="4" y="4" width="16" height="16" rx="2" />
          <path {...commonProps} d="M4 9h16M4 14h16M9 4v16M15 4v16" />
        </>
      )}
      {name === "chevronDown" && <path {...commonProps} d="m6 9 6 6 6-6" />}
      {name === "support" && (
        <>
          <circle {...commonProps} cx="12" cy="12" r="8" />
          <path {...commonProps} d="M9.5 9a3 3 0 1 1 4.2 2.8c-.9.4-1.7 1.1-1.7 2.2" />
          <path {...commonProps} d="M12 17h.01" />
        </>
      )}
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
  commandItems,
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
  const [isCommandLauncherOpen, setIsCommandLauncherOpen] = useState(false);
  const activeDestinationId = destinationByActiveView[activeView];
  const activeDestination =
    productDestinations.find((destination) => destination.id === activeDestinationId) ||
    productDestinations[0];
  const investigationFocusLabel =
    runtimeContext.selectedContextualObject?.label || activeDestination.label;
  const isSettingsView = activeDestination.id === "settings";
  // The Analyst page carries its own Schema / Context / Runtime inspection
  // tabs inside the SQL workspace, so the destination guidance rail is
  // redundant there — and crowding it in caused the rail to clip off-screen.
  // Analyst therefore runs as a clean 3-column shell with no rail.
  const hasDestinationRail =
    !isSettingsView &&
    activeDestination.id !== "home" &&
    activeDestination.id !== "analyst" &&
    activeDestination.id !== "data";
  const hasWorkspaceContextStrip =
    !isSettingsView &&
    activeDestination.id !== "home" &&
    activeDestination.id !== "data";
  const isLoadedHome = activeView === "welcome" && Boolean(dataset);
  const workflowLabel = isLoadedHome
    ? "Continue"
    : activeView === "filters"
      ? "Choose business question"
      : activeView === "queryBuilder"
        ? "Explore question"
        : activeView === "results"
          ? "Review result"
          : activeView === "sqlWorkspace"
            ? "Inspect SQL"
        : activeDestination.label;
  const analystToolCount = analystViews.length;
  const workflowDescription =
    isLoadedHome
      ? "Pick up the current investigation or open another file."
      : activeView === "filters"
        ? "Start with a business question, then narrow the rows that matter."
        : activeView === "queryBuilder"
          ? "Choose business fields and shape the result only when it helps the investigation."
          : activeView === "results"
            ? "Review what the result means, then choose the next investigation move."
            : activeView === "sqlWorkspace"
              ? "Inspect SQL, schema, context, and warnings before running anything."
              : activeView === "settings"
                ? "Manage preferences and system choices away from the investigation workspace."
      : workspaceMode === "analyst"
      ? `SQL and technical context stay inspectable across ${analystToolCount.toLocaleString()} tool surfaces.`
      : "Business questions, findings, and next steps stay connected.";
  const activeWorksheetLabel =
    runtimeContext.snapshot.workbook.activeWorksheetName ||
    (runtimeContext.snapshot.workbook.hasWorkbook ? "Workbook source" : "Dataset table");
  const datasetShapeLabel = dataset
    ? `${dataset.row_count.toLocaleString()} rows / ${dataset.column_count.toLocaleString()} columns`
    : "No rows loaded";
  const workspaceIdentityLabel =
    dataset?.original_filename || (workspaceMode === "analyst" ? "Analyst workspace" : "Workspace");
  const primaryRecommendationItem = runtimeContext.recommendationGroups[0]?.items[0] || null;
  const compactTrail = runtimeContext.trail.slice(-5);
  const investigationJourneySteps = [
    {
      label: "Dataset understood",
      complete: Boolean(dataset),
      active: activeDestination.id === "data" || activeView === "welcome",
    },
    {
      label: "Business signals detected",
      complete: Boolean(dataset) && activeDestination.id !== "home",
      active: activeDestination.id === "data",
    },
    {
      label: "Question chosen",
      complete:
        activeDestination.id === "analyze" ||
        activeDestination.id === "insights" ||
        activeDestination.id === "analyst",
      active: activeDestination.id === "analyze",
    },
    {
      label: "Findings ready",
      complete: activeDestination.id === "insights",
      active: activeDestination.id === "insights",
    },
  ];

  const changeDestination = (destination: ProductDestination) => {
    if (destination.mode !== workspaceMode) onModeChange(destination.mode);
    onViewChange(destination.defaultView);
  };

  useEffect(() => {
    const openLauncher = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandLauncherOpen(true);
      }
    };

    window.addEventListener("keydown", openLauncher);
    return () => window.removeEventListener("keydown", openLauncher);
  }, []);

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
        `destination-${activeDestination.id}`,
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
          {activeDestination.id === "data" && (
            <span className="workspace-switcher-icon" aria-hidden="true">
              <WorkspaceIcon name="spreadsheet" />
            </span>
          )}
          <strong>{workspaceIdentityLabel}</strong>
          {activeDestination.id === "data" && (
            <span className="workspace-switcher-chevron" aria-hidden="true">
              <WorkspaceIcon name="chevronDown" />
            </span>
          )}
        </button>
        <button
          type="button"
          className="command-launcher-trigger"
          onClick={() => setIsCommandLauncherOpen(true)}
          aria-label="Open command launcher"
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
          <strong>Search actions</strong>
          <kbd>Ctrl K</kbd>
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
        <button
          type="button"
          className="settings-button"
          aria-label="Settings"
          onClick={() =>
            changeDestination(
              productDestinations.find((destination) => destination.id === "settings")!,
            )
          }
        >
          {activeDestination.id === "data" ? (
            <span className="settings-button-icon" aria-hidden="true">
              <WorkspaceIcon name="settings" />
            </span>
          ) : (
            "Settings"
          )}
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
            <section className="sidebar-nav-section">
              {!isSidebarCollapsed && <p>Destinations</p>}
              <div>
                {productDestinations.map((destination) => (
                  <button
                    type="button"
                    key={destination.id}
                    className={activeDestination.id === destination.id ? "is-active" : ""}
                    onClick={() => changeDestination(destination)}
                    title={destination.label}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <WorkspaceIcon name={destination.icon} />
                    </span>
                    <span className="nav-label">{destination.label}</span>
                  </button>
                ))}
                {activeDestination.id === "data" && (
                  <button
                    type="button"
                    className="sidebar-support-item"
                    title="Support"
                    aria-label="Support"
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <WorkspaceIcon name="support" />
                    </span>
                    <span className="nav-label">Support</span>
                  </button>
                )}
              </div>
            </section>
          </nav>
          {activeDestination.id === "data" && (
            <div className="sidebar-bottom-stack" aria-label="Workspace and account">
              <section className="sidebar-workspace-status-card" aria-label="Current workspace">
                <span>Current workspace</span>
                <strong>{dataset ? workspaceIdentityLabel : "No dataset open"}</strong>
                <small>{dataset ? datasetShapeLabel : "Choose a file to begin"}</small>
              </section>
              <section className="sidebar-profile-card" aria-label="Account status">
                <span className="sidebar-profile-avatar" aria-hidden="true">LW</span>
                <div>
                  <strong>Local workspace</strong>
                  <span>No account connected</span>
                </div>
              </section>
            </div>
          )}
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
          {hasWorkspaceContextStrip && (
            <>
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
                  <p>{activeDestination.label}</p>
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
              </section>

              {workspaceMode === "human" && activeDestination.id !== "settings" && (
                <section className="investigation-status-strip" aria-label="Investigation progress">
                  {investigationJourneySteps.map((step) => (
                    <span
                      key={step.label}
                      className={[
                        step.complete ? "is-complete" : "",
                        step.active ? "is-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {step.label}
                    </span>
                  ))}
                </section>
              )}
            </>
          )}

          <section className="workspace-active-flow" aria-label="Active investigation">
            {errorMessage && activeView !== "welcome" && (
              <p className="error-message workspace-error">{errorMessage}</p>
            )}
            {children}
          </section>
        </main>

        {hasDestinationRail && (
          <aside
            className={[
              "runtime-context-panel",
              workspaceMode === "analyst" ? "is-analyst-mode" : "is-human-mode",
              isRuntimePanelCollapsed ? "is-collapsed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`${activeDestination.label} guidance`}
          >
            <button
              type="button"
              className="runtime-panel-toggle"
              onClick={onRuntimePanelToggle}
              aria-expanded={!isRuntimePanelCollapsed}
            >
              {isRuntimePanelCollapsed ? "Guidance" : "Hide guidance"}
            </button>
            {!isRuntimePanelCollapsed && (
              <div className="runtime-context-body">
                <div className="runtime-context-header">
                  <p className="section-label">
                    {activeDestination.id === "analyst" ? "Inspection" : activeDestination.label}
                  </p>
                  <h2>
                    {activeDestination.id === "data"
                      ? "Data quality"
                      : activeDestination.id === "analyze"
                        ? "Question shaping"
                        : activeDestination.id === "insights"
                          ? "Investigation thread"
                          : workflowLabel}
                  </h2>
                  <span>{investigationFocusLabel}</span>
                </div>

                <section className="runtime-investigation-surface" aria-label="Suggested next step">
                  {primaryRecommendationItem && (
                    <div className="runtime-next-steps">
                      <div className="runtime-section-heading">
                        <span>
                          {activeDestination.id === "data"
                            ? "Data guidance"
                            : activeDestination.id === "insights"
                              ? "Follow-up suggestion"
                              : activeDestination.id === "analyst"
                                ? "Execution context"
                            : "Suggested next step"}
                        </span>
                        <small>
                          {activeDestination.id === "analyst"
                            ? "Technical details stay here"
                            : "Choose when it helps the investigation"}
                        </small>
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
                    <span>
                      {activeDestination.id === "analyst" ? "Runtime inspection" : "Investigation flow"}
                    </span>
                    <small>
                      {activeDestination.id === "insights"
                        ? "Review, save, share, or export from the result"
                        : activeDestination.id === "data"
                          ? "Understand the dataset before asking more"
                          : "Move through the current work"}
                    </small>
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
        )}
      </div>
      <CommandLauncher
        open={isCommandLauncherOpen}
        commands={commandItems}
        onClose={() => setIsCommandLauncherOpen(false)}
      />
    </div>
  );
}

export default WorkspaceShell;
export type { CommandLauncherItem };
