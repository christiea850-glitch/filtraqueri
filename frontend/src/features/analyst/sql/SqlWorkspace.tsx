import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ActiveView, DatasetMetadata } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../../sqlWorkspacePersistence";
import type { AnalysisScopeSelection } from "../../workbook";
import type { AnalystNavigationContext } from "../analystWorkspaceTypes";
import DataTable, {
  type DataTableColumn,
  type DataTableRow,
} from "../../../components/common/DataTable";
import WorkbookContextPanel from "../../../components/workbook/WorkbookContextPanel";
import type { SqlAssistantMode } from "./SqlAssistantPanel";
import SqlEditorPanel, {
  SqlGuidancePanel,
  type BusinessSqlPreviewFeedback,
} from "./SqlEditorPanel";
import SqlSchemaPanel from "./SqlSchemaPanel";
import type { BusinessSqlRenderPreview } from "./businessSqlRenderPreview";
import { createBusinessSqlRenderPreviewFromWorkspaceContext } from "./businessSqlRenderPreviewUiAdapter";
import {
  shouldShowBusinessSqlPreviewInsertProvenance,
  type BusinessSqlPreviewInsertProvenance,
} from "./businessSqlPreviewProvenance";
import {
  addSqlConfirmedRelationship,
  createEmptySqlRelationshipConfirmationState,
  createSqlConfirmedRelationshipFromSuggestion,
  createTemporaryReadyRelationshipContractsFromConfirmationState,
  findSqlConfirmedRelationshipForEndpoints,
  rejectSqlRelationshipSuggestion,
  removeSqlConfirmedRelationship,
  type SqlRelationshipConfirmationState,
} from "./sqlRelationshipConfirmation";
import type { SqlPreviewResult, SqlQueryDraft } from "./sqlTypes";
import { frameResultValue, labelResultColumns } from "./resultLabeling";
import { createResultNarration } from "./resultNarration";
import {
  createSqlRelationshipReviewModel,
  type SqlRelationshipReviewModel,
} from "./sqlRelationshipReview";
import { createSqlResultProvenanceViewModel } from "./sqlResultProvenance";
import { formatSqlWorksheetScopeSummary } from "./sqlWorksheetScopeAdapter";
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
  onAnalystViewChange?: (view: ActiveView, context?: AnalystNavigationContext) => void;
  onSqlAssistantModeChange?: (mode: SqlAssistantMode | null) => void;
};

type BottomTab = "guidance";
type FocusedSqlView =
  | "editor"
  | "result"
  | "drafts"
  | "draft-detail"
  | "planning-details"
  | "relationship-review";
type SqlWorkspaceCommandTarget = "editor" | "result" | "drafts" | "context" | "relationship-review";

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

const createRelationshipReviewProgressSummary = (
  model: SqlRelationshipReviewModel,
  confirmationState: SqlRelationshipConfirmationState,
): string | null => {
  if (model.pairs.length === 0) return null;

  const confirmedCount = model.pairs.filter((pair) => {
    if (pair.status === "accepted") return true;
    if (!pair.suggestion || !pair.suggestedColumns) return false;

    return Boolean(
      findSqlConfirmedRelationshipForEndpoints(
        confirmationState,
        {
          worksheetId: pair.suggestion.fromWorksheetId,
          tableName: pair.fromTable,
          column: pair.suggestedColumns.fromColumn,
        },
        {
          worksheetId: pair.suggestion.toWorksheetId,
          tableName: pair.toTable,
          column: pair.suggestedColumns.toColumn,
        },
      ),
    );
  }).length;
  const remainingCount = Math.max(0, model.pairs.length - confirmedCount);

  if (confirmedCount === 0) return null;
  if (remainingCount === 0) {
    return `All ${model.pairs.length} worksheet connection${
      model.pairs.length === 1 ? "" : "s"
    } confirmed for this review.`;
  }

  return `${confirmedCount} of ${model.pairs.length} worksheet connection${
    model.pairs.length === 1 ? "" : "s"
  } confirmed; ${remainingCount} still need${remainingCount === 1 ? "s" : ""} review.`;
};

