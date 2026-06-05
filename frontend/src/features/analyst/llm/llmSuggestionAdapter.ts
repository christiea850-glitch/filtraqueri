import type { AIMetadataContextPayload } from "./llmGovernanceTypes";
import {
  createMockAISuggestionCandidatesFromMetadata,
  type MockAIMetadataSuggestionCandidate,
} from "./llmMockSuggestionGenerator";
import type {
  AIGovernedMetaReportSuggestion,
  AIGovernedSuggestionValidationIssue,
  AIGovernedSuggestionSummary,
} from "./llmSuggestionContract";
import {
  groupAIGovernedSuggestions,
  summarizeAIGovernedSuggestions,
  type AIGovernedSuggestionGroups,
} from "./llmSuggestionGrouping";
import {
  validateAIGovernedSuggestion,
} from "./llmSuggestionValidator";
import type { AISqlSafetyStatus } from "./llmSqlSafetyTypes";
import { validateAISqlSafety } from "./llmSqlSafetyValidator";

export type MockAISuggestionSqlEligibilityStatus =
  | "eligible_later"
  | "not_requested"
  | "blocked";

export type MockAISuggestionSqlEligibility = {
  suggestionId: string;
  status: MockAISuggestionSqlEligibilityStatus;
  safetyStatus: AISqlSafetyStatus | "not_checked";
  warningCount: number;
  blockingErrorCount: number;
  notes: string[];
};

export type MockAISuggestionValidationRecord = {
  suggestionId: string;
  issues: AIGovernedSuggestionValidationIssue[];
};

export type MockAISuggestionRunSummary = {
  generatedCandidateCount: number;
  validatedSuggestionCount: number;
  canGenerateNowCount: number;
  needsReviewCount: number;
  blockedCount: number;
  missingRequirementsCount: number;
  sqlEligibleLaterCount: number;
  sqlNotRequestedCount: number;
  sqlBlockedCount: number;
  sqlDraftIncluded: false;
  rawValuesIncluded: false;
};

export type MockGovernedAISuggestionAdapterResult = {
  generatedSuggestions: MockAIMetadataSuggestionCandidate[];
  validatedSuggestions: AIGovernedMetaReportSuggestion[];
  groupedSuggestions: AIGovernedSuggestionGroups;
  suggestionSummary: AIGovernedSuggestionSummary;
  runSummary: MockAISuggestionRunSummary;
  validationIssues: MockAISuggestionValidationRecord[];
  sqlEligibility: MockAISuggestionSqlEligibility[];
  governanceNotes: string[];
  rawValuesIncluded: false;
  sqlDraftIncluded: false;
};

const escapeSqlIdentifier = (identifier: string): string =>
  identifier.replace(/"/g, "\"\"");

const createLocalSqlEligibilityProbe = (suggestion: AIGovernedMetaReportSuggestion): string | null => {
  const table = suggestion.requiredTables[0];
  if (!table) return null;
  return `SELECT 1 FROM "${escapeSqlIdentifier(table)}" LIMIT 1`;
};

const evaluateSqlEligibility = (
  suggestion: AIGovernedMetaReportSuggestion,
  payload: AIMetadataContextPayload,
): MockAISuggestionSqlEligibility => {
  if (
    suggestion.readiness === "blocked_sensitive_fields" ||
    suggestion.readiness === "needs_missing_fields" ||
    suggestion.readiness === "unsupported"
  ) {
    return {
      suggestionId: suggestion.id,
      status: "not_requested",
      safetyStatus: "not_checked",
      warningCount: 0,
      blockingErrorCount: 0,
      notes: ["Future SQL eligibility was not checked because the suggestion is blocked, missing requirements, or unsupported."],
    };
  }

  const probe = createLocalSqlEligibilityProbe(suggestion);
  if (!probe) {
    return {
      suggestionId: suggestion.id,
      status: "not_requested",
      safetyStatus: "not_checked",
      warningCount: 0,
      blockingErrorCount: 0,
      notes: ["Future SQL eligibility was not checked because no trusted table was required."],
    };
  }

  const safety = validateAISqlSafety({
    sqlText: probe,
    sqlDialect: payload.sqlDialect.id,
    metadataPayload: payload,
  });

  if (safety.status === "blocked") {
    return {
      suggestionId: suggestion.id,
      status: "blocked",
      safetyStatus: safety.status,
      warningCount: safety.warnings.length,
      blockingErrorCount: safety.blockingErrors.length,
      notes: ["K11D blocked the future SQL eligibility probe. No SQL draft is returned."],
    };
  }

  return {
    suggestionId: suggestion.id,
    status: "eligible_later",
    safetyStatus: safety.status,
    warningCount: safety.warnings.length,
    blockingErrorCount: safety.blockingErrors.length,
    notes: ["K11D allowed metadata-only future SQL eligibility status. No SQL draft is returned."],
  };
};

