import type {
  AIColumnSensitivityCategory,
  AIColumnSensitivityLevel,
  AIMetadataContextPayload,
} from "./llmGovernanceTypes";

export type AIFutureProviderMode =
  | "local_mock"
  | "metadata_only_provider_ready"
  | "provider_disabled";

export type AIProviderConsentStatus =
  | "not_requested"
  | "granted"
  | "denied"
  | "revoked";

export type AIProviderPayloadScope =
  | "metadata_only"
  | "metadata_plus_samples_requires_consent"
  | "blocked";

export type AIProviderBoundaryStatus = "open" | "closed";

export type AIProviderConsentProvenance =
  | "system_default"
  | "user"
  | "enterprise_policy"
  | "unknown";

export type AIProviderPayloadCategory =
  | "dataset_metadata"
  | "worksheet_metadata"
  | "column_metadata"
  | "relationship_metadata"
  | "data_profile_summary"
  | "deterministic_report_summaries"
  | "sensitivity_metadata"
  | "raw_rows"
  | "sample_values"
  | "top_values"
  | "prompt_text"
  | "sql_drafts"
  | "api_keys"
  | "provider_response";

export type AIProviderBoundaryBlockReasonCode =
  | "provider_disabled"
  | "local_mock_only"
  | "consent_not_granted"
  | "consent_denied"
  | "consent_revoked"
  | "restricted_columns_present"
  | "unsupported_payload_scope"
  | "metadata_only_required"
  | "samples_blocked_by_policy"
  | "raw_values_blocked"
  | "sql_drafts_blocked";

export type AIProviderConsentRecord = {
  status: AIProviderConsentStatus;
  provenance: AIProviderConsentProvenance;
  requestedAt: string | null;
  decidedAt: string | null;
  revokedAt: string | null;
  notes: string[];
};

export type AIProviderBoundaryPolicyInput = {
  mode?: AIFutureProviderMode;
  payloadScope?: AIProviderPayloadScope;
  consent?: Partial<AIProviderConsentRecord>;
  enterprisePolicyAllowsSamples?: boolean;
  allowSamplesWithConsent?: boolean;
  allowSqlDrafts?: boolean;
};

export type AIProviderBoundaryPolicy = {
  mode: AIFutureProviderMode;
  payloadScope: AIProviderPayloadScope;
  consent: AIProviderConsentRecord;
  requiresExplicitConsent: boolean;
  enterprisePolicyAllowsSamples: boolean;
  allowSamplesWithConsent: boolean;
  allowSqlDrafts: boolean;
  allowedCategories: AIProviderPayloadCategory[];
  disallowedCategories: AIProviderPayloadCategory[];
  notes: string[];
};

export type AIProviderBoundaryCheckInput = {
  metadataPayload: AIMetadataContextPayload;
  policy?: AIProviderBoundaryPolicy;
  policyInput?: AIProviderBoundaryPolicyInput;
};

export type AIProviderBoundaryBlockReason = {
  code: AIProviderBoundaryBlockReasonCode;
  message: string;
};

export type AIProviderBoundarySensitivitySummary = {
  safe: number;
  caution: number;
  sensitive: number;
  restricted: number;
  highestLevel: AIColumnSensitivityLevel;
  categories: AIColumnSensitivityCategory[];
};

export type AIProviderBoundaryCheckResult = {
  status: AIProviderBoundaryStatus;
  providerCallAllowed: boolean;
  mode: AIFutureProviderMode;
  payloadScope: AIProviderPayloadScope;
  consentStatus: AIProviderConsentStatus;
  allowedCategories: AIProviderPayloadCategory[];
  disallowedCategories: AIProviderPayloadCategory[];
  blockingReasons: AIProviderBoundaryBlockReason[];
  warnings: string[];
  sensitivity: AIProviderBoundarySensitivitySummary;
  rawRowsIncluded: false;
  sampleRowsIncluded: false;
  topValuesIncluded: false;
  promptTextIncluded: false;
  sqlDraftIncluded: false;
};

export type AIProviderBoundarySummary = {
  status: AIProviderBoundaryStatus;
  providerCallAllowed: boolean;
  mode: AIFutureProviderMode;
  payloadScope: AIProviderPayloadScope;
  consentStatus: AIProviderConsentStatus;
  allowedCategoryCount: number;
  blockedCategoryCount: number;
  blockingReasonCount: number;
  warningCount: number;
  restrictedColumnCount: number;
  sensitiveColumnCount: number;
  rawRowsIncluded: false;
  sampleRowsIncluded: false;
  topValuesIncluded: false;
  promptTextIncluded: false;
  sqlDraftIncluded: false;
};
