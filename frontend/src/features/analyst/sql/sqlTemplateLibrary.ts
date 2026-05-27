import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
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

export type SqlTemplateCategory =
  | "Preview and counts"
  | "Filtering"
  | "Aggregation"
  | "Sorting and limits"
  | "Date/time"
  | "Data quality"
  | "Joins"
  | "Advanced SQL"
  | "Dialect examples";

export type SqlAssistantFutureDialectId = "postgresql" | "mysql" | "sqlserver" | "sqlite";

export type SqlAssistantTemplate = {
  id: string;
  title: string;
  category: SqlTemplateCategory;
  explanation: string;
  dialectLabel: string;
  sql: string;
  dialects?: Array<SqlDialectId | SqlAssistantFutureDialectId>;
};

export type SqlAssistantGenerationInput = {
  dataset: DatasetMetadata | null;
  selectedDialect: SqlDialectId;
  requestText?: string;
};

export type SqlAssistantGenerationContext = {
  requestText: string;
  normalizedRequest: string;
  selectedDialect: SqlDialectId;
  rawTableName: string;
  tableName: string;
  schema: SchemaColumn[];
  columnNames: string[];
  displayColumns: string[];
  numericColumns: SchemaColumn[];
  categoricalColumns: SchemaColumn[];
  dateColumns: SchemaColumn[];
};

const fallbackColumn = "column_name";
const fallbackTable = "other_table";

const normalizeRequestText = (requestText = "") =>
  requestText.trim().replace(/\s+/g, " ").toLowerCase();

export const createSqlAssistantGenerationContext = ({
  dataset,
  selectedDialect,
  requestText = "",
}: SqlAssistantGenerationInput): SqlAssistantGenerationContext => {
  const schema = dataset?.schema || [];

  return {
    requestText,
    normalizedRequest: normalizeRequestText(requestText),
    selectedDialect,
    rawTableName: dataset?.table_name || "uploaded_dataset",
    tableName: formatSqlTable(dataset?.table_name || "uploaded_dataset"),
    schema,
    columnNames: schema.map((column) => column.name),
    displayColumns: dataset ? getPrimaryDisplayColumns(dataset) : [],
    numericColumns: getNumericColumns(schema),
    categoricalColumns: getCategoricalColumns(schema),
    dateColumns: getDateColumns(schema),
  };
};

const quoteSampleValues = (column: SchemaColumn | undefined) => {
  if (!column) return "'value_1', 'value_2'";

  const values = column.sample_values
    .filter((sampleValue) => sampleValue !== null && sampleValue !== undefined)
    .slice(0, 2);

  if (values.length === 0) return "'value_1', 'value_2'";

  return values.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(", ");
};

const sampleValueExpression = (column?: SchemaColumn | null) =>
  column ? buildSampleValueHint(column) : "'value'";

const placeholderColumn = (column?: SchemaColumn | null) =>
  column ? formatSqlColumn(column.name) : formatSqlColumn(fallbackColumn);

const labelColumn = (column?: SchemaColumn | null) => column?.name || fallbackColumn;

const createDatePartExpression = (
  dialect: SqlDialectId,
  dateColumnExpression: string,
  part: "year" | "month",
) => {
  if (dialect === "mariadb") {
    return part === "year"
      ? `YEAR(${dateColumnExpression})`
      : `DATE_FORMAT(${dateColumnExpression}, '%Y-%m')`;
  }

  if (dialect === "oracle") {
    return part === "year"
      ? `EXTRACT(YEAR FROM ${dateColumnExpression})`
      : `TO_CHAR(${dateColumnExpression}, 'YYYY-MM')`;
  }

  return part === "year"
    ? `EXTRACT(YEAR FROM ${dateColumnExpression})`
    : `DATE_TRUNC('month', ${dateColumnExpression})`;
};

