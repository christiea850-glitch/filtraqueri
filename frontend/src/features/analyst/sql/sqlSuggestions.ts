import type { DatasetMetadata } from "../../dataset/datasetTypes";
import {
  buildSampleValueHint,
  buildSelectList,
  formatSqlColumn,
  formatSqlTable,
  getCategoricalColumns,
  getDateColumns,
  getNumericColumns,
  getPrimaryDisplayColumns,
  getSortableColumns,
} from "./sqlSchemaHelpers";
import type { SqlSuggestion, SqlTemplate } from "./sqlTypes";

export const sqlKeywordSuggestions = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "LIMIT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "CASE WHEN",
];

export const createSqlTemplates = (dataset: DatasetMetadata): SqlTemplate[] => {
  const tableName = formatSqlTable(dataset.table_name);
  const displayColumns = getPrimaryDisplayColumns(dataset);
  const numericColumn = getNumericColumns(dataset.schema)[0];
  const categoricalColumn = getCategoricalColumns(dataset.schema)[0] || dataset.schema[0];
  const dateColumn = getDateColumns(dataset.schema)[0];
  const sortableColumn = getSortableColumns(dataset.schema)[0] || dataset.schema[0];

  const templates: SqlTemplate[] = [
    {
      id: "select-preview",
      label: "SELECT preview",
      description: "Inspect the first records with visible columns.",
      category: "select",
      sql: `SELECT
  ${buildSelectList(displayColumns)}
FROM ${tableName}
LIMIT 100;`,
    },
    {
      id: "count-rows",
      label: "COUNT rows",
      description: "Count all rows in the active dataset.",
      category: "aggregate",
      sql: `SELECT
  COUNT(*) AS row_count
FROM ${tableName};`,
    },
  ];

  if (categoricalColumn) {
    templates.push({
      id: "group-by-category",
      label: "GROUP BY category",
      description: `Group rows by ${categoricalColumn.name}.`,
      category: "aggregate",
      sql: `SELECT
  ${formatSqlColumn(categoricalColumn.name)},
  COUNT(*) AS row_count
FROM ${tableName}
GROUP BY ${formatSqlColumn(categoricalColumn.name)}
ORDER BY row_count DESC
LIMIT 100;`,
    });
  }

  if (numericColumn) {
    templates.push({
      id: "numeric-summary",
      label: "Numeric summary",
      description: `Summarize ${numericColumn.name}.`,
      category: "aggregate",
      sql: `SELECT
  MIN(${formatSqlColumn(numericColumn.name)}) AS min_value,
  AVG(${formatSqlColumn(numericColumn.name)}) AS avg_value,
  MAX(${formatSqlColumn(numericColumn.name)}) AS max_value
FROM ${tableName};`,
    });
  }

  if (categoricalColumn) {
    templates.push({
      id: "where-sample",
      label: "WHERE sample",
      description: `Filter on ${categoricalColumn.name}.`,
      category: "filter",
      sql: `SELECT
  ${buildSelectList(displayColumns)}
FROM ${tableName}
WHERE ${formatSqlColumn(categoricalColumn.name)} = ${buildSampleValueHint(categoricalColumn)}
LIMIT 100;`,
    });
  }

  if (dateColumn) {
    templates.push({
      id: "where-date",
      label: "Date range",
      description: `Filter using ${dateColumn.name}.`,
      category: "filter",
      sql: `SELECT
  ${buildSelectList(displayColumns)}
FROM ${tableName}
WHERE ${formatSqlColumn(dateColumn.name)} >= DATE '2024-01-01'
ORDER BY ${formatSqlColumn(dateColumn.name)} DESC
LIMIT 100;`,
    });
  }

  if (sortableColumn) {
    templates.push({
      id: "order-by",
      label: "ORDER BY",
      description: `Sort by ${sortableColumn.name}.`,
      category: "sort",
      sql: `SELECT
  ${buildSelectList(displayColumns)}
FROM ${tableName}
ORDER BY ${formatSqlColumn(sortableColumn.name)} DESC
LIMIT 100;`,
    });
  }

  return templates;
};

export const createColumnSuggestions = (dataset: DatasetMetadata): SqlSuggestion[] =>
  dataset.schema.slice(0, 12).map((column) => ({
    id: `column-${column.name}`,
    label: column.name,
    description: column.inferred_type,
    sql: formatSqlColumn(column.name),
  }));
