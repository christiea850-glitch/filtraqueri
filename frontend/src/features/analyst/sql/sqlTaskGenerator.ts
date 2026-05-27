import type { SchemaColumn } from "../../dataset/datasetTypes";
import {
  buildSelectList,
  formatSqlColumn,
} from "./sqlSchemaHelpers";
import {
  createSqlAssistantGenerationContext,
  type SqlAssistantGenerationInput,
} from "./sqlTemplateLibrary";

export type SqlTaskGenerationResult = {
  id: string;
  title: string;
  taskLabel: string;
  explanation: string;
  fieldsUsed: string[];
  logicUsed: string[];
  warnings: string[];
  sql: string;
};

const numericWords: Record<string, string[]> = {
  streams: ["stream", "streams", "plays", "listens"],
  revenue: ["revenue", "sales", "amount", "total", "money"],
  charges: ["charge", "charges", "monthly", "total"],
  yield: ["yield", "milk"],
  temperature: ["temperature", "temp"],
  risk: ["risk", "score", "health"],
  quantity: ["quantity", "qty", "count"],
};

const categoryWords: Record<string, string[]> = {
  artist: ["artist", "artists", "singer", "performer"],
  track: ["track", "tracks", "song", "songs", "title"],
  product: ["product", "products", "item", "items"],
  region: ["region", "country", "state", "city", "location"],
  customer: ["customer", "customers", "segment", "segments"],
  breed: ["breed", "breeds", "cattle"],
  contract: ["contract", "contracts"],
  service: ["service", "services", "internet", "phone"],
  department: ["department", "unit", "team"],
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9.\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularize = (value: string) => value.replace(/s\b/g, "");

const columnSearchText = (column: SchemaColumn) =>
  `${normalizeText(column.name)} ${singularize(normalizeText(column.name))}`;

const includesAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

const requestMentionsColumn = (request: string, column: SchemaColumn) => {
  const columnText = columnSearchText(column);
  return columnText
    .split(" ")
    .filter((part) => part.length > 2)
    .some((part) => request.includes(part));
};

const scoreColumn = (
  request: string,
  column: SchemaColumn,
  semanticWords: Record<string, string[]>,
) => {
  const columnText = columnSearchText(column);
  let score = requestMentionsColumn(request, column) ? 6 : 0;

  Object.values(semanticWords).forEach((words) => {
    if (includesAny(request, words) && includesAny(columnText, words)) score += 8;
  });

  if (column.unique_count > 0 && column.unique_count <= 100) score += 1;
  if (/\bid\b|uuid|guid|hash/.test(columnText)) score -= 4;
  return score;
};

const pickColumn = (
  request: string,
  columns: SchemaColumn[],
  semanticWords: Record<string, string[]>,
) =>
  [...columns].sort(
    (left, right) =>
      scoreColumn(request, right, semanticWords) - scoreColumn(request, left, semanticWords),
  )[0] || null;

const pickCategoryColumn = (request: string, columns: SchemaColumn[]) =>
  pickColumn(request, columns, categoryWords);

const pickMetricColumn = (request: string, columns: SchemaColumn[]) =>
  pickColumn(request, columns, numericWords);

const pickDateColumn = (request: string, columns: SchemaColumn[], allColumns: SchemaColumn[]) =>
  pickColumn(request, [...columns, ...allColumns.filter((column) => /year|month|date|time/i.test(column.name))], {
    date: ["date", "time", "year", "month", "released", "release"],
  });

const aliasFrom = (prefix: string, column: SchemaColumn | null) =>
  `${prefix}_${(column?.name || "value")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;

const getLimit = (request: string, fallback = 10) => {
  const topMatch = request.match(/\b(?:top|first|limit)\s+(\d{1,4})\b/);
  if (!topMatch) return fallback;
  return Math.min(500, Math.max(1, Number(topMatch[1])));
};

const parseHumanNumber = (value: string, unit = "") => {
  const numericValue = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numericValue)) return null;
  if (/billion|bn|b\b/.test(unit)) return numericValue * 1_000_000_000;
  if (/million|mn|m\b/.test(unit)) return numericValue * 1_000_000;
  if (/thousand|k\b/.test(unit)) return numericValue * 1_000;
  return numericValue;
};

const findThreshold = (request: string, words: string[]) => {
  const thresholdPattern =
    /(?:more than|greater than|above|over|at least)\s+([\d,.]+)\s*(billion|million|thousand|bn|mn|[bmk])?/;
  const matches = [...request.matchAll(new RegExp(thresholdPattern, "g"))];

  for (const match of matches) {
    const beforeMatch = request.slice(Math.max(0, match.index ? match.index - 28 : 0), match.index);
    const afterMatch = request.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 28);
    if (includesAny(`${beforeMatch} ${afterMatch}`, words)) {
      return parseHumanNumber(match[1], match[2] || "");
    }
  }

  return null;
};

const formatThreshold = (value: number) => Number.isInteger(value) ? String(value) : String(value);

const createMissingValueSql = (columns: SchemaColumn[], tableName: string) => {
  const inspectedColumns = columns.slice(0, 8);
  const expressions = inspectedColumns.map(
    (column) =>
      `SUM(CASE WHEN ${formatSqlColumn(column.name)} IS NULL THEN 1 ELSE 0 END) AS ${aliasFrom("missing", column)}`,
  );

  return `SELECT
  ${expressions.join(",\n  ")}
FROM ${tableName};`;
};

const safeSelectColumns = (
  displayColumns: string[],
  fallbackColumns: SchemaColumn[],
  requiredColumns: Array<SchemaColumn | null>,
) => {
  const orderedColumns = [
    ...requiredColumns.map((column) => column?.name).filter(Boolean),
    ...displayColumns,
    ...fallbackColumns.map((column) => column.name),
  ] as string[];

  return [...new Set(orderedColumns)].slice(0, 6);
};

export const generateSqlTaskDraft = ({
  dataset,
  selectedDialect,
  requestText = "",
}: SqlAssistantGenerationInput): SqlTaskGenerationResult => {
  const context = createSqlAssistantGenerationContext({ dataset, selectedDialect, requestText });
  const request = context.normalizedRequest;
  const warnings: string[] = [];
  const logicUsed: string[] = [];
  const fieldSet = new Set<string>();
  const addField = (column: SchemaColumn | null) => {
    if (column) fieldSet.add(column.name);
  };

  if (!dataset || context.schema.length === 0) {
    warnings.push("No active schema was available, so placeholder SQL was generated.");
    return {
      id: "preview-placeholder",
      title: "Preview rows",
      taskLabel: "Preview rows",
      explanation: "Creates a safe starter query because no active dataset schema is available.",
      fieldsUsed: [],
      logicUsed: ["SELECT", "LIMIT"],
      warnings,
      sql: `SELECT *
FROM ${context.tableName}
LIMIT 100;`,
    };
  }

  if (selectedDialect !== "duckdb") {
    warnings.push("Generated SQL is DuckDB-safe by default. Review dialect-specific syntax before running.");
  }

  const categoryColumn = pickCategoryColumn(request, context.categoricalColumns) || context.categoricalColumns[0] || context.schema[0];
  const metricColumn = pickMetricColumn(request, context.numericColumns) || context.numericColumns[0] || null;
  const dateColumn = pickDateColumn(request, context.dateColumns, context.schema);
  const trackColumn =
    pickCategoryColumn("track song title", context.categoricalColumns) ||
    context.categoricalColumns.find((column) => /track|song|title/i.test(column.name)) ||
    categoryColumn;
  const limit = getLimit(request);
  const requestedAverage = /\b(avg|average|mean)\b/.test(request);
  const requestedCount = /\b(count|how many|number of|most common|appears|records?)\b/.test(request);
  const requestedSum = /\b(sum|total|combined)\b/.test(request) || (!requestedAverage && Boolean(metricColumn));
  const wantsRank = /\b(rank|ranking|row number|window)\b/.test(request);
  const wantsDuplicates = /\bduplicate|duplicates|repeated\b/.test(request);
  const wantsMissing = /\bmissing|null|blank|empty\b/.test(request);
  const wantsDate = /\btrend|over time|by year|by month|release year|year|month|date\b/.test(request);
  const wantsAfter = /\bafter|since|newer than\b/.test(request);
  const wantsBefore = /\bbefore|older than\b/.test(request);
  const wantsHaving = /\bmore than|greater than|above|over|at least|having\b/.test(request);

  if (wantsMissing) {
    const mentionedColumns = context.schema.filter((column) => requestMentionsColumn(request, column));
    const columnsForMissing =
      mentionedColumns.length > 0
        ? mentionedColumns
        : [
            ...context.categoricalColumns.slice(0, 2),
            ...context.numericColumns.slice(0, 1),
            ...context.dateColumns.slice(0, 1),
          ];
    const uniqueColumns = [...new Map(columnsForMissing.map((column) => [column.name, column])).values()];
    uniqueColumns.forEach(addField);
    logicUsed.push("CASE WHEN", "SUM", "missing-value counts");

    return {
      id: "missing-values",
      title: "Missing values by column",
      taskLabel: "Show missing values",
      explanation: "Counts missing values in likely relevant columns from the active dataset.",
      fieldsUsed: [...fieldSet],
      logicUsed,
      warnings,
      sql: createMissingValueSql(uniqueColumns.length > 0 ? uniqueColumns : context.schema.slice(0, 5), context.tableName),
    };
  }

  if (wantsDuplicates) {
    const duplicateColumn = request.includes("track") || request.includes("song") ? trackColumn : categoryColumn;
    addField(duplicateColumn);
    logicUsed.push("GROUP BY", "COUNT", "HAVING", "ORDER BY");

    return {
      id: "duplicate-records",
      title: "Find duplicate records",
      taskLabel: "Find duplicate records",
      explanation: `Groups by ${duplicateColumn.name} and returns values that appear more than once.`,
      fieldsUsed: [...fieldSet],
      logicUsed,
      warnings,
      sql: `SELECT
  ${formatSqlColumn(duplicateColumn.name)},
  COUNT(*) AS duplicate_count
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(duplicateColumn.name)}
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;`,
    };
  }

  if (wantsRank && metricColumn) {
    const rankColumn = request.includes("track") || request.includes("song") ? trackColumn : categoryColumn;
    addField(rankColumn);
    addField(metricColumn);
    logicUsed.push("RANK window function", "ORDER BY");

    return {
      id: "rank-by-metric",
      title: "Rank records by metric",
      taskLabel: "Rank records by metric",
      explanation: `Ranks ${rankColumn.name} values by ${metricColumn.name} using a window function.`,
      fieldsUsed: [...fieldSet],
      logicUsed,
      warnings,
      sql: `SELECT
  ${formatSqlColumn(rankColumn.name)},
  ${formatSqlColumn(metricColumn.name)},
  RANK() OVER (
    ORDER BY ${formatSqlColumn(metricColumn.name)} DESC
  ) AS metric_rank
