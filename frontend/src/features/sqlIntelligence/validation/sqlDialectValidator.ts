import type { SqlDialectId } from "../types";
import { matchSqlFunctions } from "../diagnostics/sqlFunctionMatcher";
import type { SqlValidationDiagnostic } from "./sqlValidationTypes";

const createPatternDiagnostic = ({
  sql,
  dialect,
  ruleId,
  pattern,
  message,
  suggestedAction,
}: {
  sql: string;
  dialect: SqlDialectId;
  ruleId: string;
  pattern: RegExp;
  message: string;
  suggestedAction: string;
}): SqlValidationDiagnostic[] =>
  [...sql.matchAll(pattern)].map((match) => {
    const start = match.index || 0;
    return {
      ruleId,
      severity: "warning" as const,
      category: "dialect" as const,
      message,
      location: {
        start,
        end: start + match[0].length,
      },
      dialect,
      concept: null,
      suggestedAction,
    };
  });

export const validateSqlDialect = (
  sql: string,
  dialect: SqlDialectId,
): SqlValidationDiagnostic[] => {
  const functionDiagnostics: SqlValidationDiagnostic[] = matchSqlFunctions(sql).flatMap((match) => {
    const compatibility = match.compatibility.dialects[dialect];
    const diagnostics: SqlValidationDiagnostic[] = [
      {
        ruleId: `function-${match.compatibility.canonicalName.toLowerCase()}-${compatibility.support}`,
        severity: compatibility.support === "partial" ? "warning" : "info",
        category: "function",
        message: compatibility.notes,
        location: {
          start: match.start,
          end: match.end,
        },
        dialect,
        concept: match.isNested ? "nested-functions" : "single-row-functions",
        suggestedAction:
          compatibility.support === "partial"
            ? "Review function semantics before future execution or translation."
            : "No action required; this is a compatibility note.",
      },
    ];

    if (match.isNested) {
      diagnostics.push({
        ruleId: "function-nested-call",
        severity: "info",
        category: "function",
        message: "Nested function usage was detected.",
        location: {
          start: match.start,
          end: match.end,
        },
        dialect,
        concept: "nested-functions",
        suggestedAction: "Confirm the inner function returns the value type expected by the outer function.",
      });
    }

    return diagnostics;
  });

  const dialectDiagnostics = [
    ...createPatternDiagnostic({
      sql,
      dialect,
      ruleId: "dialect-oracle-to-char",
      pattern: /\bTO_CHAR\s*\(/gi,
      message: "TO_CHAR is Oracle-style formatting; DuckDB execution will need a future adapter.",
      suggestedAction: "Keep as a draft note until a date-format translator is connected.",
    }),
    ...createPatternDiagnostic({
      sql,
      dialect,
      ruleId: "dialect-mariadb-date-format",
      pattern: /\bDATE_FORMAT\s*\(/gi,
      message: "DATE_FORMAT is MariaDB-style formatting; date format tokens differ by dialect.",
      suggestedAction: "Do not assume DATE_FORMAT tokens can be copied directly into DuckDB.",
    }),
    ...createPatternDiagnostic({
      sql,
      dialect,
      ruleId: "dialect-trunc-truncate-conflict",
      pattern: /\b(?:TRUNC|TRUNCATE)\s*\(/gi,
      message: "TRUNC and TRUNCATE have dialect-specific numeric and date semantics.",
      suggestedAction: "Future translation should separate numeric truncation from date truncation.",
    }),
    ...createPatternDiagnostic({
      sql,
      dialect,
      ruleId: "dialect-oracle-fetch-first",
      pattern: /\bFETCH\s+FIRST\s+\d+\s+ROWS?\s+ONLY\b/gi,
      message: "FETCH FIRST is Oracle-style row limiting.",
      suggestedAction: "Future translation can adapt this into DuckDB LIMIT syntax.",
    }),
    ...createPatternDiagnostic({
      sql,
      dialect,
      ruleId: "dialect-mariadb-backtick-identifier",
      pattern: /`[^`]+`/g,
      message: "Backtick identifiers are common in MariaDB.",
      suggestedAction: "Future translation should normalize identifier quoting for DuckDB.",
    }),
  ];

  return [...functionDiagnostics, ...dialectDiagnostics];
};
