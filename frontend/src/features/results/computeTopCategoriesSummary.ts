import type { DatasetMetadata, SchemaColumn, TopValue } from "../dataset/datasetTypes";

export type TopCategoryEmptyReason =
  | "none"
  | "no_categorical_fields"
  | "only_identifiers"
  | "top_values_unavailable"
  | "row_count_zero";

export type TopCategoryValueSummary = {
  value: string;
  count: number;
  percent: number;
};

export type TopCategoryOtherSummary = {
  count: number;
  percent: number;
};

export type TopCategoryColumnSummary = {
  name: string;
  inferredType: SchemaColumn["inferred_type"];
  uniqueCount: number;
  nullCount: number;
  topValues: TopCategoryValueSummary[];
  other: TopCategoryOtherSummary | null;
  strongestValue: TopCategoryValueSummary;
  originalIndex: number;
};

export type TopCategoryStrongestSummary = {
  columnName: string;
  value: string;
  count: number;
  percent: number;
};

export type TopCategoriesSummary = {
  filename: string;
  rowCount: number;
  columnCount: number;
  categoryColumnCount: number;
  usableCategoryColumnCount: number;
  excludedIdentifierCount: number;
  columnsWithoutTopValuesCount: number;
  strongestCategory: TopCategoryStrongestSummary | null;
  categoryColumns: TopCategoryColumnSummary[];
  emptyReason: TopCategoryEmptyReason;
  answer: string;
  deterministicSummary: string;
};

const IDENTIFIER_NAME_PATTERN = /^id$|_id$|code$|_code$|number$|_number$/i;

const isCategoricalColumn = (column: SchemaColumn) =>
  column.inferred_type === "categorical" || column.inferred_type === "boolean";

const isLikelyIdentifier = (column: SchemaColumn, rowCount: number) =>
  (rowCount > 0 && column.unique_count === rowCount) || IDENTIFIER_NAME_PATTERN.test(column.name);

const safePercent = (count: number, rowCount: number) => {
  if (rowCount <= 0) return 0;
  return (count / rowCount) * 100;
};

const formatCount = (value: number) => value.toLocaleString();

const formatPercent = (value: number) =>
  `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;

const summarizeTopValues = (
  topValues: readonly TopValue[],
  rowCount: number,
): TopCategoryValueSummary[] =>
  topValues.slice(0, 5).map((topValue) => ({
    value: topValue.value,
    count: Math.max(0, topValue.count || 0),
    percent: safePercent(Math.max(0, topValue.count || 0), rowCount),
  }));

const summarizeOther = (
  topValues: readonly TopCategoryValueSummary[],
  rowCount: number,
): TopCategoryOtherSummary | null => {
  const topValuesTotal = topValues.reduce((total, topValue) => total + topValue.count, 0);
  const otherCount = rowCount - topValuesTotal;
  if (rowCount <= 0 || otherCount < 0) return null;
  return {
    count: otherCount,
    percent: safePercent(otherCount, rowCount),
  };
};

export const computeTopCategoriesSummary = (
  dataset: DatasetMetadata,
): TopCategoriesSummary => {
  const rowCount = Math.max(0, dataset.row_count || 0);
  const columnCount = Math.max(0, dataset.column_count || dataset.schema.length || 0);
  const categoricalColumns = dataset.schema
    .map((column, originalIndex) => ({ column, originalIndex }))
    .filter(({ column }) => isCategoricalColumn(column));
  const identifierColumns = categoricalColumns.filter(({ column }) =>
    isLikelyIdentifier(column, rowCount),
  );
  const nonIdentifierCategoryColumns = categoricalColumns.filter(
    ({ column }) => !isLikelyIdentifier(column, rowCount),
  );
  const columnsWithoutTopValuesCount = nonIdentifierCategoryColumns.filter(
    ({ column }) => !column.top_values || column.top_values.length === 0,
  ).length;

  const categoryColumns = nonIdentifierCategoryColumns
    .filter(({ column }) => column.top_values && column.top_values.length > 0)
    .map(({ column, originalIndex }) => {
      const topValues = summarizeTopValues(column.top_values || [], rowCount);
      const strongestValue = topValues[0] || { value: "", count: 0, percent: 0 };
      return {
        name: column.name,
        inferredType: column.inferred_type,
        uniqueCount: column.unique_count,
        nullCount: column.null_count,
        topValues,
        other: summarizeOther(topValues, rowCount),
        strongestValue,
        originalIndex,
      };
    })
    .sort((left, right) => {
      if (right.strongestValue.percent !== left.strongestValue.percent) {
        return right.strongestValue.percent - left.strongestValue.percent;
      }
      if (right.strongestValue.count !== left.strongestValue.count) {
        return right.strongestValue.count - left.strongestValue.count;
      }
      if (left.uniqueCount !== right.uniqueCount) return left.uniqueCount - right.uniqueCount;
      return left.originalIndex - right.originalIndex;
    });

  const strongestColumn = categoryColumns[0] || null;
  const strongestCategory = strongestColumn
    ? {
        columnName: strongestColumn.name,
        value: strongestColumn.strongestValue.value,
        count: strongestColumn.strongestValue.count,
        percent: strongestColumn.strongestValue.percent,
      }
    : null;

  const emptyReason: TopCategoryEmptyReason =
    rowCount === 0
      ? "row_count_zero"
      : categoricalColumns.length === 0
        ? "no_categorical_fields"
        : nonIdentifierCategoryColumns.length === 0
          ? "only_identifiers"
          : categoryColumns.length === 0
            ? "top_values_unavailable"
            : "none";

  const answer =
    strongestCategory
      ? `This dataset has ${formatCount(
          categoryColumns.length,
        )} categorical fields with repeated values. The strongest category is ${strongestCategory.value} in ${strongestCategory.columnName}, appearing in ${formatCount(
          strongestCategory.count,
        )} of ${formatCount(rowCount)} rows (${formatPercent(strongestCategory.percent)}).`
      : emptyReason === "only_identifiers"
        ? "The available categorical-looking fields are mostly unique identifiers, so they are not useful for category summaries."
        : emptyReason === "top_values_unavailable"
          ? "Categorical fields were detected, but top-value counts are not available in the current profile."
          : "No categorical fields with repeated values were detected in the available profile.";

  return {
    filename: dataset.original_filename,
    rowCount,
    columnCount,
    categoryColumnCount: categoricalColumns.length,
    usableCategoryColumnCount: categoryColumns.length,
    excludedIdentifierCount: identifierColumns.length,
    columnsWithoutTopValuesCount,
    strongestCategory,
    categoryColumns,
    emptyReason,
    answer,
    deterministicSummary: [
      dataset.original_filename,
      rowCount,
      columnCount,
      categoricalColumns.length,
      categoryColumns.length,
      identifierColumns.length,
      columnsWithoutTopValuesCount,
      emptyReason,
      categoryColumns
        .map((column) =>
          [
            column.name,
            column.strongestValue.value,
            column.strongestValue.count,
            formatPercent(column.strongestValue.percent),
            column.topValues.map((topValue) => `${topValue.value}:${topValue.count}`).join(","),
          ].join(":"),
        )
        .join("|"),
    ].join("::"),
  };
};
