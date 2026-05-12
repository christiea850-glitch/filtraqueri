import type { SqlDialectProfile } from "../types";

export const oracleDialectProfile: SqlDialectProfile = {
  id: "oracle",
  displayName: "Oracle SQL",
  identifierQuoteStyle: {
    opening: "\"",
    closing: "\"",
    example: "\"COLUMN_NAME\"",
  },
  functions: {
    string: ["LENGTH", "SUBSTR", "INSTR", "LPAD", "RPAD", "REPLACE"],
    numeric: ["ROUND", "TRUNC", "CEIL", "FLOOR"],
    date: ["TO_CHAR", "TRUNC", "ADD_MONTHS", "MONTHS_BETWEEN"],
  },
  joinSupportNotes: [
    "Oracle-style SQL should be treated as an input dialect, not a separate execution engine.",
    "Modern Oracle SQL supports ANSI INNER, LEFT OUTER, RIGHT OUTER, and FULL OUTER JOIN syntax.",
    "Legacy Oracle outer join operators should be validation-only until a future translator supports them safely.",
  ],
  limitFetchBehaviorNotes: [
    "Modern Oracle SQL commonly uses FETCH FIRST n ROWS ONLY.",
    "Older Oracle patterns may use ROWNUM; those should be explained and translated only in a later phase.",
  ],
};
