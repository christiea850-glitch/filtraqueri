import type { ReportOpportunityDomain } from "../sql/reportIntelligencePlanner";
import type {
  AIColumnSensitivityCategory,
  AIColumnSensitivityLevel,
  AIMetadataContextPayload,
} from "./llmGovernanceTypes";

export type AIGovernedSuggestionReadiness =
  | "can_generate_now"
  | "needs_missing_fields"
  | "needs_user_review"
  | "blocked_sensitive_fields"
  | "unsupported";

export type AISuggestionConfidenceLevel = "Low" | "Medium" | "High";

export type AISuggestionSqlDraftStatus = "not_requested" | "blocked" | "eligible_later";

export type AISuggestionProvenance = {
  source: "future_ai_suggestion";
  mode: AIMetadataContextPayload["provenance"]["mode"];
  metadataPayloadSchemaVersion: AIMetadataContextPayload["schemaVersion"];
  rawRowsIncluded: false;
  sampleRowsIncluded: false;
  promptTextIncluded: false;
  sqlDraftIncluded: false;
};

export type AISuggestionSensitivitySummary = {
  highestLevel: AIColumnSensitivityLevel;
  categories: AIColumnSensitivityCategory[];
  restrictedColumnCount: number;
  sensitiveColumnCount: number;
  requiresUserReview: boolean;
  requiresConsentForSamples: boolean;
};

export type AIGovernedMetaReportSuggestion = {
  id: string;
  title: string;
  businessQuestion: string;
  whyItMatters: string;
  domains: ReportOpportunityDomain[];
  category: string;
  requiredTables: string[];
  requiredWorksheets: string[];
  requiredColumns: string[];
  missingRequirements: string[];
  assumptions: string[];
  confidenceLevel: AISuggestionConfidenceLevel;
  readiness: AIGovernedSuggestionReadiness;
  sensitivity: AISuggestionSensitivitySummary;
  provenance: AISuggestionProvenance;
  sqlDraftAllowedLater: boolean;
  sqlBlockedReason: string | null;
  sqlDraftIncluded: false;
  sqlDraftStatus: AISuggestionSqlDraftStatus;
  validationMessages: string[];
};

export type AIGovernedSuggestionValidationIssue = {
  severity: "warning" | "error";
  code:
    | "invalid_shape"
    | "invalid_enum"
    | "missing_table"
    | "missing_column"
    | "restricted_column"
    | "sensitive_column_review"
    | "sql_draft_present"
    | "raw_value_field_present"
    | "metadata_trimmed";
  message: string;
};

export type AIGovernedSuggestionValidationResult = {
  suggestion: AIGovernedMetaReportSuggestion;
  issues: AIGovernedSuggestionValidationIssue[];
};

export type AIGovernedSuggestionSummary = {
  total: number;
  byReadiness: Record<AIGovernedSuggestionReadiness, number>;
  byDomain: Partial<Record<ReportOpportunityDomain, number>>;
  byHighestSensitivity: Record<AIColumnSensitivityLevel, number>;
  sqlDraftIncluded: false;
};

export const AI_SUGGESTION_READINESS_VALUES: AIGovernedSuggestionReadiness[] = [
  "can_generate_now",
  "needs_missing_fields",
  "needs_user_review",
  "blocked_sensitive_fields",
  "unsupported",
];

export const AI_SUGGESTION_CONFIDENCE_VALUES: AISuggestionConfidenceLevel[] = [
  "Low",
  "Medium",
  "High",
];

export const AI_SUGGESTION_SQL_DRAFT_STATUS_VALUES: AISuggestionSqlDraftStatus[] = [
  "not_requested",
  "blocked",
  "eligible_later",
];

export const AI_SUGGESTION_DOMAIN_VALUES: ReportOpportunityDomain[] = [
  "property",
  "sales",
  "retail",
  "inventory",
  "payments",
  "finance",
  "operations",
  "hr",
  "healthcare",
  "logistics",
  "education",
  "support",
  "marketing",
  "generic",
];
