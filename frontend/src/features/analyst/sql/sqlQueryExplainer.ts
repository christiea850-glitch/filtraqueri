import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { SqlQueryExplanation } from "./sqlTypes";

type ExplainSqlQueryContext = {
  dataset: DatasetMetadata | null;
  activeSourceLabel?: string | null;
  selectedDialect?: SqlDialectId;
};

type ClauseName = "select" | "from" | "where" | "groupBy" | "having" | "orderBy" | "limit";

const fallbackMessage =
  "FiltraQueri can identify the main table and SQL clauses, but this query is complex. Review before running.";

const emptyExplanation = (sourceLabel: string): SqlQueryExplanation => ({
  title: "No query to explain",
  summary: "Write or insert a SELECT query to see a plain-English explanation here.",
  intent: "No SQL draft is currently selected.",
  source: sourceLabel,
  fields: ["No selected fields detected yet."],
  filters: ["No filters detected."],
  grouping: ["No grouping or aggregation detected."],
  sorting: ["No sorting detected.", "No row limit detected."],
  joins: ["No joins detected."],
  outputShape: "No output shape can be inferred until a query is present.",
  businessMeaning: "This area will describe the current query without running it.",
  safetyNote: "Run Query remains manual. This explanation does not execute SQL.",
  isComplex: false,
  fallbackMessage: null,
});

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const stripWrappingQuotes = (value: string) =>
  value
    .trim()
    .replace(/^"(.+)"$/, "$1")
    .replace(/^`(.+)`$/, "$1")
    .replace(/^\[(.+)\]$/, "$1");