export const createSqlAssistantTemplates = (
  dataset: DatasetMetadata | null,
  selectedDialect: SqlDialectId,
): SqlAssistantTemplate[] => {
  const generationContext = createSqlAssistantGenerationContext({ dataset, selectedDialect });
  const {
    tableName,
    schema,
    displayColumns,
    numericColumns,
    categoricalColumns,
    dateColumns,
  } = generationContext;
  const selectList = buildSelectList(displayColumns);
  const numericColumn = numericColumns[0];
  const categoryColumn = categoricalColumns[0] || schema[0] || null;
  const dateColumn = dateColumns[0];
  const sortableColumn = getSortableColumns(schema)[0] || numericColumn || schema[0] || null;
  const numericExpression = placeholderColumn(numericColumn);
  const categoryExpression = placeholderColumn(categoryColumn);
  const dateExpression = placeholderColumn(dateColumn);
  const sortableExpression = placeholderColumn(sortableColumn);
  const yearExpression = createDatePartExpression(selectedDialect, dateExpression, "year");
  const monthExpression = createDatePartExpression(selectedDialect, dateExpression, "month");

  return [
    {
      id: "preview-select",
      title: "Preview selected columns",
      category: "Preview and counts",
      explanation: "Inspect a small sample of rows before writing a larger query.",
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
LIMIT 100;`,
    },
    {
      id: "count-rows",
      title: "Count rows",
      category: "Preview and counts",
      explanation: "Count all rows in the active dataset.",
      dialectLabel: "All dialects",
      sql: `SELECT
  COUNT(*) AS row_count
FROM ${tableName};`,
    },
    {
      id: "filter-equals",
      title: "Filter equals",
      category: "Filtering",
      explanation: `Filter records where ${labelColumn(categoryColumn)} matches one value.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
WHERE ${categoryExpression} = ${sampleValueExpression(categoryColumn || schema[0])}
LIMIT 100;`,
    },
    {
      id: "filter-contains",
      title: "Contains text",
      category: "Filtering",
      explanation: `Search text inside ${labelColumn(categoryColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
WHERE ${categoryExpression} LIKE '%search_text%'
LIMIT 100;`,
    },
    {
      id: "filter-greater-than",
      title: "Numeric greater than",
      category: "Filtering",
      explanation: `Filter records where ${labelColumn(numericColumn)} is above a threshold.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
WHERE ${numericExpression} > 0
LIMIT 100;`,
    },
    {
      id: "filter-between",
      title: "Between range",
      category: "Filtering",
      explanation: `Filter ${labelColumn(numericColumn)} between two values.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
WHERE ${numericExpression} BETWEEN 0 AND 100
LIMIT 100;`,
    },
    {
      id: "filter-in-list",
      title: "IN list",
      category: "Filtering",
      explanation: `Keep records where ${labelColumn(categoryColumn)} is in a short list.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
WHERE ${categoryExpression} IN (${quoteSampleValues(categoryColumn || undefined)})
LIMIT 100;`,
    },
    {
      id: "filter-null",
      title: "IS NULL / IS NOT NULL",
      category: "Filtering",
      explanation: `Check missing or present values in ${labelColumn(categoryColumn || numericColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
WHERE ${placeholderColumn(categoryColumn || numericColumn)} IS NOT NULL
LIMIT 100;`,
    },
    {
      id: "count-by-category",
      title: "Count by category",
      category: "Aggregation",
      explanation: `Count records grouped by ${labelColumn(categoryColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${categoryExpression},
  COUNT(*) AS row_count
FROM ${tableName}
GROUP BY ${categoryExpression}
ORDER BY row_count DESC
LIMIT 100;`,
    },
    {
      id: "sum-by-category",
      title: "Sum by category",
      category: "Aggregation",
      explanation: `Sum ${labelColumn(numericColumn)} by ${labelColumn(categoryColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${categoryExpression},
  SUM(${numericExpression}) AS total_value
FROM ${tableName}
GROUP BY ${categoryExpression}
ORDER BY total_value DESC
LIMIT 100;`,
    },
    {
      id: "average-by-category",
      title: "Average by category",
      category: "Aggregation",
      explanation: `Average ${labelColumn(numericColumn)} by ${labelColumn(categoryColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${categoryExpression},
  AVG(${numericExpression}) AS average_value
FROM ${tableName}
GROUP BY ${categoryExpression}
ORDER BY average_value DESC
LIMIT 100;`,
    },
    {
      id: "min-max-summary",
      title: "Min / max summary",
      category: "Aggregation",
      explanation: `Summarize the range of ${labelColumn(numericColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  MIN(${numericExpression}) AS min_value,
  AVG(${numericExpression}) AS average_value,
  MAX(${numericExpression}) AS max_value
FROM ${tableName};`,
    },
    {
      id: "having-example",
      title: "HAVING threshold",
      category: "Aggregation",
      explanation: "Filter grouped results after aggregation.",
      dialectLabel: "All dialects",
      sql: `SELECT
  ${categoryExpression},
  COUNT(*) AS row_count
FROM ${tableName}
GROUP BY ${categoryExpression}
HAVING COUNT(*) > 1
ORDER BY row_count DESC;`,
    },
    {
      id: "top-n",
      title: "Top N by metric",
      category: "Sorting and limits",
      explanation: `Find rows with the highest ${labelColumn(sortableColumn || numericColumn)} values.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
ORDER BY ${sortableExpression} DESC
LIMIT 10;`,
    },
    {
      id: "bottom-n",
      title: "Bottom N by metric",
      category: "Sorting and limits",
      explanation: `Find rows with the lowest ${labelColumn(sortableColumn || numericColumn)} values.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
ORDER BY ${sortableExpression} ASC
LIMIT 10;`,
    },
    {
      id: "date-range",
      title: "Date range",
      category: "Date/time",
      explanation: `Filter records using ${labelColumn(dateColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
WHERE ${dateExpression} >= DATE '2024-01-01'
  AND ${dateExpression} < DATE '2025-01-01'
ORDER BY ${dateExpression} ASC
LIMIT 100;`,
    },
    {
      id: "group-by-year",
      title: "Group by year",
      category: "Date/time",
      explanation: `Summarize records by year from ${labelColumn(dateColumn)}.`,
      dialectLabel: selectedDialect.toUpperCase(),
      dialects: [selectedDialect],
      sql: `SELECT
  ${yearExpression} AS record_year,
  COUNT(*) AS row_count
FROM ${tableName}
GROUP BY record_year
ORDER BY record_year;`,
    },
    {
      id: "group-by-month",
      title: "Group by month",
      category: "Date/time",
      explanation: `Summarize records by month from ${labelColumn(dateColumn)}.`,
      dialectLabel: selectedDialect.toUpperCase(),
      dialects: [selectedDialect],
      sql: `SELECT
  ${monthExpression} AS record_month,
  COUNT(*) AS row_count
FROM ${tableName}
GROUP BY record_month
ORDER BY record_month;`,
    },
    {
      id: "missing-values",
      title: "Missing values by column",
      category: "Data quality",
      explanation: `Count missing values in ${labelColumn(categoryColumn || numericColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  COUNT(*) AS row_count,
  SUM(CASE WHEN ${placeholderColumn(categoryColumn || numericColumn)} IS NULL THEN 1 ELSE 0 END) AS missing_count
FROM ${tableName};`,
    },
    {
      id: "duplicates",
      title: "Duplicate check",
      category: "Data quality",
      explanation: `Find repeated values in ${labelColumn(categoryColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${categoryExpression},
  COUNT(*) AS duplicate_count
FROM ${tableName}
GROUP BY ${categoryExpression}
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 100;`,
    },
    {
      id: "distinct-values",
      title: "Distinct values",
      category: "Data quality",
      explanation: `List distinct values from ${labelColumn(categoryColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT DISTINCT
  ${categoryExpression}
FROM ${tableName}
WHERE ${categoryExpression} IS NOT NULL
ORDER BY ${categoryExpression}
LIMIT 100;`,
    },
    {
      id: "inner-join",
      title: "INNER JOIN",
      category: "Joins",
      explanation: "Template for matching rows between two tables.",
      dialectLabel: "All dialects",
      sql: `SELECT
  a.*,
  b.${formatSqlColumn(fallbackColumn)}
FROM ${tableName} AS a
INNER JOIN ${formatSqlTable(fallbackTable)} AS b
  ON a.${formatSqlColumn(fallbackColumn)} = b.${formatSqlColumn(fallbackColumn)}
LIMIT 100;`,
    },
    {
      id: "left-join",
      title: "LEFT JOIN",
      category: "Joins",
      explanation: "Keep all rows from the active dataset and matching rows from another table.",
      dialectLabel: "All dialects",
      sql: `SELECT
  a.*,
  b.${formatSqlColumn(fallbackColumn)}
FROM ${tableName} AS a
LEFT JOIN ${formatSqlTable(fallbackTable)} AS b
  ON a.${formatSqlColumn(fallbackColumn)} = b.${formatSqlColumn(fallbackColumn)}
LIMIT 100;`,
    },
    {
      id: "right-join",
      title: "RIGHT JOIN",
      category: "Joins",
      explanation: "Keep all rows from the joined table and matching rows from the active dataset.",
      dialectLabel: "DuckDB, MariaDB, Oracle",
      dialects: ["duckdb", "mariadb", "oracle"],
      sql: `SELECT
  a.*,
  b.${formatSqlColumn(fallbackColumn)}
FROM ${tableName} AS a
RIGHT JOIN ${formatSqlTable(fallbackTable)} AS b
  ON a.${formatSqlColumn(fallbackColumn)} = b.${formatSqlColumn(fallbackColumn)}
LIMIT 100;`,
    },
    {
      id: "full-outer-join",
      title: "FULL OUTER JOIN",
      category: "Joins",
      explanation: "Keep unmatched rows from both joined tables. Review dialect support before running.",
      dialectLabel: "Dialect-specific",
      dialects: ["duckdb", "oracle", "postgresql"],
      sql: `SELECT
  a.*,
  b.${formatSqlColumn(fallbackColumn)}
FROM ${tableName} AS a
FULL OUTER JOIN ${formatSqlTable(fallbackTable)} AS b
  ON a.${formatSqlColumn(fallbackColumn)} = b.${formatSqlColumn(fallbackColumn)}
LIMIT 100;`,
    },
    {
      id: "cte",
      title: "CTE",
      category: "Advanced SQL",
      explanation: "Use a named query block before the final SELECT.",
      dialectLabel: "All dialects",
      sql: `WITH grouped_records AS (
  SELECT
    ${categoryExpression},
    COUNT(*) AS row_count
  FROM ${tableName}
  GROUP BY ${categoryExpression}
)
SELECT *
FROM grouped_records
ORDER BY row_count DESC
LIMIT 100;`,
    },
    {
      id: "subquery",
      title: "Subquery",
      category: "Advanced SQL",
      explanation: "Filter records using a nested SELECT.",
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList}
FROM ${tableName}
WHERE ${numericExpression} > (
  SELECT AVG(${numericExpression})
  FROM ${tableName}
)
LIMIT 100;`,
    },
    {
      id: "case-when",
      title: "CASE WHEN",
      category: "Advanced SQL",
      explanation: `Create a conditional label from ${labelColumn(numericColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList},
  CASE
    WHEN ${numericExpression} >= 100 THEN 'high'
    WHEN ${numericExpression} >= 50 THEN 'medium'
    ELSE 'low'
  END AS value_band
FROM ${tableName}
LIMIT 100;`,
    },
    {
      id: "row-number",
      title: "ROW_NUMBER",
      category: "Advanced SQL",
      explanation: `Rank rows inside each ${labelColumn(categoryColumn)} group.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList},
  ROW_NUMBER() OVER (
    PARTITION BY ${categoryExpression}
    ORDER BY ${numericExpression} DESC
  ) AS row_rank
FROM ${tableName}
LIMIT 100;`,
    },
    {
      id: "rank-window",
      title: "RANK window function",
      category: "Advanced SQL",
      explanation: `Rank ${labelColumn(numericColumn)} values within ${labelColumn(categoryColumn)} groups.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${selectList},
  RANK() OVER (
    PARTITION BY ${categoryExpression}
    ORDER BY ${numericExpression} DESC
  ) AS metric_rank
FROM ${tableName}
LIMIT 100;`,
    },
    {
      id: "moving-average",
      title: "Moving average",
      category: "Advanced SQL",
      explanation: `Calculate a rolling average of ${labelColumn(numericColumn)} over ${labelColumn(dateColumn)}.`,
      dialectLabel: "All dialects",
      sql: `SELECT
  ${dateExpression},
  ${numericExpression},
  AVG(${numericExpression}) OVER (
    ORDER BY ${dateExpression}
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS moving_average
FROM ${tableName}
ORDER BY ${dateExpression};`,
    },
    {
      id: "duckdb-date-trunc",
      title: "DuckDB month summary",
      category: "Dialect examples",
      explanation: "DuckDB-style month grouping with DATE_TRUNC.",
      dialectLabel: "DuckDB",
      dialects: ["duckdb"],
      sql: `SELECT
  DATE_TRUNC('month', ${dateExpression}) AS record_month,
  AVG(${numericExpression}) AS average_value
FROM ${tableName}
GROUP BY record_month
ORDER BY record_month;`,
    },
    {
      id: "mariadb-limit",
      title: "MariaDB LIMIT",
      category: "Dialect examples",
      explanation: "MariaDB-style top records query.",
      dialectLabel: "MariaDB",
      dialects: ["mariadb"],
      sql: `SELECT
  ${selectList}
FROM ${tableName}
ORDER BY ${numericExpression} DESC
LIMIT 10;`,
    },
    {
      id: "oracle-fetch",
      title: "Oracle FETCH FIRST",
      category: "Dialect examples",
      explanation: "Oracle-style row limiting with FETCH FIRST.",
      dialectLabel: "Oracle",
      dialects: ["oracle"],
      sql: `SELECT
  ${selectList}
FROM ${tableName}
ORDER BY ${numericExpression} DESC
FETCH FIRST 10 ROWS ONLY;`,
    },
    {
      id: "postgresql-filtered-aggregate",
      title: "PostgreSQL FILTER aggregate",
      category: "Dialect examples",
      explanation: "PostgreSQL-style filtered aggregate. Review dialect support before running.",
      dialectLabel: "PostgreSQL example",
      dialects: ["postgresql"],
      sql: `SELECT
  COUNT(*) AS row_count,
  COUNT(*) FILTER (WHERE ${categoryExpression} IS NULL) AS missing_count
FROM ${tableName};`,
    },
    {
      id: "dialect-conversion-note",
      title: "Dialect conversion note",
      category: "Dialect examples",
      explanation: "Use this comment block to mark SQL that needs dialect review before running.",
      dialectLabel: "All dialects",
      sql: `-- Dialect review note:
-- Source dialect: ${selectedDialect.toUpperCase()}
-- Check date functions, identifier quoting, row limits, and join support before running.
SELECT
  ${selectList}
FROM ${tableName}
LIMIT 100;`,
    },
  ];
};
