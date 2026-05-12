import type { SqlConceptId, SqlDialectId } from "../types";

export type SqlValidationSeverity = "info" | "warning" | "error";

export type SqlValidationCategory =
  | "safety"
  | "clause"
  | "dialect"
  | "function"
  | "compatibility"
  | "structure";

export type SqlValidationLocation = {
  start: number;
  end: number;
};

export type SqlValidationDiagnostic = {
  ruleId: string;
  severity: SqlValidationSeverity;
  category: SqlValidationCategory;
  message: string;
  location: SqlValidationLocation;
  dialect: SqlDialectId | null;
  concept: SqlConceptId | null;
  suggestedAction: string;
};

export type SqlValidationResult = {
  dialect: SqlDialectId;
  diagnostics: SqlValidationDiagnostic[];
  hasErrors: boolean;
  hasWarnings: boolean;
};

export type SqlValidationRule = {
  ruleId: string;
  category: SqlValidationCategory;
  severity: SqlValidationSeverity;
  pattern: RegExp;
  message: string;
  suggestedAction: string;
  concept?: SqlConceptId;
};
