import type {
  AIColumnSensitivityCategory,
  AIColumnSensitivityClassification,
  AIColumnSensitivityLevel,
} from "./llmGovernanceTypes";
import type { AIPrivacyMode } from "./llmPrivacyModes";

export type AIShadowValuePolicy =
  | "preserve_safe"
  | "metadata_only"
  | "bucket"
  | "mask"
  | "synthesize"
  | "tokenize_private"
  | "suppress"
  | "prohibit";

export type AIRareValueRiskLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "prohibited";

export type AIUniquenessRiskLevel =
  | "unknown"
  | "not_unique"
  | "possibly_unique"
  | "unique"
  | "prohibited";

export type AIShadowDataPolicyDecision = {
  columnName: string;
  sensitivityCategory: AIColumnSensitivityCategory;
  sensitivityLevel: AIColumnSensitivityLevel;
  recommendedShadowValuePolicy: AIShadowValuePolicy;
  rawValueAllowed: false;
  metadataAllowed: boolean;
  sampleAllowed: boolean;
  tokenizationAllowed: boolean;
  tokenizationCaution: boolean;
  suppressionRequired: boolean;
  rareValueThreshold: number;
  rareValueRiskLevel: AIRareValueRiskLevel;
  uniquenessRiskLevel: AIUniquenessRiskLevel;
  reasons: string[];
  warnings: string[];
};

export type ResolveShadowValuePolicyInput = {
  columnName: string;
  classification: AIColumnSensitivityClassification;
  privacyMode: AIPrivacyMode;
  uniqueCount?: number | null;
  rowCount?: number | null;
};

const DEFAULT_RARE_VALUE_THRESHOLD = 5;

const isShadowSampleMode = (mode: AIPrivacyMode): boolean =>
  mode === "masked_synthetic_sample_llm" || mode === "reversible_tokenized_private";

const isSensitiveCategory = (category: AIColumnSensitivityCategory): boolean =>
  category === "direct_personal_identifier" ||
  category === "contact_information" ||
  category === "address_or_location" ||
  category === "financial_or_payment" ||
  category === "health_or_sensitive" ||
  category === "free_text_sensitive";

const isRestrictedCategory = (category: AIColumnSensitivityCategory): boolean =>
  category === "access_or_security";

export const getDefaultRareValueThresholdForPrivacyMode = (
  _mode: AIPrivacyMode,
): number => DEFAULT_RARE_VALUE_THRESHOLD;

export const isTokenizationAllowedForPrivacyMode = (mode: AIPrivacyMode): boolean =>
  mode === "reversible_tokenized_private";

export const isRawValueProhibitedForSensitivity = (
  classification: Pick<AIColumnSensitivityClassification, "level" | "neverSendRawValues">,
): boolean => classification.neverSendRawValues || classification.level !== "safe";

const uniquenessRiskFor = ({
  classification,
  uniqueCount,
  rowCount,
}: Pick<ResolveShadowValuePolicyInput, "classification" | "uniqueCount" | "rowCount">):
  AIUniquenessRiskLevel => {
  if (classification.level === "restricted") return "prohibited";
  if (typeof uniqueCount !== "number" || typeof rowCount !== "number" || rowCount <= 0) {
    return "unknown";
  }
  if (uniqueCount >= rowCount) return "unique";
  if (uniqueCount / rowCount >= 0.75) return "possibly_unique";
  return "not_unique";
};

const rareValueRiskFor = (
  classification: Pick<AIColumnSensitivityClassification, "level" | "category">,
  privacyMode: AIPrivacyMode,
): AIRareValueRiskLevel => {
  if (classification.level === "restricted") return "prohibited";
  if (!isShadowSampleMode(privacyMode)) return "none";
  if (classification.level === "sensitive") return "high";
  if (classification.level === "caution") return "medium";
  return "low";
};

const policyFor = (
  classification: Pick<AIColumnSensitivityClassification, "category" | "level">,
  privacyMode: AIPrivacyMode,
): AIShadowValuePolicy => {
  if (privacyMode === "no_llm" || privacyMode === "raw_data_prohibited") return "prohibit";
  if (classification.level === "restricted" || isRestrictedCategory(classification.category)) {
    return "prohibit";
  }
  if (privacyMode === "metadata_only_llm") return "metadata_only";

  if (privacyMode === "reversible_tokenized_private" && classification.category === "identifier") {
    return "tokenize_private";
  }
  if (classification.category === "health_or_sensitive" || classification.category === "free_text_sensitive") {
    return "suppress";
  }
  if (isSensitiveCategory(classification.category)) return "mask";
  if (classification.category === "identifier" || classification.category === "unknown_needs_review") {
    return "suppress";
  }
  if (classification.category === "safe_business_metric") return "bucket";
  return "metadata_only";
};

const sampleAllowedForPolicy = (policy: AIShadowValuePolicy, mode: AIPrivacyMode): boolean =>
  isShadowSampleMode(mode) &&
  (policy === "bucket" || policy === "mask" || policy === "synthesize");

export const resolveShadowValuePolicyForSensitivity = ({
  columnName,
  classification,
  privacyMode,
  uniqueCount = null,
  rowCount = null,
}: ResolveShadowValuePolicyInput): AIShadowDataPolicyDecision => {
  const recommendedShadowValuePolicy = policyFor(classification, privacyMode);
  const rareValueThreshold = getDefaultRareValueThresholdForPrivacyMode(privacyMode);
  const tokenizationAllowed =
    recommendedShadowValuePolicy === "tokenize_private" &&
    isTokenizationAllowedForPrivacyMode(privacyMode);
  const suppressionRequired =
    recommendedShadowValuePolicy === "suppress" ||
    recommendedShadowValuePolicy === "prohibit" ||
    (isShadowSampleMode(privacyMode) && classification.level !== "safe");
  const warnings: string[] = [];

  if (tokenizationAllowed) {
    warnings.push(
      "Tokenization is Level 3 private/self-hosted only and should remain caution/defer.",
    );
  }
  if (recommendedShadowValuePolicy === "prohibit") {
    warnings.push("Column is prohibited from raw or shadow provider values.");
  }
  if (suppressionRequired) {
    warnings.push("Rare values and rare joint patterns require suppression or review.");
  }

  return {
    columnName,
    sensitivityCategory: classification.category,
    sensitivityLevel: classification.level,
    recommendedShadowValuePolicy,
    rawValueAllowed: false,
    metadataAllowed: classification.allowedForMetadataOnly,
    sampleAllowed: sampleAllowedForPolicy(recommendedShadowValuePolicy, privacyMode),
    tokenizationAllowed,
    tokenizationCaution: tokenizationAllowed,
    suppressionRequired,
    rareValueThreshold,
    rareValueRiskLevel: rareValueRiskFor(classification, privacyMode),
    uniquenessRiskLevel: uniquenessRiskFor({ classification, uniqueCount, rowCount }),
    reasons: classification.reasons,
    warnings,
  };
};

export const requiresRareValueSuppression = (
  decision: Pick<
    AIShadowDataPolicyDecision,
    "suppressionRequired" | "rareValueRiskLevel" | "uniquenessRiskLevel"
  >,
): boolean =>
  decision.suppressionRequired ||
  decision.rareValueRiskLevel === "medium" ||
  decision.rareValueRiskLevel === "high" ||
  decision.rareValueRiskLevel === "prohibited" ||
  decision.uniquenessRiskLevel === "possibly_unique" ||
  decision.uniquenessRiskLevel === "unique" ||
  decision.uniquenessRiskLevel === "prohibited";

