export type SqlDialectId = "duckdb" | "mariadb" | "oracle";

export type SqlIdentifierQuoteStyle = {
  opening: string;
  closing: string;
  example: string;
};

export type SqlFunctionCategory = "string" | "numeric" | "date";

export type SqlDialectFunctionSet = {
  string: string[];
  numeric: string[];
  date: string[];
};

export type SqlDialectProfile = {
  id: SqlDialectId;
  displayName: string;
  identifierQuoteStyle: SqlIdentifierQuoteStyle;
  functions: SqlDialectFunctionSet;
  joinSupportNotes: string[];
  limitFetchBehaviorNotes: string[];
};

export type SqlConceptCategory =
  | "join"
  | "filter"
  | "grouping"
  | "sorting"
  | "expression"
  | "function";

export type SqlConceptId =
  | "inner-join"
  | "left-outer-join"
  | "right-outer-join"
  | "full-outer-join"
  | "where"
  | "group-by"
  | "having"
  | "order-by"
  | "case-when"
  | "aliases"
  | "aggregate-functions"
  | "single-row-functions"
  | "nested-functions";

export type SqlConcept = {
  id: SqlConceptId;
  title: string;
  category: SqlConceptCategory;
  summary: string;
  beginnerNote: string;
  advancedNote: string;
  examples: string[];
  relatedConceptIds: SqlConceptId[];
};

export type SqlFunctionSupportLevel = "supported" | "alias" | "partial" | "unsupported";

export type SqlFunctionDialectCompatibility = {
  dialect: SqlDialectId;
  support: SqlFunctionSupportLevel;
  functionName: string | null;
  notes: string;
};

export type SqlFunctionCompatibility = {
  canonicalName: string;
  aliases: string[];
  category: SqlFunctionCategory;
  purpose: string;
  dialects: Record<SqlDialectId, SqlFunctionDialectCompatibility>;
  portabilityNotes: string[];
};
