import type { SqlDialectProfile } from "../types";

export const duckDbDialectProfile: SqlDialectProfile = {
  id: "duckdb",
  displayName: "DuckDB",
  identifierQuoteStyle: {
    opening: "\"",
    closing: "\"",
    example: "\"column_name\"",
  },
  functions: {
    string: ["LENGTH", "SUBSTRING", "SUBSTR", "INSTR", "LPAD", "RPAD", "REPLACE"],
    numeric: ["ROUND", "TRUNC", "CEIL", "FLOOR"],
    date: ["STRFTIME", "DATE_PART", "DATE_TRUNC"],
  },
  joinSupportNotes: [
    "DuckDB is the internal execution dialect for FiltraQueri.",
    "Standard INNER, LEFT, RIGHT, and FULL OUTER JOIN patterns should be validated before execution.",
    "Future translation should target DuckDB syntax, not mutate the SQL Workspace draft directly.",
  ],
  limitFetchBehaviorNotes: [
    "DuckDB supports LIMIT for row-limited result previews.",
    "FETCH-style syntax should be normalized in a future translator before execution.",
  ],
};
