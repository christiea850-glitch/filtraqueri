import { getDialectProfile } from "../dialects";
import type { SqlDialectId } from "../types";
import { matchSqlFunctions } from "./sqlFunctionMatcher";

export type SqlDiagnosticSeverity = "info" | "warning";

export type SqlIntelligenceDiagnostic = {
  id: string;
  severity: SqlDiagnosticSeverity;
  title: string;
  message: string;
  start: number;
  end: number;
  source: "concept" | "function" | "dialect";
};

const createPatternDiagnostic = ({
  sql,
  pattern,
  id,
  title,
  message,
  severity = "info",
}: {
  sql: string;
  pattern: RegExp;
  id: string;
  title: string;
  message: string;
  severity?: SqlDiagnosticSeverity;
}): SqlIntelligenceDiagnostic[] =>
  [...sql.matchAll(pattern)].map((match) => {
    const start = match.index || 0;
    return {
      id: `${id}-${start}`,
      severity,
      title,
      message,
      start,
      end: start + match[0].length,
      source: "dialect",
    };
  });

export const createSqlDialectDiagnostics = (
  sql: string,
  sourceDialect: SqlDialectId = "duckdb",
): SqlIntelligenceDiagnostic[] => {
  const dialect = getDialectProfile(sourceDialect);
  const functionDiagnostics: SqlIntelligenceDiagnostic[] = matchSqlFunctions(sql).map((match) => {
    const compatibility = match.compatibility.dialects[sourceDialect];
    return {
      id: `function-${match.functionName}-${match.start}`,
      severity: compatibility.support === "partial" ? "warning" : "info" as const,
      title: `${match.functionName} compatibility`,
      message: `${dialect.displayName}: ${compatibility.notes}`,
      start: match.start,
      end: match.end,
      source: "function" as const,
    };
  });

  const dialectNotes = [
    ...createPatternDiagnostic({
      sql,
      pattern: /\bTO_CHAR\s*\(/gi,
      id: "oracle-to-char",
      title: "Oracle-style TO_CHAR",
      message: "TO_CHAR is common in Oracle. DuckDB execution will need a future date-format adapter before this can be translated safely.",
      severity: sourceDialect === "oracle" ? "info" : "warning",
    }),
    ...createPatternDiagnostic({
      sql,
      pattern: /\bDATE_FORMAT\s*\(/gi,
      id: "mariadb-date-format",
      title: "MariaDB-style DATE_FORMAT",
      message: "DATE_FORMAT is common in MariaDB. Date format tokens differ by dialect and should not be rewritten blindly.",
      severity: sourceDialect === "mariadb" ? "info" : "warning",
    }),
    ...createPatternDiagnostic({
      sql,
      pattern: /\bTRUNCATE\s*\(/gi,
      id: "truncate-note",
      title: "TRUNCATE vs TRUNC",
      message: "MariaDB TRUNCATE(number, decimals) and Oracle TRUNC have different portability rules.",
      severity: "warning",
    }),
    ...createPatternDiagnostic({
      sql,
      pattern: /\bFETCH\s+FIRST\s+\d+\s+ROWS?\s+ONLY\b/gi,
      id: "fetch-first-note",
      title: "FETCH FIRST row limit",
      message: "FETCH FIRST is common in Oracle-style SQL. FiltraQueri still uses DuckDB as the future execution target.",
      severity: sourceDialect === "oracle" ? "info" : "warning",
    }),
    ...createPatternDiagnostic({
      sql,
      pattern: /\bLIMIT\s+\d+\b/gi,
      id: "limit-note",
      title: "LIMIT row limit",
      message: `${dialect.displayName}: ${dialect.limitFetchBehaviorNotes[0]}`,
      severity: "info",
    }),
  ];

  return [...functionDiagnostics, ...dialectNotes].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
};