function SqlFocusedResultPreview({
  previewResult,
  currentTaskPrompt,
  currentSqlDraft,
  onBack,
}: {
  previewResult: SqlPreviewResult;
  currentTaskPrompt: string;
  currentSqlDraft: string;
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
  const provenance = createSqlResultProvenanceViewModel({
    previewResult,
    currentTaskPrompt,
    currentSqlDraft,
  });

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
  const labeledColumns = labelResultColumns({
    columns: previewResult.columns,
    taskPrompt: previewResult.executedQuestion?.taskPrompt,
    detectedIntent: previewResult.executedQuestion?.detectedIntent,
    questionShape: previewResult.executedQuestion?.questionShape,
    sourceLabel: previewResult.executedQuestion?.sourceLabel,
    sourceTableName: previewResult.executedQuestion?.sourceTableName,
  });
  const resultNarration = createResultNarration({
    columns: previewResult.columns,
    rows: previewResult.rows,
    taskPrompt: previewResult.executedQuestion?.taskPrompt,
    detectedIntent: previewResult.executedQuestion?.detectedIntent,
    questionShape: previewResult.executedQuestion?.questionShape,
    labeledColumns,
  });
  const sqlResultColumns: DataTableColumn[] = labeledColumns.map((column) => ({
    key: column.key,
    width: getColumnWidth(column.key),
    title: column.label === column.key ? column.key : `${column.label} (${column.key})`,
    header: (
      <>
        <span className="dataset-preview-cell">{column.label}</span>
        {column.label !== column.key ? (
          <span className="dataset-preview-column-raw" aria-label={`Raw column ${column.key}`}>
            {column.key}
          </span>
        ) : null}
        <span
          className="dataset-preview-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${column.label} column`}
          onPointerDown={(event) => startColumnResize(event, column.key)}
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
          <div className="sql-result-provenance" aria-label="Result provenance">
            <p>{provenance.summaryText}</p>
            {provenance.sourceText ? <p>{provenance.sourceText}</p> : null}
            {provenance.ranAtText ? <p>{provenance.ranAtText}</p> : null}
            {provenance.clarificationText ? <p>{provenance.clarificationText}</p> : null}
            {provenance.driftWarningText ? (
              <p className="sql-result-provenance-warning">{provenance.driftWarningText}</p>
            ) : null}
          </div>
          <p>{previewResult.message}</p>
          {resultNarration ? (
            <p className="sql-result-narration" aria-label="Result summary">
              {resultNarration.text}
            </p>
          ) : null}
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
          renderCell={(row, column) => {
            const framedValue = frameResultValue({
              value: row.values[column.key],
              columnKey: column.key,
              columnLabel: labeledColumns.find((labeledColumn) => labeledColumn.key === column.key)?.label,
              taskPrompt: previewResult.executedQuestion?.taskPrompt,
              detectedIntent: previewResult.executedQuestion?.detectedIntent,
              questionShape: previewResult.executedQuestion?.questionShape,
            });
            return (
              <span
                className="dataset-preview-cell"
                title={framedValue.origin === "framed" ? `Raw value: ${String(framedValue.raw ?? "")}` : undefined}
                aria-label={
                  framedValue.origin === "framed"
                    ? `${framedValue.display} (raw value: ${String(framedValue.raw ?? "")})`
                    : undefined
                }
              >
                {framedValue.display}
              </span>
            );
          }}
          getCellTitle={(row, column) => {
            const framedValue = frameResultValue({
              value: row.values[column.key],
              columnKey: column.key,
              columnLabel: labeledColumns.find((labeledColumn) => labeledColumn.key === column.key)?.label,
              taskPrompt: previewResult.executedQuestion?.taskPrompt,
              detectedIntent: previewResult.executedQuestion?.detectedIntent,
              questionShape: previewResult.executedQuestion?.questionShape,
            });
            return framedValue.origin === "framed"
              ? `${framedValue.display} (raw: ${String(framedValue.raw ?? "")})`
              : framedValue.display;
          }}
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

export function SqlWorkspaceDetailPlaceholder({
  title,
  emptyStateCopy,
  onBack,
}: {
  title: string;
  emptyStateCopy: string;
  onBack: () => void;
}) {
  return (
    <section className="sql-detail-placeholder-page" aria-label={title}>
      <div className="sql-result-page-header">
        <button type="button" className="secondary-button" onClick={onBack}>
          {"\u2190 Back to SQL workspace"}
        </button>
        <div>
          <p className="section-label">Analyst SQL</p>
          <h2>{title}</h2>
          <p>Read-only view. Nothing here runs SQL or changes worksheet connections.</p>
        </div>
      </div>
      <div className="empty-state compact-empty">
        <p className="section-label">Details</p>
        <h2>{title}</h2>
        <p>{emptyStateCopy}</p>
      </div>
    </section>
  );
}

function SqlRelationshipReviewPage({
  model,
  confirmationState,
  onConfirmRelationship,
  onRejectRelationship,
  onRemoveConfirmation,
  onBack,
}: {
  model: SqlRelationshipReviewModel;
  confirmationState: SqlRelationshipConfirmationState;
  onConfirmRelationship: (pair: SqlRelationshipReviewModel["pairs"][number]) => void;
  onRejectRelationship: (pair: SqlRelationshipReviewModel["pairs"][number]) => void;
  onRemoveConfirmation: (pair: SqlRelationshipReviewModel["pairs"][number]) => void;
  onBack: () => void;
}) {
  return (
    <section className="sql-detail-placeholder-page" aria-label="Review worksheet connections">
      <div className="sql-result-page-header">
        <button type="button" className="secondary-button" onClick={onBack}>
          {"\u2190 Back to SQL workspace"}
        </button>
        <div>
          <p className="section-label">Analyst SQL</p>
          <h2>Review worksheet connections</h2>
          <p>{model.description}</p>
          <p>{model.safetyCopy}</p>
        </div>
      </div>
      {model.pairs.length > 0 ? (
        <SqlRelationshipReviewPanel
          model={model}
          confirmationState={confirmationState}
          onConfirmRelationship={onConfirmRelationship}
          onRejectRelationship={onRejectRelationship}
          onRemoveConfirmation={onRemoveConfirmation}
        />
      ) : (
        <div className="empty-state compact-empty">
          <p className="section-label">Details</p>
          <h2>Review worksheet connections</h2>
          <p>No worksheets need connection review for this question.</p>
        </div>
      )}
    </section>
  );
}

function SqlRelationshipReviewPanel({
  model,
  confirmationState,
  onConfirmRelationship,
  onRejectRelationship,
  onRemoveConfirmation,
}: {
  model: SqlRelationshipReviewModel;
  confirmationState: SqlRelationshipConfirmationState;
  onConfirmRelationship: (pair: SqlRelationshipReviewModel["pairs"][number]) => void;
  onRejectRelationship: (pair: SqlRelationshipReviewModel["pairs"][number]) => void;
  onRemoveConfirmation: (pair: SqlRelationshipReviewModel["pairs"][number]) => void;
}) {
  const friendlyWorksheetLabel = (value: string): string => {
    const label = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    return label
      .split(" ")
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  };

  return (
    <section className="sql-relationship-review-panel" aria-label={model.title}>
      <div className="business-sql-preview-head">
        <div>
          <span>Review only</span>
          <strong>Connections to review</strong>
        </div>
        <div className="business-sql-preview-badges" aria-label="Relationship review safety">
          <em>Review only</em>
          <em>Nothing has been inserted</em>
        </div>
      </div>

      {model.relevantWorksheets.length > 0 && (
        <div className="sql-relationship-review-worksheets" aria-label="Relevant worksheets">
          <strong>Relevant worksheets</strong>
          <span>{model.relevantWorksheets.map(friendlyWorksheetLabel).join(", ")}</span>
        </div>
      )}

      {model.pairs.length > 0 ? (
        <div className="sql-relationship-review-list" aria-label="Required relationship pairs">
          {model.pairs.map((pair) => {
            const confirmedRelationship = pair.suggestion && pair.suggestedColumns
              ? findSqlConfirmedRelationshipForEndpoints(
                  confirmationState,
                  {
                    worksheetId: pair.suggestion.fromWorksheetId,
                    tableName: pair.fromTable,
                    column: pair.suggestedColumns.fromColumn,
                  },
                  {
                    worksheetId: pair.suggestion.toWorksheetId,
                    tableName: pair.toTable,
                    column: pair.suggestedColumns.toColumn,
                  },
                )
              : null;
            const rejectedSuggestion = pair.suggestion && pair.suggestedColumns
              ? confirmationState.rejectedSuggestions.find(
                  (relationship) =>
                    relationship.fromWorksheetId === pair.suggestion?.fromWorksheetId &&
                    relationship.fromTableName === pair.fromTable &&
                    relationship.fromColumn === pair.suggestedColumns?.fromColumn &&
                    relationship.toWorksheetId === pair.suggestion?.toWorksheetId &&
                    relationship.toTableName === pair.toTable &&
                    relationship.toColumn === pair.suggestedColumns?.toColumn,
                )
              : null;
            const isConfirmed = Boolean(confirmedRelationship) || pair.status === "accepted";
            const isRejected = Boolean(rejectedSuggestion) && !confirmedRelationship;
            const statusCopy = confirmedRelationship
              ? "Confirmed for this review only"
              : isConfirmed
                ? "Confirmed"
                : isRejected
                  ? "Rejected"
                  : pair.statusLabel;

            return (
              <article
                className={`sql-relationship-review-card ${isRejected ? "is-rejected" : ""}`}
                key={pair.id}
              >
              <div className="sql-relationship-review-card-head">
                <strong>
                  {friendlyWorksheetLabel(pair.fromWorksheet)} {"\u2194"} {friendlyWorksheetLabel(pair.toWorksheet)}
                </strong>
                <span
                  className={`sql-grounding-badge ${
                    isConfirmed ? "supported" : isRejected ? "blocked" : "needs_review"
                  }`}
                >
                  {statusCopy}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Worksheet</dt>
                  <dd>{friendlyWorksheetLabel(pair.fromWorksheet)}</dd>
                </div>
                <div>
                  <dt>Connects to</dt>
                  <dd>{friendlyWorksheetLabel(pair.toWorksheet)}</dd>
                </div>
              </dl>
              <p>
                {pair.suggestedColumns
                  ? `Suggested match: ${pair.suggestedColumns.fromColumn} connects both worksheets`
                  : "FiltraQueri could not find a clear matching column yet."}
              </p>
              {pair.suggestion && pair.suggestedColumns && pair.status !== "accepted" && (
                <div className="sql-relationship-review-actions">
                  {confirmedRelationship ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onRemoveConfirmation(pair)}
                    >
                      Remove confirmation
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => onConfirmRelationship(pair)}
                      >
                        Confirm connection
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onRejectRelationship(pair)}
                      >
                        Reject suggestion
                      </button>
                    </>
                  )}
                </div>
              )}
              {isRejected && (
                <p className="sql-relationship-review-note">
                  This worksheet connection suggestion is marked rejected for this review only.
                </p>
              )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="business-sql-preview-empty">
          No required relationship pairs are available for review yet.
        </div>
      )}
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
  onAnalystViewChange,
  onSqlAssistantModeChange,
}: SqlWorkspaceProps) {
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [focusedView, setFocusedView] = useState<FocusedSqlView>("editor");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [bottomTab, setBottomTab] = useState<BottomTab | null>(null);
  const [relationshipReviewRequirements, setRelationshipReviewRequirements] = useState<string[]>([]);
  const [relationshipConfirmationState, setRelationshipConfirmationState] =
    useState<SqlRelationshipConfirmationState>(() => createEmptySqlRelationshipConfirmationState());
  const [businessSqlPreviewFeedback, setBusinessSqlPreviewFeedback] =
    useState<BusinessSqlPreviewFeedback>("idle");
  const [businessSqlCandidatePreview, setBusinessSqlCandidatePreview] =
    useState<BusinessSqlRenderPreview | null>(null);
  const [hasBusinessSqlPreviewAttempt, setHasBusinessSqlPreviewAttempt] = useState(false);
  const [insertedAskRecommendationId, setInsertedAskRecommendationId] = useState<string | null>(null);
  const [businessSqlPreviewInsertProvenance, setBusinessSqlPreviewInsertProvenance] =
    useState<BusinessSqlPreviewInsertProvenance | null>(null);
  const [contextHeight, setContextHeight] = useState(248);
  const [bottomHeight, setBottomHeight] = useState(220);
  const {
    savedDrafts,
    characterCount,
    editorStatus,
    previewResult,
    sqlAnalysis,
    queryExplanation,
    readinessReport,
    selectedDialect,
    selectedDialectProfile,
    dialectOptions,
    sqlTabs,
    setSelectedDialect,
    editor,
    draftConversionPreview,
    applyDraftConversion,
    insertSql,
    loadDraft,
    renameDraft,
    deleteDraft,
    deleteDrafts,
    openSqlSourceTab,
    activeTabSourceContext,
  } = useSqlWorkspace(dataset, onExecutionResult, metadata, onMetadataChange, {
    businessSqlPreviewInsertProvenance,
  });
  const canOpenResultPreview = editorStatus === "success" && previewResult.columns.length > 0;
  // Option C - Drive the command-bar source label from the active SQL tab's
  // resolved context instead of falling back to the global active worksheet.
  // The schema rail (right) and command bar (top) now both reflect the
  // *tab's* source, not the global dataset's.
  const activeSourceLabel = dataset ? activeTabSourceContext.sourceLabel : null;
  // Separate workbook badge label for the command bar - mirrors the routing
  // mockup's "Property Management Company.xlsx" pill next to the violet
  // "Active {worksheet}" pill.
  const workbookLabel = dataset?.original_filename || null;
  const activeDraft = savedDrafts.find((draft) => draft.id === activeDraftId) || null;
  const selectedTabScopeSummary = formatSqlWorksheetScopeSummary(
    dataset,
    sqlTabs.selectedScopeSelections,
  );
  const appliedTabScopeSummary = formatSqlWorksheetScopeSummary(
    dataset,
    sqlTabs.appliedScopeSelections,
  );
  const temporaryReadyRelationshipContracts = useMemo(
    () =>
      createTemporaryReadyRelationshipContractsFromConfirmationState(
        relationshipConfirmationState,
      ),
    [relationshipConfirmationState],
  );
  const businessSqlRenderPreview = useMemo(
    () =>
      createBusinessSqlRenderPreviewFromWorkspaceContext({
        taskPrompt: sqlTabs.taskPrompt,
        selectedGuidanceDialect: selectedDialect,
        selectedScopeSelections: sqlTabs.selectedScopeSelections,
        appliedScopeSelections: sqlTabs.appliedScopeSelections,
        worksheets: dataset?.workbook_metadata?.worksheets || [],
        acceptedRelationshipContracts:
          dataset?.workbook_metadata?.acceptedRelationshipContracts || [],
        readyRelationshipContracts: temporaryReadyRelationshipContracts,
        activeSqlDraft: editor.value,
        activeSqlDraftSource: sqlTabs.activeTabCreatedFrom || undefined,
      }).preview,
    [
      dataset?.workbook_metadata?.acceptedRelationshipContracts,
      dataset?.workbook_metadata?.worksheets,
      editor.value,
      selectedDialect,
      sqlTabs.appliedScopeSelections,
      sqlTabs.activeTabCreatedFrom,
      sqlTabs.selectedScopeSelections,
      sqlTabs.taskPrompt,
      temporaryReadyRelationshipContracts,
    ],
  );
  const relationshipReviewModel = useMemo(
    () =>
      createSqlRelationshipReviewModel({
        dataset,
        requiredRelationships: relationshipReviewRequirements,
      }),
    [dataset, relationshipReviewRequirements],
  );
  const relationshipReviewProgressSummary = useMemo(
    () =>
      createRelationshipReviewProgressSummary(
        relationshipReviewModel,
        relationshipConfirmationState,
      ),
    [relationshipConfirmationState, relationshipReviewModel],
  );
  useEffect(() => {
    setRelationshipConfirmationState(createEmptySqlRelationshipConfirmationState());
  }, [dataset?.dataset_id, dataset?.workbook_metadata?.workbookId]);
  useEffect(() => {
    if (!businessSqlPreviewInsertProvenance) return;
    if (
      insertedAskRecommendationId &&
      insertedAskRecommendationId !==
        `business-sql-renderer-preview:${businessSqlPreviewInsertProvenance.planId}`
    ) {
      setBusinessSqlPreviewInsertProvenance(null);
      return;
    }
    if (
      shouldShowBusinessSqlPreviewInsertProvenance({
        provenance: businessSqlPreviewInsertProvenance,
        activeTabId: sqlTabs.activeTabId,
        currentSqlDraft: editor.value,
      })
    ) {
      return;
    }
    setBusinessSqlPreviewInsertProvenance(null);
  }, [
    businessSqlPreviewInsertProvenance,
    editor.value,
    insertedAskRecommendationId,
    sqlTabs.activeTabId,
  ]);

  const createRelationshipFromReviewPair = (
    pair: SqlRelationshipReviewModel["pairs"][number],
    status: "confirmed" | "rejected",
  ) => {
    if (!pair.suggestion || !pair.suggestedColumns) return null;

    return createSqlConfirmedRelationshipFromSuggestion({
      from: {
        worksheetId: pair.suggestion.fromWorksheetId,
        worksheetLabel: pair.suggestion.fromWorksheetLabel,
        tableName: pair.fromTable,
        column: pair.suggestedColumns.fromColumn,
      },
      fromColumns: pair.suggestion.fromColumns,
      to: {
        worksheetId: pair.suggestion.toWorksheetId,
        worksheetLabel: pair.suggestion.toWorksheetLabel,
        tableName: pair.toTable,
        column: pair.suggestedColumns.toColumn,
      },
      toColumns: pair.suggestion.toColumns,
      scope: "workbook",
      source: "inferred_then_confirmed",
      status,
      confirmedAt: status === "confirmed" ? new Date().toISOString() : undefined,
      rejectedAt: status === "rejected" ? new Date().toISOString() : undefined,
      cardinality: pair.suggestion.cardinality,
      confidence: pair.suggestion.confidence,
      acceptedFromCandidateId: pair.suggestion.candidateId,
      workbookId: dataset?.workbook_metadata?.workbookId || null,
      datasetId: dataset?.dataset_id || null,
    });
  };

  const confirmRelationship = (pair: SqlRelationshipReviewModel["pairs"][number]) => {
    const relationship = createRelationshipFromReviewPair(pair, "confirmed");
    if (!relationship) return;
    setRelationshipConfirmationState((state) => addSqlConfirmedRelationship(state, relationship));
  };

  const rejectRelationship = (pair: SqlRelationshipReviewModel["pairs"][number]) => {
    const relationship = createRelationshipFromReviewPair(pair, "rejected");
    if (!relationship) return;
    setRelationshipConfirmationState((state) => rejectSqlRelationshipSuggestion(state, relationship));
  };

  const removeRelationshipConfirmation = (pair: SqlRelationshipReviewModel["pairs"][number]) => {
    const relationship = createRelationshipFromReviewPair(pair, "confirmed");
    if (!relationship) return;
    setRelationshipConfirmationState((state) =>
      removeSqlConfirmedRelationship(state, relationship.relationshipId),
    );
  };

  const toggleBottomTab = (tab: BottomTab) => {
    setBottomTab((current) => (current === tab ? null : tab));
  };
  const openSqlAssistantMode = (
    mode: SqlAssistantMode,
    context?: AnalystNavigationContext,
  ) => {
    onSqlAssistantModeChange?.(mode);
    onAnalystViewChange?.(mode === "recipes" ? "sqlReports" : "sqlTemplates", context);
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
  const openRelationshipReview = (requiredRelationships: string[]) => {
    setRelationshipReviewRequirements(requiredRelationships);
    setBottomTab(null);
    setFocusedView("relationship-review");
  };

  useEffect(() => {
    const handleSqlWorkspaceCommand = (event: Event) => {
      const commandEvent = event as CustomEvent<{
        target?: SqlWorkspaceCommandTarget;
        requiredRelationships?: string[];
      }>;
      const target = commandEvent.detail?.target;

      if (target === "drafts") {
        setFocusedView("drafts");
        return;
      }

      if (target === "result") {
        if (canOpenResultPreview) setFocusedView("result");
        return;
      }

      if (target === "context") {
        setFocusedView("editor");
        setIsContextOpen(true);
        return;
      }

      if (target === "relationship-review") {
        const requiredRelationships = Array.isArray(commandEvent.detail?.requiredRelationships)
          ? commandEvent.detail.requiredRelationships.filter(
              (relationship): relationship is string => typeof relationship === "string",
            )
          : [];
        openRelationshipReview(requiredRelationships);
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
          currentTaskPrompt={sqlTabs.taskPrompt}
          currentSqlDraft={editor.value}
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

  if (focusedView === "planning-details") {
    return (
      <section className="sql-workspace-v2 sql-workspace-preview-mode" aria-label="SQL workspace">
        <SqlEditorPanel
          dataset={dataset}
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
            draftConversionPreview,
            onDialectChange: setSelectedDialect,
            onApplyDraftConversion: applyDraftConversion,
          }}
          workbookLabel={workbookLabel}
          activeSourceLabel={activeSourceLabel}
          activeSourceTableLabel={activeTabSourceContext.tableName || sqlTabs.activeTabSourceBadge}
          activeSourceKindLabel={
            activeTabSourceContext.sourceType === "cleaned_working_copy"
              ? "Cleaned"
              : "Original"
          }
          selectedScopeSummary={selectedTabScopeSummary}
          appliedScopeSummary={appliedTabScopeSummary}
          selectedScopeCount={sqlTabs.selectedScopeSelections.length}
          appliedScopeCount={sqlTabs.appliedScopeSelections.length}
          selectedTemplateLabel={sqlTabs.selectedTemplateLabel}
          onInsertSql={insertSql}
          onOpenSqlSourceTab={openSqlSourceTab}
          sourceMismatchWarning={activeTabSourceContext.mismatchWarning}
          readinessReport={readinessReport}
          errorInsight={previewResult.errorInsight}
          businessSqlRenderPreview={businessSqlRenderPreview}
          onReviewRelationships={openRelationshipReview}
          relationshipReviewProgressSummary={relationshipReviewProgressSummary}
          planningDetailMode
          onBackFromPlanningDetails={() => setFocusedView("editor")}
          businessSqlPreviewFeedback={businessSqlPreviewFeedback}
          onBusinessSqlPreviewFeedbackChange={setBusinessSqlPreviewFeedback}
          businessSqlCandidatePreview={businessSqlCandidatePreview}
          onBusinessSqlCandidatePreviewChange={setBusinessSqlCandidatePreview}
          hasBusinessSqlPreviewAttempt={hasBusinessSqlPreviewAttempt}
          onHasBusinessSqlPreviewAttemptChange={setHasBusinessSqlPreviewAttempt}
          insertedAskRecommendationId={insertedAskRecommendationId}
          onInsertedAskRecommendationIdChange={setInsertedAskRecommendationId}
          businessSqlPreviewInsertProvenance={businessSqlPreviewInsertProvenance}
          onBusinessSqlPreviewInsertProvenanceChange={setBusinessSqlPreviewInsertProvenance}
        />
      </section>
    );
  }

  if (focusedView === "relationship-review") {
    return (
      <section className="sql-workspace-v2 sql-workspace-preview-mode" aria-label="SQL workspace">
        <SqlRelationshipReviewPage
          model={relationshipReviewModel}
          confirmationState={relationshipConfirmationState}
          onConfirmRelationship={confirmRelationship}
          onRejectRelationship={rejectRelationship}
          onRemoveConfirmation={removeRelationshipConfirmation}
          onBack={() => setFocusedView("editor")}
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
        <p>Write, review, and run SQL safely. Run Query stays manual.</p>
      </div>

      <header className="analyst-page-head" aria-label="Inspect SQL section heading">
        <p className="section-label">SQL workspace</p>
        <p>The editor targets the active worksheet. Templates and Reports insert back here.</p>
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
                  analysisScopeSelections={sqlTabs.selectedScopeSelections}
                  onAnalysisScopeSelectionsChange={sqlTabs.onSelectedScopeChange}
                  appliedAnalysisScopeSelections={sqlTabs.appliedScopeSelections}
                  onApplyAnalysisScope={sqlTabs.onApplyScope}
                  taskPrompt={sqlTabs.taskPrompt}
                  onTaskPromptChange={sqlTabs.onTaskPromptChange}
                  selectedDialect={selectedDialect}
                  onInsertSql={insertSql}
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
          dataset={dataset}
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
            draftConversionPreview,
            onDialectChange: setSelectedDialect,
            onApplyDraftConversion: applyDraftConversion,
          }}
          workbookLabel={workbookLabel}
          activeSourceLabel={activeSourceLabel}
          activeSourceTableLabel={activeTabSourceContext.tableName || sqlTabs.activeTabSourceBadge}
          activeSourceKindLabel={
            activeTabSourceContext.sourceType === "cleaned_working_copy"
              ? "Cleaned"
              : "Original"
          }
          selectedScopeSummary={selectedTabScopeSummary}
          appliedScopeSummary={appliedTabScopeSummary}
          selectedScopeCount={sqlTabs.selectedScopeSelections.length}
          appliedScopeCount={sqlTabs.appliedScopeSelections.length}
          selectedTemplateLabel={sqlTabs.selectedTemplateLabel}
          onInsertSql={insertSql}
          onOpenSqlSourceTab={openSqlSourceTab}
          sourceMismatchWarning={activeTabSourceContext.mismatchWarning}
          readinessReport={readinessReport}
          errorInsight={previewResult.errorInsight}
          businessSqlRenderPreview={businessSqlRenderPreview}
          onReviewRelationships={openRelationshipReview}
          relationshipReviewProgressSummary={relationshipReviewProgressSummary}
          onOpenPlanningDetails={() => setFocusedView("planning-details")}
          businessSqlPreviewFeedback={businessSqlPreviewFeedback}
          onBusinessSqlPreviewFeedbackChange={setBusinessSqlPreviewFeedback}
          businessSqlCandidatePreview={businessSqlCandidatePreview}
          onBusinessSqlCandidatePreviewChange={setBusinessSqlCandidatePreview}
          hasBusinessSqlPreviewAttempt={hasBusinessSqlPreviewAttempt}
          onHasBusinessSqlPreviewAttemptChange={setHasBusinessSqlPreviewAttempt}
          insertedAskRecommendationId={insertedAskRecommendationId}
          onInsertedAskRecommendationIdChange={setInsertedAskRecommendationId}
          businessSqlPreviewInsertProvenance={businessSqlPreviewInsertProvenance}
          onBusinessSqlPreviewInsertProvenanceChange={setBusinessSqlPreviewInsertProvenance}
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
        schemaOverride={activeTabSourceContext.schema}
        columnCountOverride={activeTabSourceContext.columnCount}
      />
    </section>
  );
}

export default SqlWorkspace;
