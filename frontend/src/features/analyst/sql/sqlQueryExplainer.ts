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
  fields: ["No columns selected yet."],
  filters: ["No limits on which rows are included yet."],
  grouping: ["No grouping or aggregation detected."],
  sorting: ["No sorting detected.", "No row limit detected."],
  joins: ["No joins detected."],
  outputShape: "No result preview can be described until a query is present.",
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

const stripSqlValueQuotes = (value: string) => {
  const trimmedValue = value.trim();
  const unquotedValue =
    /^'(.*)'$/.exec(trimmedValue)?.[1] ??
    /^"(.*)"$/.exec(trimmedValue)?.[1] ??
    /^`(.*)`$/.exec(trimmedValue)?.[1] ??
    trimmedValue;

  return unquotedValue.replace(/''/g, "'");
};

const isGenericSourceName = (value: string | null) =>
  !value || ["data", "main table", "main_table", "uploaded_dataset"].includes(value.toLowerCase());

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
    ? [...visibleItems, `${items.length - maxItems} more columns`]
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

const resolveSourceLabel = (rawSource: string | null, sourceLabel: string) =>
  isGenericSourceName(rawSource) ? sourceLabel : rawSource || sourceLabel;

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

const formatFieldList = (fields: string[]) => {
  const visibleFields = formatList(fields);
  return visibleFields.length > 0 ? [visibleFields.join(", ")] : ["No selected fields detected."];
};

const describeOperator = (operator: string) => {
  const normalizedOperator = operator.toUpperCase();
  if (normalizedOperator === "=") return "equals";
  if (normalizedOperator === "!=" || normalizedOperator === "<>") return "does not equal";
  if (normalizedOperator === ">") return "is greater than";
  if (normalizedOperator === ">=") return "is greater than or equal to";
  if (normalizedOperator === "<") return "is less than";
  if (normalizedOperator === "<=") return "is less than or equal to";
  if (normalizedOperator === "LIKE") return "matches";
  return operator;
};

const describeSimpleFilter = (whereClause: string) => {
  const betweenMatch = /^("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w.$-]*)\s+BETWEEN\s+(.+?)\s+AND\s+(.+)$/i.exec(
    whereClause,
  );
  if (betweenMatch) {
    return `${stripWrappingQuotes(betweenMatch[1])} is between ${stripSqlValueQuotes(betweenMatch[2])} and ${stripSqlValueQuotes(betweenMatch[3])}`;
  }

  const comparisonMatch = /^("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w.$-]*)\s*(=|!=|<>|>=|<=|>|<|LIKE)\s*(.+)$/i.exec(
    whereClause,
  );
  if (comparisonMatch) {
    return `${stripWrappingQuotes(comparisonMatch[1])} ${describeOperator(comparisonMatch[2])} ${stripSqlValueQuotes(comparisonMatch[3])}`;
  }

  return normalizeWhitespace(whereClause);
};

const describeAggregateField = (field: string) => {
  const aggregateMatch = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\((.*?)\)/i.exec(field);
  if (!aggregateMatch) return null;

  const label = simplifyFieldLabel(field);
  const functionName = aggregateMatch[1].toUpperCase();
  const target = normalizeWhitespace(aggregateMatch[2]) === "*"
    ? "rows"
    : stripWrappingQuotes(simplifyFieldLabel(aggregateMatch[2]));
  const functionDescription: Record<string, string> = {
    COUNT: "a count of",
    SUM: "the total of",
    AVG: "the average of",
    MIN: "the minimum of",
    MAX: "the maximum of",
  };

  return `${label} as ${functionDescription[functionName] || functionName.toLowerCase()} ${target}`;
};

const describeSorting = (orderByClause: string) => {
  if (!orderByClause) return "No sorting detected.";

  const sortDescriptions = splitTopLevel(orderByClause).map((sortExpression) => {
    const directionMatch = /\s+(ASC|DESC)\s*$/i.exec(sortExpression);
    const direction = directionMatch?.[1].toUpperCase();
    const fieldExpression = directionMatch
      ? sortExpression.slice(0, directionMatch.index).trim()
      : sortExpression.trim();
    const field = simplifyFieldLabel(fieldExpression);

    if (direction === "DESC") return `${field} descending`;
    if (direction === "ASC") return `${field} ascending`;
    return field;
  });

  return `Sorted by ${sortDescriptions.join(", ")}.`;
};

