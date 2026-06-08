import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { AnalysisScopeSelection } from "../../workbook";
import type { SqlTabSourceContext } from "./resolveSqlTabSourceContext";

export type SqlReadinessSeverity = "ready" | "info" | "warning";

export type SqlReadinessIssue = {
  id: string;
  severity: Exclude<SqlReadinessSeverity, "ready">;
  message: string;
};

export type SqlReadinessReport = {
  status: SqlReadinessSeverity;
  summary: string;
  issues: SqlReadinessIssue[];
};

type TableReference = {
  tableName: string;
  alias: string;
  clause: "FROM" | "JOIN";
};

type TableSchemaEntry = {
  displayName: string;
  schema: SchemaColumn[];
  isApplied: boolean;
  isWorkbookTable: boolean;
};

const SQL_KEYWORDS = new Set([
  "cross",
  "full",
  "group",
  "having",
  "inner",
  "join",
  "left",
  "limit",
  "natural",
  "on",
  "order",
  "right",
  "union",
  "where",
]);

const normalizeIdentifier = (value: string) =>
  value
    .trim()
    .replace(/^["`[]|["`\]]$/g, "")
    .split(".")
    .pop()
    ?.toLowerCase() || "";

const displayIdentifier = (value: string) =>
  value.trim().replace(/^["`[]|["`\]]$/g, "");

const maskCommentsAndStrings = (sql: string) => {
  let masked = "";
  let index = 0;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];

    if (current === "-" && next === "-") {
      const end = sql.indexOf("\n", index + 2);
      const stop = end === -1 ? sql.length : end;
      masked += " ".repeat(stop - index);
      index = stop;
      continue;
    }

    if (current === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      const stop = end === -1 ? sql.length : end + 2;
      masked += " ".repeat(stop - index);
      index = stop;
      continue;
    }

    if (current === "'") {
      const start = index;
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2;
          continue;
        }
        if (sql[index] === "'") {
          index += 1;
          break;
        }
        index += 1;
      }
      masked += " ".repeat(index - start);
      continue;
    }

    masked += current;
    index += 1;
  }

  return masked;
};

const hasComplexShape = (sql: string) =>
  /^\s*with\b/i.test(sql) ||
  /\(\s*select\b/i.test(sql) ||
  sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean).length > 1;

const extractCteNames = (sql: string) => {
  const cteNames = new Set<string>();
  if (!/^\s*with\b/i.test(sql)) return cteNames;

  const ctePattern = /(?:\bwith\b|,)\s*([A-Za-z_][\w$]*)\s+(?:\([^)]*\)\s*)?as\s*\(/gi;
  for (const match of sql.matchAll(ctePattern)) {
    cteNames.add(normalizeIdentifier(match[1]));
  }

  return cteNames;
};

const extractTableReferences = (sql: string): TableReference[] => {
  const references: TableReference[] = [];
  const tablePattern =
    /\b(from|join)\s+((?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w.$]*))(?:\s+(?:as\s+)?([A-Za-z_][\w$]*))?/gi;

  for (const match of sql.matchAll(tablePattern)) {
    const clause = match[1].toUpperCase() as "FROM" | "JOIN";
    const tableName = displayIdentifier(match[2]);
    const aliasCandidate = match[3]?.toLowerCase();
    const alias =
      aliasCandidate && !SQL_KEYWORDS.has(aliasCandidate)
        ? aliasCandidate
        : normalizeIdentifier(tableName);

    references.push({ tableName, alias, clause });
  }

  return references;
};

const extractAliasColumnReferences = (sql: string) => {
  const references: Array<{ alias: string; column: string }> = [];
  const aliasColumnPattern =
    /\b([A-Za-z_][\w$]*)\s*\.\s*(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))/g;

  for (const match of sql.matchAll(aliasColumnPattern)) {
    references.push({
      alias: match[1].toLowerCase(),
      column: match[2] || match[3] || match[4] || match[5] || "",
    });
  }

  return references;
};

const getSimpleSelectSegment = (sql: string) => {
  const match = /\bselect\b([\s\S]*?)\bfrom\b/i.exec(sql);
  return match?.[1] || "";
};

