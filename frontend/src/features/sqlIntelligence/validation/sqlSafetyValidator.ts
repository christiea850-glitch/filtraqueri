import type { SqlDialectId } from "../types";
import { selectOnlySafetyRules } from "./sqlValidationRules";
import type { SqlValidationDiagnostic, SqlValidationRule } from "./sqlValidationTypes";

const createRuleDiagnostics = (
  sql: string,
  dialect: SqlDialectId,
  rules: SqlValidationRule[],
): SqlValidationDiagnostic[] =>
  rules.flatMap((rule) =>
    [...sql.matchAll(rule.pattern)].map((match) => {
      const start = match.index || 0;

      return {
        ruleId: rule.ruleId,
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
        location: {
          start,
          end: start + match[0].length,
        },
        dialect,
        concept: rule.concept || null,
        suggestedAction: rule.suggestedAction,
      };
    }),
  );

const findUnsafeStatementSeparators = (
  sql: string,
  dialect: SqlDialectId,
): SqlValidationDiagnostic[] => {
  const trimmedSql = sql.trim();
  if (!trimmedSql) return [];

  const separatorMatches = [...trimmedSql.matchAll(/;/g)].filter(
    (match) => (match.index || 0) < trimmedSql.length - 1,
  );

  return separatorMatches.map((match) => {
    const start = match.index || 0;
    return {
      ruleId: "safety-multi-statement",
      severity: "error" as const,
      category: "safety" as const,
      message: "Multiple SQL statements were detected.",
      location: {
        start,
        end: start + 1,
      },
      dialect,
      concept: null,
      suggestedAction: "Keep one SELECT statement in the SQL workspace.",
    };
  });
};

export const validateSqlSafety = (
  sql: string,
  dialect: SqlDialectId,
): SqlValidationDiagnostic[] => [
  ...createRuleDiagnostics(sql, dialect, selectOnlySafetyRules),
  ...findUnsafeStatementSeparators(sql, dialect),
];
