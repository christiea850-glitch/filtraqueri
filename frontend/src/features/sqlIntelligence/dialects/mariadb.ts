import type { SqlDialectProfile } from "../types";

export const mariaDbDialectProfile: SqlDialectProfile = {
  id: "mariadb",
  displayName: "MariaDB",
  identifierQuoteStyle: {
    opening: "`",
    closing: "`",
    example: "`column_name`",
  },
  functions: {
    string: ["LENGTH", "SUBSTRING", "INSTR", "LPAD", "RPAD", "REPLACE"],
    numeric: ["ROUND", "TRUNCATE", "CEIL", "FLOOR"],
    date: ["DATE_FORMAT", "DATE", "YEAR", "MONTH", "DAY"],
  },
  joinSupportNotes: [
    "MariaDB-style SQL should be treated as an input dialect, not a separate execution engine.",
    "INNER, LEFT OUTER, and RIGHT OUTER JOIN are common MariaDB patterns.",
    "FULL OUTER JOIN is not a native MariaDB join form and should be flagged before translation.",
  ],
  limitFetchBehaviorNotes: [
    "MariaDB commonly uses LIMIT and optional OFFSET for pagination.",
    "Future translation should convert compatible LIMIT forms into DuckDB syntax before execution.",
  ],
};
