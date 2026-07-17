import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";

export type TrendsDateColumnSummary = {
  name: string;
  missingCount: number;
  completenessPercent: number;
  hasValidRange: boolean;
  minDate: string | null;
  maxDate: string | null;
  rangeDays: number | null;
  originalIndex: number;
};

export type TrendsTypeCounts = {
  date: number;
  numeric: number;
  categorical: number;
  text: number;
  boolean: number;
};

export type TrendsSummary = {
  filename: string;
  rowCount: number;
  columnCount: number;
  dateColumnCount: number;
  dateColumnsWithValidRange: number;
  numericColumnCount: number;
  rowsAvailable: number;
  widestDateRangeColumn: TrendsDateColumnSummary | null;
  dateColumns: TrendsDateColumnSummary[];
  detectedTypeCounts: TrendsTypeCounts;
  readiness: {
    hasDateField: boolean;
    hasUsableDateRange: boolean;
    hasNumericFields: boolean;
    canPrepareTrend: boolean;
    canRenderTrendChart: false;
  };
  answer: string;
  deterministicSummary: string;
};

const formatCount = (value: number) => value.toLocaleString();

const formatPercent = (value: number) =>
  `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;

const parseDateMs = (value: string | null | undefined) => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const rangeDays = (minDate: string | null | undefined, maxDate: string | null | undefined) => {
  const minTime = parseDateMs(minDate);
  const maxTime = parseDateMs(maxDate);
  if (minTime === null || maxTime === null || maxTime < minTime) return null;
  return Math.round((maxTime - minTime) / 86_400_000);
};

const completenessFor = (missingCount: number, rowCount: number) => {
  if (rowCount <= 0) return 100;
  return Math.max(0, 100 - (missingCount / rowCount) * 100);
};

const summarizeDateColumn = (
  column: SchemaColumn,
  rowCount: number,
  originalIndex: number,
): TrendsDateColumnSummary => {
  const range = column.date_range || null;
  const computedRangeDays = rangeDays(range?.min, range?.max);
  const missingCount = Math.max(0, column.null_count || 0);
  return {
    name: column.name,
    missingCount,
    completenessPercent: completenessFor(missingCount, rowCount),
    hasValidRange: computedRangeDays !== null,
    minDate: computedRangeDays !== null ? range?.min || null : null,
    maxDate: computedRangeDays !== null ? range?.max || null : null,
    rangeDays: computedRangeDays,
    originalIndex,
  };
};

const countTypes = (schema: readonly SchemaColumn[]): TrendsTypeCounts =>
  schema.reduce<TrendsTypeCounts>(
    (counts, column) => ({
      ...counts,
      [column.inferred_type]: counts[column.inferred_type] + 1,
    }),
    {
      date: 0,
      numeric: 0,
      categorical: 0,
      text: 0,
      boolean: 0,
    },
  );

export const computeTrendsSummary = (dataset: DatasetMetadata): TrendsSummary => {
  const rowCount = Math.max(0, dataset.row_count || 0);
  const columnCount = Math.max(0, dataset.column_count || dataset.schema.length || 0);
  const detectedTypeCounts = countTypes(dataset.schema);
  const dateColumns = dataset.schema
    .map((column, originalIndex) => ({ column, originalIndex }))
    .filter(({ column }) => column.inferred_type === "date")
    .map(({ column, originalIndex }) => summarizeDateColumn(column, rowCount, originalIndex));
  const dateColumnsWithValidRange = dateColumns.filter((column) => column.hasValidRange);
  const numericColumnCount = dataset.schema.filter((column) => column.inferred_type === "numeric").length;
  const widestDateRangeColumn =
    [...dateColumnsWithValidRange].sort((left, right) => {
      const rightDays = right.rangeDays || 0;
      const leftDays = left.rangeDays || 0;
      if (rightDays !== leftDays) return rightDays - leftDays;
      return left.originalIndex - right.originalIndex;
    })[0] || null;
  const hasDateField = dateColumns.length > 0;
  const hasUsableDateRange = dateColumnsWithValidRange.length > 0;
  const hasNumericFields = numericColumnCount > 0;

  const answer = widestDateRangeColumn
    ? `This dataset has ${formatCount(dateColumns.length)} date field${
        dateColumns.length === 1 ? "" : "s"
      }. The widest date range is ${widestDateRangeColumn.name}, from ${
        widestDateRangeColumn.minDate
      } to ${
        widestDateRangeColumn.maxDate
      }. Trend charts need time-bucketed counts, which are not available in the current profile yet.`
    : hasDateField
      ? "Date fields were detected, but the current profile does not include a usable date range. Trend analysis needs at least one date field with a valid range."
      : "No usable date field was detected in the available profile. Trends need at least one date column.";

  return {
    filename: dataset.original_filename,
    rowCount,
    columnCount,
    dateColumnCount: dateColumns.length,
    dateColumnsWithValidRange: dateColumnsWithValidRange.length,
    numericColumnCount,
    rowsAvailable: rowCount,
    widestDateRangeColumn,
    dateColumns,
    detectedTypeCounts,
    readiness: {
      hasDateField,
      hasUsableDateRange,
      hasNumericFields,
      canPrepareTrend: hasUsableDateRange,
      canRenderTrendChart: false,
    },
    answer,
    deterministicSummary: [
      dataset.original_filename,
      rowCount,
      columnCount,
      dateColumns.length,
      dateColumnsWithValidRange.length,
      numericColumnCount,
      widestDateRangeColumn
        ? `${widestDateRangeColumn.name}:${widestDateRangeColumn.minDate}:${widestDateRangeColumn.maxDate}:${widestDateRangeColumn.rangeDays}`
        : "none",
      dateColumns
        .map((column) =>
          `${column.name}:${column.minDate || "no-min"}:${column.maxDate || "no-max"}:${formatPercent(
            column.completenessPercent,
          )}`,
        )
        .join("|"),
      "canRenderTrendChart:false",
    ].join("::"),
  };
};
