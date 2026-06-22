import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { SqlBusinessQuestionShape } from "./sqlBusinessQuestionShape";
import { buildSelectList, formatSqlColumn, formatSqlTable } from "./sqlSchemaHelpers";
import type { SqlTemplateAdaptiveMetadata } from "./sqlTemplateAdaptiveMetadata";

export type SqlTemplateAdaptationStatus =
  | "ready"
  | "blocked_missing_table"
  | "blocked_missing_grouping"
  | "blocked_missing_metric"
  | "blocked_missing_filter"
  | "blocked_missing_sort"
  | "blocked_multi_table"
  | "blocked_relationship_required"
  | "unsupported_template";

export type SqlSingleTableAdaptationRequest = {
  prompt: string;
  questionShape: SqlBusinessQuestionShape;
  selectedTable: {
    worksheetId: string | null;
    worksheetLabel: string;
    tableName: string;
    schema: SchemaColumn[];
  } | null;
  template: {
    id: string;
    title: string;
    adaptiveMetadata?: SqlTemplateAdaptiveMetadata;
  };
  dialect: Extract<SqlDialectId, "duckdb">;
};

export type SqlSingleTableAdaptationResult = {
  status: SqlTemplateAdaptationStatus;
  adaptedTitle: string;
  adaptedDescription: string;
  sql: string | null;
  expectedOutputColumns: string[];
  reasons: string[];
  bindings: {
    tableName?: string;
    groupingColumn?: string;
    metricColumn?: string;
    filterColumn?: string;
    sortColumn?: string;
    filterValue?: string;
  };
  safety: {
    noBackendCall: true;
    noRunQuery: true;
    manualInsertOnly: true;
    singleTableOnly: true;
    noJoins: true;
    noEditorMutationUntilManualInsert: true;
  };
};

const safety = {
  noBackendCall: true,
  noRunQuery: true,
  manualInsertOnly: true,
  singleTableOnly: true,
  noJoins: true,
  noEditorMutationUntilManualInsert: true,
} as const;

const pilotTemplateIds = new Set([
  "count-by-category",
  "sum-by-category",
  "average-by-category",
  "filter-equals",
  "top-n",
  "bottom-n",
]);

const sortableTypes = new Set<SchemaColumn["inferred_type"]>([
  "numeric",
  "date",
  "boolean",
  "categorical",
  "text",
]);