const splitSelectItems = (segment: string) => {
  const items: string[] = [];
  let current = "";
  let depth = 0;

  for (const character of segment) {
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      items.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) items.push(current.trim());
  return items;
};

const extractUnqualifiedSelectColumns = (sql: string) => {
  const columns: string[] = [];
  const items = splitSelectItems(getSimpleSelectSegment(sql));

  for (const item of items) {
    if (!item || item === "*" || item.includes(".") || /\bcount\s*\(/i.test(item)) continue;
    const quoted = /^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\])(?:\s+as\s+\w+)?$/i.exec(item);
    if (quoted) {
      columns.push(quoted[1] || quoted[2] || quoted[3]);
      continue;
    }
    const bare = /^([A-Za-z_][\w$]*)(?:\s+as\s+\w+)?$/i.exec(item);
    if (bare && !SQL_KEYWORDS.has(bare[1].toLowerCase())) columns.push(bare[1]);
  }

  return columns;
};

const addTableEntry = (
  tableMap: Map<string, TableSchemaEntry>,
  tableName: string | null | undefined,
  entry: TableSchemaEntry,
) => {
  if (!tableName) return;
  tableMap.set(normalizeIdentifier(tableName), {
    ...entry,
    displayName: tableName,
  });
};

const createTableSchemaMap = (
  dataset: DatasetMetadata | null,
  appliedScopeSelections: AnalysisScopeSelection[],
  activeTabSourceContext: SqlTabSourceContext,
) => {
  const tableMap = new Map<string, TableSchemaEntry>();
  const appliedIds = new Set(appliedScopeSelections.map((selection) => selection.worksheetId));
  const appliedTableNames = new Set(
    appliedScopeSelections.map((selection) => normalizeIdentifier(selection.tableName)),
  );

  for (const worksheet of dataset?.workbook_metadata?.worksheets || []) {
    const baseEntry = {
      displayName: worksheet.tableName,
      schema: worksheet.schema,
      isApplied: appliedIds.has(worksheet.worksheetId),
      isWorkbookTable: true,
    };
    addTableEntry(tableMap, worksheet.tableName, baseEntry);

    const cleanedCopy = dataset?.workbook_metadata?.cleanedWorkingCopies.find(
      (copy) => copy.sourceWorksheetId === worksheet.worksheetId,
    );
    addTableEntry(tableMap, cleanedCopy?.cleanedTableName, baseEntry);
  }

  if (dataset) {
    addTableEntry(tableMap, dataset.table_name, {
      displayName: dataset.table_name,
      schema: dataset.schema,
      isApplied: appliedTableNames.has(normalizeIdentifier(dataset.table_name)),
      isWorkbookTable: Boolean(dataset.workbook_metadata),
    });
  }

  addTableEntry(tableMap, activeTabSourceContext.tableName, {
    displayName: activeTabSourceContext.tableName,
    schema: activeTabSourceContext.schema,
    isApplied:
      appliedTableNames.has(normalizeIdentifier(activeTabSourceContext.tableName)) ||
      appliedIds.has(activeTabSourceContext.worksheetId || ""),
    isWorkbookTable: true,
  });

  return tableMap;
};

const hasColumn = (schema: SchemaColumn[], columnName: string) => {
  const normalizedColumn = normalizeIdentifier(columnName);
  return schema.some((column) => normalizeIdentifier(column.name) === normalizedColumn);
};