const inferIntent = ({
  fields,
  groupByClause,
  whereClause,
  orderByClause,
  source,
  filterDescriptions,
  limitClause,
}: {
  fields: string[];
  groupByClause: string;
  whereClause: string;
  orderByClause: string;
  source: string;
  filterDescriptions: string[];
  limitClause: string;
}) => {
  const aggregateQuery = fields.some(hasAggregate) || Boolean(groupByClause);
  const limitText = limitClause ? ` It will show up to ${limitClause} matching rows.` : "";

  if (aggregateQuery && groupByClause) {
    const groupFields = splitTopLevel(groupByClause).map(simplifyFieldLabel).join(", ");
    return `This query summarizes rows in ${source} by ${groupFields || "group"}.${limitText}`;
  }

  if (aggregateQuery) {
    return `This query calculates summary values from ${source}.${limitText}`;
  }

  if (whereClause) {
    const filterText = filterDescriptions.length > 0
      ? ` and only includes rows where ${filterDescriptions.join("; ")}`
      : "";
    const sortText = orderByClause ? " The matching rows are sorted." : "";
    return `This query looks in ${source}${filterText}.${sortText}${limitText}`;
  }

  if (orderByClause) {
    return `This query looks in ${source}, shows matching rows, and sorts them.${limitText}`;
  }

  return `This query looks in ${source} and shows matching rows.${limitText}`;
};

const inferBusinessMeaning = (
  fields: string[],
  groupByClause: string,
  sourceLabel: string,
  filterDescriptions: string[],
) => {
  const combined = [...fields, groupByClause].join(" ").toLowerCase();
  const sourceText = sourceLabel ? ` from ${sourceLabel}` : "";
  const fieldLabels = fields.map(simplifyFieldLabel);
  const readableFields = fieldLabels.length > 0 ? fieldLabels.join(", ") : "the selected fields";
  const entityIdFilter = filterDescriptions.find((description) =>
    /\b(property_id|property id)\s+equals\s+/i.test(description),
  );

  if (entityIdFilter) {
    const propertyId = entityIdFilter.replace(/^.*\s+equals\s+/i, "");
    return `This query finds property ${propertyId} and shows ${readableFields}.`;
  }

  if (groupByClause && /\bcount\s*\(/i.test(combined)) {
    const groupFields = splitTopLevel(groupByClause).map(simplifyFieldLabel).join(", ");
    return `This query counts rows by ${groupFields || "group"}${sourceText}.`;
  }

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
    return `A summary table with one row per group and ${fields.length || "selected"} result column${fields.length === 1 ? "" : "s"}${limitText}.`;
  }

  if (selectAll) {
    return `A table of matching rows with every available column${limitText}.`;
  }

  return `A table of matching rows with ${fields.length || "selected"} shown column${fields.length === 1 ? "" : "s"}${limitText}.`;
};

const createPlainSummary = ({
  source,
  selectedFields,
  selectAll,
  filterDescriptions,
  groupByClause,
  aggregateFields,
  orderByClause,
  limitClause,
}: {
  source: string;
  selectedFields: string[];
  selectAll: boolean;
  filterDescriptions: string[];
  groupByClause: string;
  aggregateFields: string[];
  orderByClause: string;
  limitClause: string;
}) => {
  const limitText = limitClause ? ` It will show up to ${limitClause} matching rows.` : "";
  const fieldText = selectAll
    ? "all available columns"
    : selectedFields.map(simplifyFieldLabel).join(", ");
  const propertyFilter = filterDescriptions.find((description) =>
    /\b(property_id|property id)\s+equals\s+/i.test(description),
  );

  if (propertyFilter) {
    const propertyId = propertyFilter.replace(/^.*\s+equals\s+/i, "");
    return `This query looks in ${source}, finds the property with ID ${propertyId}, and shows ${fieldText}.${limitText}`;
  }

  if (groupByClause) {
    const groupFields = splitTopLevel(groupByClause).map(simplifyFieldLabel).join(", ");
    const aggregateText = aggregateFields.length > 0 ? ` and shows ${aggregateFields.join(", ")}` : "";
    const sortText = orderByClause ? " The summary is sorted." : "";
    return `This query summarizes rows in ${source} by ${groupFields || "group"}${aggregateText}.${sortText}${limitText}`;
  }

  if (filterDescriptions.length > 0) {
    return `This query looks in ${source}, only includes rows where ${filterDescriptions.join("; ")}, and shows ${fieldText}.${limitText}`;
  }

  return `This query looks in ${source} and shows ${fieldText}.${limitText}`;
};

