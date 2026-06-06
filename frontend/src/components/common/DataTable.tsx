import type { KeyboardEvent, ReactNode } from "react";

type DataTableVariant = "workbookPreview" | "queryResult" | "sqlResult";

type DataTableColumn = {
  key: string;
  className?: string;
  title?: string;
  header: ReactNode;
};

type DataTableRow = {
  key: string | number;
  values: Record<string, unknown>;
  className?: string;
  tabIndex?: number;
  ariaLabel?: string;
  rowNumber?: number;
  rowHeaderClassName?: string;
  rowHeaderTitle?: string;
  rowHeaderContent?: ReactNode;
  onRowHeaderClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTableRowElement>) => void;
};

type DataTableProps = {
  variant: DataTableVariant;
  ariaLabel: string;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  wrapperClassName: string;
  tableClassName?: string;
  showRowNumbers?: boolean;
  rowNumberHeader?: ReactNode;
  rowNumberHeaderClassName?: string;
  rowNumberHeaderTitle?: string;
  renderCell: (row: DataTableRow, column: DataTableColumn) => ReactNode;
  getCellClassName?: (row: DataTableRow, column: DataTableColumn) => string;
  getCellTitle?: (row: DataTableRow, column: DataTableColumn) => string;
  onCellClick?: (row: DataTableRow, column: DataTableColumn) => void;
};

function DataTable({
  variant,
  ariaLabel,
  columns,
  rows,
  wrapperClassName,
  tableClassName,
  showRowNumbers = false,
  rowNumberHeader = "Row",
  rowNumberHeaderClassName,
  rowNumberHeaderTitle,
  renderCell,
  getCellClassName,
  getCellTitle,
  onCellClick,
}: DataTableProps) {
  return (
    <div className={wrapperClassName} data-table-variant={variant}>
      <table className={tableClassName} aria-label={ariaLabel}>
        <thead>
          <tr>
            {showRowNumbers && (
              <th className={rowNumberHeaderClassName} scope="col" title={rowNumberHeaderTitle}>
                {rowNumberHeader}
              </th>
            )}
            {columns.map((column) => (
              <th key={column.key} className={column.className} title={column.title}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={row.className}
              tabIndex={row.tabIndex}
              onKeyDown={row.onKeyDown}
              aria-label={row.ariaLabel}
            >
              {showRowNumbers && (
                <th
                  className={row.rowHeaderClassName}
                  scope="row"
                  title={row.rowHeaderTitle}
                  onClick={row.onRowHeaderClick}
                >
                  {row.rowHeaderContent ?? row.rowNumber}
                </th>
              )}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={getCellClassName?.(row, column)}
                  title={getCellTitle?.(row, column)}
                  onClick={() => onCellClick?.(row, column)}
                >
                  {renderCell(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
export type { DataTableColumn, DataTableRow, DataTableVariant };
