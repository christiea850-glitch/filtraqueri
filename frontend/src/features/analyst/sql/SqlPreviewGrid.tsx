import { labelResultColumns } from "./resultLabeling";
import type { SqlPreviewResult } from "./sqlTypes";

type SqlPreviewGridProps = {
  previewResult: SqlPreviewResult;
};

function SqlPreviewGrid({ previewResult }: SqlPreviewGridProps) {
  const hasRows = previewResult.rows.length > 0 && previewResult.columns.length > 0;
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
                  {previewResult.columns.map((column) => (
                    <td key={column}>{String(row[column] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <p className="section-label">No execution</p>
          <h2>Execution not connected yet</h2>
          <p>No results yet.</p>
        </div>
      )}
    </section>
  );
}

export default SqlPreviewGrid;
