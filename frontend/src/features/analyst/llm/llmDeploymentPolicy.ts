/**
 * T-24I-1 - AI deployment policy contract vocabulary.
 *
 * Types, constants, and tiny pure helpers only. This module does not read
 * environment variables, render UI, persist policy, call providers, call
 * backend APIs, build payloads, synthesize data, tokenize values, generate SQL,
 * insert SQL, or run queries.
 */

import type { AIPrivacyLevel, AIPrivacyMode } from "./llmPrivacyModes";
import { AI_PRIVACY_NO_EXECUTION_INVARIANTS, requiresPrivacyConsent } from "./llmPrivacyModes";

export type AIDeploymentType =
  | "public_cloud"
  | "private_cloud"
  | "self_hosted_on_prem"
  | "enterprise_governed"
  | "offline_local_only";

export type AIPrivacyLevelAllowance =
  | "allowed"
  | "allowed_with_admin_policy"
  | "deferred"
  | "prohibited"
  | "requires_legal_compliance_review";

export type AIProviderEligibilityRequirement = {
  readonly zeroRetentionRequired: boolean;
  readonly dpaRequired: boolean;
  readonly customerApprovedProviderRequired: boolean;
  readonly externalProviderAllowed: boolean;
  readonly localPrivateModelRequired: boolean;
};

export type AIAdminPolicyRequirement = {
  readonly adminOptInRequired: boolean;
  readonly maxPrivacyLevelAllowed: AIPrivacyLevel;
  readonly regulatedDataRestrictions: readonly string[];
  readonly providerAllowlistRequired: boolean;
  readonly auditExportRequired: boolean;
};

export type AIDeploymentPolicyDecision = {
  readonly deploymentType: AIDeploymentType;
  readonly privacyLevel: 0 | 1 | 2 | 3 | 4;
  readonly privacyMode: AIPrivacyMode;
  readonly allowance: AIPrivacyLevelAllowance;
  readonly consentRequired: boolean;
  readonly adminPolicyRequired: boolean;
  readonly auditSummaryRequired: boolean;
  readonly providerEligibilityRequired: boolean;
  readonly legalComplianceReviewRequired: boolean;
  readonly deterministicValidationRequired: true;
  readonly manualInsertSqlRequired: true;
  readonly manualRunQueryRequired: true;
  readonly providerEligibility: AIProviderEligibilityRequirement;
  readonly adminPolicy: AIAdminPolicyRequirement;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
};

type PolicyTemplate = Omit<AIDeploymentPolicyDecision, "deploymentType" | "privacyLevel" | "privacyMode" | "consentRequired">;

export const DEFAULT_AI_DEPLOYMENT_TYPE: AIDeploymentType = "public_cloud";

const DEPLOYMENTS: readonly AIDeploymentType[] = [
  "public_cloud",
  "private_cloud",
  "self_hosted_on_prem",
  "enterprise_governed",
  "offline_local_only",
];

const provider = (
  externalProviderAllowed: boolean,
  overrides: Partial<AIProviderEligibilityRequirement> = {},
): AIProviderEligibilityRequirement => ({
  zeroRetentionRequired: externalProviderAllowed,
  dpaRequired: externalProviderAllowed,
  customerApprovedProviderRequired: externalProviderAllowed,
  externalProviderAllowed,
  localPrivateModelRequired: !externalProviderAllowed,
  ...overrides,
});

const admin = (
  adminOptInRequired: boolean,
  maxPrivacyLevelAllowed: AIPrivacyLevel,
  regulatedDataRestrictions: readonly string[] = [],
): AIAdminPolicyRequirement => ({
  adminOptInRequired,
  maxPrivacyLevelAllowed,
  regulatedDataRestrictions,
  providerAllowlistRequired: adminOptInRequired,
  auditExportRequired: adminOptInRequired,
});

const template = (
  allowance: AIPrivacyLevelAllowance,
  options: {
    adminPolicyRequired?: boolean;
    providerEligibilityRequired?: boolean;
    legalComplianceReviewRequired?: boolean;
    providerEligibility?: AIProviderEligibilityRequirement;
    adminPolicy?: AIAdminPolicyRequirement;
    reasons: readonly string[];
    warnings?: readonly string[];
  },
): PolicyTemplate => ({
  allowance,
  adminPolicyRequired: options.adminPolicyRequired ?? false,
  auditSummaryRequired: true,
  providerEligibilityRequired: options.providerEligibilityRequired ?? false,
  legalComplianceReviewRequired: options.legalComplianceReviewRequired ?? false,
  deterministicValidationRequired: true,
  manualInsertSqlRequired: true,
  manualRunQueryRequired: true,
  providerEligibility: options.providerEligibility ?? provider(false, { localPrivateModelRequired: false }),
  adminPolicy: options.adminPolicy ?? admin(false, 0),
  reasons: options.reasons,
  warnings: options.warnings ?? [],
});

const level0 = template("allowed", {
  reasons: ["Level 0 uses no LLM and is allowed in every deployment type."],
});

