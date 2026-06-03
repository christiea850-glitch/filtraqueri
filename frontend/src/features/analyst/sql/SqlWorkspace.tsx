import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
import WorkbookContextPanel from "../../../components/workbook/WorkbookContextPanel";
import SqlAssistantPanel from "./SqlAssistantPanel";
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
        <div className="dataset-preview-table-wrap sql-result-table-wrap">
          <table
            className={["dataset-preview-table", "sql-result-table", isWrapped ? "is-wrapped" : ""]
              .filter(Boolean)
              .join(" ")}
            style={{ width: `${totalTableWidth}px`, minWidth: "100%" }}
            aria-label="SQL result data grid"
          >
            <colgroup>
              <col style={{ width: "52px" }} />
              {previewResult.columns.map((column) => (
                <col key={column} style={{ width: `${getColumnWidth(column)}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="dataset-preview-rownum" scope="col">
                  #
                </th>
                {previewResult.columns.map((column) => (
                  <th key={column} scope="col">
                    <span className="dataset-preview-cell">{column}</span>
                    <span
                      className="dataset-preview-resizer"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${column} column`}
                      onPointerDown={(event) => startColumnResize(event, column)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasRows ? (
                previewResult.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="dataset-preview-rownum">
                      {rowIndex + 1}
                    </td>
                    {previewResult.columns.map((column) => (
                      <td key={column} title={String(row[column] ?? "")}>
                        <span className="dataset-preview-cell">{String(row[column] ?? "")}</span>
                      </td>
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
}: SqlWorkspaceProps) {
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [focusedView, setFocusedView] = useState<FocusedSqlView>("editor");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [bottomTab, setBottomTab] = useState<BottomTab | null>(null);
  const [assistantHeight, setAssistantHeight] = useState(320);
  const [contextHeight, setContextHeight] = useState(248);
  const [bottomHeight, setBottomHeight] = useState(220);
  const {
    savedDrafts,
    characterCount,
    editorStatus,
    previewResult,
    sqlAnalysis,
    selectedDialect,
    selectedDialectProfile,
    dialectOptions,
    setSelectedDialect,
    editor,
    insertSql,
    loadDraft,
    renameDraft,
    deleteDraft,
    deleteDrafts,
  } = useSqlWorkspace(dataset, onExecutionResult, metadata, onMetadataChange);
  const canOpenResultPreview = editorStatus === "success" && previewResult.columns.length > 0;
  const activeDraft = savedDrafts.find((draft) => draft.id === activeDraftId) || null;
  const toggleBottomTab = (tab: BottomTab) => {
    setBottomTab((current) => (current === tab ? null : tab));
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
    dock: "assistant" | "context" | "bottom",
  ) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-dragging");
    const startY = event.clientY;
    const direction = dock === "bottom" ? -1 : 1;
    const startHeight =
      dock === "assistant" ? assistantHeight : dock === "context" ? contextHeight : bottomHeight;
    const applyHeight =
      dock === "assistant"
        ? setAssistantHeight
        : dock === "context"
          ? setContextHeight
          : setBottomHeight;

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
      <div className="sqlw-main">
        <div className="sqlw-dockbar">
          <button
            type="button"
            className={["sqlw-pill", isAssistantOpen ? "is-on" : ""].filter(Boolean).join(" ")}
            aria-expanded={isAssistantOpen}
            onClick={() => setIsAssistantOpen((current) => !current)}
          >
            Assistant
          </button>
          <button
            type="button"
            className={["sqlw-pill", isContextOpen ? "is-on" : ""].filter(Boolean).join(" ")}
            aria-expanded={isContextOpen}
            onClick={() => setIsContextOpen((current) => !current)}
          >
            SQL context
          </button>
        </div>

        {isAssistantOpen && (
          <>
            <section
              className="sqlw-dock sqlw-dock-top"
              aria-label="SQL Assistant"
              style={{ height: assistantHeight }}
            >
              <div className="sqlw-dock-head">
                <span>SQL Assistant</span>
                <button
                  type="button"
                  className="sqlw-dock-x"
                  onClick={() => setIsAssistantOpen(false)}
                  aria-label="Close SQL Assistant"
                >
                  Close
                </button>
              </div>
              <div className="sqlw-dock-body">
                <SqlAssistantPanel
                  dataset={dataset}
                  selectedDialect={selectedDialect}
                  selectedDialectProfile={selectedDialectProfile}
                  onInsertSql={insertSql}
                />
              </div>
            </section>
            <div
              className="sqlw-split"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize SQL Assistant panel"
              onPointerDown={(event) => startDockResize(event, "assistant")}
            />
          </>
        )}

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
          onOpenResultPreview={() => setFocusedView("result")}
          onOpenSavedDrafts={() => setFocusedView("drafts")}
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
        onWorksheetSelect={onWorksheetSelect}
        isSwitchingWorksheet={isSwitchingWorksheet}
      />
    </section>
  );
}

export default SqlWorkspace;
