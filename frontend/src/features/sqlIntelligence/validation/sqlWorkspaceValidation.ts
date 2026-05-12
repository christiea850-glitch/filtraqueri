import type { SqlDialectId } from "../types";
import { validateSqlClauses } from "./sqlClauseValidator";
import { validateSqlDialect } from "./sqlDialectValidator";
import { validateSqlSafety } from "./sqlSafetyValidator";
import type { SqlValidationDiagnostic, SqlValidationResult } from "./sqlValidationTypes";

const severityRank: Record<SqlValidationDiagnostic["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export const validateSqlWorkspaceDraft = (
  sql: string,
  dialect: SqlDialectId = "duckdb",
): SqlValidationResult => {
  const diagnostics = [
    ...validateSqlSafety(sql, dialect),
    ...validateSqlClauses(sql, dialect),
    ...validateSqlDialect(sql, dialect),
  ].sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      left.location.start - right.location.start ||
      left.location.end - right.location.end,
  );

  return {
    dialect,
    diagnostics,
    hasErrors: diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    hasWarnings: diagnostics.some((diagnostic) => diagnostic.severity === "warning"),
  };
};
