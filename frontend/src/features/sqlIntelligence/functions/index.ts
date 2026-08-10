import type { SqlDialectId, SqlFunctionCompatibility } from "../types";

const support = (
  dialect: SqlDialectId,
  functionName: string | null,
  notes: string,
  supportLevel: SqlFunctionCompatibility["dialects"][SqlDialectId]["support"] = "supported",
) => ({
  dialect,
  support: supportLevel,
  functionName,
  notes,
});

export const sqlFunctionCompatibilityRegistry: Record<string, SqlFunctionCompatibility> = {
  LENGTH: {
    canonicalName: "LENGTH",
    aliases: [],
    category: "string",
    purpose: "Returns the length of a text value.",
    dialects: {
      duckdb: support("duckdb", "LENGTH", "Supported for text length checks."),
      mariadb: support("mariadb", "LENGTH", "Returns byte length; CHAR_LENGTH may be needed for character length."),
      oracle: support("oracle", "LENGTH", "Supported for character length."),
      postgresql: support("postgresql", "LENGTH", "Supported for text length checks."),
    },
    portabilityNotes: ["MariaDB byte-vs-character length can matter for multi-byte text."],
  },
  SUBSTRING: {
    canonicalName: "SUBSTRING",
    aliases: ["SUBSTR"],
    category: "string",
    purpose: "Extracts part of a text value.",
    dialects: {
      duckdb: support("duckdb", "SUBSTRING", "SUBSTR is also accepted as a common alias."),
      mariadb: support("mariadb", "SUBSTRING", "SUBSTR is also accepted as a common alias."),
      oracle: support("oracle", "SUBSTR", "Oracle commonly uses SUBSTR rather than SUBSTRING.", "alias"),
      postgresql: support("postgresql", "SUBSTRING", "Supported for common substring forms."),
    },
    portabilityNotes: ["Argument order is broadly similar for common cases, but edge cases should be validated."],
  },
  INSTR: {
    canonicalName: "INSTR",
    aliases: [],
    category: "string",
    purpose: "Finds the position of one text value inside another.",
    dialects: {
      duckdb: support("duckdb", "INSTR", "Supported for simple substring position checks."),
      mariadb: support("mariadb", "INSTR", "Supported with INSTR(text, substring) argument order."),
      oracle: support("oracle", "INSTR", "Supports additional optional position and occurrence arguments.", "partial"),
      postgresql: support("postgresql", "POSITION", "Use POSITION(substring IN text) rather than INSTR.", "alias"),
    },
    portabilityNotes: ["Optional Oracle arguments need explicit translator support before execution."],
  },
  LPAD: {
    canonicalName: "LPAD",
    aliases: [],
    category: "string",
    purpose: "Pads text on the left to a target length.",
    dialects: {
      duckdb: support("duckdb", "LPAD", "Supported for text padding."),
      mariadb: support("mariadb", "LPAD", "Supported for text padding."),
      oracle: support("oracle", "LPAD", "Supported for text padding."),
      postgresql: support("postgresql", "LPAD", "Supported for text padding."),
    },
    portabilityNotes: ["Validate target length and pad text argument types."],
  },
  RPAD: {
    canonicalName: "RPAD",
    aliases: [],
    category: "string",
    purpose: "Pads text on the right to a target length.",
    dialects: {
      duckdb: support("duckdb", "RPAD", "Supported for text padding."),
      mariadb: support("mariadb", "RPAD", "Supported for text padding."),
      oracle: support("oracle", "RPAD", "Supported for text padding."),
      postgresql: support("postgresql", "RPAD", "Supported for text padding."),
    },
    portabilityNotes: ["Validate target length and pad text argument types."],
  },
  REPLACE: {
    canonicalName: "REPLACE",
    aliases: [],
    category: "string",
    purpose: "Replaces matching text inside a value.",
    dialects: {
      duckdb: support("duckdb", "REPLACE", "Supported for simple text replacement."),
      mariadb: support("mariadb", "REPLACE", "Supported for simple text replacement."),
      oracle: support("oracle", "REPLACE", "Supported for simple text replacement."),
      postgresql: support("postgresql", "REPLACE", "Supported for simple text replacement."),
    },
    portabilityNotes: ["Null handling should be explained when replacement inputs are nullable."],
  },
  ROUND: {
    canonicalName: "ROUND",
    aliases: [],
    category: "numeric",
    purpose: "Rounds a numeric value to a requested precision.",
    dialects: {
      duckdb: support("duckdb", "ROUND", "Supported for numeric rounding."),
      mariadb: support("mariadb", "ROUND", "Supported for numeric rounding."),
      oracle: support("oracle", "ROUND", "Supported for numeric rounding; also used with dates in Oracle.", "partial"),
      postgresql: support("postgresql", "ROUND", "Supported for numeric rounding."),
    },
    portabilityNotes: ["Oracle date ROUND should not be treated like numeric ROUND without validation."],
  },
  TRUNC: {
    canonicalName: "TRUNC",
    aliases: ["TRUNCATE"],
    category: "numeric",
    purpose: "Truncates numeric precision or, in Oracle, can truncate dates.",
    dialects: {
      duckdb: support("duckdb", "TRUNC", "Numeric truncation should be verified before execution.", "partial"),
      mariadb: support("mariadb", "TRUNCATE", "MariaDB commonly uses TRUNCATE(number, decimals).", "alias"),
      oracle: support("oracle", "TRUNC", "Oracle uses TRUNC for numbers and dates.", "partial"),
      postgresql: support("postgresql", "TRUNC", "Supported for numeric truncation.", "partial"),
    },
    portabilityNotes: [
      "TRUNC and TRUNCATE are not interchangeable in every dialect.",
      "Date truncation needs separate validation from numeric truncation.",
    ],
  },
  CEIL: {
    canonicalName: "CEIL",
    aliases: ["CEILING"],
    category: "numeric",
    purpose: "Rounds a numeric value up to the nearest integer.",
    dialects: {
      duckdb: support("duckdb", "CEIL", "Supported for numeric ceiling."),
      mariadb: support("mariadb", "CEIL", "CEILING is also common."),
      oracle: support("oracle", "CEIL", "Supported for numeric ceiling."),
      postgresql: support("postgresql", "CEIL", "CEILING is also common."),
    },
    portabilityNotes: ["CEILING can be treated as an alias where the target dialect supports it."],
  },
  FLOOR: {
    canonicalName: "FLOOR",
    aliases: [],
    category: "numeric",
    purpose: "Rounds a numeric value down to the nearest integer.",
    dialects: {
      duckdb: support("duckdb", "FLOOR", "Supported for numeric floor."),
      mariadb: support("mariadb", "FLOOR", "Supported for numeric floor."),
      oracle: support("oracle", "FLOOR", "Supported for numeric floor."),
      postgresql: support("postgresql", "FLOOR", "Supported for numeric floor."),
    },
    portabilityNotes: ["Validate input is numeric or safely castable before execution."],
  },
  DATE_FORMAT: {
    canonicalName: "DATE_FORMAT",
    aliases: ["TO_CHAR", "STRFTIME"],
    category: "date",
    purpose: "Formats a date or timestamp as text.",
    dialects: {
      duckdb: support("duckdb", "STRFTIME", "DuckDB uses strftime-style formatting tokens.", "alias"),
      mariadb: support("mariadb", "DATE_FORMAT", "MariaDB uses percent-prefixed date format tokens."),
      oracle: support("oracle", "TO_CHAR", "Oracle uses TO_CHAR with Oracle-specific format models.", "alias"),
      postgresql: support("postgresql", "TO_CHAR", "PostgreSQL uses TO_CHAR with PostgreSQL format patterns.", "alias"),
    },
    portabilityNotes: [
      "Date format tokens differ significantly across dialects.",
      "Future translation should use a token table rather than direct string replacement.",
    ],
  },
  TO_CHAR: {
    canonicalName: "TO_CHAR",
    aliases: ["DATE_FORMAT", "STRFTIME"],
    category: "date",
    purpose: "Formats values, commonly dates, as text.",
    dialects: {
      duckdb: support("duckdb", "STRFTIME", "Use STRFTIME for date formatting in DuckDB.", "alias"),
      mariadb: support("mariadb", "DATE_FORMAT", "Use DATE_FORMAT for MariaDB date formatting.", "alias"),
      oracle: support("oracle", "TO_CHAR", "Native Oracle date and number formatting function."),
      postgresql: support("postgresql", "TO_CHAR", "Native PostgreSQL date and number formatting function."),
    },
    portabilityNotes: [
      "TO_CHAR can format dates and numbers in Oracle; initial FiltraQueri support should focus on dates.",
      "Translator support must separate format model conversion from function-name conversion.",
    ],
  },
};

const normalizeFunctionName = (functionName: string) => functionName.trim().toUpperCase();

export const getFunctionCompatibility = (
  functionName: string,
): SqlFunctionCompatibility | undefined => {
  const normalizedName = normalizeFunctionName(functionName);
  return Object.values(sqlFunctionCompatibilityRegistry).find(
    (entry) => entry.canonicalName === normalizedName || entry.aliases.includes(normalizedName),
  );
};

export const listFunctionCompatibility = (): SqlFunctionCompatibility[] =>
  Object.values(sqlFunctionCompatibilityRegistry);
