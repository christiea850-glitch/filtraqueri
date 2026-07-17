import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import type { WorksheetMetadata } from "../workbook";

export type SummaryColumnKind =
  | "text"
  | "numeric"
  | "date"
  | "categorical"
  | "identifier";

export type SummaryTypeBreakdownItem = {
  kind: SummaryColumnKind;
  label: string;
  count: number;
};

export type SummaryNotableColumn = {
  kind: "identifier" | "date_range" | "top_category";
  label: string;
  columnName: string;
  detail: string;
};

export type SummaryWorksheetRow = {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  isActive: boolean;
};

export type DatasetSummary = {
  filename: string;
  activeWorksheetName: string | null;
  totalRows: number;
  totalColumns: number;
  totalWorksheets: number;
  missingCellCount: number;
  completenessPercent: number | null;
  columnsWithMissing: number;
  typeBreakdown: SummaryTypeBreakdownItem[];
  notableColumns: SummaryNotableColumn[];
  worksheetRows: SummaryWorksheetRow[];
  headline: string;
  deterministicSummary: string;
};

const TYPE_LABELS: Record<SummaryColumnKind, string> = {
  text: "Text",
  numeric: "Numeric",
  date: "Date",
  categorical: "Categorical",
  identifier: "Identifier",
};

const IDENTIFIER_NAME_PATTERN = /^id$|_id$|number$|code$/i;

const formatCount = (value: number) => value.toLocaleString();

