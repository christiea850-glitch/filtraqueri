import type {
  AIColumnSensitivityClassification,
  AIColumnSensitivityLevel,
  AIColumnSummary,
  AIMetadataContextPayload,
  AIWorksheetTableSummary,
} from "./llmGovernanceTypes";
import type {
  AISqlSafetyIssue,
  AISqlSafetyReferencedColumn,
  AISqlSafetyReferencedTable,
  AISqlSafetyStatus,
  AISqlSafetyTrustedColumn,
  AISqlSafetyTrustedMetadata,
  AISqlSafetyValidationInput,
  AISqlSafetyValidationResult,
} from "./llmSqlSafetyTypes";

type TrustedColumnRecord = {
  tableName: string;
  column: AIColumnSummary;
};

type TrustedMetadataIndex = {
  tableNames: Set<string>;
  tablesByName: Map<string, AIWorksheetTableSummary>;
  columnsByTable: Map<string, Map<string, AIColumnSummary>>;
};

const BLOCKED_KEYWORD_PATTERNS: Array<{ keyword: string; pattern: RegExp }> = [
  { keyword: "DROP", pattern: /\bdrop\b/i },
  { keyword: "DELETE", pattern: /\bdelete\b/i },
  { keyword: "UPDATE", pattern: /\bupdate\b/i },
  { keyword: "INSERT", pattern: /\binsert\b/i },
  { keyword: "ALTER", pattern: /\balter\b/i },
  { keyword: "TRUNCATE", pattern: /\btruncate\b/i },
  { keyword: "CREATE TABLE", pattern: /\bcreate\s+(?:or\s+replace\s+)?(?:temporary\s+|temp\s+)?table\b/i },
  { keyword: "CREATE VIEW", pattern: /\bcreate\s+(?:or\s+replace\s+)?(?:temporary\s+|temp\s+)?view\b/i },
  { keyword: "REPLACE", pattern: /\breplace\b/i },
  { keyword: "COPY", pattern: /\bcopy\b/i },
  { keyword: "EXPORT", pattern: /\bexport\b/i },
  { keyword: "ATTACH", pattern: /\battach\b/i },
  { keyword: "DETACH", pattern: /\bdetach\b/i },
  { keyword: "INSTALL", pattern: /\binstall\b/i },
  { keyword: "LOAD", pattern: /\bload\b/i },
  { keyword: "PRAGMA", pattern: /\bpragma\b/i },
  { keyword: "CALL", pattern: /\bcall\b/i },
  { keyword: "EXECUTE", pattern: /\bexecute\b/i },
];