export const AI_DEPLOYMENT_POLICY_MATRIX: Readonly<
  Record<AIDeploymentType, Readonly<Record<0 | 1 | 2 | 3 | 4, PolicyTemplate>>>
> = {
  public_cloud: {
    0: level0,
    1: template("allowed", {
      providerEligibilityRequired: true,
      providerEligibility: provider(true),
      reasons: ["Public cloud Level 1 is limited to metadata-only safety and provider boundary controls."],
      warnings: ["No raw rows, samples, top values, SQL drafts, query results, or token vault data may be sent."],
    }),
    2: template("deferred", {
      adminPolicyRequired: true,
      providerEligibilityRequired: true,
      providerEligibility: provider(true),
      adminPolicy: admin(true, 1, ["Shadow data requires product-policy gating before public cloud use."]),
      reasons: ["Public cloud Level 2 is not default-allowed and remains deferred until implementation prerequisites exist."],
    }),
    3: template("prohibited", {
      legalComplianceReviewRequired: true,
      providerEligibility: provider(false, { localPrivateModelRequired: true }),
      reasons: ["Public cloud Level 3 reversible tokenization is prohibited."],
    }),
    4: template("prohibited", {
      reasons: ["Level 4 raw-data mode is prohibited for external LLMs and default governed AI mode."],
    }),
  },
  private_cloud: {
    0: level0,
    1: template("allowed_with_admin_policy", { adminPolicyRequired: true, providerEligibilityRequired: true, providerEligibility: provider(true), adminPolicy: admin(true, 1), reasons: ["Private cloud Level 1 requires admin policy and provider eligibility controls."] }),
    2: template("deferred", { adminPolicyRequired: true, providerEligibilityRequired: true, providerEligibility: provider(true), adminPolicy: admin(true, 1, ["Level 2 requires implementation prerequisites before enablement."]), reasons: ["Private cloud Level 2 is admin-policy gated after implementation prerequisites exist."] }),
    3: template("requires_legal_compliance_review", { adminPolicyRequired: true, providerEligibilityRequired: true, legalComplianceReviewRequired: true, providerEligibility: provider(false, { localPrivateModelRequired: true }), adminPolicy: admin(true, 2, ["Regulated data and reversible tokenization require legal/compliance review."]), reasons: ["Private cloud Level 3 requires legal/compliance review before any future enablement."] }),
    4: template("prohibited", { reasons: ["Level 4 raw-data mode is prohibited for external LLMs and default governed AI mode."] }),
  },
  self_hosted_on_prem: {
    0: level0,
    1: template("allowed_with_admin_policy", { adminPolicyRequired: true, providerEligibilityRequired: true, providerEligibility: provider(false, { localPrivateModelRequired: true }), adminPolicy: admin(true, 1), reasons: ["Self-hosted Level 1 requires admin policy and private/local model controls."] }),
    2: template("deferred", { adminPolicyRequired: true, providerEligibilityRequired: true, providerEligibility: provider(false, { localPrivateModelRequired: true }), adminPolicy: admin(true, 1, ["Level 2 requires implementation prerequisites before enablement."]), reasons: ["Self-hosted Level 2 is admin-policy gated after implementation prerequisites exist."] }),
    3: template("requires_legal_compliance_review", { adminPolicyRequired: true, providerEligibilityRequired: true, legalComplianceReviewRequired: true, providerEligibility: provider(false, { localPrivateModelRequired: true }), adminPolicy: admin(true, 2, ["Reversible tokenization requires legal/compliance review."]), reasons: ["Self-hosted Level 3 requires legal/compliance review before any future enablement."] }),
    4: template("prohibited", { reasons: ["Level 4 raw-data mode is prohibited for external LLMs and default governed AI mode."] }),
  },
  enterprise_governed: {
    0: level0,
    1: template("allowed_with_admin_policy", { adminPolicyRequired: true, providerEligibilityRequired: true, providerEligibility: provider(true), adminPolicy: admin(true, 1), reasons: ["Enterprise governed Level 1 requires admin opt-in, audit export, and provider allowlisting."] }),
    2: template("deferred", { adminPolicyRequired: true, providerEligibilityRequired: true, providerEligibility: provider(true), adminPolicy: admin(true, 1, ["Level 2 requires implementation prerequisites before enablement."]), reasons: ["Enterprise governed Level 2 is admin-policy gated after implementation prerequisites exist."] }),
    3: template("requires_legal_compliance_review", { adminPolicyRequired: true, providerEligibilityRequired: true, legalComplianceReviewRequired: true, providerEligibility: provider(false, { localPrivateModelRequired: true }), adminPolicy: admin(true, 2, ["Regulated data and reversible tokenization require legal/compliance review."]), reasons: ["Enterprise governed Level 3 requires legal/compliance review before any future enablement."] }),
    4: template("prohibited", { reasons: ["Level 4 raw-data mode is prohibited for external LLMs and default governed AI mode."] }),
  },
  offline_local_only: {
    0: level0,
    1: template("allowed", { providerEligibilityRequired: true, providerEligibility: provider(false, { localPrivateModelRequired: true }), reasons: ["Offline/local-only Level 1 is allowed only when no external provider is contacted."], warnings: ["External provider access must remain disabled."] }),
    2: template("deferred", { adminPolicyRequired: true, providerEligibilityRequired: true, providerEligibility: provider(false, { localPrivateModelRequired: true }), adminPolicy: admin(true, 1, ["Local Level 2 policy requires implementation before enablement."]), reasons: ["Offline/local-only Level 2 is local-policy gated after implementation exists."] }),
    3: template("requires_legal_compliance_review", { adminPolicyRequired: true, providerEligibilityRequired: true, legalComplianceReviewRequired: true, providerEligibility: provider(false, { localPrivateModelRequired: true }), adminPolicy: admin(true, 2, ["Local reversible tokenization requires legal/compliance review."]), reasons: ["Offline/local-only Level 3 requires legal/compliance review before any future enablement."] }),
    4: template("prohibited", { reasons: ["Level 4 raw-data mode is prohibited for external LLMs and default governed AI mode."] }),
  },
};