const categoricalTypes = new Set<SchemaColumn["inferred_type"]>(["categorical", "text"]);

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularize = (value: string): string => {
  if (value.endsWith("ies") && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
};

const tokens = (value: string): string[] =>
  normalize(value)
    .split(" ")
    .map(singularize)
    .filter((token) => token.length > 1 && token !== "id");

const unique = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const columnExists = (schema: readonly SchemaColumn[], columnName: string | undefined): boolean =>
  Boolean(columnName && schema.some((column) => normalize(column.name) === normalize(columnName)));

const promptExactlyMatchesColumn = (prompt: string, column: SchemaColumn): boolean => {
  const promptText = normalize(prompt);
  const normalizedColumn = normalize(column.name);
  return promptText.includes(normalizedColumn);
};

const promptTokenMatchesColumn = (prompt: string, column: SchemaColumn): boolean => {
  const promptTokens = new Set(tokens(prompt));
  return tokens(column.name).some((token) => promptTokens.has(token));
};

const exactEvidenceColumns = (
  schema: readonly SchemaColumn[],
  evidence: readonly string[],
  allowed: (column: SchemaColumn) => boolean,
): SchemaColumn[] => {
  const normalizedEvidence = evidence.map(normalize).filter(Boolean);
  return schema.filter((column) => {
    if (!allowed(column)) return false;
    const normalizedColumn = normalize(column.name);
    return normalizedEvidence.some((item) => item === normalizedColumn || item.includes(normalizedColumn));
  });
};

const evidenceColumns = (
  schema: readonly SchemaColumn[],
  evidence: readonly string[],
  allowed: (column: SchemaColumn) => boolean,
): SchemaColumn[] => {
  const normalizedEvidence = evidence.map(normalize).filter(Boolean);
  const evidenceTokens = new Set(evidence.flatMap(tokens));
  return schema.filter((column) => {
    if (!allowed(column)) return false;
    const normalizedColumn = normalize(column.name);
    if (normalizedEvidence.some((item) => item === normalizedColumn || item.includes(normalizedColumn))) {
      return true;
    }
    const columnTokens = tokens(column.name);
    return columnTokens.some((token) => evidenceTokens.has(token));
  });
};

const selectColumn = ({
  schema,
  prompt,
  evidence,
  allowed,
}: {
  schema: readonly SchemaColumn[];
  prompt: string;
  evidence: readonly string[];
  allowed: (column: SchemaColumn) => boolean;
}): SchemaColumn | null => {
  const promptExactMatches = schema.filter((column) => allowed(column) && promptExactlyMatchesColumn(prompt, column));
  if (promptExactMatches.length === 1) return promptExactMatches[0] || null;

  const exactEvidenceMatches = exactEvidenceColumns(schema, evidence, allowed);
  if (exactEvidenceMatches.length === 1) return exactEvidenceMatches[0] || null;

  const promptMatches = schema.filter((column) => allowed(column) && promptTokenMatchesColumn(prompt, column));
  if (promptMatches.length === 1) return promptMatches[0] || null;

  const evidenceMatches = evidenceColumns(schema, evidence, allowed);
  if (evidenceMatches.length === 1) return evidenceMatches[0] || null;

  const fallback = schema.filter(allowed);
  if (fallback.length === 1) return fallback[0] || null;

  return null;
};

const groupingEvidence = (shape: SqlBusinessQuestionShape): string[] =>
  unique([
    shape.groupingEntity?.label || "",
    shape.groupingEntity?.tableName || "",
    ...(shape.groupingEntity?.matchedColumns || []),
    ...shape.filterTerms,
  ]);

const metricEvidence = (shape: SqlBusinessQuestionShape, prompt: string): string[] =>
  unique([
    shape.countedEntity?.label || "",
    shape.countedEntity?.tableName || "",
    ...(shape.countedEntity?.matchedColumns || []),
    shape.metricIntent || "",
    ...tokens(prompt),
  ]);

const filterEvidence = (shape: SqlBusinessQuestionShape): string[] =>
  unique([...shape.filterTerms, ...(shape.groupingEntity?.matchedColumns || [])]);

const clearLiteralValueFromPrompt = (prompt: string): string | null => {
  const quoted = prompt.match(/["']([^"']{1,80})["']/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const equals = prompt.match(/\b(?:equals?|is|=)\s+([a-z0-9][a-z0-9 _-]{0,60})\b/i);
  if (!equals?.[1]) return null;

  const value = equals[1]
    .replace(/\b(?:by|grouped|group|count|sum|average|avg|top|bottom|limit)\b.*$/i, "")
    .trim();
  return value || null;
};

const metadataAllowsSingleTable = (metadata: SqlTemplateAdaptiveMetadata | undefined): boolean =>
  Boolean(
    metadata &&
      metadata.relationshipMode === "single_table" &&
      metadata.safety.requiresAcceptedRelationships === false,
  );

const createResult = (
  request: SqlSingleTableAdaptationRequest,
  overrides: Omit<SqlSingleTableAdaptationResult, "safety">,
): SqlSingleTableAdaptationResult => ({
  ...overrides,
  adaptedTitle: overrides.adaptedTitle || request.template.title,
  adaptedDescription: overrides.adaptedDescription,
  safety,
});

const blocked = (
  request: SqlSingleTableAdaptationRequest,
  status: Exclude<SqlTemplateAdaptationStatus, "ready">,
  reason: string,
  bindings: SqlSingleTableAdaptationResult["bindings"] = {},
): SqlSingleTableAdaptationResult =>
  createResult(request, {
    status,
    adaptedTitle: request.template.title,
    adaptedDescription: "FiltraQueri needs clearer single-table evidence before adapting this template.",
    sql: null,
    expectedOutputColumns: [],
    reasons: [reason],
    bindings,
  });

const escapeLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const assertSchemaBacked = (
  schema: readonly SchemaColumn[],
  columns: readonly string[],
): boolean => columns.every((column) => columnExists(schema, column));

const hasJoin = (sql: string): boolean => /\bjoin\b/i.test(sql);

const ready = (
  request: SqlSingleTableAdaptationRequest,
  args: {
    title: string;
    description: string;
    sql: string;
    expectedOutputColumns: string[];
    bindings: SqlSingleTableAdaptationResult["bindings"];
    reasons: string[];
  },
): SqlSingleTableAdaptationResult => {
  const schema = request.selectedTable?.schema || [];
  const emittedColumns = [
    args.bindings.groupingColumn,
    args.bindings.metricColumn,
    args.bindings.filterColumn,
    args.bindings.sortColumn,
  ].filter((value): value is string => Boolean(value));
  const tableReference = request.selectedTable ? formatSqlTable(request.selectedTable.tableName) : "";
  if (
    !request.selectedTable ||
    !assertSchemaBacked(schema, emittedColumns) ||
    hasJoin(args.sql) ||
    (tableReference && !args.sql.includes(`FROM ${tableReference}`))
  ) {
    return blocked(request, "unsupported_template", "Adapted SQL failed the single-table safety check.", args.bindings);
  }

  return createResult(request, {
    status: "ready",
    adaptedTitle: args.title,
    adaptedDescription: args.description,
    sql: args.sql,
    expectedOutputColumns: args.expectedOutputColumns,
    reasons: args.reasons,
    bindings: args.bindings,
  });
};

const tableLooksMultiEntity = (
  request: SqlSingleTableAdaptationRequest,
): boolean => {
  const tableName = normalize(request.selectedTable?.tableName || "");
  const schema = request.selectedTable?.schema || [];
  return request.questionShape.mentionedEntities.some((entity) => {
    if (normalize(entity.tableName) === tableName) return false;
    return !entity.matchedColumns.some((column) => columnExists(schema, column));
  });
};

const preflight = (
  request: SqlSingleTableAdaptationRequest,
): SqlSingleTableAdaptationResult | null => {
  if (!pilotTemplateIds.has(request.template.id)) {
    return blocked(request, "unsupported_template", "This template is not in the single-table adaptation pilot.");
  }

  if (!metadataAllowsSingleTable(request.template.adaptiveMetadata)) {
    return blocked(request, "unsupported_template", "Template metadata is not safe for single-table adaptation.");
  }

  if (
    request.questionShape.preferredOutputShape === "blocked_relationship_plan" ||
    request.questionShape.relationshipDependent ||
    request.questionShape.relationshipGaps.length > 0
  ) {
    return blocked(
      request,
      "blocked_relationship_required",
      "This question needs worksheet relationships, so single-table adaptation is blocked.",
    );
  }

  if (!request.selectedTable || !request.selectedTable.tableName.trim() || request.selectedTable.schema.length === 0) {
    return blocked(request, "blocked_missing_table", "No single worksheet table with schema was supplied.");
  }

  if (tableLooksMultiEntity(request)) {
    return blocked(request, "blocked_multi_table", "The question appears to need more than the selected table.");
  }

  return null;
};

export function adaptSingleTableTemplate(
  request: SqlSingleTableAdaptationRequest,
): SqlSingleTableAdaptationResult {
  const preflightResult = preflight(request);
  if (preflightResult) return preflightResult;

  const table = request.selectedTable!;
  const tableSql = formatSqlTable(table.tableName);
  const selectList = buildSelectList(table.schema.map((column) => column.name).slice(0, 5));
  const grouping = selectColumn({
    schema: table.schema,
    prompt: request.prompt,
    evidence: groupingEvidence(request.questionShape),
    allowed: (column) => categoricalTypes.has(column.inferred_type),
  });
  const numericMetric = selectColumn({
    schema: table.schema,
    prompt: request.prompt,
    evidence: metricEvidence(request.questionShape, request.prompt),
    allowed: (column) => column.inferred_type === "numeric",
  });
  const sortable = selectColumn({
    schema: table.schema,
    prompt: request.prompt,
    evidence: metricEvidence(request.questionShape, request.prompt),
    allowed: (column) => sortableTypes.has(column.inferred_type),
  });

  if (request.template.id === "count-by-category") {
    if (!grouping) {
      return blocked(request, "blocked_missing_grouping", "No clear grouping column was found.");
    }
    const groupingSql = formatSqlColumn(grouping.name);
    return ready(request, {
      title: `Count records by ${grouping.name}`,
      description: `Adapted count-by-category for ${table.worksheetLabel}.`,
      sql: [
        "SELECT",
        `  ${groupingSql},`,
        `  COUNT(*) AS ${formatSqlColumn("row_count")}`,
        `FROM ${tableSql}`,
        `GROUP BY ${groupingSql}`,
        `ORDER BY ${formatSqlColumn("row_count")} DESC`,
        "LIMIT 100;",
      ].join("\n"),
      expectedOutputColumns: [grouping.name, "row_count"],
      bindings: { tableName: table.tableName, groupingColumn: grouping.name },
      reasons: ["A single grouping column was found in the selected worksheet."],
    });
  }

  if (request.template.id === "sum-by-category" || request.template.id === "average-by-category") {
    if (!grouping) {
      return blocked(request, "blocked_missing_grouping", "No clear grouping column was found.");
    }
    if (!numericMetric) {
      return blocked(request, "blocked_missing_metric", "No clear numeric metric column was found.", {
        tableName: table.tableName,
        groupingColumn: grouping.name,
      });
    }
    const isAverage = request.template.id === "average-by-category";
    const metricSql = formatSqlColumn(numericMetric.name);
    const groupingSql = formatSqlColumn(grouping.name);
    const alias = isAverage ? "average_value" : "total_value";
    const aggregate = isAverage ? "AVG" : "SUM";
    return ready(request, {
      title: `${isAverage ? "Average" : "Total"} ${numericMetric.name} by ${grouping.name}`,
      description: `Adapted ${request.template.id} for ${table.worksheetLabel}.`,
      sql: [
        "SELECT",
        `  ${groupingSql},`,
        `  ${aggregate}(${metricSql}) AS ${formatSqlColumn(alias)}`,
        `FROM ${tableSql}`,
        `GROUP BY ${groupingSql}`,
        `ORDER BY ${formatSqlColumn(alias)} DESC`,
        "LIMIT 100;",
      ].join("\n"),
      expectedOutputColumns: [grouping.name, alias],
      bindings: {
        tableName: table.tableName,
        groupingColumn: grouping.name,
        metricColumn: numericMetric.name,
      },
      reasons: ["A grouping column and numeric metric column were found in the selected worksheet."],
    });
  }

  if (request.template.id === "filter-equals") {
    const filterColumn = selectColumn({
      schema: table.schema,
      prompt: request.prompt,
      evidence: filterEvidence(request.questionShape),
      allowed: (column) => categoricalTypes.has(column.inferred_type) || column.inferred_type === "boolean",
    });
    const filterValue = clearLiteralValueFromPrompt(request.prompt);
    if (!filterColumn || !filterValue) {
      return blocked(request, "blocked_missing_filter", "No clear filter column and literal value were found.");
    }
    return ready(request, {
      title: `Filter ${table.worksheetLabel} by ${filterColumn.name}`,
      description: `Adapted filter-equals for ${table.worksheetLabel}.`,
      sql: [
        "SELECT",
        `  ${selectList}`,
        `FROM ${tableSql}`,
        `WHERE ${formatSqlColumn(filterColumn.name)} = ${escapeLiteral(filterValue)}`,
        "LIMIT 100;",
      ].join("\n"),
      expectedOutputColumns: table.schema.slice(0, 5).map((column) => column.name),
      bindings: {
        tableName: table.tableName,
        filterColumn: filterColumn.name,
        filterValue,
      },
      reasons: ["A filter column and explicit prompt value were found."],
    });
  }

  if (request.template.id === "top-n" || request.template.id === "bottom-n") {
    if (!sortable) {
      return blocked(request, "blocked_missing_sort", "No clear sortable column was found.");
    }
    const direction = request.template.id === "top-n" ? "DESC" : "ASC";
    return ready(request, {
      title: `${request.template.id === "top-n" ? "Top" : "Bottom"} ${table.worksheetLabel} by ${sortable.name}`,
      description: `Adapted ${request.template.id} for ${table.worksheetLabel}.`,
      sql: [
        "SELECT",
        `  ${selectList}`,
        `FROM ${tableSql}`,
        `ORDER BY ${formatSqlColumn(sortable.name)} ${direction}`,
        "LIMIT 10;",
      ].join("\n"),
      expectedOutputColumns: table.schema.slice(0, 5).map((column) => column.name),
      bindings: {
        tableName: table.tableName,
        sortColumn: sortable.name,
      },
      reasons: ["A sortable column was found in the selected worksheet."],
    });
  }

  return blocked(request, "unsupported_template", "This template is not supported by the adapter.");
}
