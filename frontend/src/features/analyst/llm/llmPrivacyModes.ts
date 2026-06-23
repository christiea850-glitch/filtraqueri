export type AIPrivacyLevel =
  | 0
  | 1
  | 2
  | 3
  | 4
  | "no_llm"
  | "metadata_only"
  | "shadow_synthetic"
  | "tokenized_private"
  | "raw_data_prohibited";

export type AIPrivacyMode =
  | "no_llm"
  | "metadata_only_llm"
  | "masked_synthetic_sample_llm"
  | "reversible_tokenized_private"
  | "raw_data_prohibited";

export type AIPrivacyPayloadCategory =
  | "dataset_metadata"
  | "worksheet_metadata"
  | "column_metadata"
  | "relationship_metadata"
  | "data_profile_summary"
  | "sensitivity_metadata"
  | "aggregate_summary"
  | "masked_sample_rows"
  | "synthetic_sample_rows"
  | "bucketed_values"
  | "tokenized_values"
  | "raw_rows"
  | "sample_values"
  | "top_values"
  | "prompt_text"
  | "sql_drafts"
  | "query_results"
  | "provider_response"
  | "tokenization_vault";

export type AIPrivacyNoExecutionInvariants = {
  llmCannotExecute: true;
  llmCannotInsertSql: true;
  llmCannotRunQuery: true;
  deterministicValidationRequired: true;
  manualInsertRequired: true;
  manualRunRequired: true;
};

export type AIPrivacyConsentScope = "session" | "dataset" | "workbook";

export type AIPrivacyProviderCategory =
  | "none"
  | "external_provider"
  | "private_model"
  | "self_hosted";

export type AIPrivacyAuditSummary = {
  privacyLevel: AIPrivacyLevel;
  privacyMode: AIPrivacyMode;
  includedCategories: AIPrivacyPayloadCategory[];
  excludedCategories: AIPrivacyPayloadCategory[];
  providerCategory: AIPrivacyProviderCategory;
  consentRequired: boolean;
  consentGranted: boolean;
  rawRowsIncluded: false;
  rawRowsBlocked: true;
  sqlExecutionAllowed: false;
  deterministicValidationRequired: true;
};

export type ShadowPayloadManifest = {
  payloadFingerprint: string | null;
  privacyMode: AIPrivacyMode;
  includedCategories: AIPrivacyPayloadCategory[];
  excludedCategories: AIPrivacyPayloadCategory[];
  suppressionPolicySummary: string;
  rareValueThreshold: number;
  schemaAliasingUsed: boolean;
  tokenVaultUsed: boolean;
  rawValuesIncluded: false;
};

export type AIPrivacyDecisionBase = {
  privacyMode: AIPrivacyMode;
  privacyLevel: AIPrivacyLevel;
  allowedCategories: AIPrivacyPayloadCategory[];
  blockedCategories: AIPrivacyPayloadCategory[];
  refusalReasons: string[];
  noExecution: AIPrivacyNoExecutionInvariants;
  auditSummary: AIPrivacyAuditSummary;
};

export type AIPrivacyDecision =
  | (AIPrivacyDecisionBase & {
      status: "allowed";
    })
  | (AIPrivacyDecisionBase & {
      status: "refused";
    });

export const DEFAULT_AI_PRIVACY_MODE: AIPrivacyMode = "no_llm";

export const AI_PRIVACY_NO_EXECUTION_INVARIANTS: AIPrivacyNoExecutionInvariants = {
  llmCannotExecute: true,
  llmCannotInsertSql: true,
  llmCannotRunQuery: true,
  deterministicValidationRequired: true,
  manualInsertRequired: true,
  manualRunRequired: true,
};

export const AI_PRIVACY_RAW_DATA_PROHIBITED_CATEGORIES: AIPrivacyPayloadCategory[] = [
  "raw_rows",
  "sample_values",
  "top_values",
  "prompt_text",
  "sql_drafts",
  "query_results",
  "provider_response",
  "tokenization_vault",
];

export const AI_PRIVACY_METADATA_ONLY_ALLOWED_CATEGORIES: AIPrivacyPayloadCategory[] = [
  "dataset_metadata",
  "worksheet_metadata",
  "column_metadata",
  "relationship_metadata",
  "data_profile_summary",
  "sensitivity_metadata",
];

export const AI_PRIVACY_SHADOW_DATA_REQUIRES_CONSENT_CATEGORIES: AIPrivacyPayloadCategory[] = [
  "aggregate_summary",
  "masked_sample_rows",
  "synthetic_sample_rows",
  "bucketed_values",
];

export const AI_PRIVACY_TOKENIZED_PRIVATE_CATEGORIES: AIPrivacyPayloadCategory[] = [
  "tokenized_values",
];

const RAW_DATA_CATEGORY_SET = new Set<AIPrivacyPayloadCategory>(
  AI_PRIVACY_RAW_DATA_PROHIBITED_CATEGORIES,
);
const METADATA_ONLY_CATEGORY_SET = new Set<AIPrivacyPayloadCategory>(
  AI_PRIVACY_METADATA_ONLY_ALLOWED_CATEGORIES,
);

export const isRawDataCategory = (category: AIPrivacyPayloadCategory): boolean =>
  RAW_DATA_CATEGORY_SET.has(category);

export const isCategoryAllowedForMetadataOnly = (
  category: AIPrivacyPayloadCategory,
): boolean => METADATA_ONLY_CATEGORY_SET.has(category);