const getFallbackExplanation = (
  sourceLabel: string,
  sql: string,
  context: ExplainSqlQueryContext,
): SqlQueryExplanation => {
  const positions = findClausePositions(sql);
  const fromClause = getClauseText(sql, positions, "from");
  const source = resolveSourceLabel(getSourceTable(fromClause), sourceLabel);
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
    fields: ["Review the columns being shown before running."],
    filters: [positions.some((position) => position.name === "where") ? "A row filter was detected." : "No simple row filter detected."],
    grouping: [positions.some((position) => position.name === "groupBy") ? "GROUP BY clause detected." : "No simple GROUP BY clause detected."],
    sorting: [
      positions.some((position) => position.name === "orderBy") ? "ORDER BY clause detected." : "No simple ORDER BY clause detected.",
      positions.some((position) => position.name === "limit") ? "LIMIT clause detected." : "No simple LIMIT clause detected.",
    ],
    joins: getJoinDescriptions(sql).length > 0 ? getJoinDescriptions(sql) : ["No simple joins detected."],
    outputShape: "The result cannot be confidently described for this query.",
    businessMeaning: inferBusinessMeaning([], "", context.activeSourceLabel || sourceLabel, []),
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
  const source = resolveSourceLabel(getSourceTable(fromClause), sourceLabel);
  const selectedFields = splitTopLevel(selectClause);
  const selectAll = selectedFields.length === 1 && selectedFields[0] === "*";
  const fieldLabels = selectAll
    ? ["All columns from the selected source."]
    : formatFieldList(selectedFields.map(simplifyFieldLabel));
  const aggregateFields = selectedFields
    .filter(hasAggregate)
    .map((field) => describeAggregateField(field) || simplifyFieldLabel(field));
  const groupFields = splitTopLevel(groupByClause).map(simplifyFieldLabel);
  const joins = getJoinDescriptions(sql);
  const filterDescriptions = [
    whereClause ? describeSimpleFilter(whereClause) : "",
    havingClause ? `grouped results where ${describeSimpleFilter(havingClause)}` : "",
  ].filter(Boolean);
  const sortingItems = [
    describeSorting(orderByClause),
    limitClause ? `Limited to ${limitClause} rows.` : "No row limit detected.",
  ];
  const plainSummary = createPlainSummary({
    source,
    selectedFields,
    selectAll,
    filterDescriptions,
    groupByClause,
    aggregateFields,
    orderByClause,
    limitClause,
  });
  const intent = inferIntent({
    fields: selectedFields,
    groupByClause,
    whereClause,
    orderByClause,
    source,
    filterDescriptions,
    limitClause,
  });

  return {
    title: "What this query does",
    summary: plainSummary,
    intent,
    source,
    fields: fieldLabels,
    filters: [
      filterDescriptions.length > 0 ? filterDescriptions.join("; ") : "All rows can be included.",
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
    businessMeaning: inferBusinessMeaning(
      selectedFields,
      groupByClause,
      context.activeSourceLabel || source,
      filterDescriptions,
    ),
    safetyNote: "This is a read-only explanation. FiltraQueri does not run this SQL until you choose Run Query.",
    isComplex: false,
    fallbackMessage: null,
  };
};