export const AI_DEPLOYMENT_NO_EXECUTION_INVARIANTS = {
  ...AI_PRIVACY_NO_EXECUTION_INVARIANTS,
  deterministicValidationRequired: true,
  manualInsertSqlRequired: true,
  manualRunQueryRequired: true,
} as const;

const privacyModeForLevel = (level: 0 | 1 | 2 | 3 | 4): AIPrivacyMode =>
  (["no_llm", "metadata_only_llm", "masked_synthetic_sample_llm", "reversible_tokenized_private", "raw_data_prohibited"] as const)[level];

const normalizePrivacy = (privacyModeOrLevel: AIPrivacyMode | AIPrivacyLevel): { level: 0 | 1 | 2 | 3 | 4; mode: AIPrivacyMode } => {
  if (privacyModeOrLevel === 0 || privacyModeOrLevel === "no_llm") return { level: 0, mode: "no_llm" };
  if (privacyModeOrLevel === 1 || privacyModeOrLevel === "metadata_only" || privacyModeOrLevel === "metadata_only_llm") return { level: 1, mode: "metadata_only_llm" };
  if (privacyModeOrLevel === 2 || privacyModeOrLevel === "shadow_synthetic" || privacyModeOrLevel === "masked_synthetic_sample_llm") return { level: 2, mode: "masked_synthetic_sample_llm" };
  if (privacyModeOrLevel === 3 || privacyModeOrLevel === "tokenized_private" || privacyModeOrLevel === "reversible_tokenized_private") return { level: 3, mode: "reversible_tokenized_private" };
  return { level: 4, mode: privacyModeForLevel(4) };
};

export const createAIDeploymentPolicyDecision = (
  deploymentType: AIDeploymentType,
  privacyModeOrLevel: AIPrivacyMode | AIPrivacyLevel,
): AIDeploymentPolicyDecision => {
  const { level, mode } = normalizePrivacy(privacyModeOrLevel);
  const policy = AI_DEPLOYMENT_POLICY_MATRIX[deploymentType][level];
  return { deploymentType, privacyLevel: level, privacyMode: mode, consentRequired: requiresPrivacyConsent(mode), ...policy };
};

export const getAIPrivacyAllowanceForDeployment = (
  deploymentType: AIDeploymentType,
  privacyModeOrLevel: AIPrivacyMode | AIPrivacyLevel,
): AIPrivacyLevelAllowance => createAIDeploymentPolicyDecision(deploymentType, privacyModeOrLevel).allowance;

export const isAIPrivacyModeAllowedForDeployment = (
  deploymentType: AIDeploymentType,
  privacyModeOrLevel: AIPrivacyMode | AIPrivacyLevel,
): boolean => {
  const allowance = getAIPrivacyAllowanceForDeployment(deploymentType, privacyModeOrLevel);
  return allowance === "allowed" || allowance === "allowed_with_admin_policy";
};

export const requiresAIAdminPolicy = (
  deploymentType: AIDeploymentType,
  privacyModeOrLevel: AIPrivacyMode | AIPrivacyLevel,
): boolean => createAIDeploymentPolicyDecision(deploymentType, privacyModeOrLevel).adminPolicyRequired;

export const requiresAILegalComplianceReview = (
  deploymentType: AIDeploymentType,
  privacyModeOrLevel: AIPrivacyMode | AIPrivacyLevel,
): boolean => createAIDeploymentPolicyDecision(deploymentType, privacyModeOrLevel).legalComplianceReviewRequired;

export const assertAIDeploymentNoExecutionInvariants = (
  decision: Pick<AIDeploymentPolicyDecision, "deterministicValidationRequired" | "manualInsertSqlRequired" | "manualRunQueryRequired">,
): boolean => decision.deterministicValidationRequired && decision.manualInsertSqlRequired && decision.manualRunQueryRequired;

export const AI_DEPLOYMENT_TYPES: readonly AIDeploymentType[] = DEPLOYMENTS;
