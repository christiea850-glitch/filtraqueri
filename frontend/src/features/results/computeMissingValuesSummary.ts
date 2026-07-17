import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import type { WorksheetMetadata } from "../workbook";

export type MissingValuesVisualType = "text" | "numeric" | "date" | "categorical";

export type MissingValuesColumnSummary = {
  name: string;
  inferredType: SchemaColumn["inferred_type"];
  visualType: MissingValuesVisualType;
  missingCount: number;
  presentCount: number;
  completenessPercent: number;
  missingPercent: number;
  originalIndex: number;
};

export type MissingValuesWorksheetSummary = {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  totalCells: number;
  missingCells: number;
  completenessPercent: number;
  missingPercent: number;
  columnsWithMissing: number;
};

export type MissingValuesSummary = {
  filename: string;
  rowCount: number;
  columnCount: number;
  totalCells: number;
  totalMissingCells: number;
  percentComplete: number;
  percentMissing: number;
  columns: MissingValuesColumnSummary[];
  columnsWithMissing: MissingValuesColumnSummary[];
  completeColumns: MissingValuesColumnSummary[];
  worksheetSummaries: MissingValuesWorksheetSummary[];
  answer: string;
  deterministicSummary: string;
};

const toVisualType = (inferredType: SchemaColumn["inferred_type"]): MissingValuesVisualType =>
  inferredType === "boolean" ? "categorical" : inferredType;

const safePercent = (part: number, total: number) => {
  if (total <= 0) return 0;
  return (part / total) * 100;
};

const completenessFor = (missingCount: number, rowCount: number) => {
  if (rowCount <= 0) return 100;
  return Math.max(0, 100 - safePercent(missingCount, rowCount));
};

const formatCount = (value: number) => value.toLocaleString();

const formatPercent = (value: number) =>
  `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;

const getWorksheetName = (worksheet: WorksheetMetadata) =>
  worksheet.displayName || worksheet.sheetName || worksheet.tableName;

const summarizeColumns = (
  schema: readonly SchemaColumn[],
  rowCount: number,
): MissingValuesColumnSummary[] =>
  schema
    .map((column, originalIndex) => {
      const missingCount = Math.max(0, column.null_count || 0);
      const presentCount = Math.max(0, rowCount - missingCount);
      const completenessPercent = completenessFor(missingCount, rowCount);
      return {
        name: column.name,
        inferredType: column.inferred_type,
        visualType: toVisualType(column.inferred_type),
        missingCount,
        presentCount,
        completenessPercent,
        missingPercent: rowCount <= 0 ? 0 : 100 - completenessPercent,
        originalIndex,
      };
    })
    .sort((left, right) => {
      if (right.missingCount !== left.missingCount) {
        return right.missingCount - left.missingCount;
      }
      return left.originalIndex - right.originalIndex;
    });

const summarizeWorksheet = (worksheet: WorksheetMetadata): MissingValuesWorksheetSummary => {
  const missingCells = worksheet.schema.reduce(
    (total, column) => total + Math.max(0, column.null_count || 0),
    0,
  );
  const totalCells = worksheet.rowCount * worksheet.columnCount;
  const percentMissing = totalCells <= 0 ? 0 : safePercent(missingCells, totalCells);
  return {
    id: worksheet.worksheetId,
    name: getWorksheetName(worksheet),
    rowCount: worksheet.rowCount,
    columnCount: worksheet.columnCount,
    totalCells,
    missingCells,
    completenessPercent: totalCells <= 0 ? 100 : Math.max(0, 100 - percentMissing),
    missingPercent: percentMissing,
    columnsWithMissing: worksheet.schema.filter((column) => column.null_count > 0).length,
  };
};

export const computeMissingValuesSummary = (
  dataset: DatasetMetadata,
): MissingValuesSummary => {
  const rowCount = Math.max(0, dataset.row_count || 0);
  const columnCount = Math.max(0, dataset.column_count || dataset.schema.length || 0);
  const totalCells = rowCount * columnCount;
  const totalMissingCells = dataset.schema.reduce(
    (total, column) => total + Math.max(0, column.null_count || 0),
    0,
  );
  const percentMissing = totalCells <= 0 ? 0 : safePercent(totalMissingCells, totalCells);
  const percentComplete = totalCells <= 0 ? 100 : Math.max(0, 100 - percentMissing);
  const columns = summarizeColumns(dataset.schema, rowCount);
  const columnsWithMissing = columns.filter((column) => column.missingCount > 0);
  const completeColumns = columns.filter((column) => column.missingCount === 0);
  const workbookWorksheets = dataset.workbook_metadata?.worksheets || [];
  const worksheetSummaries =
    workbookWorksheets.length > 1
      ? workbookWorksheets
          .filter((worksheet) => worksheet.schema.length > 0)
          .map(summarizeWorksheet)
          .sort((left, right) => {
            if (right.missingCells !== left.missingCells) {
              return right.missingCells - left.missingCells;
            }
            return left.name.localeCompare(right.name);
          })
      : [];

  const answer =
    totalMissingCells === 0
      ? `No missing cells are reported in the available profile. All ${formatCount(
          rowCount,
        )} rows and ${formatCount(columnCount)} columns appear complete.`
      : `This dataset is ${formatPercent(percentComplete)} complete. ${formatCount(
          totalMissingCells,
        )} values are missing across ${formatCount(columnsWithMissing.length)} columns.`;

  return {
    filename: dataset.original_filename,
    rowCount,
    columnCount,
    totalCells,
    totalMissingCells,
    percentComplete,
    percentMissing,
    columns,
    columnsWithMissing,
    completeColumns,
    worksheetSummaries,
    answer,
    deterministicSummary: [
      dataset.original_filename,
      rowCount,
      columnCount,
      totalMissingCells,
      formatPercent(percentComplete),
      columns
        .map((column) => `${column.name}:${column.missingCount}:${formatPercent(column.completenessPercent)}`)
        .join("|"),
      worksheetSummaries
        .map((worksheet) => `${worksheet.name}:${worksheet.missingCells}:${formatPercent(worksheet.completenessPercent)}`)
        .join("|"),
    ].join("::"),
  };
};
