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

const menuItems = ["File", "Edit", "View", "Dataset", "Tools", "Help"];

const humanSidebarItems: Array<[ActiveView, string]> = [
  ["welcome", "Welcome"],
  ["dataset", "Dataset"],
  ["filters", "Filters"],
  ["queryBuilder", "Query Builder"],
  ["results", "Results"],
  ["history", "History"],
  ["export", "Export"],
  ["settings", "Settings"],
];

const navIcons: Record<string, string> = {
  "Open File": "OF",
  Welcome: "W",
  Dataset: "D",
  Filters: "F",
  "Query Builder": "QB",
  Results: "R",
  History: "H",
  Export: "E",
  Settings: "S",
  "SQL Workspace": "SQL",
  "Saved Queries": "SQ",
  "Query Explain": "QE",
  "Data Cleaning": "DC",
  Diagnostics: "DG",
  Normalization: "N",
};

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
              {isSidebarCollapsed ? ">" : "<"}
            </span>
            <span className="nav-label">{isSidebarCollapsed ? "Expand" : "Collapse"}</span>
          </button>
          <button type="button" className="sidebar-primary" onClick={onOpenFile}>
            <span className="nav-icon" aria-hidden="true">
              {navIcons["Open File"]}
            </span>
            <span className="nav-label">Open File</span>
          </button>
          <div className="sidebar-dataset-summary" aria-label="Active dataset">
            <p>Active dataset</p>
            {dataset ? (
              <>
                <strong>{dataset.original_filename}</strong>
                <span>
                  {dataset.row_count.toLocaleString()} rows &middot;{" "}
                  {dataset.column_count.toLocaleString()} columns
                </span>
              </>
            ) : (
              <span>No dataset open</span>
            )}
          </div>
          <div className="sidebar-recents" aria-label="Recent datasets">
            <p>Recent datasets</p>
            {recentDatasets.length === 0 ? (
              <span>No recent datasets</span>
            ) : (
              recentDatasets.map((session) => (
                <button
                  type="button"
                  key={session.dataset.dataset_id}
                  className={dataset?.dataset_id === session.dataset.dataset_id ? "is-active" : ""}
                  onClick={() => onRecentDatasetClick(session.dataset.dataset_id)}
                  title={session.dataset.original_filename}
                >
                  <span className="nav-icon" aria-hidden="true">
                    D
                  </span>
                  <strong>{session.dataset.original_filename}</strong>
                  <span>
                    {session.dataset.row_count.toLocaleString()} rows &middot;{" "}
                    {session.dataset.column_count.toLocaleString()} cols
                  </span>
                </button>
              ))
            )}
          </div>
          <nav>
            {humanSidebarItems.map(([view, label]) => (
              <button
                type="button"
                key={view}
                className={activeView === view ? "is-active" : ""}
                onClick={() => onViewChange(view)}
                title={label}
              >
                <span className="nav-icon" aria-hidden="true">
                  {navIcons[label] || label.slice(0, 2)}
                </span>
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>
          {workspaceMode === "analyst" && (
            <div className="analyst-sidebar-section" aria-label="Analyst mode tools">
              <p>Analyst mode</p>
              {analystViews.map((item) => (
                <button
                  type="button"
                  key={item.view}
                  className={activeView === item.view ? "is-active" : ""}
                  onClick={() => onViewChange(item.view)}
                  title={item.label}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {navIcons[item.label] || item.label.slice(0, 2)}
                  </span>
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-badge">{item.previewBadge || "Preview"}</span>
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