export const requiresPrivacyConsent = (mode: AIPrivacyMode): boolean =>
  mode === "masked_synthetic_sample_llm" || mode === "reversible_tokenized_private";

const levelForMode = (mode: AIPrivacyMode): AIPrivacyLevel => {
  switch (mode) {
    case "metadata_only_llm":
      return "metadata_only";
    case "masked_synthetic_sample_llm":
      return "shadow_synthetic";
    case "reversible_tokenized_private":
      return "tokenized_private";
    case "raw_data_prohibited":
      return "raw_data_prohibited";
    case "no_llm":
    default:
      return "no_llm";
  }
};

const providerCategoryForMode = (mode: AIPrivacyMode): AIPrivacyProviderCategory => {
  if (mode === "reversible_tokenized_private") return "private_model";
  if (mode === "no_llm" || mode === "raw_data_prohibited") return "none";
  return "external_provider";
};

const allowedCategoriesForMode = (mode: AIPrivacyMode): AIPrivacyPayloadCategory[] => {
  if (mode === "metadata_only_llm") return [...AI_PRIVACY_METADATA_ONLY_ALLOWED_CATEGORIES];
  if (mode === "masked_synthetic_sample_llm") {
    return [
      ...AI_PRIVACY_METADATA_ONLY_ALLOWED_CATEGORIES,
      ...AI_PRIVACY_SHADOW_DATA_REQUIRES_CONSENT_CATEGORIES,
    ];
  }
  if (mode === "reversible_tokenized_private") {
    return [
      ...AI_PRIVACY_METADATA_ONLY_ALLOWED_CATEGORIES,
      ...AI_PRIVACY_SHADOW_DATA_REQUIRES_CONSENT_CATEGORIES,
      ...AI_PRIVACY_TOKENIZED_PRIVATE_CATEGORIES,
    ];
  }
  return [];
};

const blockedCategoriesForMode = (mode: AIPrivacyMode): AIPrivacyPayloadCategory[] => {
  const blocked = new Set<AIPrivacyPayloadCategory>(AI_PRIVACY_RAW_DATA_PROHIBITED_CATEGORIES);
  if (mode !== "reversible_tokenized_private") {
    blocked.add("tokenized_values");
  }
  return Array.from(blocked);
};

const cautionForMode = (mode: AIPrivacyMode): string[] => {
  if (mode === "reversible_tokenized_private") {
    return [
      "Level 3 reversible tokenization is private/self-hosted only and should remain deferred until Levels 0-2 are proven safe.",
    ];
  }
  if (mode === "raw_data_prohibited") {
    return ["Level 4 raw-data mode is prohibited for external LLMs by default."];
  }
  return [];
};

const createAuditSummary = ({
  privacyMode,
  allowedCategories,
  blockedCategories,
  consentGranted,
}: {
  privacyMode: AIPrivacyMode;
  allowedCategories: AIPrivacyPayloadCategory[];
  blockedCategories: AIPrivacyPayloadCategory[];
  consentGranted: boolean;
}): AIPrivacyAuditSummary => ({
  privacyLevel: levelForMode(privacyMode),
  privacyMode,
  includedCategories: allowedCategories,
  excludedCategories: blockedCategories,
  providerCategory: providerCategoryForMode(privacyMode),
  consentRequired: requiresPrivacyConsent(privacyMode),
  consentGranted,
  rawRowsIncluded: false,
  rawRowsBlocked: true,
  sqlExecutionAllowed: false,
  deterministicValidationRequired: true,
});

export const createDefaultAIPrivacyDecision = (): AIPrivacyDecision => {
  const privacyMode = DEFAULT_AI_PRIVACY_MODE;
  const allowedCategories = allowedCategoriesForMode(privacyMode);
  const blockedCategories = blockedCategoriesForMode(privacyMode);

  return {
    status: "refused",
    privacyMode,
    privacyLevel: levelForMode(privacyMode),
    allowedCategories,
    blockedCategories,
    refusalReasons: ["No LLM privacy mode is enabled by default."],
    noExecution: AI_PRIVACY_NO_EXECUTION_INVARIANTS,
    auditSummary: createAuditSummary({
      privacyMode,
      allowedCategories,
      blockedCategories,
      consentGranted: false,
    }),
  };
};

export const createRefusedAIPrivacyDecision = (
  reason: string,
  mode: AIPrivacyMode = DEFAULT_AI_PRIVACY_MODE,
): AIPrivacyDecision => {
  const allowedCategories = allowedCategoriesForMode(mode);
  const blockedCategories = blockedCategoriesForMode(mode);

  return {
    status: "refused",
    privacyMode: mode,
    privacyLevel: levelForMode(mode),
    allowedCategories,
    blockedCategories,
    refusalReasons: [reason, ...cautionForMode(mode)],
    noExecution: AI_PRIVACY_NO_EXECUTION_INVARIANTS,
    auditSummary: createAuditSummary({
      privacyMode: mode,
      allowedCategories,
      blockedCategories,
      consentGranted: false,
    }),
  };
};

export const assertNoExecutionInvariants = (
  decision: Pick<AIPrivacyDecision, "noExecution">,
): boolean =>
  decision.noExecution.llmCannotExecute &&
  decision.noExecution.llmCannotInsertSql &&
  decision.noExecution.llmCannotRunQuery &&
  decision.noExecution.deterministicValidationRequired &&
  decision.noExecution.manualInsertRequired &&
  decision.noExecution.manualRunRequired;
