import type { DatasetMetadata, SchemaColumn } from "../../features/dataset/datasetTypes";
import {
  getActiveWorksheet,
  getWorkbookMetadata,
  type WorkbookIngestionProfile,
  type WorksheetMetadata,
  type WorksheetStatus,
} from "../../features/workbook";

type WorkbookContextPanelProps = {
  dataset: DatasetMetadata | null;
  variant?: "results" | "analyst";
};

const statusLabel = (status: WorksheetStatus) => (status === "error" ? "unsupported" : status);

const countByStatus = (worksheets: WorksheetMetadata[], status: WorksheetStatus) =>
  worksheets.filter((worksheet) => worksheet.status === status).length;

const formatProfileValue = (value: number | string) =>
  typeof value === "number" ? value.toLocaleString() : value;

function SchemaColumnList({ columns }: { columns: SchemaColumn[] }) {
  if (columns.length === 0) {
    return <p className="workbook-empty-note">No schema available.</p>;
  }

  return (
    <div className="workbook-schema-list" aria-label="Active worksheet schema">
      {columns.map((column) => (
        <div className="workbook-schema-row" key={column.name} title={column.name}>
          <span className="workbook-column-name">{column.name}</span>
          <span className={`workbook-type-badge ${column.inferred_type}`}>
            {column.inferred_type}
          </span>
          <span className="workbook-null-note">
            {column.null_count > 0 ? `${column.null_count.toLocaleString()} nulls` : "no nulls"}
          </span>
        </div>
      ))}
    </div>
  );
}

function WorkbookProfileList({ profile }: { profile: WorkbookIngestionProfile }) {
  const profileItems = [
    ["Max sheets", profile.maxWorksheets],
    ["Profile rows", profile.maxRowsPerWorksheetProfile],
    ["Profile columns", profile.maxColumnsPerWorksheet],
    ["Preview rows", profile.maxPreviewRows],
  ];

  return (
    <div className="workbook-profile-list" aria-label="Workbook ingestion profile">
      {profileItems.map(([label, value]) => (
        <span key={label}>
          {label}
          <strong>{formatProfileValue(value)}</strong>
        </span>
      ))}
    </div>
  );
}

function WorkbookContextPanel({ dataset, variant = "results" }: WorkbookContextPanelProps) {
  const workbook = getWorkbookMetadata(dataset);
  if (!workbook) return null;

  const activeWorksheet = getActiveWorksheet(workbook);
  const readyCount = countByStatus(workbook.worksheets, "ready");
  const skippedCount = countByStatus(workbook.worksheets, "skipped");
  const emptyCount = countByStatus(workbook.worksheets, "empty");
  const unsupportedCount = countByStatus(workbook.worksheets, "error");
  const activeIndex = activeWorksheet ? activeWorksheet.originalIndex + 1 : null;

  return (
    <div className={`workbook-context-panel ${variant}`} aria-label="Workbook context">
      <div className="workbook-context-header">
        <div>
          <p className="section-label">Workbook</p>
          <h3 title={workbook.name}>{workbook.name}</h3>
        </div>
        <span className={`worksheet-status ${activeWorksheet?.status || "empty"}`}>
          {activeWorksheet ? statusLabel(activeWorksheet.status) : "empty"}
        </span>
      </div>

      <div className="workbook-summary-grid">
        <span>
          Active sheet
          <strong>{activeWorksheet?.displayName || "None"}</strong>
        </span>
        <span>
          Active table
          <strong>{dataset?.table_name || "data"}</strong>
        </span>
        <span>
          Source table
          <strong>{activeWorksheet?.tableName || "None"}</strong>
        </span>
        <span>
          Position
          <strong>
            {activeIndex ? `${activeIndex} of ${workbook.worksheets.length}` : "None"}
          </strong>
        </span>
        <span>
          Rows
          <strong>{(activeWorksheet?.rowCount || 0).toLocaleString()}</strong>
        </span>
        <span>
          Columns
          <strong>{(activeWorksheet?.columnCount || 0).toLocaleString()}</strong>
        </span>
      </div>

      <div className="workbook-status-grid" aria-label="Worksheet status summary">
        <span className="worksheet-status ready">ready {readyCount.toLocaleString()}</span>
        <span className="worksheet-status skipped">skipped {skippedCount.toLocaleString()}</span>
        <span className="worksheet-status empty">empty {emptyCount.toLocaleString()}</span>
        <span className="worksheet-status error">
          unsupported {unsupportedCount.toLocaleString()}
        </span>
      </div>

      <div className="workbook-mapping-section">
        <div className="builder-block-header">
          <span>Worksheet tables</span>
          <small>{workbook.worksheets.length.toLocaleString()} sheets</small>
        </div>
        <div className="workbook-mapping-list" aria-label="Worksheet table mappings">
          {workbook.worksheets.map((worksheet) => {
            const isActive = worksheet.worksheetId === workbook.activeWorksheetId;
            return (
              <div
                className={`workbook-mapping-row${isActive ? " active" : ""}`}
                key={worksheet.worksheetId}
              >
                <span title={worksheet.displayName}>{worksheet.displayName}</span>
                <strong>{isActive ? dataset?.table_name || "data" : worksheet.tableName}</strong>
                <small className={`worksheet-status ${worksheet.status}`}>
                  {statusLabel(worksheet.status)}
                </small>
              </div>
            );
          })}
        </div>
      </div>

      <div className="workbook-mapping-section">
        <div className="builder-block-header">
          <span>Workbook profile</span>
          <small>{workbook.sourceFile.originalFilename}</small>
        </div>
        <WorkbookProfileList profile={workbook.ingestionProfile} />
      </div>

      {variant === "analyst" && (
        <div className="workbook-mapping-section">
          <div className="builder-block-header">
            <span>Active schema</span>
            <small>{activeWorksheet?.schema.length || 0}</small>
          </div>
          <SchemaColumnList columns={activeWorksheet?.schema || dataset?.schema || []} />
        </div>
      )}
    </div>
  );
}

export default WorkbookContextPanel;
