import type { SqlDialectId, SqlDialectProfile } from "../../sqlIntelligence";

export const SQL_DIALECT_SELECTOR_LABEL = "SQL guidance dialect";

export const SQL_DIALECT_EXECUTION_HELPER_TEXT =
  "Run Query executes with DuckDB. This setting guides templates and diagnostics.";

export const getSqlDialectExecutionAdvisory = (
  selectedDialect: SqlDialectId,
  selectedDialectProfile: Pick<SqlDialectProfile, "displayName">,
) => {
  if (selectedDialect === "duckdb") return null;

  return `Execution target is DuckDB; ${selectedDialectProfile.displayName} is used for drafting guidance only.`;
};