const uniqueIssues = (issues: SqlReadinessIssue[]) => {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function analyzeSqlReadiness({
  sqlDraft,
  dataset,
  appliedScopeSelections,
  activeTabSourceContext,
}: {
  sqlDraft: string;
  dataset: DatasetMetadata | null;
  appliedScopeSelections: AnalysisScopeSelection[];
  activeTabSourceContext: SqlTabSourceContext;
}): SqlReadinessReport {
  const trimmedSql = sqlDraft.trim();
  if (!trimmedSql) {
    return {
      status: "info",
      summary: "Write a query before running.",
      issues: [
        {
          id: "empty-sql",
          severity: "info",
          message: "No SQL draft is ready yet.",
        },
      ],
    };
  }

  const maskedSql = maskCommentsAndStrings(trimmedSql);
  const issues: SqlReadinessIssue[] = [];
  const tableMap = createTableSchemaMap(dataset, appliedScopeSelections, activeTabSourceContext);
  const tableReferences = extractTableReferences(maskedSql);
  const cteNames = extractCteNames(maskedSql);
  const workbookTableReferences = tableReferences.filter(
    (reference) => !cteNames.has(normalizeIdentifier(reference.tableName)),
  );
  const aliasMap = new Map<string, TableReference>();
  const localSourceAliases = new Set<string>();
  const appliedTableCount = appliedScopeSelections.length;

  if (hasComplexShape(maskedSql)) {
    issues.push({
      id: "complex-sql",
      severity: "info",
      message: "Complex SQL detected. Review CTEs, nested queries, and joins before running.",
    });
  }

  if (workbookTableReferences.length > 1 && appliedTableCount === 0) {
    issues.push({
      id: "multi-table-without-scope",
      severity: "warning",
      message:
        "This query uses multiple worksheets, but no worksheet scope is applied to this tab.",
    });
  }

  for (const reference of tableReferences) {
    const normalizedTable = normalizeIdentifier(reference.tableName);
    const tableEntry = tableMap.get(normalizedTable);
    aliasMap.set(reference.alias, reference);
    aliasMap.set(normalizedTable, reference);

    if (cteNames.has(normalizedTable)) {
      localSourceAliases.add(reference.alias);
      localSourceAliases.add(normalizedTable);
      continue;
    }

    if (!tableEntry) {
      issues.push({
        id: `unknown-table-${normalizedTable}`,
        severity: "warning",
        message: `This query references ${reference.tableName}, but FiltraQueri could not find that table in the workbook metadata.`,
      });
      continue;
    }

    if (appliedTableCount > 0 && !tableEntry.isApplied) {
      issues.push({
        id: `table-outside-scope-${normalizedTable}`,
        severity: "warning",
        message: `This query references ${reference.tableName}, but that worksheet is not in this tab's applied scope.`,
      });
    }
  }

  const aliasColumnReferences = extractAliasColumnReferences(maskedSql);
  for (const reference of aliasColumnReferences) {
    const tableReference = aliasMap.get(reference.alias);
    if (!tableReference) {
      issues.push({
        id: `unknown-alias-${reference.alias}`,
        severity: "warning",
        message: `Alias ${reference.alias} is used, but FiltraQueri could not find where it was defined.`,
      });
      continue;
    }

    if (localSourceAliases.has(reference.alias)) {
      continue;
    }

    const tableEntry = tableMap.get(normalizeIdentifier(tableReference.tableName));
    if (tableEntry && !hasColumn(tableEntry.schema, reference.column)) {
      issues.push({
        id: `unknown-column-${reference.alias}-${reference.column}`,
        severity: "warning",
        message: `Column ${reference.column} was not found in ${tableReference.tableName}.`,
      });
    }
  }

  const unionSchema = [
    ...activeTabSourceContext.schema,
    ...appliedScopeSelections.flatMap((selection) => {
      const tableEntry = tableMap.get(normalizeIdentifier(selection.tableName));
      return tableEntry?.schema || [];
    }),
  ];
  for (const column of extractUnqualifiedSelectColumns(maskedSql)) {
    if (unionSchema.length > 0 && !hasColumn(unionSchema, column)) {
      issues.push({
        id: `unknown-unqualified-column-${column}`,
        severity: "warning",
        message: `Column ${column} was not found in the selected worksheets.`,
      });
    }
  }

  if (tableReferences.some((reference) => reference.clause === "JOIN")) {
    issues.push({
      id: "join-review",
      severity: "info",
      message: "This query uses joins. Review the join keys before running.",
    });
  }

  if (activeTabSourceContext.mismatchWarning) {
    issues.push({
      id: "source-mismatch",
      severity: "warning",
      message: activeTabSourceContext.mismatchWarning,
    });
  }

  const compactIssues = uniqueIssues(issues);
  const hasWarning = compactIssues.some((issue) => issue.severity === "warning");

  return {
    status: hasWarning ? "warning" : compactIssues.length > 0 ? "info" : "ready",
    summary: hasWarning
      ? "Review these SQL readiness warnings before running."
      : compactIssues.length > 0
        ? "SQL looks runnable, with a few review notes."
        : "SQL looks ready based on this tab's metadata.",
    issues: compactIssues,
  };
}