const formatPercent = (value: number) =>
  `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;

const isIdentifierColumn = (column: SchemaColumn, rowCount: number) =>
  rowCount > 0 &&
  column.unique_count === rowCount &&
  IDENTIFIER_NAME_PATTERN.test(column.name);

const classifyColumn = (column: SchemaColumn, rowCount: number): SummaryColumnKind => {
  if (isIdentifierColumn(column, rowCount)) return "identifier";
  if (column.inferred_type === "boolean") return "categorical";
  return column.inferred_type;
};

const getWorksheetName = (worksheet: WorksheetMetadata) =>
  worksheet.displayName || worksheet.sheetName || worksheet.tableName;

const getWorksheetRows = (
  dataset: DatasetMetadata,
  activeWorksheetName?: string | null,
): SummaryWorksheetRow[] => {
  const workbook = dataset.workbook_metadata;
  if (!workbook || workbook.worksheets.length <= 1) return [];

  return workbook.worksheets.map((worksheet) => ({
    id: worksheet.worksheetId,
    name: getWorksheetName(worksheet),
    rowCount: worksheet.rowCount,
    columnCount: worksheet.columnCount,
    isActive:
      worksheet.worksheetId === workbook.activeWorksheetId ||
      getWorksheetName(worksheet) === activeWorksheetName,
  }));
};

const getActiveWorksheetName = (
  dataset: DatasetMetadata,
  activeWorksheetName?: string | null,
) => {
  if (activeWorksheetName) return activeWorksheetName;
  const workbook = dataset.workbook_metadata;
  const activeWorksheet = workbook?.worksheets.find(
    (worksheet) => worksheet.worksheetId === workbook.activeWorksheetId,
  );
  return activeWorksheet ? getWorksheetName(activeWorksheet) : null;
};

export const computeDatasetSummary = ({
  dataset,
  activeWorksheetName,
}: {
  dataset: DatasetMetadata;
  activeWorksheetName?: string | null;
}): DatasetSummary => {
  const totalRows = dataset.row_count;
  const totalColumns = dataset.column_count || dataset.schema.length;
  const totalWorksheets = dataset.workbook_metadata?.worksheets.length || 1;
  const missingCellCount = dataset.schema.reduce(
    (total, column) => total + Math.max(0, column.null_count || 0),
    0,
  );
  const totalCells = totalRows * totalColumns;
  const completenessPercent =
    totalCells > 0 ? Math.max(0, 100 - (missingCellCount / totalCells) * 100) : null;
  const columnsWithMissing = dataset.schema.filter((column) => column.null_count > 0).length;
  const activeName = getActiveWorksheetName(dataset, activeWorksheetName);

  const typeCounts = new Map<SummaryColumnKind, number>();
  dataset.schema.forEach((column) => {
    const kind = classifyColumn(column, totalRows);
    typeCounts.set(kind, (typeCounts.get(kind) || 0) + 1);
  });

  const typeBreakdown = (["text", "numeric", "date", "categorical", "identifier"] as const)
    .map((kind) => ({
      kind,
      label: TYPE_LABELS[kind],
      count: typeCounts.get(kind) || 0,
    }))
    .filter((item) => item.count > 0);

  const notableColumns: SummaryNotableColumn[] = [];
  const identifierColumn = dataset.schema.find((column) => isIdentifierColumn(column, totalRows));
  if (identifierColumn) {
    notableColumns.push({
      kind: "identifier",
      label: "Primary identifier",
      columnName: identifierColumn.name,
      detail: `${identifierColumn.unique_count.toLocaleString()} unique values`,
    });
  }

  const dateRangeColumn = dataset.schema.find(
    (column) => column.inferred_type === "date" && column.date_range?.min && column.date_range?.max,
  );
  if (dateRangeColumn?.date_range) {
    notableColumns.push({
      kind: "date_range",
      label: "Date range",
      columnName: dateRangeColumn.name,
      detail: `${dateRangeColumn.date_range.min} to ${dateRangeColumn.date_range.max}`,
    });
  }

  const topCategoryColumn = dataset.schema.find(
    (column) =>
      (column.inferred_type === "categorical" ||
        column.inferred_type === "text" ||
        column.inferred_type === "boolean") &&
      column.top_values &&
      column.top_values.length > 0,
  );
  const topValue = topCategoryColumn?.top_values?.[0];
  if (topCategoryColumn && topValue) {
    notableColumns.push({
      kind: "top_category",
      label: "Top category",
      columnName: topCategoryColumn.name,
      detail: `${topValue.value} (${topValue.count.toLocaleString()} rows)`,
    });
  }

  const dominantType = typeBreakdown.reduce<SummaryTypeBreakdownItem | null>(
    (current, item) => (!current || item.count > current.count ? item : current),
    null,
  );
  const worksheetPhrase =
    totalWorksheets > 1
      ? `${formatCount(totalWorksheets)} worksheets`
      : activeName
        ? `the ${activeName} worksheet`
        : "one worksheet";
  const completenessPhrase =
    completenessPercent === null
      ? "Completeness cannot be estimated from the available row and column counts."
      : missingCellCount === 0
        ? "No missing cells are reported in the available profile."
        : `${formatCount(missingCellCount)} missing cells are reported across ${formatCount(
            columnsWithMissing,
          )} columns, for about ${formatPercent(completenessPercent)} completeness.`;
  const dominantTypePhrase = dominantType
    ? `The most common field shape is ${dominantType.label.toLowerCase()} (${formatCount(
        dominantType.count,
      )} columns).`
    : "No profiled columns are available yet.";

  const headline = `${dataset.original_filename} contains ${formatCount(totalRows)} rows and ${formatCount(
    totalColumns,
  )} columns across ${worksheetPhrase}. ${dominantTypePhrase} ${completenessPhrase}`;

  const deterministicSummary = [
    dataset.original_filename,
    totalRows,
    totalColumns,
    totalWorksheets,
    missingCellCount,
    columnsWithMissing,
    typeBreakdown.map((item) => `${item.kind}:${item.count}`).join("|"),
    notableColumns.map((item) => `${item.kind}:${item.columnName}:${item.detail}`).join("|"),
  ].join("::");

  return {
    filename: dataset.original_filename,
    activeWorksheetName: activeName,
    totalRows,
    totalColumns,
    totalWorksheets,
    missingCellCount,
    completenessPercent,
    columnsWithMissing,
    typeBreakdown,
    notableColumns,
    worksheetRows: getWorksheetRows(dataset, activeName),
    headline,
    deterministicSummary,
  };
};
