import type {
  AIColumnSensitivityCategory,
  AIColumnSensitivityLevel,
  AIRedactionPolicyLabel,
} from "./llmGovernanceTypes";

export type AIRedactionPolicy = {
  category: AIColumnSensitivityCategory;
  level: AIColumnSensitivityLevel;
  labels: AIRedactionPolicyLabel[];
  allowedForMetadataOnly: true;
  allowedForSqlPlanning: boolean;
  requiresUserConsentForSamples: boolean;
  neverSendRawValues: true;
};

const BASE_LABELS: AIRedactionPolicyLabel[] = [
  "allowed_for_metadata_only",
  "allowed_for_sql_planning",
  "requires_user_consent_for_samples",
  "never_send_raw_values",
];

export const getRedactionPolicyForSensitivity = (
  category: AIColumnSensitivityCategory,
  level: AIColumnSensitivityLevel,
): AIRedactionPolicy => {
  const restricted = level === "restricted";
  return {
    category,
    level,
    labels: restricted
      ? BASE_LABELS.filter((label) => label !== "allowed_for_sql_planning")
      : BASE_LABELS,
    allowedForMetadataOnly: true,
    allowedForSqlPlanning: !restricted,
    requiresUserConsentForSamples: true,
    neverSendRawValues: true,
  };
};
