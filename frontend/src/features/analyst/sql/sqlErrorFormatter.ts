export type SqlExecutionErrorCategory =
  | "table_not_found"
  | "column_not_found"
  | "alias_not_found"
  | "ambiguous_column"
  | "parser_error"
  | "dialect_mismatch"
  | "read_only_validation"
  | "multi_statement"
  | "blocked_statement"
  | "cte_select_first_validation"
  | "backend_unreachable"
  | "unknown";

export type SqlExecutionErrorInsight = {
  category: SqlExecutionErrorCategory;
  title: string;
  summary: string;
  rawMessage: string;
  likelyCause: string;
  likelyLocation?: {
    token: string;
    start?: number;
    end?: number;
  };
  suggestions: string[];
  howToFix: string[];
  confidence: "high" | "medium" | "low";
};

export type FormatSqlExecutionErrorInput = {
  rawMessage: string;
  sqlText: string;
  selectedDialect?: string;
  availableTables?: string[];
  availableColumns?: string[];
  activeTable?: string;
  appliedScopeTables?: string[];
};

type DialectPattern = {
  id: string;
  pattern: RegExp;
  tokenPattern: RegExp;
  title: string;
  summary: (token: string) => string;
  likelyCause: string;
  suggestions: string[];
  howToFix: string[];
  incompatibleWhen?: (selectedDialect: string | undefined) => boolean;
};

const blockedStatementPattern = /\b(DROP|UPDATE|DELETE|ALTER|CREATE|INSERT)\s+statements?\s+are\s+not\s+allowed\b/i;
const onlySelectPattern = /\bonly\s+select\s+queries\s+are\s+allowed\b/i;
const oneSelectPattern = /\bonly\s+one\s+select\s+statement\s+is\s+allowed\b/i;
const backendReachabilityPattern = /\bcould\s+not\s+reach\s+filtraqueri\s+backend\b/i;