FROM ${context.tableName}
ORDER BY metric_rank
LIMIT ${limit};`,
    };
  }

  if ((wantsAfter || wantsBefore) && dateColumn) {
    const yearMatch = request.match(/\b(19|20)\d{2}\b/);
    const comparisonValue = yearMatch?.[0] || "2020";
    const operator = wantsBefore ? "<" : ">";
    const selectColumns = safeSelectColumns(context.displayColumns, context.schema, [trackColumn, categoryColumn, dateColumn, metricColumn]);
    addField(dateColumn);
    addField(trackColumn);
    addField(metricColumn);
    logicUsed.push("WHERE", "ORDER BY", "LIMIT");

    return {
      id: "filter-by-date",
      title: "Filter rows by date or year",
      taskLabel: "Filter rows by date or year",
      explanation: `Returns rows where ${dateColumn.name} is ${wantsBefore ? "before" : "after"} ${comparisonValue}.`,
      fieldsUsed: [...fieldSet],
      logicUsed,
      warnings,
      sql: `SELECT
  ${buildSelectList(selectColumns)}
FROM ${context.tableName}
WHERE ${formatSqlColumn(dateColumn.name)} ${operator} ${comparisonValue}
ORDER BY ${formatSqlColumn(dateColumn.name)} DESC
LIMIT 100;`,
    };
  }

  if (wantsDate && dateColumn && metricColumn) {
    addField(dateColumn);
    addField(metricColumn);
    logicUsed.push(requestedAverage ? "AVG" : "SUM", "GROUP BY", "ORDER BY");
    const aggregate = requestedAverage ? "AVG" : "SUM";
    const alias = requestedAverage ? aliasFrom("average", metricColumn) : aliasFrom("total", metricColumn);

    return {
      id: "date-metric-summary",
      title: requestedAverage ? "Average metric by date" : "Total metric by date",
      taskLabel: "Summarize metric by date field",
      explanation: `Summarizes ${metricColumn.name} by ${dateColumn.name}.`,
      fieldsUsed: [...fieldSet],
      logicUsed,
      warnings,
      sql: `SELECT
  ${formatSqlColumn(dateColumn.name)},
  ${aggregate}(${formatSqlColumn(metricColumn.name)}) AS ${alias}
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(dateColumn.name)}
ORDER BY ${formatSqlColumn(dateColumn.name)};`,
    };
  }

  if ((/\btop|highest|best|compare|by\b/.test(request) || wantsHaving || requestedAverage || requestedSum || requestedCount) && categoryColumn) {
    const aggregateColumns: string[] = [];
    const havingClauses: string[] = [];
    addField(categoryColumn);

    const countThreshold = findThreshold(request, ["song", "songs", "track", "tracks", "record", "records", "count"]);
    if (requestedCount || wantsHaving || countThreshold !== null) {
      const countAlias = includesAny(request, ["song", "songs", "track", "tracks"]) ? "song_count" : "row_count";
      aggregateColumns.push(`COUNT(*) AS ${countAlias}`);
      if (countThreshold !== null) havingClauses.push(`COUNT(*) > ${formatThreshold(countThreshold)}`);
      logicUsed.push("COUNT");
    }

    if (metricColumn) {
      addField(metricColumn);
      const aggregate = requestedAverage ? "AVG" : "SUM";
      const alias = requestedAverage ? aliasFrom("average", metricColumn) : aliasFrom("total", metricColumn);
      aggregateColumns.push(`${aggregate}(${formatSqlColumn(metricColumn.name)}) AS ${alias}`);
      logicUsed.push(aggregate);

      if (wantsHaving) {
        const metricThreshold = findThreshold(request, [
          ...normalizeText(metricColumn.name).split(" "),
          "stream",
          "streams",
          "total",
          "metric",
          "value",
        ]);
        if (metricThreshold !== null) {
          havingClauses.push(`${aggregate}(${formatSqlColumn(metricColumn.name)}) > ${formatThreshold(metricThreshold)}`);
        }
      }
    }

    if (aggregateColumns.length === 0) aggregateColumns.push("COUNT(*) AS row_count");
    logicUsed.push("GROUP BY", "ORDER BY");
    if (havingClauses.length > 0) logicUsed.push("HAVING");
    const orderAlias = aggregateColumns[aggregateColumns.length - 1].match(/\bAS\s+([a-zA-Z0-9_]+)/)?.[1] || "row_count";

    return {
      id: havingClauses.length > 0 ? "grouped-threshold-summary" : "category-summary",
      title: havingClauses.length > 0 ? "Grouped summary with thresholds" : "Summary by category",
      taskLabel: havingClauses.length > 0 ? "Group records with thresholds" : "Summarize by category",
      explanation:
        havingClauses.length > 0
          ? `Groups by ${categoryColumn.name}, calculates requested metrics, and keeps groups that meet the thresholds.`
          : `Groups by ${categoryColumn.name} and orders by the selected metric.`,
      fieldsUsed: [...fieldSet],
      logicUsed: [...new Set(logicUsed)],
      warnings,
      sql: `SELECT
  ${formatSqlColumn(categoryColumn.name)},
  ${aggregateColumns.join(",\n  ")}
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(categoryColumn.name)}${
        havingClauses.length > 0 ? `\nHAVING ${havingClauses.join("\n   AND ")}` : ""
      }
ORDER BY ${orderAlias} DESC${havingClauses.length > 0 ? "" : `\nLIMIT ${limit}`};`,
    };
  }

  const selectColumns = safeSelectColumns(context.displayColumns, context.schema, [categoryColumn, metricColumn, dateColumn]);
  selectColumns.forEach((name) => fieldSet.add(name));
  logicUsed.push("SELECT", "LIMIT");
  warnings.push("The request was broad, so a safe row preview was generated.");

  return {
    id: "safe-preview",
    title: "Safe row preview",
    taskLabel: "Preview rows",
    explanation: "Creates a compact SELECT query because the request was broad.",
    fieldsUsed: [...fieldSet],
    logicUsed,
    warnings,
    sql: `SELECT
  ${buildSelectList(selectColumns)}
FROM ${context.tableName}
LIMIT 100;`,
  };
};
