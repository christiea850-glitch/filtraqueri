import { useState, type ReactNode } from "react";
import type {
  ActiveView,
  DatasetMetadata,
  DatasetSession,
  WorkspaceMode,
} from "../../features/dataset/datasetTypes";

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
  children: ReactNode;
  onOpenFile: () => void;
  onViewChange: (view: ActiveView) => void;
  onModeChange: (mode: WorkspaceMode) => void;
  onRecentDatasetClick: (datasetId: string) => void;
};

const menuItems = ["Help"];

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
  recentDatasets,
  analystViews,
  errorMessage,
  children,
  onOpenFile,
  onViewChange,
  onModeChange,
  onRecentDatasetClick,
}: WorkspaceShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
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

  const changeHub = (hub: HubItem) => {
    if (hub.mode !== workspaceMode) onModeChange(hub.mode);
    onViewChange(hub.defaultView);
  };

  return (
    <div
      className={[
        "app",
        isSidebarCollapsed ? "is-sidebar-collapsed" : "",
        isFocusMode ? "is-workspace-focused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
        <nav className="menu-items" aria-label="Application menu">
          {menuItems.map((item) => (
            <button type="button" key={item}>
              {item}
            </button>
          ))}
        </nav>
        <span className="workspace-status">
          {dataset ? dataset.original_filename : "No dataset open"}
        </span>
        <button
          type="button"
          className={`focus-toggle ${isFocusMode ? "is-active" : ""}`}
          onClick={() => setIsFocusMode((currentValue) => !currentValue)}
        >
          {isFocusMode ? "Exit Focus" : "Focus Mode"}
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
      </header>

      <div className="workspace-shell">
        <aside className="left-sidebar" aria-label="Workspace navigation">
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
          <button type="button" className="sidebar-primary" onClick={onOpenFile} title="Open data">
            <span className="nav-icon" aria-hidden="true">
              <WorkspaceIcon name="upload" />
            </span>
            <span className="nav-label">Open data</span>
          </button>
          <div className="sidebar-dataset-summary" aria-label="Active dataset">
            <p>Dataset</p>
            {dataset ? (
              <>
                <strong>{dataset.original_filename}</strong>
                <span>
                  {dataset.row_count.toLocaleString()} rows &middot;{" "}
                  {dataset.column_count.toLocaleString()} columns
                </span>
              </>
            ) : (
              <span>No dataset open. Choose CSV.</span>
            )}
          </div>
          {!isSidebarCollapsed && activeHub.id === "data" && (
          <div className="sidebar-recents" aria-label="Recent files">
            <p>Recent files</p>
            {recentDatasets.length === 0 ? (
              <span>No recent files</span>
            ) : (
              recentDatasets.map((session) => (
                <button
                  type="button"
                  key={session.dataset.dataset_id}
                  className={dataset?.dataset_id === session.dataset.dataset_id ? "is-active" : ""}
                  onClick={() => onRecentDatasetClick(session.dataset.dataset_id)}
                  title={session.dataset.original_filename}
                >
                  <strong>{session.dataset.original_filename}</strong>
                  <span>
                    {session.dataset.row_count.toLocaleString()} rows &middot;{" "}
                    {session.dataset.column_count.toLocaleString()} cols
                  </span>
                </button>
              ))
            )}
          </div>
          )}
          <nav className="hub-nav" aria-label="Workspace hubs">
            {hubs.map((hub) => (
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
          </nav>

          {!isSidebarCollapsed && (
            <div className="hub-subnav" aria-label={`${activeHub.label} navigation`}>
              <p>{activeHub.label}</p>
              {activeHub.subItems.map((item) => (
                <button
                  type="button"
                  key={item.view}
                  className={activeView === item.view ? "is-active" : ""}
                  onClick={() => onViewChange(item.view)}
                  title={item.label}
                >
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="workspace-canvas">
          {errorMessage && activeView !== "welcome" && (
            <p className="error-message workspace-error">{errorMessage}</p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default WorkspaceShell;
