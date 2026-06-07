import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ActiveView, DatasetMetadata } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
import type { AnalysisScopeSelection } from "../../workbook";
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
} from "../../../components/common/DataTable";
import WorkbookContextPanel from "../../../components/workbook/WorkbookContextPanel";
import type { SqlAssistantMode } from "./SqlAssistantPanel";
import SqlEditorPanel, { SqlGuidancePanel } from "./SqlEditorPanel";
import SqlSchemaPanel from "./SqlSchemaPanel";
import type { SqlPreviewResult, SqlQueryDraft } from "./sqlTypes";
import useSqlWorkspace from "./useSqlWorkspace";

type SqlWorkspaceProps = {
  dataset: DatasetMetadata | null;
  onExecutionResult?: (result: WorkspaceExecutionResult) => void;
  metadata?: SqlWorkspaceMetadataSnapshot;
  onMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void;
  onWorksheetSelect?: (worksheetId: string) => void;
  isSwitchingWorksheet?: boolean;
  analysisScopeSelections?: AnalysisScopeSelection[];
  onAnalysisScopeSelectionsChange?: (selections: AnalysisScopeSelection[]) => void;
  onAnalystViewChange?: (view: ActiveView) => void;
  onSqlAssistantModeChange?: (mode: SqlAssistantMode | null) => void;
};

type BottomTab = "guidance";
type FocusedSqlView = "editor" | "result" | "drafts" | "draft-detail";
type SqlWorkspaceCommandTarget = "editor" | "result" | "drafts";

const bottomTabLabels: Record<BottomTab, string> = {
  guidance: "SQL diagnostics",
};

const bottomTabOrder: BottomTab[] = ["guidance"];

const formatDraftTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const createSqlPreview = (sql: string) => {
  const normalized = sql.replace(/\s+/g, " ").trim();
  return normalized.length > 150 ? `${normalized.slice(0, 150)}...` : normalized;
};

