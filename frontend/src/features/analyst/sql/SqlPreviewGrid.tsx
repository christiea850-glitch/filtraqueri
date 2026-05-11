import type { SqlPreviewResult } from "./sqlTypes";

type SqlPreviewGridProps = {
  previewResult: SqlPreviewResult;
};

function SqlPreviewGrid({ previewResult }: SqlPreviewGridProps) {
  const hasRows = previewResult.rows.length > 0 && previewResult.columns.length > 0;

  return (
    <section className="sql-preview-panel" aria-label="SQL preview result">
      <div className="data-grid-toolbar">
        <div>
          <p className="section-label">Preview</p>
          <h2>SQL result placeholder</h2>
          <p>{previewResult.message}</p>
        </div>
      </div>

      {hasRows ? (
        <div className="table-container data-grid-table">
          <table>
            <thead>
              <tr>
                {previewResult.columns.map((column) => (
                  <th key={column}>{column}</th>
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
          <h2>Backend SQL execution is not connected yet</h2>
          <p>Draft, save, and explain SQL here until the secure SQL endpoint is added.</p>
        </div>
      )}
    </section>
  );
}

export default SqlPreviewGrid;
