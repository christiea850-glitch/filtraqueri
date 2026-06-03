import type { DatasetMetadata } from "../../dataset/datasetTypes";
import {
  WORKBOOK_HEADER_WARNING_COPY,
  getDatasetActiveWorksheet,
  getStructuralColumnNotice,
  getWorkbookMetadata,
  hasSuspiciousWorkbookHeaders,
} from "../../workbook";

type SqlSchemaPanelProps = {
  dataset: DatasetMetadata | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onInsertSql: (sql: string) => void;
  onWorksheetSelect?: (worksheetId: string) => void;
  isSwitchingWorksheet?: boolean;
};

function SqlSchemaPanel({
  dataset,
  collapsed,
  onToggleCollapsed,
  onInsertSql,
  onWorksheetSelect,
  isSwitchingWorksheet,
}: SqlSchemaPanelProps) {
  const showHeaderWarning = hasSuspiciousWorkbookHeaders(dataset);
  const structuralColumnNotice = getStructuralColumnNotice(dataset);

  // Active analysis context — read straight from the dataset / workbook metadata.
  // The backend has already repointed the active VIEW to the user's choice, so the
  // schema and row counts shown here always reflect the active analysis source.
  // K8A: the standalone summary card has been removed; the active worksheet's
  // row in the picker now carries the "Active · original/cleaned" badge.
  const workbook = getWorkbookMetadata(dataset);
  const activeWorksheet = getDatasetActiveWorksheet(dataset);
  const activeAnalysisSource = workbook?.activeAnalysisSource || null;
  const worksheets = workbook?.worksheets || [];
  const activeWorksheetId = workbook?.activeWorksheetId || activeWorksheet?.worksheetId || null;
  const activeIsCleanedCopy =
    activeAnalysisSource?.type === "cleaned_working_copy" &&
    activeAnalysisSource.worksheetId === activeWorksheetId;
  const activeSourceLabel = activeIsCleanedCopy ? "cleaned working copy" : "original";
  const canPickWorksheets =
    Boolean(onWorksheetSelect) && worksheets.length > 1;

  return (
    <aside className="sql-context-panel" aria-label="SQL schema intelligence">
      <button
        type="button"
        className="panel-collapse-button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand SQL schema tools" : "Collapse SQL schema tools"}
      >
        {collapsed ? "Schema" : "Hide schema"}
      </button>

      <div className="sql-context-body">
        {/*
          K8A: the standalone "Active analysis source" summary card lived here as a
          duplicate of the worksheet picker below and the SQL Context centre panel.
          Removed. The worksheet picker is now the single source of truth — the
          active worksheet's row carries an "Active · original/cleaned" badge and
          the table name + row/column counts users were reading from the card.
        */}
        {structuralColumnNotice ? (
          <p className="workbook-header-warning">{structuralColumnNotice}</p>
        ) : showHeaderWarning ? (
          <p className="workbook-header-warning">{WORKBOOK_HEADER_WARNING_COPY}</p>
        ) : null}

        {canPickWorksheets && (
          <div className="sql-helper-section">
            <div className="builder-block-header">
              <span>Worksheet tables</span>
              <small>{worksheets.length}</small>
            </div>
            <div
              className="sql-worksheet-picker"
              aria-label="Available worksheet tables"
            >
              {worksheets.map((worksheet) => {
                const worksheetIsActive = worksheet.worksheetId === activeWorksheetId;
                const worksheetLabel =
                  worksheet.displayName || worksheet.sheetName;
                const worksheetReady = worksheet.status === "ready";
                const canSelect =
                  Boolean(onWorksheetSelect) &&
                  worksheetReady &&
                  !worksheetIsActive &&
                  !isSwitchingWorksheet;
                return (
                  <div
                    key={worksheet.worksheetId}
                    className={`sql-worksheet-picker-item${worksheetIsActive ? " is-active" : ""}`}
                  >
                    <div className="sql-worksheet-picker-meta">
                      <strong title={worksheetLabel}>{worksheetLabel}</strong>
                      <small>
                        <code>{worksheet.tableName}</code>
                        {" · "}
                        {worksheet.rowCount.toLocaleString()} rows
                        {" / "}
                        {worksheet.columnCount.toLocaleString()} cols
                      </small>
                    </div>
                    {worksheetIsActive ? (
                      <span
                        className={`sql-worksheet-picker-status is-${activeIsCleanedCopy ? "cleaned" : "original"}`}
                        title={`Active analysis source · ${activeSourceLabel}. Report Recipes and generated SQL use this worksheet's schema.`}
                      >
                        Active · {activeSourceLabel}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="secondary-button sql-worksheet-picker-apply"
                        onClick={() =>
                          onWorksheetSelect && onWorksheetSelect(worksheet.worksheetId)
                        }
                        disabled={!canSelect}
                        title={
                          worksheetReady
                            ? `Use ${worksheetLabel} for analysis`
                            : `${worksheetLabel} is not ready for analysis`
                        }
                      >
                        {isSwitchingWorksheet ? "Switching…" : "Use for analysis"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="sql-helper-section">
          <div className="builder-block-header">
            <span>Columns</span>
            <small>{dataset ? `${dataset.schema.length}` : "0"}</small>
          </div>
          <div className="schema-list sql-schema-list" aria-label="SQL available columns">
            {dataset ? (
              dataset.schema.map((column) => (
                <button
                  type="button"
                  className="schema-pill sql-schema-chip"
                  key={column.name}
                  onClick={() => onInsertSql(`"${column.name.replace(/"/g, '""')}"`)}
                >
                  {column.name}
                  <small>{column.inferred_type}</small>
                </button>
              ))
            ) : (
              <p className="sql-helper-empty">No dataset open.</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default SqlSchemaPanel;