const maskSqlLiterals = (sql: string) => {
  let masked = "";
  let quote: "'" | '"' | "`" | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (quote) {
      masked += " ";
      if (char === quote) {
        if (quote === "'" && next === "'") {
          masked += " ";
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      masked += " ";
      continue;
    }

    masked += char;
  }

  return masked;
};

const removeSqlComments = (sql: string) =>
  sql
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");

const splitTopLevel = (value: string) => {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (quote) {
      current += char;
      if (char === quote) {
        if (quote === "'" && next === "'") {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      const part = current.trim();
      if (part) parts.push(part);
      current = "";
      continue;
    }

    current += char;
  }

  const lastPart = current.trim();
  if (lastPart) parts.push(lastPart);
  return parts;
};

const formatList = (items: string[], maxItems = 6) => {
  if (items.length === 0) return [];
  const visibleItems = items.slice(0, maxItems);
  return items.length > maxItems
    ? [...visibleItems, `${items.length - maxItems} more fields`]
    : visibleItems;
};

const findClausePositions = (sql: string) => {
  const masked = maskSqlLiterals(sql);
  const patterns: Array<{ name: ClauseName; pattern: RegExp }> = [
    { name: "select", pattern: /\bSELECT\b/i },
    { name: "from", pattern: /\bFROM\b/i },
    { name: "where", pattern: /\bWHERE\b/i },
    { name: "groupBy", pattern: /\bGROUP\s+BY\b/i },
    { name: "having", pattern: /\bHAVING\b/i },
    { name: "orderBy", pattern: /\bORDER\s+BY\b/i },
    { name: "limit", pattern: /\bLIMIT\b/i },
  ];

  return patterns
    .map(({ name, pattern }) => {
      const match = pattern.exec(masked);
      return match
        ? {
            name,
            start: match.index,
            end: match.index + match[0].length,
          }
        : null;
    })
    .filter((clause): clause is { name: ClauseName; start: number; end: number } =>
      Boolean(clause),
    )
    .sort((left, right) => left.start - right.start);
};

const getClauseText = (
  sql: string,
  positions: Array<{ name: ClauseName; start: number; end: number }>,
  name: ClauseName,
) => {
  const clause = positions.find((position) => position.name === name);
  if (!clause) return "";

  const nextClause = positions.find((position) => position.start > clause.start);
  return normalizeWhitespace(sql.slice(clause.end, nextClause?.start ?? sql.length).replace(/;+\s*$/, ""));
};

const getSourceTable = (fromClause: string) => {
  const sourceMatch = /^("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w.$-]*)/i.exec(fromClause);
  return sourceMatch ? stripWrappingQuotes(sourceMatch[1]) : null;
};

const getJoinDescriptions = (sql: string) => {
  const maskedSql = maskSqlLiterals(sql);
  const joins = [...maskedSql.matchAll(/\b((?:INNER|LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?JOIN|JOIN)\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w.$-]*)/gi)];
  return joins.map((match) => {
    const joinType = normalizeWhitespace(match[1]).toUpperCase();
    const tableName = stripWrappingQuotes(match[2]);
    return `${joinType} ${tableName}`;
  });
};

const hasAggregate = (value: string) => /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(value);

const simplifyFieldLabel = (field: string) => {
  const aliasMatch = /\bAS\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)\s*$/i.exec(field);
  if (aliasMatch) return stripWrappingQuotes(aliasMatch[1]);

  const dottedMatch = /(?:^|\.)("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)\s*$/.exec(field);
  return dottedMatch ? stripWrappingQuotes(dottedMatch[1]) : normalizeWhitespace(field);
};

const inferIntent = ({
  fields,
  groupByClause,
  whereClause,
  orderByClause,
}: {
  fields: string[];
  groupByClause: string;
  whereClause: string;
  orderByClause: string;
}) => {
  const aggregateQuery = fields.some(hasAggregate) || Boolean(groupByClause);
  if (aggregateQuery && groupByClause) {
    return "Summarizes records into grouped results so you can compare categories or segments.";
  }

  if (aggregateQuery) {
    return "Calculates summary values across the selected source.";
  }

  if (whereClause && orderByClause) {
    return "Filters records from the selected source, then sorts the matching rows.";
  }

  if (whereClause) {
    return "Filters records from the selected source and returns the matching rows.";
  }

  return "Reads records from the selected source and prepares a table-style result.";
};

const inferBusinessMeaning = (fields: string[], groupByClause: string, sourceLabel: string) => {
  const combined = [...fields, groupByClause].join(" ").toLowerCase();
  const sourceText = sourceLabel ? ` from ${sourceLabel}` : "";

  if (/\b(revenue|sales|amount|cost|price|profit|margin|invoice|payment)\b/.test(combined)) {
    return `This may support financial or transaction review${sourceText}.`;
  }

  if (/\b(date|month|year|week|created|updated|time)\b/.test(combined)) {
    return `This may support time-based trend review${sourceText}.`;
  }

  if (/\b(status|category|type|segment|region|department|customer|vendor)\b/.test(combined)) {
    return `This may help compare operational categories or segments${sourceText}.`;
  }

  return "This query prepares a table-style result from the selected source.";
};

const inferOutputShape = ({
  fields,
  selectAll,
  groupByClause,
  limitClause,
}: {
  fields: string[];
  selectAll: boolean;
  groupByClause: string;
  limitClause: string;
}) => {
  const limitText = limitClause ? ` capped at ${limitClause} rows` : "";

  if (groupByClause) {
    return `One row per group with ${fields.length || "selected"} result column${fields.length === 1 ? "" : "s"}${limitText}.`;
  }

  if (selectAll) {
    return `A row-level table with every available column${limitText}.`;
  }

  return `A row-level table with ${fields.length || "selected"} selected field${fields.length === 1 ? "" : "s"}${limitText}.`;
};

const getFallbackExplanation = (
  sourceLabel: string,
  sql: string,
  context: ExplainSqlQueryContext,
): SqlQueryExplanation => {
  const positions = findClausePositions(sql);
  const fromClause = getClauseText(sql, positions, "from");
  const source = getSourceTable(fromClause) || sourceLabel;
  const clauseNames = positions.map((position) =>
    position.name === "groupBy" ? "GROUP BY" : position.name === "orderBy" ? "ORDER BY" : position.name.toUpperCase(),
  );

  return {
    title: "Complex query detected",
    summary: fallbackMessage,
    intent: clauseNames.length > 0
      ? `Detected SQL clauses: ${Array.from(new Set(clauseNames)).join(", ")}.`
      : "The query could not be confidently broken into simple clauses.",
    source,
    fields: ["Review the SELECT list before running."],
    filters: [positions.some((position) => position.name === "where") ? "WHERE clause detected." : "No simple WHERE clause detected."],
    grouping: [positions.some((position) => position.name === "groupBy") ? "GROUP BY clause detected." : "No simple GROUP BY clause detected."],
    sorting: [
      positions.some((position) => position.name === "orderBy") ? "ORDER BY clause detected." : "No simple ORDER BY clause detected.",
      positions.some((position) => position.name === "limit") ? "LIMIT clause detected." : "No simple LIMIT clause detected.",
    ],
    joins: getJoinDescriptions(sql).length > 0 ? getJoinDescriptions(sql) : ["No simple joins detected."],
    outputShape: "Output shape is not confidently inferred for this query.",
    businessMeaning: inferBusinessMeaning([], "", context.activeSourceLabel || sourceLabel),
    safetyNote: "This explanation is deterministic and does not run SQL. Review before choosing Run Query.",
    isComplex: true,
    fallbackMessage,
  };
};

export const explainSqlQuery = (
  sqlDraft: string,
  context: ExplainSqlQueryContext,
): SqlQueryExplanation => {
  const sourceLabel =
    context.activeSourceLabel ||
    context.dataset?.workbook_metadata?.worksheets.find(
      (worksheet) => worksheet.worksheetId === context.dataset?.workbook_metadata?.activeWorksheetId,
    )?.displayName ||
    context.dataset?.table_name ||
    "No active source";
  const sql = removeSqlComments(sqlDraft).trim();

  if (!sql) return emptyExplanation(sourceLabel);

  const statementCount = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean).length;
  const masked = maskSqlLiterals(sql);
  const isComplex =
    statementCount > 1 ||
    /\bWITH\b/i.test(masked) ||
    /\b(UNION|INTERSECT|EXCEPT)\b/i.test(masked) ||
    /\(\s*SELECT\b/i.test(masked) ||
    [...masked.matchAll(/\bSELECT\b/gi)].length !== 1;

  if (isComplex) return getFallbackExplanation(sourceLabel, sql, context);

  const positions = findClausePositions(sql);
  const hasSelect = positions.some((position) => position.name === "select");
  const hasFrom = positions.some((position) => position.name === "from");

  if (!hasSelect || !hasFrom) return getFallbackExplanation(sourceLabel, sql, context);

  const selectClause = getClauseText(sql, positions, "select");
  const fromClause = getClauseText(sql, positions, "from");
  const whereClause = getClauseText(sql, positions, "where");
  const groupByClause = getClauseText(sql, positions, "groupBy");
  const havingClause = getClauseText(sql, positions, "having");
  const orderByClause = getClauseText(sql, positions, "orderBy");
  const limitClause = getClauseText(sql, positions, "limit").match(/\d+/)?.[0] || "";
  const source = getSourceTable(fromClause) || sourceLabel;
  const selectedFields = splitTopLevel(selectClause);
  const selectAll = selectedFields.length === 1 && selectedFields[0] === "*";
  const fieldLabels = selectAll
    ? ["All columns from the selected source."]
    : formatList(selectedFields.map(simplifyFieldLabel));
  const aggregateFields = selectedFields.filter(hasAggregate).map(simplifyFieldLabel);
  const groupFields = splitTopLevel(groupByClause).map(simplifyFieldLabel);
  const joins = getJoinDescriptions(sql);
  const sortingItems = [
    orderByClause ? `Sorted by ${normalizeWhitespace(orderByClause)}.` : "No sorting detected.",
    limitClause ? `Limited to ${limitClause} rows.` : "No row limit detected.",
  ];

  return {
    title: "What this query does",
    summary: inferIntent({
      fields: selectedFields,
      groupByClause,
      whereClause,
      orderByClause,
    }),
    intent: inferIntent({
      fields: selectedFields,
      groupByClause,
      whereClause,
      orderByClause,
    }),
    source,
    fields: fieldLabels,
    filters: [
      whereClause ? `Keeps rows where ${whereClause}.` : "No row filters detected.",
      havingClause ? `Filters grouped results where ${havingClause}.` : "",
    ].filter(Boolean),
    grouping: [
      groupByClause ? `Groups by ${groupFields.join(", ")}.` : "No grouping detected.",
      aggregateFields.length > 0 ? `Calculates ${aggregateFields.join(", ")}.` : "No aggregate calculations detected.",
    ],
    sorting: sortingItems,
    joins: joins.length > 0 ? joins : ["No joins detected."],
    outputShape: inferOutputShape({
      fields: selectedFields,
      selectAll,
      groupByClause,
      limitClause,
    }),
    businessMeaning: inferBusinessMeaning(selectedFields, groupByClause, context.activeSourceLabel || source),
    safetyNote: "This is a read-only explanation. FiltraQueri does not run this SQL until you choose Run Query.",
    isComplex: false,
    fallbackMessage: null,
  };
};
