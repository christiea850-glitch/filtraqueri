import type {
  AIColumnSensitivityCategory,
  AIColumnSensitivityLevel,
  AIMetadataContextPayload,
} from "./llmGovernanceTypes";
import { createAIProviderBoundaryPolicy } from "./llmConsentPolicy";
import type {
  AIProviderBoundaryBlockReason,
  AIProviderBoundaryCheckInput,
  AIProviderBoundaryCheckResult,
  AIProviderBoundaryPolicy,
  AIProviderBoundarySensitivitySummary,
  AIProviderBoundarySummary,
} from "./llmProviderBoundaryTypes";

const sensitivityRank: Record<AIColumnSensitivityLevel, number> = {
  safe: 0,
  caution: 1,
  sensitive: 2,
  restricted: 3,
};

const summarizeBoundarySensitivity = (
  payload: AIMetadataContextPayload,
): AIProviderBoundarySensitivitySummary => {
  const categories = new Set<AIColumnSensitivityCategory>();
  const summary: AIProviderBoundarySensitivitySummary = {
    safe: 0,
    caution: 0,
    sensitive: 0,
    restricted: 0,
    highestLevel: "safe",
    categories: [],
  };

  for (const worksheet of payload.worksheets) {
    for (const column of worksheet.columns) {
      const { level, category } = column.sensitivity;
      summary[level] += 1;
      categories.add(category);
      if (sensitivityRank[level] > sensitivityRank[summary.highestLevel]) {
        summary.highestLevel = level;
      }
    }
  }

  summary.categories = Array.from(categories).sort();
  return summary;
};

const consentBlockReason = (
  status: AIProviderBoundaryPolicy["consent"]["status"],
): AIProviderBoundaryBlockReason => {
  if (status === "denied") {
    return {
      code: "consent_denied",
      message: "Future provider boundary is closed because provider consent was denied.",
    };
  }

  if (status === "revoked") {
    return {
      code: "consent_revoked",
      message: "Future provider boundary is closed because provider consent was revoked.",
    };
  }

  return {
    code: "consent_not_granted",
    message: "Future provider boundary is closed until explicit consent is granted.",
  };
};

export const checkAIProviderBoundary = ({
  metadataPayload,
  policy,
  policyInput,
}: AIProviderBoundaryCheckInput): AIProviderBoundaryCheckResult => {
  const boundaryPolicy = policy ?? createAIProviderBoundaryPolicy(policyInput);
  const blockingReasons: AIProviderBoundaryBlockReason[] = [];
  const warnings: string[] = [];
  const sensitivity = summarizeBoundarySensitivity(metadataPayload);

  if (boundaryPolicy.mode === "provider_disabled") {
    blockingReasons.push({
      code: "provider_disabled",
      message: "Future provider boundary is closed because provider mode is disabled.",
    });
  }

  if (boundaryPolicy.mode === "local_mock") {
    blockingReasons.push({
      code: "local_mock_only",
      message: "Future provider boundary is closed because the current mode is local mock only.",
    });
  }

  if (
    boundaryPolicy.mode === "metadata_only_provider_ready" &&
    boundaryPolicy.consent.status !== "granted"
  ) {
    blockingReasons.push(consentBlockReason(boundaryPolicy.consent.status));
  }

  if (boundaryPolicy.payloadScope === "blocked") {
    blockingReasons.push({
      code: "unsupported_payload_scope",
      message: "Future provider boundary is closed because the requested payload scope is blocked.",
    });
  }

  if (boundaryPolicy.payloadScope !== "metadata_only") {
    blockingReasons.push({
      code: "metadata_only_required",
      message: "Future provider boundary requires metadata-only payload scope.",
    });
  }

  if (
    boundaryPolicy.payloadScope === "metadata_plus_samples_requires_consent" &&
    (!boundaryPolicy.enterprisePolicyAllowsSamples || !boundaryPolicy.allowSamplesWithConsent)
  ) {
    blockingReasons.push({
      code: "samples_blocked_by_policy",
      message: "Sample values remain blocked by policy even when consent is present.",
    });
  }

  if (sensitivity.restricted > 0) {
    blockingReasons.push({
      code: "restricted_columns_present",
      message: "Restricted columns are present in metadata and remain never-send for provider boundaries.",
    });
  }

  if (boundaryPolicy.disallowedCategories.includes("raw_rows")) {
    warnings.push("Raw rows are disallowed for provider payloads.");
  }

  if (
    boundaryPolicy.disallowedCategories.includes("sample_values") ||
    boundaryPolicy.disallowedCategories.includes("top_values")
  ) {
    warnings.push("Sample values and top values are disallowed for provider payloads.");
  }

  if (boundaryPolicy.disallowedCategories.includes("sql_drafts")) {
    warnings.push("SQL drafts are disallowed until a later validated SQL-governance step.");
  }

  const providerCallAllowed = blockingReasons.length === 0;

  return {
    status: providerCallAllowed ? "open" : "closed",
    providerCallAllowed,
    mode: boundaryPolicy.mode,
    payloadScope: boundaryPolicy.payloadScope,
    consentStatus: boundaryPolicy.consent.status,
    allowedCategories: boundaryPolicy.allowedCategories,
    disallowedCategories: boundaryPolicy.disallowedCategories,
    blockingReasons,
    warnings,
    sensitivity,
    rawRowsIncluded: false,
    sampleRowsIncluded: false,
    topValuesIncluded: false,
    promptTextIncluded: false,
    sqlDraftIncluded: false,
  };
};

export const summarizeAIProviderBoundary = (
  result: AIProviderBoundaryCheckResult,
): AIProviderBoundarySummary => ({
  status: result.status,
  providerCallAllowed: result.providerCallAllowed,
  mode: result.mode,
  payloadScope: result.payloadScope,
  consentStatus: result.consentStatus,
  allowedCategoryCount: result.allowedCategories.length,
  blockedCategoryCount: result.disallowedCategories.length,
  blockingReasonCount: result.blockingReasons.length,
  warningCount: result.warnings.length,
  restrictedColumnCount: result.sensitivity.restricted,
  sensitiveColumnCount: result.sensitivity.sensitive,
  rawRowsIncluded: false,
  sampleRowsIncluded: false,
  topValuesIncluded: false,
  promptTextIncluded: false,
  sqlDraftIncluded: false,
});
