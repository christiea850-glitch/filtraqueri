import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ActiveResultModel } from "../../features/results/activeResultModel";
import type { SortDirection } from "../../features/results/resultTypes";
import {
  classifyStructuralRow,
  createDisplayColumnProfiles,
  getDisplayColumnName,
} from "../../features/dataIntelligence/structuralPresentation";

type ResultsGridProps = {
  title: string;
  label: string;
  activeResultModel: ActiveResultModel;
  loading: boolean;
  activeSortColumn: string;
  activeSortDirection: SortDirection;
  hiddenColumns: string[];
  toolbarActions?: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  onHiddenColumnsChange: (columns: string[]) => void;
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

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function ResultsGrid({
  title,
  label,
  activeResultModel,
  loading,
  activeSortColumn,
  activeSortDirection,
  hiddenColumns,
  toolbarActions,
  emptyTitle,
  emptyDescription,
  onHiddenColumnsChange,
  onSortColumn,
  onPageChange,
  onRowsPerPageChange,
}: ResultsGridProps) {
  const [columnSearch, setColumnSearch] = useState("");
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState("");
  const [copiedCellKey, setCopiedCellKey] = useState("");
  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const {
    rows,
    columns,
    visibleColumns,
    totalCount,
    page,
    totalPages,
    rowsPerPage,
    filters,
  } = activeResultModel;
  const firstVisibleRowNumber = (page - 1) * rowsPerPage + 1;
  const isLargePage = rowsPerPage >= 500;
  const largePageWarningId = "results-large-page-warning";
  const normalizedColumnSearch = columnSearch.trim().toLowerCase();
  const displayColumnProfiles = useMemo(
    () => createDisplayColumnProfiles(columns, rows),
    [columns, rows],
  );
  const matchingColumns = useMemo(
    () =>
      normalizedColumnSearch
        ? new Set(
            visibleColumns.filter((column) => {
              const displayName = getDisplayColumnName(displayColumnProfiles, column);
              return (
                column.toLowerCase().includes(normalizedColumnSearch) ||
                displayName.toLowerCase().includes(normalizedColumnSearch)
              );
            }),
          )
        : new Set<string>(),
    [displayColumnProfiles, normalizedColumnSearch, visibleColumns],
  );
  const hiddenColumnCount = columns.length - visibleColumns.length;
  const structuralRowCount = useMemo(
    () =>
      rows.reduce(
        (count, row) => count + (classifyStructuralRow(row, visibleColumns).isStructural ? 1 : 0),
        0,
      ),
    [rows, visibleColumns],
  );

  useEffect(() => {
    if (!copiedMessage) return undefined;

    const clearCopiedMessage = window.setTimeout(() => {
      setCopiedMessage("");
      setCopiedCellKey("");
    }, 1600);

    return () => window.clearTimeout(clearCopiedMessage);
  }, [copiedMessage]);

  useEffect(() => {
    if (!isColumnMenuOpen) return undefined;

    const closeColumnMenu = (event: MouseEvent) => {
      if (
        columnMenuRef.current &&
        event.target instanceof Node &&
        !columnMenuRef.current.contains(event.target)
      ) {
        setIsColumnMenuOpen(false);
      }
    };
    const closeColumnMenuFromKeyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsColumnMenuOpen(false);
    };

    document.addEventListener("mousedown", closeColumnMenu);
    document.addEventListener("keydown", closeColumnMenuFromKeyboard);

    return () => {
      document.removeEventListener("mousedown", closeColumnMenu);
      document.removeEventListener("keydown", closeColumnMenuFromKeyboard);
    };
  }, [isColumnMenuOpen]);

  const showAllColumns = () => onHiddenColumnsChange([]);

  const toggleColumnVisibility = (column: string) => {
    onHiddenColumnsChange(
      hiddenColumns.includes(column)
        ? hiddenColumns.filter((currentColumn) => currentColumn !== column)
        : [...hiddenColumns, column],
    );
  };

  const copyCellValue = async (column: string, rowIndex: number, value: unknown) => {
    const cellValue = String(value ?? "");
    try {
      await copyTextToClipboard(cellValue);
      setCopiedCellKey(`${rowIndex}-${column}`);
      setCopiedMessage("Copied cell");
    } catch {
      setCopiedMessage("Copy failed");
    }
  };

  const copyVisibleRow = async (row: Record<string, unknown>, rowNumber: number) => {
    const rowValue = visibleColumns.map((column) => String(row[column] ?? "")).join("\t");
    try {
      await copyTextToClipboard(rowValue);
      setCopiedCellKey(`row-${rowNumber}`);
      setCopiedMessage("Copied row");
    } catch {
      setCopiedMessage("Copy failed");
    }
  };

  const focusSiblingRow = (
    event: KeyboardEvent<HTMLTableRowElement>,
    row: Record<string, unknown>,
    rowNumber: number,
  ) => {
    const currentRow = event.currentTarget;
    let nextRow: Element | null = null;

    if (event.key === "ArrowDown") nextRow = currentRow.nextElementSibling;
    if (event.key === "ArrowUp") nextRow = currentRow.previousElementSibling;
    if (event.key === "Home") nextRow = currentRow.parentElement?.firstElementChild || null;
    if (event.key === "End") nextRow = currentRow.parentElement?.lastElementChild || null;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      copyVisibleRow(row, rowNumber);
      return;
    }

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
        <div className="results-toolbar-tools">
          <label className="find-column-control">
            <span>Find column</span>
            <input
              type="search"
              value={columnSearch}
              onChange={(event) => setColumnSearch(event.target.value)}
              placeholder="Column name"
            />
          </label>
          <div className="visible-columns-control" ref={columnMenuRef}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsColumnMenuOpen((currentValue) => !currentValue)}
              aria-expanded={isColumnMenuOpen}
              aria-haspopup="true"
            >
              Columns
              {hiddenColumnCount > 0 ? ` (${visibleColumns.length}/${columns.length})` : ""}
            </button>
            {isColumnMenuOpen && (
              <div className="columns-menu" role="menu" aria-label="Visible columns">
                <div className="columns-menu-header">
                  <span>{visibleColumns.length.toLocaleString()} visible</span>
                  <button type="button" className="text-button" onClick={showAllColumns}>
                    Show all
                  </button>
                </div>
                <div className="columns-menu-list">
                  {columns.map((column) => {
                    const displayName = getDisplayColumnName(displayColumnProfiles, column);

                    return (
                    <label key={column} title={column}>
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.includes(column)}
                        onChange={() => toggleColumnVisibility(column)}
                      />
                      <span>
                        {displayName}
                        {displayName !== column && <small>{column}</small>}
                      </span>
                    </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {toolbarActions}
        </div>
      </div>

      {(normalizedColumnSearch || copiedMessage || structuralRowCount > 0) && (
        <div className="results-grid-feedback" aria-live="polite">
          {normalizedColumnSearch && (
            <span>
              {matchingColumns.size.toLocaleString()} matching column
              {matchingColumns.size === 1 ? "" : "s"}
            </span>
          )}
          {copiedMessage && <strong>{copiedMessage}</strong>}
          {structuralRowCount > 0 && (
            <span>{structuralRowCount.toLocaleString()} report rows softened</span>
          )}
        </div>
      )}

      {filters.activeLabels.length > 0 && (
        <div className="active-filter-bar">
          {filters.activeLabels.map((filterLabel) => (
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
                {visibleColumns.map((column, columnIndex) => {
                  const displayName = getDisplayColumnName(displayColumnProfiles, column);

                  return (
                  <th
                    key={column}
                    className={matchingColumns.has(column) ? "is-column-match" : ""}
                  >
                    <button type="button" onClick={() => onSortColumn(column)}>
                      <span
                        className="column-letter"
                        aria-label={`Column ${getColumnLetter(columnIndex)}`}
                        title={`Column ${getColumnLetter(columnIndex)}`}
                      >
                        {getColumnLetter(columnIndex)}
                      </span>
                      <span className="column-name" title={displayName !== column ? `${displayName} (${column})` : column}>
                        {displayName}
                        {activeSortColumn === column && <span> {activeSortDirection}</span>}
                      </span>
                      {displayName !== column && <span className="source-column-name">{column}</span>}
                    </button>
                  </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => {
                const rowNumber = firstVisibleRowNumber + rowIndex;
                const structuralRow = classifyStructuralRow(row, visibleColumns);

                return (
                  <tr
                    key={rowIndex}
                    className={structuralRow.isStructural ? `is-structural-row is-${structuralRow.type}` : ""}
                    tabIndex={0}
                    onKeyDown={(event) => focusSiblingRow(event, row, rowNumber)}
                    aria-label={`Row ${rowNumber}. ${structuralRow.label}. Press Enter to copy visible row values.`}
                  >
                    <th
                      className={`row-number-cell ${copiedCellKey === `row-${rowNumber}` ? "is-copied" : ""}`}
                      scope="row"
                      title={`${structuralRow.label}. Click to copy visible row values`}
                      onClick={() => copyVisibleRow(row, rowNumber)}
                    >
                      {rowNumber}
                      {structuralRow.isStructural && <span className="row-structure-label">Report</span>}
                    </th>
                    {visibleColumns.map((column) => (
                      <td
                        key={column}
                        className={[
                          matchingColumns.has(column) ? "is-column-match" : "",
                          copiedCellKey === `${rowIndex}-${column}` ? "is-copied" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title={`${getDisplayColumnName(displayColumnProfiles, column)} (${column}): ${String(row[column] ?? "")}. Click to copy.`}
                        onClick={() => copyCellValue(column, rowIndex, row[column])}
                      >
                        {String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })}
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
