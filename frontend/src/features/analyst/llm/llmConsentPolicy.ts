import type {
  AIProviderBoundaryPolicy,
  AIProviderBoundaryPolicyInput,
  AIProviderConsentRecord,
  AIProviderConsentStatus,
  AIProviderPayloadCategory,
} from "./llmProviderBoundaryTypes";

export const AI_PROVIDER_METADATA_ONLY_CATEGORIES: AIProviderPayloadCategory[] = [
  "dataset_metadata",
  "worksheet_metadata",
  "column_metadata",
  "relationship_metadata",
  "data_profile_summary",
  "deterministic_report_summaries",
  "sensitivity_metadata",
];

export const AI_PROVIDER_BLOCKED_PAYLOAD_CATEGORIES: AIProviderPayloadCategory[] = [
  "raw_rows",
  "sample_values",
  "top_values",
  "prompt_text",
  "sql_drafts",
  "api_keys",
  "provider_response",
];

export const createAIProviderConsentRecord = (
  status: AIProviderConsentStatus = "not_requested",
  overrides: Partial<AIProviderConsentRecord> = {},
): AIProviderConsentRecord => ({
  status,
  provenance: "system_default",
  requestedAt: null,
  decidedAt: null,
  revokedAt: null,
  notes: [],
  ...overrides,
});

export const createAIProviderBoundaryPolicy = (
  input: AIProviderBoundaryPolicyInput = {},
): AIProviderBoundaryPolicy => {
  const mode = input.mode ?? "provider_disabled";
  const payloadScope = input.payloadScope ?? "metadata_only";
  const consent = createAIProviderConsentRecord(input.consent?.status, input.consent);
  const enterprisePolicyAllowsSamples = input.enterprisePolicyAllowsSamples ?? false;
  const allowSamplesWithConsent = input.allowSamplesWithConsent ?? false;
  const allowSqlDrafts = false;
  const allowedCategories =
    payloadScope === "blocked" ? [] : [...AI_PROVIDER_METADATA_ONLY_CATEGORIES];
  const disallowedCategories = new Set<AIProviderPayloadCategory>(
    AI_PROVIDER_BLOCKED_PAYLOAD_CATEGORIES,
  );

  if (
    payloadScope === "metadata_plus_samples_requires_consent" &&
    enterprisePolicyAllowsSamples &&
    allowSamplesWithConsent &&
    consent.status === "granted"
  ) {
    disallowedCategories.delete("sample_values");
  }

  return {
    mode,
    payloadScope,
    consent,
    requiresExplicitConsent: mode === "metadata_only_provider_ready",
    enterprisePolicyAllowsSamples,
    allowSamplesWithConsent,
    allowSqlDrafts,
    allowedCategories,
    disallowedCategories: Array.from(disallowedCategories),
    notes: [
      "Default boundary is closed unless a future metadata-only provider path is explicitly enabled and consent is granted.",
      "Raw rows, raw values, top values, prompts, provider responses, and API credentials are outside the governed payload.",
      "Restricted columns are never-send for provider boundaries.",
      "SQL drafts remain blocked until a later validated SQL-governance step.",
    ],
  };
};
