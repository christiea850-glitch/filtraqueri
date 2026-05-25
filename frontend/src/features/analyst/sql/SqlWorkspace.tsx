import { useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
import WorkbookContextPanel from "../../../components/workbook/WorkbookContextPanel";
import SqlEditorPanel, { SqlDraftPanel, SqlGuidancePanel } from "./SqlEditorPanel";
import SqlPreviewGrid from "./SqlPreviewGrid";
import SqlSchemaPanel from "./SqlSchemaPanel";
import type { SqlPreviewResult } from "./sqlTypes";
import useSqlWorkspace from "./useSqlWorkspace";

type SqlWorkspaceProps = {
  dataset: DatasetMetadata | null;
  onExecutionResult?: (result: WorkspaceExecutionResult) => void;
  metadata?: SqlWorkspaceMetadataSnapshot;
  onMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void;
};

type BottomTab = "result" | "guidance" | "drafts";

const bottomTabLabels: Record<BottomTab, string> = {
  result: "Result preview",
  guidance: "SQL guidance",
  drafts: "Drafts",
};

const bottomTabOrder: BottomTab[] = ["result", "guidance", "drafts"];

function SqlFocusedResultPreview({
  dataset,
  sql,
  previewResult,
  onBack,
}: {
  dataset: DatasetMetadata | null;
  sql: string;
  previewResult: SqlPreviewResult;
  onBack: () => void;
}) {
  const hasColumns = previewResult.columns.length > 0;
  const hasRows = previewResult.rows.length > 0;

  return (
    <section className="sql-result-page" aria-label="SQL result preview">
      <div className="sql-result-page-header">
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to Analyst
        </button>
        <div>
          <p className="section-label">Analyst SQL</p>
          <h2>Result Preview</h2>
          <p>{previewResult.message}</p>
        </div>
        <div className="sql-result-page-actions" aria-label="Future result actions">
          <button type="button" className="secondary-button" disabled title="Export for SQL results is planned.">
            Export
          </button>
          <button type="button" className="secondary-button" disabled title="Print for SQL results is planned.">
            Print
          </button>
        </div>
      </div>

      <div className="sql-result-summary" aria-label="SQL result summary">
        <span>
          <strong>{previewResult.rows.length.toLocaleString()}</strong>
          Rows
        </span>
        <span>
          <strong>{previewResult.columns.length.toLocaleString()}</strong>
          Columns
        </span>
        <span title={dataset?.original_filename || "No dataset"}>
          <strong>{dataset?.table_name || "data"}</strong>
          Source
        </span>
      </div>

      <div className="sql-result-query-card">
        <span>Query</span>
        <pre>{sql}</pre>
      </div>

      {hasColumns ? (
        <div className="sql-result-table-shell">
          <table aria-label="SQL result data grid">
            <thead>
              <tr>
                <th className="row-number-cell" scope="col">
                  Row
                </th>
                {previewResult.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasRows ? (
                previewResult.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <th className="row-number-cell" scope="row">
                      {rowIndex + 1}
                    </th>
                    {previewResult.columns.map((column) => (
                      <td key={column}>{String(row[column] ?? "")}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={previewResult.columns.length + 1}>The query returned no rows.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <p className="section-label">No result</p>
          <h2>No SQL result to preview</h2>
          <p>Run a SELECT query to open a focused result preview.</p>
        </div>
      )}
    </section>
  );
}

function SqlWorkspace({ dataset, onExecutionResult, metadata, onMetadataChange }: SqlWorkspaceProps) {
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isFocusedPreviewOpen, setIsFocusedPreviewOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab | null>(null);
  const [contextHeight, setContextHeight] = useState(248);
  const [bottomHeight, setBottomHeight] = useState(220);
  const {
    savedDrafts,
    characterCount,
    editorStatus,
    previewResult,
    templates,
    keywordSuggestions,
    sqlAnalysis,
    selectedDialect,
    selectedDialectProfile,
    dialectOptions,
    setSelectedDialect,
    editor,
    insertSql,
    loadDraft,
    sqlDraft,
  } = useSqlWorkspace(dataset, onExecutionResult, metadata, onMetadataChange);
  const canOpenResultPreview = editorStatus === "success" && previewResult.columns.length > 0;
  const toggleBottomTab = (tab: BottomTab) => {
    setBottomTab((current) => (current === tab ? null : tab));
  };

  const startDockResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    dock: "context" | "bottom",
  ) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-dragging");
    const startY = event.clientY;
    const direction = dock === "context" ? 1 : -1;
    const startHeight = dock === "context" ? contextHeight : bottomHeight;
    const applyHeight = dock === "context" ? setContextHeight : setBottomHeight;

    const onMove = (moveEvent: PointerEvent) => {
      const next = startHeight + (moveEvent.clientY - startY) * direction;
      applyHeight(Math.min(560, Math.max(96, Math.round(next))));
    };
    const onRelease = () => {
      handle.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onRelease);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onRelease);
  };

  if (isFocusedPreviewOpen) {
    return (
      <section className="sql-workspace-v2 sql-workspace-preview-mode" aria-label="SQL workspace">
        <SqlFocusedResultPreview
          dataset={dataset}
          sql={sqlDraft}
          previewResult={previewResult}
          onBack={() => setIsFocusedPreviewOpen(false)}
        />
      </section>
    );
  }

  return (
    <section
      className={["sql-workspace-v2", isRailCollapsed ? "is-rail-collapsed" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label="SQL workspace"
    >
      <div className="sqlw-main">
        <div className="sqlw-dockbar">
          <button
            type="button"
            className={["sqlw-pill", isContextOpen ? "is-on" : ""].filter(Boolean).join(" ")}
            aria-expanded={isContextOpen}
            onClick={() => setIsContextOpen((current) => !current)}
          >
            SQL context
          </button>
        </div>

        {isContextOpen && (
          <>
            <section
              className="sqlw-dock sqlw-dock-top"
              aria-label="SQL context"
              style={{ height: contextHeight }}
            >
              <div className="sqlw-dock-head">
                <span>SQL context</span>
                <button
                  type="button"
                  className="sqlw-dock-x"
                  onClick={() => setIsContextOpen(false)}
                  aria-label="Close SQL context"
                >
                  Close
                </button>
              </div>
              <div className="sqlw-dock-body">
                <WorkbookContextPanel dataset={dataset} variant="analyst" />
              </div>
            </section>
            <div
              className="sqlw-split"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize SQL context panel"
              onPointerDown={(event) => startDockResize(event, "context")}
            />
          </>
        )}

        <SqlEditorPanel
          editor={editor}
          executionStatus={editorStatus}
          characterCount={characterCount}
          canRunQuery={Boolean(dataset)}
          canOpenResultPreview={canOpenResultPreview}
          onOpenResultPreview={() => setIsFocusedPreviewOpen(true)}
          dialectContext={{
            selectedDialect,
            selectedDialectProfile,
            dialectOptions,
            onDialectChange: setSelectedDialect,
          }}
        />

        {bottomTab && (
          <>
            <div
              className="sqlw-split"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize query output panel"
              onPointerDown={(event) => startDockResize(event, "bottom")}
            />
            <section
              className="sqlw-dock sqlw-dock-bot"
              aria-label="Query output"
              style={{ height: bottomHeight }}
            >
              <div className="sqlw-dock-head">
                <span>{bottomTabLabels[bottomTab]}</span>
                <button
                  type="button"
                  className="sqlw-dock-x"
                  onClick={() => setBottomTab(null)}
                  aria-label="Close query output"
                >
                  Close
                </button>
              </div>
              <div className="sqlw-dock-body">
                {bottomTab === "result" && <SqlPreviewGrid previewResult={previewResult} />}
                {bottomTab === "guidance" && (
                  <SqlGuidancePanel
                    diagnostics={sqlAnalysis.diagnostics}
                    guidanceCards={sqlAnalysis.explanationCards}
                    dialectContext={{ selectedDialectProfile }}
                    validation={sqlAnalysis.validation}
                  />
                )}
                {bottomTab === "drafts" && (
                  <SqlDraftPanel savedDrafts={savedDrafts} onLoadDraft={loadDraft} />
                )}
              </div>
            </section>
          </>
        )}

        <div className="sqlw-dockbar sqlw-dockbar-bottom">
          <span className="sqlw-dockbar-label">Query output</span>
          {bottomTabOrder.map((tab) => (
            <button
              type="button"
              key={tab}
              className={["sqlw-pill", bottomTab === tab ? "is-on" : ""].filter(Boolean).join(" ")}
              aria-pressed={bottomTab === tab}
              onClick={() => toggleBottomTab(tab)}
            >
              {bottomTabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      <SqlSchemaPanel
        dataset={dataset}
        templates={templates}
        keywordSuggestions={keywordSuggestions}
        collapsed={isRailCollapsed}
        onToggleCollapsed={() => setIsRailCollapsed((current) => !current)}
        onInsertSql={insertSql}
      />
    </section>
  );
}

export default SqlWorkspace;
