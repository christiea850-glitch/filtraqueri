import type { SqlDialectProfile } from "../types";

export const postgreSqlDialectProfile: SqlDialectProfile = {
  id: "postgresql",
  displayName: "PostgreSQL",
  identifierQuoteStyle: {
    opening: "\"",
    closing: "\"",
    example: "\"column_name\"",
  },
  functions: {
    string: ["LENGTH", "SUBSTRING", "POSITION", "LPAD", "RPAD", "REPLACE"],
    numeric: ["ROUND", "TRUNC", "CEIL", "FLOOR"],
    date: ["TO_CHAR", "DATE_PART", "DATE_TRUNC"],
  },
  joinSupportNotes: [
    "PostgreSQL rendering is available for supported canonical Business SQL plans.",
    "This profile does not imply a live PostgreSQL connection or execution permission.",
    "Standard INNER JOIN rendering follows canonical join-path metadata.",
  ],
  limitFetchBehaviorNotes: [
    "PostgreSQL supports LIMIT for row-limited analytical previews.",
    "Execution against a real PostgreSQL connection remains governed by PS-Exec policy gates.",
  ],
};
