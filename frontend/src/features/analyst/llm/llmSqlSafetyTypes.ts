import type { SqlDialectId } from "../../sqlIntelligence";
import type {
  AIColumnSensitivityClassification,
  AIColumnSensitivityLevel,
  AIMetadataContextPayload,
} from "./llmGovernanceTypes";

export type AISqlSafetyStatus = "safe" | "needs_review" | "blocked";

export type AISqlSafetyIssueSeverity = "warning" | "error";

export type AISqlSafetyIssueCode =
  | "empty_sql"
  | "non_select_statement"
  | "blocked_keyword"
  | "blocked_access_pattern"
  | "multiple_statements"
  | "unknown_table"
  | "unknown_column"
  | "ambiguous_column_validation"
  | "restricted_column"
  | "sensitive_column_review"
  | "caution_column_review"
  | "wildcard_column_review";

export type AISqlSafetyIssue = {
  severity: AISqlSafetyIssueSeverity;
  code: AISqlSafetyIssueCode;
  message: string;
  token?: string;
};

export type AISqlSafetyReferencedColumn = {
  tableName: string | null;
  columnName: string;
  sensitivity: AIColumnSensitivityClassification | null;
  validation: "known" | "unknown" | "ambiguous";
};

export type AISqlSafetyReferencedTable = {
  tableName: string;
  validation: "known" | "unknown";
};

export type AISqlSafetyTrustedColumn = {
  tableName: string;
  columnName: string;
  sensitivity: AIColumnSensitivityClassification;
};

export type AISqlSafetyTrustedMetadata = {
  tables: string[];
  columns: AISqlSafetyTrustedColumn[];
};

export type AISqlSafetyValidationInput = {
  sqlText: string;
  sqlDialect: SqlDialectId;
  metadataPayload: AIMetadataContextPayload;
};

export type AISqlSafetyValidationResult = {
  status: AISqlSafetyStatus;
  dialect: SqlDialectId;
  normalizedSqlPreview: string;
  referencedTables: AISqlSafetyReferencedTable[];
  referencedColumns: AISqlSafetyReferencedColumn[];
  highestSensitivityLevel: AIColumnSensitivityLevel | null;
  warnings: AISqlSafetyIssue[];
  blockingErrors: AISqlSafetyIssue[];
  summary: string;
};