function SqlFocusedResultPreview({
  previewResult,
  onBack,
}: {
  previewResult: SqlPreviewResult;
  onBack: () => void;
}) {
  const [isWrapped, setIsWrapped] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const hasColumns = previewResult.columns.length > 0;
  const hasRows = previewResult.rows.length > 0;
  const baseColumnWidth = 168;
  const getColumnWidth = (columnName: string) => columnWidths[columnName] ?? baseColumnWidth;
  const totalTableWidth =
    52 + previewResult.columns.reduce((sum, column) => sum + getColumnWidth(column), 0);

  const startColumnResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    columnName: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-dragging");
    const startX = event.clientX;
    const startWidth = getColumnWidth(columnName);
    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX);
      setColumnWidths((current) => ({
        ...current,
        [columnName]: Math.min(560, Math.max(72, Math.round(nextWidth))),
      }));
    };
    const onRelease = () => {
      handle.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onRelease);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onRelease);
  };
  const sqlResultColumns: DataTableColumn[] = previewResult.columns.map((column) => ({
    key: column,
    width: getColumnWidth(column),
    header: (
      <>
        <span className="dataset-preview-cell">{column}</span>
        <span
          className="dataset-preview-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${column} column`}
          onPointerDown={(event) => startColumnResize(event, column)}
        />
      </>
    ),
  }));
  const sqlResultRows: DataTableRow[] = previewResult.rows.map((row, rowIndex) => ({
    key: rowIndex,
    values: row,
    rowNumber: rowIndex + 1,
    rowHeaderClassName: "dataset-preview-rownum",
  }));

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
          <button
            type="button"
            className="secondary-button dataset-preview-wrap-toggle"
            onClick={() => setIsWrapped((current) => !current)}
          >
            {isWrapped ? "Compact cells" : "Expand cells"}
          </button>
          <button type="button" className="secondary-button" disabled title="Export for SQL results is planned.">
            Export
          </button>
          <button type="button" className="secondary-button" disabled title="Print for SQL results is planned.">
            Print
          </button>
        </div>
      </div>

      {hasColumns ? (
        <DataTable
          variant="sqlResult"
          ariaLabel="SQL result data grid"
          wrapperClassName="dataset-preview-table-wrap sql-result-table-wrap"
          tableClassName={["dataset-preview-table", "sql-result-table", isWrapped ? "is-wrapped" : ""]
            .filter(Boolean)
            .join(" ")}
          tableStyle={{ width: `${totalTableWidth}px`, minWidth: "100%" }}
          columns={sqlResultColumns}
          rows={sqlResultRows}
          showRowNumbers
          rowNumberHeader="#"
          rowNumberHeaderClassName="dataset-preview-rownum"
          rowNumberColumnWidth={52}
          emptyRowContent={hasRows ? undefined : "The query returned no rows."}
          renderCell={(row, column) => (
            <span className="dataset-preview-cell">{String(row.values[column.key] ?? "")}</span>
          )}
          getCellTitle={(row, column) => String(row.values[column.key] ?? "")}
        />
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

function SavedDraftsPage({
  drafts,
  selectedDraftIds,
  onSelectedDraftIdsChange,
  onBack,
  onOpenDraft,
  onRenameDraft,
  onDeleteDraft,
  onBulkDelete,
}: {
  drafts: SqlQueryDraft[];
  selectedDraftIds: string[];
  onSelectedDraftIdsChange: (draftIds: string[]) => void;
  onBack: () => void;
  onOpenDraft: (draft: SqlQueryDraft) => void;
  onRenameDraft: (draft: SqlQueryDraft) => void;
  onDeleteDraft: (draft: SqlQueryDraft) => void;
  onBulkDelete: () => void;
}) {
  const selectedDraftIdSet = new Set(selectedDraftIds);
  const allSelected = drafts.length > 0 && selectedDraftIds.length === drafts.length;
  const toggleDraft = (draftId: string) => {
    onSelectedDraftIdsChange(
      selectedDraftIdSet.has(draftId)
        ? selectedDraftIds.filter((selectedDraftId) => selectedDraftId !== draftId)
        : [...selectedDraftIds, draftId],
    );
  };

  return (
    <section className="sql-drafts-page" aria-label="Saved Drafts">
      <div className="sql-result-page-header">
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to Analyst
        </button>
        <div>
          <p className="section-label">Analyst SQL</p>
          <h2>Saved Drafts</h2>
          <p>{drafts.length.toLocaleString()} Saved Draft{drafts.length === 1 ? "" : "s"}</p>
        </div>
        <div className="sql-result-page-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => onSelectedDraftIdsChange(allSelected ? [] : drafts.map((draft) => draft.id))}
            disabled={drafts.length === 0}
          >
            {allSelected ? "Clear selection" : "Select all"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onBulkDelete}
            disabled={selectedDraftIds.length === 0}
          >
            Delete selected Saved Drafts
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="empty-state compact-empty">
          <p className="section-label">No Saved Drafts</p>
          <h2>No Saved Drafts yet</h2>
          <p>Save a query from the editor to manage it in Saved Drafts.</p>
        </div>
      ) : (
        <div className="sql-drafts-list">
          {drafts.map((draft) => (
            <article className="sql-draft-row" key={draft.id}>
              <label className="sql-draft-check">
                <input
                  type="checkbox"
                  checked={selectedDraftIdSet.has(draft.id)}
                  onChange={() => toggleDraft(draft.id)}
                  aria-label={`Select ${draft.name}`}
                />
              </label>
              <button type="button" className="sql-draft-open" onClick={() => onOpenDraft(draft)}>
                <strong>{draft.name}</strong>
                <span>
                  {draft.dialect.toUpperCase()} | {formatDraftTimestamp(draft.savedAt)}
                </span>
                <p>{createSqlPreview(draft.sql)}</p>
              </button>
              <div className="sql-draft-actions">
                <button type="button" className="secondary-button" onClick={() => onRenameDraft(draft)}>
                  Rename
                </button>
                <button type="button" className="text-button" onClick={() => onDeleteDraft(draft)}>
                  Delete Saved Draft
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DraftDetailPage({
  draft,
  onBackToDrafts,
  onBackToAnalyst,
  onLoadDraft,
  onRenameDraft,
  onDeleteDraft,
}: {
  draft: SqlQueryDraft;
  onBackToDrafts: () => void;
  onBackToAnalyst: () => void;
  onLoadDraft: (draft: SqlQueryDraft) => void;
  onRenameDraft: (draft: SqlQueryDraft) => void;
  onDeleteDraft: (draft: SqlQueryDraft) => void;
}) {
  return (
    <section className="sql-draft-detail-page" aria-label="Saved Draft detail">
      <div className="sql-result-page-header">
        <div className="sql-draft-detail-nav">
          <button type="button" className="secondary-button" onClick={onBackToDrafts}>
            Back to Saved Drafts
          </button>
          <button type="button" className="secondary-button" onClick={onBackToAnalyst}>
            Back to Analyst
          </button>
        </div>
        <div>
          <p className="section-label">Saved Draft</p>
          <h2>{draft.name}</h2>
          <p>
            {draft.dialect.toUpperCase()} | Saved {formatDraftTimestamp(draft.savedAt)}
          </p>
        </div>
        <div className="sql-result-page-actions">
          <button type="button" className="primary-button" onClick={() => onLoadDraft(draft)}>
            Open Saved Draft
          </button>
          <button type="button" className="secondary-button" onClick={() => onRenameDraft(draft)}>
            Rename
          </button>
          <button type="button" className="text-button" onClick={() => onDeleteDraft(draft)}>
            Delete Saved Draft
          </button>
        </div>
      </div>
      <div className="sql-draft-detail-body">
        <pre>{draft.sql}</pre>
      </div>
    </section>
  );
}

function SqlWorkspace({
  dataset,
  onExecutionResult,
  metadata,
  onMetadataChange,
  onWorksheetSelect,
  isSwitchingWorksheet,
  analysisScopeSelections,
  onAnalysisScopeSelectionsChange,
  onAnalystViewChange,
  onSqlAssistantModeChange,
}: SqlWorkspaceProps) {
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [focusedView, setFocusedView] = useState<FocusedSqlView>("editor");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [bottomTab, setBottomTab] = useState<BottomTab | null>(null);
  const [contextHeight, setContextHeight] = useState(248);
  const [bottomHeight, setBottomHeight] = useState(220);
  const {
    savedDrafts,
    characterCount,
    editorStatus,
    previewResult,
    sqlAnalysis,
    queryExplanation,
    selectedDialect,
    selectedDialectProfile,
    dialectOptions,
    sqlTabs,
    setSelectedDialect,
    editor,
    insertSql,
    loadDraft,
    renameDraft,
    deleteDraft,
    deleteDrafts,
    openSqlSourceTab,
  } = useSqlWorkspace(dataset, onExecutionResult, metadata, onMetadataChange);
  const canOpenResultPreview = editorStatus === "success" && previewResult.columns.length > 0;
  // Active source chip label for the Analyst command bar. Falls through
  // worksheet displayName → sheetName → dataset.table_name → original_filename
  // so the chip always reads something meaningful when a dataset is open.
  const activeWorkbookWorksheet = dataset?.workbook_metadata?.worksheets.find(
    (worksheet) => worksheet.worksheetId === dataset.workbook_metadata?.activeWorksheetId,
  );
  const activeSourceLabel = dataset
    ? activeWorkbookWorksheet?.displayName ||
      activeWorkbookWorksheet?.sheetName ||
      dataset.table_name ||
      null
    : null;
  // Separate workbook badge label for the command bar — mirrors the routing
  // mockup's "Property Management Company.xlsx" pill next to the violet
  // "Active · {worksheet}" pill.
  const workbookLabel = dataset?.original_filename || null;
  const activeDraft = savedDrafts.find((draft) => draft.id === activeDraftId) || null;
  const toggleBottomTab = (tab: BottomTab) => {
    setBottomTab((current) => (current === tab ? null : tab));
  };
  const openSqlAssistantMode = (mode: SqlAssistantMode) => {
    onSqlAssistantModeChange?.(mode);
    onAnalystViewChange?.(mode === "recipes" ? "sqlReports" : "sqlTemplates");
  };
  const openDraftDetail = (draft: SqlQueryDraft) => {
    setActiveDraftId(draft.id);
    setFocusedView("draft-detail");
  };
  const requestRenameDraft = (draft: SqlQueryDraft) => {
    const nextName = window.prompt("Rename Saved Draft", draft.name);
    if (nextName === null) return;
    renameDraft(draft.id, nextName);
  };
  const requestDeleteDraft = (draft: SqlQueryDraft) => {
    const shouldDelete = window.confirm(
      "Deleting Saved Draft will permanently erase this information.",
    );
    if (!shouldDelete) return;

    deleteDraft(draft.id);
    setSelectedDraftIds((currentIds) => currentIds.filter((draftId) => draftId !== draft.id));
    if (activeDraftId === draft.id) {
      setActiveDraftId(null);
      setFocusedView("drafts");
    }
  };
  const requestBulkDelete = () => {
    const shouldDelete = window.confirm(
      "Deleting selected Saved Drafts will permanently erase all selected draft information.",
    );
    if (!shouldDelete) return;

    deleteDrafts(selectedDraftIds);
    if (activeDraftId && selectedDraftIds.includes(activeDraftId)) {
      setActiveDraftId(null);
      setFocusedView("drafts");
    }
    setSelectedDraftIds([]);
  };
  const openDraftInEditor = (draft: SqlQueryDraft) => {
    loadDraft(draft);
    setFocusedView("editor");
  };

  useEffect(() => {
    const handleSqlWorkspaceCommand = (event: Event) => {
      const commandEvent = event as CustomEvent<{ target?: SqlWorkspaceCommandTarget }>;
      const target = commandEvent.detail?.target;

      if (target === "drafts") {
        setFocusedView("drafts");
        return;
      }

      if (target === "result") {
        if (canOpenResultPreview) setFocusedView("result");
        return;
      }

      if (target === "editor") {
        setFocusedView("editor");
      }
    };

    window.addEventListener("filtraqueri:sql-workspace-command", handleSqlWorkspaceCommand);
    return () =>
      window.removeEventListener("filtraqueri:sql-workspace-command", handleSqlWorkspaceCommand);
  }, [canOpenResultPreview]);

  const startDockResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    dock: "context" | "bottom",
  ) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-dragging");
    const startY = event.clientY;
    const direction = dock === "bottom" ? -1 : 1;
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

  if (focusedView === "result") {
    return (
      <section className="sql-workspace-v2 sql-workspace-preview-mode" aria-label="SQL workspace">
        <SqlFocusedResultPreview
          previewResult={previewResult}
          onBack={() => setFocusedView("editor")}
        />
      </section>
    );
  }

  if (focusedView === "drafts") {
    return (
      <section className="sql-workspace-v2 sql-workspace-preview-mode" aria-label="SQL workspace">
        <SavedDraftsPage
          drafts={savedDrafts}
          selectedDraftIds={selectedDraftIds}
          onSelectedDraftIdsChange={setSelectedDraftIds}
          onBack={() => setFocusedView("editor")}
          onOpenDraft={openDraftDetail}
          onRenameDraft={requestRenameDraft}
          onDeleteDraft={requestDeleteDraft}
          onBulkDelete={requestBulkDelete}
        />
      </section>
    );
  }

  if (focusedView === "draft-detail" && activeDraft) {
    return (
      <section className="sql-workspace-v2 sql-workspace-preview-mode" aria-label="SQL workspace">
        <DraftDetailPage
          draft={activeDraft}
          onBackToDrafts={() => setFocusedView("drafts")}
          onBackToAnalyst={() => setFocusedView("editor")}
          onLoadDraft={openDraftInEditor}
          onRenameDraft={requestRenameDraft}
          onDeleteDraft={requestDeleteDraft}
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
      <div className="analyst-page-banner" aria-label="Analyst workspace introduction">
        <p className="section-label">Analyst workspace</p>
        <h2>Inspect SQL</h2>
        <p>
          Write, review, and run SQL safely from one focused workspace. Templates and Reports
          for ready-made starting points — Run Query always stays manual.
        </p>
      </div>

      <header className="analyst-page-head" aria-label="Inspect SQL section heading">
        <p className="section-label">Analyst · Inspect SQL</p>
        <h2>Write and run SQL</h2>
        <p>
          The editor below targets the active worksheet. Browse Templates and Browse Reports for
          ready-made starting points — they insert back here.
        </p>
      </header>

      <div className="sqlw-main">
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
                <WorkbookContextPanel
                  dataset={dataset}
                  variant="analyst"
                  onWorksheetSelect={onWorksheetSelect}
                  isSwitchingWorksheet={isSwitchingWorksheet}
                  analysisScopeSelections={analysisScopeSelections}
                  onAnalysisScopeSelectionsChange={onAnalysisScopeSelectionsChange}
                  onOpenSqlAssistantMode={openSqlAssistantMode}
                  onOpenSqlSourceTab={openSqlSourceTab}
                />
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
          onOpenResultPreview={() => setFocusedView("result")}
          onOpenSavedDrafts={() => setFocusedView("drafts")}
          sqlTabs={sqlTabs}
          dialectContext={{
            selectedDialect,
            selectedDialectProfile,
            dialectOptions,
            onDialectChange: setSelectedDialect,
          }}
          workbookLabel={workbookLabel}
          activeSourceLabel={activeSourceLabel}
          isContextOpen={isContextOpen}
          onToggleContext={() => setIsContextOpen((current) => !current)}
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
              aria-label="SQL diagnostics"
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
                {bottomTab === "guidance" && (
                  <SqlGuidancePanel
                    queryExplanation={queryExplanation}
                    diagnostics={sqlAnalysis.diagnostics}
                    guidanceCards={sqlAnalysis.explanationCards}
                    dialectContext={{ selectedDialectProfile }}
                    validation={sqlAnalysis.validation}
                  />
                )}
              </div>
            </section>
          </>
        )}

        <div className="sqlw-dockbar sqlw-dockbar-bottom">
          <span className="sqlw-dockbar-label">Review</span>
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
        collapsed={isRailCollapsed}
        onToggleCollapsed={() => setIsRailCollapsed((current) => !current)}
        onInsertSql={insertSql}
        activeSourceLabel={activeSourceLabel}
      />
    </section>
  );
}

export default SqlWorkspace;
