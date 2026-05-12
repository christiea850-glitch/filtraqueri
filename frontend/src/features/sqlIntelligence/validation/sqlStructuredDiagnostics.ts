import type { SqlIntelligenceDiagnostic } from "../diagnostics/sqlDialectDiagnostics";
import type { SqlValidationDiagnostic, SqlValidationSeverity } from "./sqlValidationTypes";

const titleForDiagnostic = (diagnostic: SqlValidationDiagnostic) =>
  diagnostic.ruleId
    .split("-")
    .filter(Boolean)
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || diagnostic.category;

const mapSeverity = (severity: SqlValidationSeverity): SqlIntelligenceDiagnostic["severity"] =>
  severity;

export const validationDiagnosticToIntelligenceDiagnostic = (
  diagnostic: SqlValidationDiagnostic,
): SqlIntelligenceDiagnostic => ({
  id: `${diagnostic.ruleId}-${diagnostic.location.start}`,
  severity: mapSeverity(diagnostic.severity),
  title: titleForDiagnostic(diagnostic),
  message: `${diagnostic.message} ${diagnostic.suggestedAction}`,
  start: diagnostic.location.start,
  end: diagnostic.location.end,
  source:
    diagnostic.category === "function"
      ? "function"
      : diagnostic.category === "dialect" || diagnostic.category === "compatibility"
        ? "dialect"
        : diagnostic.concept
          ? "concept"
          : "validation",
});

export const validationDiagnosticsToIntelligenceDiagnostics = (
  diagnostics: SqlValidationDiagnostic[],
): SqlIntelligenceDiagnostic[] =>
  diagnostics.map(validationDiagnosticToIntelligenceDiagnostic);
