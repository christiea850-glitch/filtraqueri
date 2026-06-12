import type { SqlDialectId } from "../../sqlIntelligence";

export type SqlDialectDraftConversionKind = "row_limit";

export type SqlDialectDraftConversion = {
  canConvert: boolean;
  convertedSql: string;
  summary: string;
  warnings: string[];
  conversionKind: SqlDialectDraftConversionKind | null;
};

export type SqlDialectDraftConversionInput = {
  sql: string;
  fromDialect?: SqlDialectId;
  toDialect: SqlDialectId;
};

const noConversion = (summary: string, warnings: string[] = []): SqlDialectDraftConversion => ({
  canConvert: false,
  convertedSql: "",
  summary,
  warnings,
  conversionKind: null,
});

const limitPattern = /(\s+)LIMIT\s+(\d+)\s*(;)?\s*$/i;
const oracleFetchFirstPattern = /(\s+)FETCH\s+FIRST\s+(\d+)\s+ROWS\s+ONLY\s*(;)?\s*$/i;
const complexSqlWarning = "Complex SQL is not converted automatically yet.";

const stripSingleTrailingSemicolon = (sql: string) => sql.replace(/;\s*$/, "");

const sanitizeSqlForStructureChecks = (sql: string) => {
  let sanitized = "";
  let quote: "single" | "double" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (lineComment) {
      sanitized += character === "\n" ? "\n" : " ";
      if (character === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        sanitized += "  ";
        index += 1;
        blockComment = false;
      } else {
        sanitized += character === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (quote === "single") {
      if (character === "'" && nextCharacter === "'") {
        sanitized += "  ";
        index += 1;
      } else {
        sanitized += character === "'" ? " " : character === "\n" ? "\n" : " ";
        if (character === "'") quote = null;
      }
      continue;
    }

    if (quote === "double") {
      if (character === '"' && nextCharacter === '"') {
        sanitized += "  ";
        index += 1;
      } else {
        sanitized += character === '"' ? " " : character === "\n" ? "\n" : " ";
        if (character === '"') quote = null;
      }
      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      sanitized += "  ";
      index += 1;
      lineComment = true;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      sanitized += "  ";
      index += 1;
      blockComment = true;
      continue;
    }

    if (character === "'") {
      sanitized += " ";
      quote = "single";
      continue;
    }

    if (character === '"') {
      sanitized += " ";
      quote = "double";
      continue;
    }

    sanitized += character;
  }

  return sanitized;
};

const countKeywordMatches = (sql: string, pattern: RegExp) => {
  const matches = sql.match(pattern);
  return matches?.length || 0;
};

const hasMultipleStatements = (sql: string) => {
  const trimmed = sql.trim();
  const withoutTrailingSemicolon = stripSingleTrailingSemicolon(trimmed);

  let quote: "single" | "double" | null = null;
  for (let index = 0; index < withoutTrailingSemicolon.length; index += 1) {
    const character = withoutTrailingSemicolon[index];
    const nextCharacter = withoutTrailingSemicolon[index + 1];

    if (quote === "single") {
      if (character === "'" && nextCharacter === "'") {
        index += 1;
      } else if (character === "'") {
        quote = null;
      }
      continue;
    }

    if (quote === "double") {
      if (character === '"' && nextCharacter === '"') {
        index += 1;
      } else if (character === '"') {
        quote = null;
      }
      continue;
    }

    if (character === "'") {
      quote = "single";
      continue;
    }

    if (character === '"') {
      quote = "double";
      continue;
    }

    if (character === ";") return true;
  }

  return false;
};

const hasParenthesizedSelect = (sql: string) => {
  const tokens = sql.match(/\(|\)|\bSELECT\b/gi) || [];
  let depth = 0;

  return tokens.some((token) => {
    if (token === "(") {
      depth += 1;
      return false;
    }

    if (token === ")") {
      depth = Math.max(0, depth - 1);
      return false;
    }

    return depth > 0 && /^SELECT$/i.test(token);
  });
};

const hasAmbiguousRowLimitSyntax = (sql: string) => {
  const withoutTrailingSemicolon = stripSingleTrailingSemicolon(sql.trim());
  return (
    countKeywordMatches(withoutTrailingSemicolon, /\bLIMIT\s+\d+\b/gi) > 1 ||
    countKeywordMatches(withoutTrailingSemicolon, /\bFETCH\s+FIRST\s+\d+\s+ROWS\s+ONLY\b/gi) > 1
  );
};

const hasComplexSqlContext = (sql: string) => {
  const structuralSql = sanitizeSqlForStructureChecks(sql);
  const withoutTrailingSemicolon = stripSingleTrailingSemicolon(structuralSql.trim());

  return (
    /^WITH\b/i.test(withoutTrailingSemicolon) ||
    /\b(?:UNION|INTERSECT|EXCEPT)\b/i.test(withoutTrailingSemicolon) ||
    hasParenthesizedSelect(withoutTrailingSemicolon) ||
    countKeywordMatches(withoutTrailingSemicolon, /\bSELECT\b/gi) > 1 ||
    hasAmbiguousRowLimitSyntax(withoutTrailingSemicolon)
  );
};

export const getDialectDraftConversion = ({
  sql,
  fromDialect,
  toDialect,
}: SqlDialectDraftConversionInput): SqlDialectDraftConversion => {
  const trimmedSql = sql.trim();
  if (!trimmedSql) return noConversion("No SQL draft is available to convert.");

  if (hasMultipleStatements(trimmedSql)) {
    return noConversion("No safe dialect conversion available yet.", [
      "Multiple SQL statements are not converted automatically.",
    ]);
  }

  if (hasComplexSqlContext(trimmedSql)) {
    return noConversion("No safe dialect conversion available yet.", [complexSqlWarning]);
  }

  if (toDialect === "oracle") {
    const limitMatch = sql.match(limitPattern);
    if (!limitMatch) return noConversion("No supported DuckDB/MariaDB LIMIT clause was found.");

    const [matchedText, leadingWhitespace, rowCount, semicolon] = limitMatch;
    const prefix = sql.slice(0, sql.length - matchedText.length);
    return {
      canConvert: true,
      convertedSql: `${prefix}${leadingWhitespace}FETCH FIRST ${rowCount} ROWS ONLY${semicolon || ""}`,
      summary: `Convert trailing LIMIT ${rowCount} to Oracle FETCH FIRST ${rowCount} ROWS ONLY.`,
      warnings: [],
      conversionKind: "row_limit",
    };
  }

  if (toDialect === "duckdb" || toDialect === "mariadb") {
    const fetchFirstMatch = sql.match(oracleFetchFirstPattern);
    if (!fetchFirstMatch) return noConversion("No supported Oracle FETCH FIRST clause was found.");

    const [matchedText, leadingWhitespace, rowCount, semicolon] = fetchFirstMatch;
    const prefix = sql.slice(0, sql.length - matchedText.length);
    return {
      canConvert: true,
      convertedSql: `${prefix}${leadingWhitespace}LIMIT ${rowCount}${semicolon || ""}`,
      summary: `Convert trailing FETCH FIRST ${rowCount} ROWS ONLY to ${toDialect === "duckdb" ? "DuckDB" : "MariaDB"} LIMIT ${rowCount}.`,
      warnings: [],
      conversionKind: "row_limit",
    };
  }

  return noConversion(
    fromDialect
      ? `No safe ${fromDialect} to ${toDialect} dialect conversion available yet.`
      : "No safe dialect conversion available yet.",
  );
};