const dialectPatterns: DialectPattern[] = [
  {
    id: "oracle-rownum",
    pattern: /\bROWNUM\b/i,
    tokenPattern: /\bROWNUM\b/i,
    title: "Query may use Oracle row limit syntax",
    summary: (token) => `${token} looks like Oracle-style SQL, while manual execution runs through DuckDB.`,
    likelyCause: "The query may have been copied from Oracle or written with Oracle row-limiting syntax.",
    suggestions: [
      "Check whether the query was copied from Oracle.",
      "Try using DuckDB-compatible row limiting such as LIMIT when you edit the SQL manually.",
    ],
    howToFix: [
      "Review the row limiting clause near ROWNUM.",
      "Keep Run Query manual; FiltraQueri will not rewrite this SQL automatically.",
    ],
  },
  {
    id: "sqlserver-top",
    pattern: /\bSELECT\s+(?:DISTINCT\s+)?TOP\s+\(?\d+\)?\b/i,
    tokenPattern: /\bTOP\s+\(?\d+\)?\b/i,
    title: "Query may use SQL Server TOP syntax",
    summary: (token) => `${token} looks like SQL Server-style row limiting, while manual execution runs through DuckDB.`,
    likelyCause: "The query may have been copied from SQL Server or written with TOP row-limiting syntax.",
    suggestions: [
      "Check whether the query was copied from SQL Server.",
      "Try using a DuckDB-compatible LIMIT clause when you edit the SQL manually.",
    ],
    howToFix: [
      "Review the SELECT list and row limiting syntax.",
      "FiltraQueri will not convert TOP syntax automatically in this slice.",
    ],
  },
  {
    id: "dateadd",
    pattern: /\bDATEADD\s*\(/i,
    tokenPattern: /\bDATEADD\s*\(/i,
    title: "Query may use DATEADD dialect syntax",
    summary: (token) => `${token.trim()} has dialect-specific argument order and date interval behavior.`,
    likelyCause: "DATEADD syntax differs across SQL Server, DuckDB, and other SQL dialects.",
    suggestions: [
      "Check whether DATEADD uses the argument order expected by DuckDB.",
      "Try using DuckDB date interval syntax when you edit the SQL manually.",
    ],
    howToFix: [
      "Review the date arithmetic expression and its arguments.",
      "Do not rely on automatic SQL conversion; update the SQL only if you choose to.",
    ],
  },
  {
    id: "oracle-to-date",
    pattern: /\bTO_DATE\s*\(/i,
    tokenPattern: /\bTO_DATE\s*\(/i,
    title: "Query may use Oracle TO_DATE syntax",
    summary: (token) => `${token.trim()} is commonly used in Oracle-style SQL and may not match DuckDB date parsing.`,
    likelyCause: "The query may depend on Oracle date parsing or Oracle format tokens.",
    suggestions: [
      "Check whether the date format tokens are compatible with DuckDB.",
      "Try using DuckDB-compatible date parsing when you edit the SQL manually.",
    ],
    howToFix: [
      "Review the TO_DATE expression and date format string.",
      "FiltraQueri will not rewrite date parsing automatically.",
    ],
  },
  {
    id: "oracle-nvl",
    pattern: /\bNVL\s*\(/i,
    tokenPattern: /\bNVL\s*\(/i,
    title: "Query may use Oracle NVL syntax",
    summary: (token) => `${token.trim()} is Oracle-style null handling and may not run as-is in DuckDB.`,
    likelyCause: "The query may have been copied from Oracle or written with Oracle null-handling functions.",
    suggestions: [
      "Check whether the runtime supports NVL for this expression.",
      "Try using DuckDB-compatible null handling when you edit the SQL manually.",
    ],
    howToFix: [
      "Review the null-handling function and argument types.",
      "Keep the change manual; FiltraQueri will not auto-fix the function call.",
    ],
  },
  {
    id: "sqlserver-isnull",
    pattern: /\bISNULL\s*\(/i,
    tokenPattern: /\bISNULL\s*\(/i,
    title: "Query may use SQL Server ISNULL syntax",
    summary: (token) => `${token.trim()} is SQL Server-style null handling and can differ from DuckDB semantics.`,
    likelyCause: "The query may have been copied from SQL Server or written with SQL Server null-handling functions.",
    suggestions: [
      "Check whether ISNULL is supported with the same behavior in the runtime.",
      "Try using DuckDB-compatible null handling when you edit the SQL manually.",
    ],
    howToFix: [
      "Review the null-handling function and result type.",
      "FiltraQueri will not replace the function automatically.",
    ],
  },
  {
    id: "sqlserver-brackets",
    pattern: /\[[^\]]+\]/,
    tokenPattern: /\[[^\]]+\]/,
    title: "Query may use SQL Server bracket identifiers",
    summary: (token) => `${token} looks like SQL Server-style identifier quoting.`,
    likelyCause: "The query may have been copied from SQL Server, where square brackets quote table or column names.",
    suggestions: [
      "Check whether the bracketed identifier exists in the active schema.",
      "Try using identifier quoting that the DuckDB runtime accepts when you edit the SQL manually.",
    ],
    howToFix: [
      "Review bracketed table and column names.",
      "Make any quoting changes manually before running again.",
    ],
  },
  {
    id: "postgres-cast",
    pattern: /::\s*[A-Za-z_][\w]*(?:\[\])?/,
    tokenPattern: /::\s*[A-Za-z_][\w]*(?:\[\])?/,
    title: "Query may use PostgreSQL cast syntax",
    summary: (token) => `${token.trim()} looks like PostgreSQL-style type casting.`,
    likelyCause: "The query may have been copied from PostgreSQL or written with PostgreSQL cast syntax.",
    suggestions: [
      "Check whether the cast type and syntax are supported by DuckDB.",
      "Try using DuckDB-compatible CAST syntax when you edit the SQL manually.",
    ],
    howToFix: [
      "Review the cast expression around the :: operator.",
      "FiltraQueri will not convert cast syntax automatically.",
    ],
  },
  {
    id: "fetch-first",
    pattern: /\bFETCH\s+FIRST\s+\d+\s+ROWS?\s+ONLY\b/i,
    tokenPattern: /\bFETCH\s+FIRST\s+\d+\s+ROWS?\s+ONLY\b/i,
    title: "Query may use FETCH FIRST row limiting",
    summary: (token) => `${token} is dialect-specific row limiting and may not match the DuckDB runtime context.`,
    likelyCause: "The query may rely on Oracle, DB2, or PostgreSQL-style row limiting instead of the runtime's expected syntax.",
    suggestions: [
      "Check whether FETCH FIRST is compatible with the selected/runtime dialect.",
      "Try using DuckDB-compatible LIMIT syntax when you edit the SQL manually.",
    ],
    howToFix: [
      "Review the row limiting clause near the end of the query.",
      "Make any syntax change manually; FiltraQueri will not rewrite it.",
    ],
    incompatibleWhen: (selectedDialect) => !selectedDialect || selectedDialect.toLowerCase() === "duckdb",
  },
];

const normalizeIdentifier = (value: string) =>
  value
    .trim()
    .replace(/^Query failed:\s*/i, "")
    .replace(/^["`\[]|["`\]]$/g, "")
    .toLowerCase();

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const findTokenLocation = (sqlText: string, token: string) => {
  const normalizedToken = token.trim();
  if (!normalizedToken) return undefined;

  const escapedToken = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordLike = /^[A-Za-z_][\w$]*$/.test(normalizedToken);
  const pattern = new RegExp(wordLike ? `\\b${escapedToken}\\b` : escapedToken, "i");
  const match = pattern.exec(sqlText);
  if (!match || match.index === undefined) return { token: normalizedToken };

  return {
    token: normalizedToken,
    start: match.index,
    end: match.index + match[0].length,
  };
};

const stripQuotes = (value: string) => value.trim().replace(/^["'`\[]|["'`\]]$/g, "");

const levenshteinDistance = (left: string, right: string) => {
  const a = normalizeIdentifier(left);
  const b = normalizeIdentifier(right);
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length] || 0;
};

const suggestSimilar = (target: string, candidates: string[], maxSuggestions = 3) => {
  const normalizedTarget = normalizeIdentifier(target);
  if (!normalizedTarget) return [];

  return unique(candidates)
    .map((candidate) => ({
      candidate,
      distance: levenshteinDistance(normalizedTarget, candidate),
      includes:
        normalizeIdentifier(candidate).includes(normalizedTarget) ||
        normalizedTarget.includes(normalizeIdentifier(candidate)),
    }))
    .filter(({ candidate, distance, includes }) => {
      const normalizedCandidate = normalizeIdentifier(candidate);
      if (!normalizedCandidate || normalizedCandidate === normalizedTarget) return false;
      const threshold = Math.max(2, Math.ceil(Math.max(normalizedCandidate.length, normalizedTarget.length) / 3));
      return includes || distance <= threshold;
    })
    .sort((left, right) => Number(right.includes) - Number(left.includes) || left.distance - right.distance)
    .slice(0, maxSuggestions)
    .map(({ candidate }) => candidate);
};

const extractTableName = (message: string) => {
  const patterns = [
    /Table\s+with\s+name\s+["'`]?([^"'`\n]+?)["'`]?\s+does\s+not\s+exist/i,
    /Table\s+["'`]?([^"'`\n]+?)["'`]?\s+does\s+not\s+exist/i,
    /Catalog\s+Error:.*?table\s+["'`]?([^"'`\s]+)["'`]?/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (match?.[1]) return stripQuotes(match[1].split(" ")[0]);
  }

  return null;
};

const extractColumnName = (message: string) => {
  const patterns = [
    /Referenced\s+column\s+["'`]?([^"'`\n]+?)["'`]?\s+not\s+found/i,
    /column\s+named\s+["'`]?([^"'`\n]+?)["'`]?\b/i,
    /Column\s+["'`]?([^"'`\n]+?)["'`]?\s+was\s+not\s+found/i,
    /Binder\s+Error:.*?column\s+["'`]?([^"'`\s]+)["'`]?/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (match?.[1]) return stripQuotes(match[1].split(" ")[0]);
  }

  return null;
};

const extractAliasName = (message: string) => {
  const patterns = [
    /Referenced\s+table\s+["'`]?([^"'`\n]+?)["'`]?\s+not\s+found/i,
    /Table\s+alias\s+["'`]?([^"'`\n]+?)["'`]?\s+not\s+found/i,
    /Alias\s+["'`]?([^"'`\n]+?)["'`]?\s+(?:is\s+used|not\s+found)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (match?.[1]) return stripQuotes(match[1].split(" ")[0]);
  }

  return null;
};

const extractAmbiguousColumn = (message: string) => {
  const patterns = [
    /Ambiguous\s+reference\s+to\s+column\s+name\s+["'`]?([^"'`\n]+?)["'`]?\b/i,
    /ambiguous\s+column\s+(?:name\s+)?["'`]?([^"'`\n]+?)["'`]?\b/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (match?.[1]) return stripQuotes(match[1].split(" ")[0]);
  }

  return null;
};

const extractParserToken = (message: string) => {
  const patterns = [
    /syntax\s+error\s+at\s+or\s+near\s+["'`]?([^"'`\n]+?)["'`]?\s*(?:\n|$)/i,
    /Parser\s+Error:.*?near\s+["'`]?([^"'`\n]+?)["'`]?\s*(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (match?.[1]) return stripQuotes(match[1].trim());
  }

  return null;
};

const candidateBindingSuggestions = (message: string) => {
  const match = /Candidate\s+(?:bindings|tables):\s*([^\n]+)/i.exec(message);
  if (!match?.[1]) return [];

  return unique(
    [...match[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((candidate) => candidate[1]),
  ).slice(0, 3);
};

const createBaseInsight = (
  input: FormatSqlExecutionErrorInput,
  insight: Omit<SqlExecutionErrorInsight, "rawMessage">,
): SqlExecutionErrorInsight => ({
  ...insight,
  rawMessage: input.rawMessage,
});

const formatSimilarSuggestion = (values: string[]) => {
  if (values.length === 0) return null;
  return `Did you mean ${values.map((value) => `\`${value}\``).join(", ")}?`;
};

const availableTableSuggestions = (input: FormatSqlExecutionErrorInput, missingTable: string) => {
  const availableTables = unique([
    ...(input.appliedScopeTables || []),
    ...(input.activeTable ? [input.activeTable] : []),
    ...(input.availableTables || []),
  ]);
  const similar = suggestSimilar(missingTable, availableTables);

  return unique([
    ...(formatSimilarSuggestion(similar) ? [formatSimilarSuggestion(similar) as string] : []),
    ...(input.activeTable ? [`Check whether the active table \`${input.activeTable}\` is the intended FROM table.`] : []),
    ...(input.appliedScopeTables?.length
      ? [`Check whether the table is in this tab's applied scope: ${input.appliedScopeTables.map((table) => `\`${table}\``).join(", ")}.`]
      : []),
    "Check whether the table name is misspelled or belongs to another worksheet.",
  ]);
};

const availableColumnSuggestions = (input: FormatSqlExecutionErrorInput, missingColumn: string, message: string) => {
  const candidatesFromMessage = candidateBindingSuggestions(message);
  const similar = suggestSimilar(missingColumn, [...candidatesFromMessage, ...(input.availableColumns || [])]);

  return unique([
    ...(formatSimilarSuggestion(similar) ? [formatSimilarSuggestion(similar) as string] : []),
    "Check whether the column name is misspelled.",
    "Check whether the column belongs to a different table or alias.",
    "Try using a table alias to qualify the column when more than one table is referenced.",
  ]);
};

const findDialectMismatch = (input: FormatSqlExecutionErrorInput) => {
  const selectedDialect = input.selectedDialect;

  return dialectPatterns.find((dialectPattern) => {
    if (dialectPattern.incompatibleWhen && !dialectPattern.incompatibleWhen(selectedDialect)) {
      return false;
    }
    return dialectPattern.pattern.test(input.sqlText);
  });
};

const dialectInsight = (
  input: FormatSqlExecutionErrorInput,
  dialectPattern: DialectPattern,
): SqlExecutionErrorInsight => {
  const tokenMatch = dialectPattern.tokenPattern.exec(input.sqlText);
  const token = tokenMatch?.[0] || dialectPattern.id;

  return createBaseInsight(input, {
    category: "dialect_mismatch",
    title: dialectPattern.title,
    summary: dialectPattern.summary(token),
    likelyCause: dialectPattern.likelyCause,
    likelyLocation: findTokenLocation(input.sqlText, token),
    suggestions: dialectPattern.suggestions,
    howToFix: dialectPattern.howToFix,
    confidence: "medium",
  });
};

export function formatSqlExecutionError(input: FormatSqlExecutionErrorInput): SqlExecutionErrorInsight {
  const rawMessage = input.rawMessage.trim() || "Unknown SQL execution error.";
  const normalizedInput = { ...input, rawMessage };
  const sqlText = input.sqlText.trim();

  if (backendReachabilityPattern.test(rawMessage)) {
    return createBaseInsight(normalizedInput, {
      category: "backend_unreachable",
      title: "FiltraQueri backend could not be reached",
      summary: "The SQL query could not run because the frontend could not reach the backend service.",
      likelyCause: "The backend may be stopped, restarting, or unavailable from this browser session.",
      suggestions: ["Check whether the backend is running and reachable."],
      howToFix: ["Start or reconnect the backend, then manually choose Run Query again."],
      confidence: "high",
    });
  }

  if (onlySelectPattern.test(rawMessage) && /^\s*with\b/i.test(sqlText)) {
    return createBaseInsight(normalizedInput, {
      category: "cte_select_first_validation",
      title: "Query was not run: backend currently expects SELECT-first SQL",
      summary: "This query starts with WITH, but the current backend validator only accepts SQL that starts with SELECT.",
      likelyCause: "The SQL may be a read-only CTE, but this initial validation path rejects CTE-first statements before DuckDB execution.",
      likelyLocation: findTokenLocation(input.sqlText, "WITH"),
      suggestions: [
        "Check whether this CTE can be kept as a saved draft until CTE validation support is expanded.",
        "Try using a simple SELECT-first query if you need to run a preview now.",
      ],
      howToFix: [
        "Do not rewrite automatically; only adjust the SQL if you choose to.",
        "Run Query remains manual after any edits.",
      ],
      confidence: "high",
    });
  }

  if (oneSelectPattern.test(rawMessage)) {
    return createBaseInsight(normalizedInput, {
      category: "multi_statement",
      title: "Query was not run: multiple SQL statements detected",
      summary: "The SQL workspace runs one read-only SELECT statement at a time.",
      likelyCause: "The draft contains an extra semicolon or more than one SQL statement.",
      likelyLocation: findTokenLocation(input.sqlText, ";"),
      suggestions: [
        "Check whether there is another statement after a semicolon.",
        "Try keeping only the SELECT statement you want to preview.",
      ],
      howToFix: [
        "Remove or save extra statements separately if you decide they are not needed for this run.",
        "Choose Run Query manually after reviewing the draft.",
      ],
      confidence: "high",
    });
  }

  const blockedMatch = blockedStatementPattern.exec(rawMessage);
  if (blockedMatch?.[1]) {
    const statement = blockedMatch[1].toUpperCase();
    return createBaseInsight(normalizedInput, {
      category: "blocked_statement",
      title: `Query was not run: ${statement} statements are blocked`,
      summary: `The backend rejected this SQL because ${statement} is not allowed in the read-only SQL workspace.`,
      likelyCause: "Manual SQL execution is limited to read-only analytical SELECT queries.",
      likelyLocation: findTokenLocation(input.sqlText, statement),
      suggestions: [
        "Check whether this task can be expressed as a SELECT query.",
        "Try using Data Preview or Clean & Prepare workflows for data-shaping tasks instead of write statements.",
      ],
      howToFix: [
        "Remove write or schema-changing statements if you only need to inspect data.",
        "FiltraQueri will not run blocked statements automatically or manually from this workspace.",
      ],
      confidence: "high",
    });
  }

  if (onlySelectPattern.test(rawMessage)) {
    return createBaseInsight(normalizedInput, {
      category: "read_only_validation",
      title: "Query was not run: only SELECT queries are allowed",
      summary: "The backend rejected this SQL before execution because it does not start as a SELECT query.",
      likelyCause: "Manual SQL execution is limited to read-only SELECT-style analysis.",
      suggestions: [
        "Check whether the query starts with SELECT.",
        "Try using a read-only SELECT query if your goal is to inspect data.",
      ],
      howToFix: [
        "Review the first SQL keyword in the draft.",
        "Choose Run Query manually after making any edits yourself.",
      ],
      confidence: "high",
    });
  }

  const dialectPattern = findDialectMismatch(normalizedInput);
  if (dialectPattern) return dialectInsight(normalizedInput, dialectPattern);

  const ambiguousColumn = extractAmbiguousColumn(rawMessage);
  if (/\b(Binder\s+Error|ambiguous)\b/i.test(rawMessage) && ambiguousColumn) {
    return createBaseInsight(normalizedInput, {
      category: "ambiguous_column",
      title: "Query failed: ambiguous column name",
      summary: `More than one referenced table may contain column \`${ambiguousColumn}\`.`,
      likelyCause: "DuckDB needs the column to be qualified with the intended table or alias.",
      likelyLocation: findTokenLocation(input.sqlText, ambiguousColumn),
      suggestions: [
        `Check whether \`${ambiguousColumn}\` exists in multiple joined tables.`,
        "Try using the table alias before the column name when you edit the SQL manually.",
      ],
      howToFix: [
        "Review the SELECT, JOIN, WHERE, GROUP BY, and ORDER BY clauses for the ambiguous column.",
        "FiltraQueri will not choose an alias or rewrite the SQL automatically.",
      ],
      confidence: "high",
    });
  }

  const aliasName = extractAliasName(rawMessage);
  if (/\bBinder\s+Error\b/i.test(rawMessage) && aliasName) {
    return createBaseInsight(normalizedInput, {
      category: "alias_not_found",
      title: "Query failed: alias not defined",
      summary: `The query refers to \`${aliasName}\`, but DuckDB could not find that table or alias in the FROM/JOIN clauses.`,
      likelyCause: "The alias may be misspelled, or the table may not have been declared with that alias.",
      likelyLocation: findTokenLocation(input.sqlText, aliasName),
      suggestions: [
        `Check whether \`${aliasName}\` is declared in a FROM or JOIN clause.`,
        "Try using one of the aliases that is actually defined in the query.",
      ],
      howToFix: [
        "Review every alias-qualified reference like alias.column.",
        "Make alias changes manually; FiltraQueri will not auto-fix the query.",
      ],
      confidence: "medium",
    });
  }

  const tableName = extractTableName(rawMessage);
  if (/\bCatalog\s+Error\b/i.test(rawMessage) && tableName) {
    return createBaseInsight(normalizedInput, {
      category: "table_not_found",
      title: "Query failed: table not found",
      summary: `DuckDB could not find table \`${tableName}\`.`,
      likelyCause: "The query references a table name that is not available in the current workbook/runtime connection.",
      likelyLocation: findTokenLocation(input.sqlText, tableName),
      suggestions: availableTableSuggestions(input, tableName),
      howToFix: [
        "Review the FROM and JOIN clauses for the missing table name.",
        "Use the schema/context shown in Inspect SQL to choose the table name yourself.",
        "FiltraQueri will not replace the table name automatically.",
      ],
      confidence: "high",
    });
  }

  const columnName = extractColumnName(rawMessage);
  if (/\bBinder\s+Error\b/i.test(rawMessage) && columnName) {
    return createBaseInsight(normalizedInput, {
      category: "column_not_found",
      title: "Query failed: column not found",
      summary: `DuckDB could not find column \`${columnName}\`.`,
      likelyCause: "The column may be misspelled, unavailable in the active schema, or referenced through the wrong table alias.",
      likelyLocation: findTokenLocation(input.sqlText, columnName),
      suggestions: availableColumnSuggestions(input, columnName, rawMessage),
      howToFix: [
        "Review the SELECT, WHERE, JOIN, GROUP BY, and ORDER BY clauses for this column.",
        "Use the active schema or applied worksheet scope to confirm the column name.",
        "FiltraQueri will not replace the column automatically.",
      ],
      confidence: "high",
    });
  }

  const parserToken = extractParserToken(rawMessage);
  if (/\bParser\s+Error\b|syntax\s+error/i.test(rawMessage)) {
    return createBaseInsight(normalizedInput, {
      category: "parser_error",
      title: "Query failed: SQL syntax error",
      summary: parserToken
        ? `DuckDB reported a syntax problem near \`${parserToken}\`.`
        : "DuckDB reported a SQL syntax problem.",
      likelyCause: "The query may have a missing comma, unmatched parenthesis, unmatched quote, or clauses in an order DuckDB does not accept.",
      likelyLocation: parserToken ? findTokenLocation(input.sqlText, parserToken) : undefined,
      suggestions: [
        "Check whether commas, parentheses, and quotes are balanced.",
        "Check whether SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, and LIMIT appear in a valid order.",
      ],
      howToFix: [
        "Review the token DuckDB reported and the SQL immediately before it.",
        "Make any edits manually, then choose Run Query again when ready.",
      ],
      confidence: parserToken ? "high" : "medium",
    });
  }

  return createBaseInsight(normalizedInput, {
    category: "unknown",
    title: "Query failed",
    summary: "FiltraQueri could not classify this SQL error deterministically.",
    likelyCause: "The backend returned an error message that does not match the known SQL error patterns yet.",
    suggestions: [
      "Check the technical details for the exact backend/DuckDB message.",
      "Review table names, column names, aliases, syntax, and dialect-specific functions manually.",
    ],
    howToFix: [
      "Use the raw error details to decide what to edit.",
      "Run Query remains manual after any changes.",
    ],
    confidence: "low",
  });
}
