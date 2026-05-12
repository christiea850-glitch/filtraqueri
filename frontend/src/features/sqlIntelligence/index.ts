export type {
  SqlConcept,
  SqlConceptCategory,
  SqlConceptId,
  SqlDialectFunctionSet,
  SqlDialectId,
  SqlDialectProfile,
  SqlFunctionCategory,
  SqlFunctionCompatibility,
  SqlFunctionDialectCompatibility,
  SqlFunctionSupportLevel,
  SqlIdentifierQuoteStyle,
} from "./types";

export {
  duckDbDialectProfile,
  getDialectProfile,
  listSupportedDialects,
  mariaDbDialectProfile,
  oracleDialectProfile,
  sqlDialectProfiles,
} from "./dialects";
export { getSqlConcept, listSqlConcepts, sqlConceptRegistry } from "./concepts";
export {
  getFunctionCompatibility,
  listFunctionCompatibility,
  sqlFunctionCompatibilityRegistry,
} from "./functions";
export {
  analyzeSqlWorkspaceDraft,
  createSqlDialectDiagnostics,
  matchSqlConcepts,
  matchSqlFunctions,
  scanSqlKeywords,
} from "./diagnostics";
export type {
  SqlConceptMatch,
  SqlDiagnosticSeverity,
  SqlFunctionMatch,
  SqlIntelligenceDiagnostic,
  SqlKeywordMatch,
  SqlWorkspaceAnalysis,
} from "./diagnostics";
export { getSqlConceptExplanation, getSqlFunctionExplanation } from "./explanations";
export type { SqlExplanation } from "./explanations";
export {
  clausePresenceRules,
  selectOnlySafetyRules,
  validateSqlClauses,
  validateSqlDialect,
  validateSqlSafety,
  validateSqlWorkspaceDraft,
  validationDiagnosticToIntelligenceDiagnostic,
  validationDiagnosticsToIntelligenceDiagnostics,
} from "./validation";
export type {
  SqlValidationCategory,
  SqlValidationDiagnostic,
  SqlValidationLocation,
  SqlValidationResult,
  SqlValidationRule,
  SqlValidationSeverity,
} from "./validation";
