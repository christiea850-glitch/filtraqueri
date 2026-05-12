import type { KeyboardEvent, ReactNode } from "react";
import type { SortDirection } from "../../features/results/resultTypes";

type ResultsGridProps = {
  title: string;
  label: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
  loading: boolean;
  activeFilterLabels: string[];
  activeSortColumn: string;
  activeSortDirection: SortDirection;
  page: number;
  totalPages: number;
  rowsPerPage: number;
  toolbarActions?: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  onSortColumn: (column: string) => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
};

function getColumnLetter(index: number) {
  let columnIndex = index + 1;
  let label = "";

  while (columnIndex > 0) {
    const remainder = (columnIndex - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    columnIndex = Math.floor((columnIndex - 1) / 26);
  }

  return label;
}

function ResultsGrid({
  title,
  label,
  columns,
  rows,
  totalCount,
  loading,
  activeFilterLabels,
  activeSortColumn,
  activeSortDirection,
  page,
  totalPages,
  rowsPerPage,
  toolbarActions,
  emptyTitle,
  emptyDescription,
  onSortColumn,
  onPageChange,
  onRowsPerPageChange,
}: ResultsGridProps) {
  const firstVisibleRowNumber = (page - 1) * rowsPerPage + 1;
  const isLargePage = rowsPerPage >= 500;
  const largePageWarningId = "results-large-page-warning";

  const focusSiblingRow = (event: KeyboardEvent<HTMLTableRowElement>) => {
    const currentRow = event.currentTarget;
    let nextRow: Element | null = null;

    if (event.key === "ArrowDown") nextRow = currentRow.nextElementSibling;
    if (event.key === "ArrowUp") nextRow = currentRow.previousElementSibling;
    if (event.key === "Home") nextRow = currentRow.parentElement?.firstElementChild || null;
    if (event.key === "End") nextRow = currentRow.parentElement?.lastElementChild || null;

    if (!nextRow) return;

    event.preventDefault();
    if (nextRow instanceof HTMLElement) nextRow.focus();
  };

  return (
    <section className="data-grid-section">
      <div className="data-grid-toolbar">
        <div>
          <p className="section-label">{label}</p>
          <h2>{title}</h2>
          <p>
            Showing {rows.length.toLocaleString()} of {totalCount.toLocaleString()}
          </p>
        </div>
        {toolbarActions}
      </div>

      {activeFilterLabels.length > 0 && (
        <div className="active-filter-bar">
          {activeFilterLabels.map((filterLabel) => (
            <span key={filterLabel}>{filterLabel}</span>
          ))}
        </div>
      )}

      {loading && <p className="status-message">Loading rows...</p>}

      {rows.length === 0 && !loading ? (
        <div className="empty-state compact-empty">
          <p className="section-label">{label}</p>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
      ) : (
        <div className="table-container data-grid-table">
          <table aria-label={`${title} data grid`}>
            <thead>
              <tr>
                <th
                  className="row-number-cell row-number-header"
                  scope="col"
                  title="Visible row number"
                >
                  Row
                </th>
                {columns.map((column, columnIndex) => (
                  <th key={column}>
                    <button type="button" onClick={() => onSortColumn(column)}>
                      <span
                        className="column-letter"
                        aria-label={`Column ${getColumnLetter(columnIndex)}`}
                        title={`Column ${getColumnLetter(columnIndex)}`}
                      >
                        {getColumnLetter(columnIndex)}
                      </span>
                      <span className="column-name" title={column}>
                        {column}
                        {activeSortColumn === column && <span> {activeSortDirection}</span>}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  tabIndex={0}
                  onKeyDown={focusSiblingRow}
                  aria-label={`Row ${firstVisibleRowNumber + rowIndex}`}
                >
                  <th className="row-number-cell" scope="row">
                    {firstVisibleRowNumber + rowIndex}
                  </th>
                  {columns.map((column) => (
                    <td key={column} title={`${column}: ${String(row[column] ?? "")}`}>
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination-bar">
        <label className="rows-per-page-control">
          <span>Rows per page</span>
          <select
            aria-label="Rows per page"
            title="Rows per page"
            aria-describedby={isLargePage ? largePageWarningId : undefined}
            value={rowsPerPage}
            onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="300">300</option>
            <option value="500">500</option>
            <option value="800">800</option>
          </select>
        </label>
        <div className="page-controls">
          <button
            type="button"
            className="secondary-button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {isLargePage && (
        <p className="large-page-helper" id={largePageWarningId}>
          Large previews may affect browser performance.
        </p>
      )}
    </section>
  );
}

export default ResultsGrid;