const BLOCKED_ACCESS_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "file read/write", pattern: /\bread_csv|read_json|read_parquet|read_text|read_blob|read_xlsx|write_csv|write_json|write_parquet\b/i },
  { label: "file URI", pattern: /\b(file|s3|http|https):\/\//i },
  { label: "absolute file path", pattern: /(?:[a-z]:\\|\/(?:tmp|var|etc|home|users)\b)/i },
  { label: "shell/system access", pattern: /\b(shell|system|cmd|powershell|xp_cmdshell)\s*\(/i },
];

const SQL_CLAUSE_KEYWORDS = new Set([
  "select",
  "from",
  "join",
  "left",
  "right",
  "full",
  "inner",
  "outer",
  "cross",
  "on",
  "where",
  "group",
  "by",
  "order",
  "having",
  "limit",
  "offset",
  "case",
  "when",
  "then",
  "else",
  "end",
  "as",
  "and",
  "or",
  "not",
  "null",
  "is",
  "in",
  "like",
  "between",
  "over",
  "partition",
  "distinct",
  "with",
  "union",
  "all",
  "asc",
  "desc",
  "false",
  "true",
]);

const SQL_FUNCTION_NAMES = new Set([
  "avg",
  "cast",
  "coalesce",
  "count",
  "date",
  "date_trunc",
  "day",
  "extract",
  "hour",
  "lower",
  "max",
  "min",
  "month",
  "nullif",
  "round",
  "strftime",
  "sum",
  "trim",
  "upper",
  "year",
]);

const normalizeIdentifier = (value: string): string =>
  value
    .replace(/^[`"\[]|[`"\]]$/g, "")
    .trim()
    .toLowerCase();

const unquoteIdentifier = (value: string): string =>
  value.replace(/^[`"\[]|[`"\]]$/g, "").trim();

const normalizeSqlPreview = (sqlText: string): string =>
  sqlText.replace(/\s+/g, " ").trim().slice(0, 240);

const maskSqlLiteralsAndComments = (sqlText: string): string => {
  let masked = "";
  let index = 0;

  while (index < sqlText.length) {
    const char = sqlText[index];
    const next = sqlText[index + 1];

    if (char === "-" && next === "-") {
      while (index < sqlText.length && sqlText[index] !== "\n") {
        masked += " ";
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      masked += "  ";
      index += 2;
      while (index < sqlText.length && !(sqlText[index] === "*" && sqlText[index + 1] === "/")) {
        masked += " ";
        index += 1;
      }
      if (index < sqlText.length) {
        masked += "  ";
        index += 2;
      }
      continue;
    }

    if (char === "'") {
      masked += " ";
      index += 1;
      while (index < sqlText.length) {
        const current = sqlText[index];
        masked += " ";
        index += 1;
        if (current === "'") {
          if (sqlText[index] === "'") {
            masked += " ";
            index += 1;
            continue;
          }
          break;
        }
      }
      continue;
    }

    masked += char;
    index += 1;
  }

  return masked;
};

const compactSql = (sqlText: string): string =>
  maskSqlLiteralsAndComments(sqlText).replace(/\s+/g, " ").trim();

const splitSqlStatements = (maskedSql: string): string[] =>
  maskedSql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

const buildTrustedMetadataIndex = (payload: AIMetadataContextPayload): TrustedMetadataIndex => {
  const tableNames = new Set<string>();
  const tablesByName = new Map<string, AIWorksheetTableSummary>();
  const columnsByTable = new Map<string, Map<string, AIColumnSummary>>();

  payload.worksheets.forEach((worksheet) => {
    const normalizedTable = normalizeIdentifier(worksheet.trustedTableName);
    tableNames.add(normalizedTable);
    tablesByName.set(normalizedTable, worksheet);

    const tableColumns = new Map<string, AIColumnSummary>();
    worksheet.columns.forEach((column) => {
      const normalizedColumn = normalizeIdentifier(column.name);
      tableColumns.set(normalizedColumn, column);
    });
    columnsByTable.set(normalizedTable, tableColumns);
  });

  return { tableNames, tablesByName, columnsByTable };
};

export const buildAISqlSafetyTrustedMetadata = (
  payload: AIMetadataContextPayload,
): AISqlSafetyTrustedMetadata => ({
  tables: payload.worksheets.map((worksheet) => worksheet.trustedTableName),
  columns: payload.worksheets.flatMap<AISqlSafetyTrustedColumn>((worksheet) =>
    worksheet.columns.map((column) => ({
      tableName: worksheet.trustedTableName,
      columnName: column.name,
      sensitivity: column.sensitivity,
    })),
  ),
});

export const detectAISqlBlockedKeywords = (sqlText: string): AISqlSafetyIssue[] => {
  const compact = compactSql(sqlText);

  return BLOCKED_KEYWORD_PATTERNS.filter(({ pattern }) => pattern.test(compact)).map(({ keyword }) => ({
    severity: "error",
    code: "blocked_keyword",
    message: `SQL contains blocked command keyword: ${keyword}.`,
    token: keyword,
  }));
};

const detectBlockedAccessPatterns = (sqlText: string): AISqlSafetyIssue[] => {
  const compact = compactSql(sqlText);

  return BLOCKED_ACCESS_PATTERNS.filter(({ pattern }) => pattern.test(compact)).map(({ label }) => ({
    severity: "error",
    code: "blocked_access_pattern",
    message: `SQL contains blocked ${label} pattern.`,
    token: label,
  }));
};

export const detectAISqlMultiStatementRisks = (sqlText: string): AISqlSafetyIssue[] => {
  const statements = splitSqlStatements(maskSqlLiteralsAndComments(sqlText));

  if (statements.length <= 1) return [];

  return [
    {
      severity: "error",
      code: "multiple_statements",
      message: "SQL contains multiple statements; AI SQL drafts must validate as one read-only SELECT statement.",
    },
  ];
};

const extractCteNames = (maskedSql: string): Set<string> => {
  const cteNames = new Set<string>();
  const normalized = maskedSql.replace(/\s+/g, " ").trim();
  if (!/^with\b/i.test(normalized)) return cteNames;

  const ctePattern = /(?:\bwith\b|,)\s*([`"\[]?[A-Za-z_][\w$]*[`"\]]?)\s+(?:\([^)]*\)\s*)?as\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = ctePattern.exec(normalized)) !== null) {
    cteNames.add(normalizeIdentifier(match[1]));
  }

  return cteNames;
};

const parseTableToken = (token: string): string | null => {
  const cleaned = token.trim();
  if (!cleaned || cleaned.startsWith("(")) return null;
  const parts = cleaned.split(".").map(unquoteIdentifier).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

export const extractAISqlReferencedTableNames = (sqlText: string): string[] => {
  const maskedSql = maskSqlLiteralsAndComments(sqlText);
  const cteNames = extractCteNames(maskedSql);
  const tables = new Set<string>();
  const tablePattern = /\b(?:from|join)\s+((?:[`"\[]?[A-Za-z_][\w$]*[`"\]]?\.)?[`"\[]?[A-Za-z_][\w$]*[`"\]]?)/gi;
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(maskedSql)) !== null) {
    const tableName = parseTableToken(match[1]);
    if (!tableName) continue;
    const normalized = normalizeIdentifier(tableName);
    if (!cteNames.has(normalized)) {
      tables.add(normalized);
    }
  }

  return Array.from(tables).sort();
};

const extractTableAliases = (sqlText: string): Map<string, string> => {
  const maskedSql = maskSqlLiteralsAndComments(sqlText);
  const aliases = new Map<string, string>();
  const tablePattern =
    /\b(?:from|join)\s+((?:[`"\[]?[A-Za-z_][\w$]*[`"\]]?\.)?[`"\[]?[A-Za-z_][\w$]*[`"\]]?)(?:\s+(?:as\s+)?([`"\[]?[A-Za-z_][\w$]*[`"\]]?))?/gi;
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(maskedSql)) !== null) {
    const tableName = parseTableToken(match[1]);
    const alias = match[2] ? normalizeIdentifier(match[2]) : null;
    if (!tableName || !alias || SQL_CLAUSE_KEYWORDS.has(alias)) continue;
    aliases.set(alias, normalizeIdentifier(tableName));
  }

  return aliases;
};

const addColumnReference = (
  columns: Map<string, AISqlSafetyReferencedColumn>,
  reference: AISqlSafetyReferencedColumn,
) => {
  const key = `${reference.tableName || ""}.${normalizeIdentifier(reference.columnName)}.${reference.validation}`;
  columns.set(key, reference);
};

export const extractAISqlReferencedColumnNames = (sqlText: string): string[] => {
  const maskedSql = maskSqlLiteralsAndComments(sqlText);
  const columns = new Set<string>();
  const qualifiedColumnPattern =
    /\b([`"\[]?[A-Za-z_][\w$]*[`"\]]?)\s*\.\s*([`"\[]?[A-Za-z_][\w$]*[`"\]]?|\*)/g;
  let match: RegExpExecArray | null;

  while ((match = qualifiedColumnPattern.exec(maskedSql)) !== null) {
    columns.add(normalizeIdentifier(match[2]));
  }

  return Array.from(columns).sort();
};

const resolveQualifiedColumns = (
  sqlText: string,
  index: TrustedMetadataIndex,
  tableAliases: Map<string, string>,
): AISqlSafetyReferencedColumn[] => {
  const maskedSql = maskSqlLiteralsAndComments(sqlText);
  const columns = new Map<string, AISqlSafetyReferencedColumn>();
  const qualifiedColumnPattern =
    /\b([`"\[]?[A-Za-z_][\w$]*[`"\]]?)\s*\.\s*([`"\[]?[A-Za-z_][\w$]*[`"\]]?|\*)/g;
  let match: RegExpExecArray | null;

  while ((match = qualifiedColumnPattern.exec(maskedSql)) !== null) {
    const qualifier = normalizeIdentifier(match[1]);
    const tableName = tableAliases.get(qualifier) || qualifier;
    const columnName = normalizeIdentifier(match[2]);
    if (columnName === "*") {
      addColumnReference(columns, {
        tableName,
        columnName: "*",
        sensitivity: null,
        validation: "ambiguous",
      });
      continue;
    }

    const column = index.columnsByTable.get(tableName)?.get(columnName) || null;
    addColumnReference(columns, {
      tableName,
      columnName,
      sensitivity: column?.sensitivity || null,
      validation: column ? "known" : "unknown",
    });
  }

  return Array.from(columns.values());
};

const resolveSingleTableBareColumns = (
  sqlText: string,
  index: TrustedMetadataIndex,
  referencedTables: string[],
): AISqlSafetyReferencedColumn[] => {
  if (referencedTables.length !== 1) return [];

  const tableName = referencedTables[0];
  const tableColumns = index.columnsByTable.get(tableName);
  if (!tableColumns) return [];

  const maskedSql = maskSqlLiteralsAndComments(sqlText);
  const columns = new Map<string, AISqlSafetyReferencedColumn>();
  const identifierPattern = /\b[A-Za-z_][\w$]*\b/g;
  let match: RegExpExecArray | null;

  while ((match = identifierPattern.exec(maskedSql)) !== null) {
    const identifier = normalizeIdentifier(match[0]);
    const beforeIdentifier = maskedSql.slice(0, match.index);
    const afterIdentifier = maskedSql.slice(identifierPattern.lastIndex);
    const previousToken = beforeIdentifier.match(/([A-Za-z_][\w$]*|\))\s*$/)?.[1]?.toLowerCase() || "";
    const previousNonSpace = beforeIdentifier.match(/(\S)\s*$/)?.[1] || "";
    const nextNonSpace = afterIdentifier.match(/^\s*(.)/)?.[1] || "";
    if (
      SQL_CLAUSE_KEYWORDS.has(identifier) ||
      SQL_FUNCTION_NAMES.has(identifier) ||
      identifier === tableName ||
      previousToken === "as" ||
      previousToken === ")" ||
      previousNonSpace === "." ||
      nextNonSpace === "." ||
      nextNonSpace === "("
    ) {
      continue;
    }

    const column = tableColumns.get(identifier);
    addColumnReference(columns, {
      tableName,
      columnName: identifier,
      sensitivity: column?.sensitivity || null,
      validation: column ? "known" : "unknown",
    });
  }

  return Array.from(columns.values());
};

const extractPotentialBareColumnNames = (
  sqlText: string,
  referencedTables: string[],
  tableAliases: Map<string, string>,
): string[] => {
  if (referencedTables.length <= 1) return [];

  const ignoredIdentifiers = new Set([
    ...referencedTables,
    ...Array.from(tableAliases.keys()),
    ...Array.from(tableAliases.values()),
  ]);
  const maskedSql = maskSqlLiteralsAndComments(sqlText);
  const bareColumns = new Set<string>();
  const identifierPattern = /\b[A-Za-z_][\w$]*\b/g;
  let match: RegExpExecArray | null;

  while ((match = identifierPattern.exec(maskedSql)) !== null) {
    const identifier = normalizeIdentifier(match[0]);
    const beforeIdentifier = maskedSql.slice(0, match.index);
    const afterIdentifier = maskedSql.slice(identifierPattern.lastIndex);
    const previousToken = beforeIdentifier.match(/([A-Za-z_][\w$]*|\))\s*$/)?.[1]?.toLowerCase() || "";
    const previousNonSpace = beforeIdentifier.match(/(\S)\s*$/)?.[1] || "";
    const nextNonSpace = afterIdentifier.match(/^\s*(.)/)?.[1] || "";
    if (
      SQL_CLAUSE_KEYWORDS.has(identifier) ||
      SQL_FUNCTION_NAMES.has(identifier) ||
      ignoredIdentifiers.has(identifier) ||
      previousToken === "as" ||
      previousToken === ")" ||
      previousNonSpace === "." ||
      nextNonSpace === "." ||
      nextNonSpace === "("
    ) {
      continue;
    }

    bareColumns.add(identifier);
  }

  return Array.from(bareColumns).sort();
};

const compareSensitivity = (left: AIColumnSensitivityLevel, right: AIColumnSensitivityLevel) => {
  const order: Record<AIColumnSensitivityLevel, number> = {
    safe: 0,
    caution: 1,
    sensitive: 2,
    restricted: 3,
  };
  return order[left] - order[right];
};

const highestSensitivity = (
  sensitivities: Array<AIColumnSensitivityClassification | null>,
): AIColumnSensitivityLevel | null =>
  sensitivities.reduce<AIColumnSensitivityLevel | null>((highest, sensitivity) => {
    if (!sensitivity) return highest;
    if (!highest || compareSensitivity(sensitivity.level, highest) > 0) {
      return sensitivity.level;
    }
    return highest;
  }, null);

const columnsForTables = (
  tableNames: string[],
  index: TrustedMetadataIndex,
): TrustedColumnRecord[] =>
  tableNames.flatMap((tableName) => {
    const table = index.tablesByName.get(tableName);
    if (!table) return [];
    return table.columns.map((column) => ({ tableName, column }));
  });

const buildReferencedTables = (
  tableNames: string[],
  index: TrustedMetadataIndex,
): AISqlSafetyReferencedTable[] =>
  tableNames.map((tableName) => ({
    tableName,
    validation: index.tableNames.has(tableName) ? "known" : "unknown",
  }));

const hasSafeSelectShape = (sqlText: string): boolean => {
  const compact = compactSql(sqlText);
  return /^select\b/i.test(compact) || /^with\b[\s\S]*\bselect\b/i.test(compact);
};

const hasUnqualifiedSelectWildcard = (sqlText: string): boolean => {
  const compact = compactSql(sqlText);
  return /\bselect\s+(?:distinct\s+)?\*/i.test(compact) || /\bselect\b[\s\S]*,\s*\*\s*(?:,|\bfrom\b)/i.test(compact);
};

const deriveStatus = (
  warnings: AISqlSafetyIssue[],
  blockingErrors: AISqlSafetyIssue[],
): AISqlSafetyStatus => {
  if (blockingErrors.length > 0) return "blocked";
  if (warnings.length > 0) return "needs_review";
  return "safe";
};

export const summarizeAISqlSafetyValidationResult = (
  result: Pick<AISqlSafetyValidationResult, "status" | "referencedTables" | "referencedColumns" | "warnings" | "blockingErrors">,
): string => {
  const tableCount = result.referencedTables.length;
  const columnCount = result.referencedColumns.filter((column) => column.columnName !== "*").length;

  if (result.status === "blocked") {
    return `Blocked read-only SQL validation with ${result.blockingErrors.length} blocking issue(s), ${tableCount} table reference(s), and ${columnCount} column reference(s).`;
  }

  if (result.status === "needs_review") {
    return `Needs review before any SQL insertion with ${result.warnings.length} warning(s), ${tableCount} table reference(s), and ${columnCount} column reference(s).`;
  }

  return `Safe read-only SQL draft over trusted metadata with ${tableCount} table reference(s) and ${columnCount} column reference(s).`;
};

export const validateAISqlSafety = ({
  sqlText,
  sqlDialect,
  metadataPayload,
}: AISqlSafetyValidationInput): AISqlSafetyValidationResult => {
  const index = buildTrustedMetadataIndex(metadataPayload);
  const warnings: AISqlSafetyIssue[] = [];
  const blockingErrors: AISqlSafetyIssue[] = [];
  const normalizedSqlPreview = normalizeSqlPreview(sqlText);

  if (!sqlText.trim()) {
    blockingErrors.push({
      severity: "error",
      code: "empty_sql",
      message: "SQL draft is empty.",
    });
  }

  if (sqlText.trim() && !hasSafeSelectShape(sqlText)) {
    blockingErrors.push({
      severity: "error",
      code: "non_select_statement",
      message: "SQL draft must be a read-only SELECT or WITH/CTE followed by SELECT.",
    });
  }

  blockingErrors.push(...detectAISqlBlockedKeywords(sqlText));
  blockingErrors.push(...detectBlockedAccessPatterns(sqlText));
  blockingErrors.push(...detectAISqlMultiStatementRisks(sqlText));

  const referencedTableNames = extractAISqlReferencedTableNames(sqlText);
  const referencedTables = buildReferencedTables(referencedTableNames, index);
  referencedTables
    .filter((table) => table.validation === "unknown")
    .forEach((table) => {
      blockingErrors.push({
        severity: "error",
        code: "unknown_table",
        message: `SQL references table not present in trusted AI metadata: ${table.tableName}.`,
        token: table.tableName,
      });
    });

  const tableAliases = extractTableAliases(sqlText);
  const qualifiedColumns = resolveQualifiedColumns(sqlText, index, tableAliases);
  const bareColumns = resolveSingleTableBareColumns(sqlText, index, referencedTableNames);
  const referencedColumnMap = new Map<string, AISqlSafetyReferencedColumn>();
  [...qualifiedColumns, ...bareColumns].forEach((column) => addColumnReference(referencedColumnMap, column));
  if (hasUnqualifiedSelectWildcard(sqlText)) {
    referencedTableNames.forEach((tableName) => {
      addColumnReference(referencedColumnMap, {
        tableName,
        columnName: "*",
        sensitivity: null,
        validation: "ambiguous",
      });
    });
  }
  const referencedColumns = Array.from(referencedColumnMap.values()).sort((left, right) =>
    `${left.tableName || ""}.${left.columnName}`.localeCompare(`${right.tableName || ""}.${right.columnName}`),
  );

  referencedColumns
    .filter((column) => column.validation === "unknown")
    .forEach((column) => {
      blockingErrors.push({
        severity: "error",
        code: "unknown_column",
        message: `SQL references column not present in trusted AI metadata: ${column.tableName || "unknown table"}.${column.columnName}.`,
        token: column.columnName,
      });
    });

  referencedColumns
    .filter((column) => column.validation === "ambiguous")
    .forEach((column) => {
      warnings.push({
        severity: "warning",
        code: "wildcard_column_review",
        message: `SQL uses wildcard column selection for ${column.tableName || "an unknown table"} and requires review before insertion.`,
        token: column.columnName,
      });
    });

  const wildcardTables = referencedColumns
    .filter((column) => column.columnName === "*" && column.tableName)
    .map((column) => column.tableName as string);
  const wildcardExposedColumns = columnsForTables(wildcardTables, index);

  wildcardExposedColumns.forEach(({ tableName, column }) => {
    if (column.sensitivity.level === "restricted") {
      blockingErrors.push({
        severity: "error",
        code: "restricted_column",
        message: `Wildcard selection could expose restricted column ${tableName}.${column.name}.`,
        token: column.name,
      });
    } else if (column.sensitivity.level === "sensitive") {
      warnings.push({
        severity: "warning",
        code: "sensitive_column_review",
        message: `Wildcard selection includes sensitive column ${tableName}.${column.name}; review is required before insertion.`,
        token: column.name,
      });
    } else if (column.sensitivity.level === "caution") {
      warnings.push({
        severity: "warning",
        code: "caution_column_review",
        message: `Wildcard selection includes caution column ${tableName}.${column.name}; review is required before insertion.`,
        token: column.name,
      });
    }
  });

  referencedColumns.forEach((column) => {
    const sensitivity = column.sensitivity;
    if (!sensitivity) return;

    if (sensitivity.level === "restricted") {
      blockingErrors.push({
        severity: "error",
        code: "restricted_column",
        message: `SQL references restricted column ${column.tableName || "unknown table"}.${column.columnName}; raw restricted values are never allowed.`,
        token: column.columnName,
      });
    } else if (sensitivity.level === "sensitive") {
      warnings.push({
        severity: "warning",
        code: "sensitive_column_review",
        message: `SQL references sensitive column ${column.tableName || "unknown table"}.${column.columnName}; review is required before insertion.`,
        token: column.columnName,
      });
    } else if (sensitivity.level === "caution") {
      warnings.push({
        severity: "warning",
        code: "caution_column_review",
        message: `SQL references caution column ${column.tableName || "unknown table"}.${column.columnName}; review is required before insertion.`,
        token: column.columnName,
      });
    }
  });

  if (referencedTableNames.length > 1 && qualifiedColumns.length === 0) {
    warnings.push({
      severity: "warning",
      code: "ambiguous_column_validation",
      message: "SQL references multiple tables without table-qualified columns; column validation is conservative and requires review.",
    });
  }
  extractPotentialBareColumnNames(sqlText, referencedTableNames, tableAliases).forEach((columnName) => {
    warnings.push({
      severity: "warning",
      code: "unqualified_multitable_column",
      message: `SQL references possible unqualified column ${columnName} across multiple tables; review is required before insertion.`,
      token: columnName,
    });
  });

  const highestSensitivityLevel =
    highestSensitivity([
      ...referencedColumns.map((column) => column.sensitivity),
      ...wildcardExposedColumns.map(({ column }) => column.sensitivity),
    ]) || null;
  const status = deriveStatus(warnings, blockingErrors);
  const resultWithoutSummary = {
    status,
    dialect: sqlDialect,
    normalizedSqlPreview,
    referencedTables,
    referencedColumns,
    highestSensitivityLevel,
    warnings,
    blockingErrors,
  };

  return {
    ...resultWithoutSummary,
    summary: summarizeAISqlSafetyValidationResult(resultWithoutSummary),
  };
};