export const summarizeMockAISuggestionRun = ({
  generatedSuggestions,
  validatedSuggestions,
  sqlEligibility,
}: Pick<
  MockGovernedAISuggestionAdapterResult,
  "generatedSuggestions" | "validatedSuggestions" | "sqlEligibility"
>): MockAISuggestionRunSummary => ({
  generatedCandidateCount: generatedSuggestions.length,
  validatedSuggestionCount: validatedSuggestions.length,
  canGenerateNowCount: validatedSuggestions.filter((suggestion) => suggestion.readiness === "can_generate_now").length,
  needsReviewCount: validatedSuggestions.filter((suggestion) => suggestion.readiness === "needs_user_review").length,
  blockedCount: validatedSuggestions.filter((suggestion) => suggestion.readiness === "blocked_sensitive_fields").length,
  missingRequirementsCount: validatedSuggestions.filter((suggestion) => suggestion.readiness === "needs_missing_fields").length,
  sqlEligibleLaterCount: sqlEligibility.filter((eligibility) => eligibility.status === "eligible_later").length,
  sqlNotRequestedCount: sqlEligibility.filter((eligibility) => eligibility.status === "not_requested").length,
  sqlBlockedCount: sqlEligibility.filter((eligibility) => eligibility.status === "blocked").length,
  sqlDraftIncluded: false,
  rawValuesIncluded: false,
});

export const createMockGovernedAISuggestionsFromMetadata = (
  payload: AIMetadataContextPayload,
): MockGovernedAISuggestionAdapterResult => {
  const generatedSuggestions = createMockAISuggestionCandidatesFromMetadata(payload);
  const validationResults = generatedSuggestions.map((candidate) =>
    validateAIGovernedSuggestion(candidate, payload),
  );
  const validatedSuggestions = validationResults.map((result) => result.suggestion);
  const groupedSuggestions = groupAIGovernedSuggestions(validatedSuggestions);
  const suggestionSummary = summarizeAIGovernedSuggestions(validatedSuggestions);
  const validationIssues = validationResults.map((result) => ({
    suggestionId: result.suggestion.id,
    issues: result.issues,
  }));
  const sqlEligibility = validatedSuggestions.map((suggestion) =>
    evaluateSqlEligibility(suggestion, payload),
  );
  const runSummary = summarizeMockAISuggestionRun({
    generatedSuggestions,
    validatedSuggestions,
    sqlEligibility,
  });

  return {
    generatedSuggestions,
    validatedSuggestions,
    groupedSuggestions,
    suggestionSummary,
    runSummary,
    validationIssues,
    sqlEligibility,
    governanceNotes: [
      "Mock suggestions are generated locally from K11A metadata only.",
      "K11C validation/sanitization is applied before suggestions are returned.",
      "K11D is used only for future SQL eligibility metadata; no SQL draft is returned, inserted, or executed.",
      "Raw rows, sample values, top values, prompt text, and LLM responses are not included.",
    ],
    rawValuesIncluded: false,
    sqlDraftIncluded: false,
  };
};
