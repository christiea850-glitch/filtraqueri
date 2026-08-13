import { frameResultValue, labelResultColumns } from "./resultLabeling";
import {
  getSqlExecutionDisplayStatusCopy,
  type SqlExecutionDisplayStatus,
} from "./sqlExecutionDisplayStatus";
import type { SqlPreviewResult } from "./sqlTypes";

type SqlPreviewGridProps = {
  previewResult: SqlPreviewResult;
  executionDisplayStatus?: SqlExecutionDisplayStatus;
};

function SqlPreviewGrid({
  previewResult,
  executionDisplayStatus = previewResult.executionIdentity ? "current" : "not_run",
}: SqlPreviewGridProps) {
  const hasColumns = previewResult.columns.length > 0;
  const hasRows = previewResult.rows.length > 0;
  const hasExecutedResult = Boolean(previewResult.executionIdentity);
  const statusCopy = getSqlExecutionDisplayStatusCopy(executionDisplayStatus);
  const isFailed = executionDisplayStatus === "failed" || Boolean(previewResult.errorInsight);
  const isRunning = executionDisplayStatus === "running";
  const isStale = executionDisplayStatus === "stale";
  const isZeroRowSuccess = hasExecutedResult && hasColumns && !hasRows && !isFailed && !isRunning;
  const emptyTitle = isZeroRowSuccess
    ? isStale
      ? "Last run returned 0 rows"
      : "Query ran successfully"
    : statusCopy.label;
  const emptyMessage = isZeroRowSuccess
    ? isStale
      ? "Last run returned 0 rows, but the SQL or data source has changed. Run again to refresh."
      : "Query ran successfully and returned 0 rows."
    : statusCopy.description;
  const labeledColumns = labelResultColumns({
    columns: previewResult.columns,
    taskPrompt: previewResult.executedQuestion?.taskPrompt,
    detectedIntent: previewResult.executedQuestion?.detectedIntent,
    questionShape: previewResult.executedQuestion?.questionShape,
    sourceLabel: previewResult.executedQuestion?.sourceLabel,
    sourceTableName: previewResult.executedQuestion?.sourceTableName,
  });

  return (
    <section className="sql-preview-panel" aria-label="SQL preview result">
      <div className="data-grid-toolbar">
        <div>
          <p className="section-label">Preview</p>
          <h2>Result preview</h2>
          <p>{previewResult.message}</p>
        </div>
      </div>

      {hasRows ? (
        <div className="table-container data-grid-table">
          <table>
            <thead>
              <tr>
                {labeledColumns.map((column) => (
                  <th
                    key={column.key}
                    title={column.label === column.key ? column.key : `${column.label} (${column.key})`}
                  >
                    <span>{column.label}</span>
                    {column.label !== column.key ? (
                      <span className="dataset-preview-column-raw">{column.key}</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewResult.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {labeledColumns.map((column) => {
                    const framedValue = frameResultValue({
                      value: row[column.key],
                      columnKey: column.key,
                      columnLabel: column.label,
                      taskPrompt: previewResult.executedQuestion?.taskPrompt,
                      detectedIntent: previewResult.executedQuestion?.detectedIntent,
                      questionShape: previewResult.executedQuestion?.questionShape,
                    });
                    return (
                      <td
                        key={column.key}
                        title={framedValue.origin === "framed" ? `Raw value: ${String(framedValue.raw ?? "")}` : undefined}
                        aria-label={
                          framedValue.origin === "framed"
                            ? `${framedValue.display} (raw value: ${String(framedValue.raw ?? "")})`
                            : undefined
                        }
                      >
                        {framedValue.display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <p className="section-label">{statusCopy.label}</p>
          <h2>{emptyTitle}</h2>
          <p>{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}

export default SqlPreviewGrid;
