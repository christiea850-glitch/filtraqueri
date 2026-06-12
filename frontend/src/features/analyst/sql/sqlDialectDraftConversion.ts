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

const stripSingleTrailingSemicolon = (sql: string) => sql.replace(/;\s*$/, "");

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

const hasAmbiguousRowLimitSyntax = (sql: string) => {
  const withoutTrailingSemicolon = stripSingleTrailingSemicolon(sql.trim());
  return (
    countKeywordMatches(withoutTrailingSemicolon, /\bLIMIT\s+\d+\b/gi) > 1 ||
    countKeywordMatches(withoutTrailingSemicolon, /\bFETCH\s+FIRST\s+\d+\s+ROWS\s+ONLY\b/gi) > 1
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

  if (hasAmbiguousRowLimitSyntax(trimmedSql)) {
    return noConversion("No safe dialect conversion available yet.", [
      "Multiple row-limit clauses were detected.",
    ]);
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
