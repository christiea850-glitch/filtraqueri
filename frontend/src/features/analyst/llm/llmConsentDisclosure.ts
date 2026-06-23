/**
 * T-24H-1 - AI consent and disclosure contract vocabulary.
 *
 * Types, constants, and tiny pure helpers only. This module does not render UI,
 * request or store consent, call providers, call backend APIs, build payloads,
 * synthesize data, tokenize values, generate SQL, insert SQL, or run queries.
 */

import type {
  AIPrivacyAuditSummary,
  AIPrivacyMode,
  AIPrivacyPayloadCategory,
} from "./llmPrivacyModes";
import { requiresPrivacyConsent } from "./llmPrivacyModes";
import type {
  AIFutureProviderMode,
  AIProviderBoundaryStatus,
  AIProviderConsentStatus,
  AIProviderPayloadScope,
} from "./llmProviderBoundaryTypes";

export type AIConsentDisclosureLevelCopy = {
  readonly level: 0 | 1 | 2 | 3 | 4;
  readonly privacyMode: AIPrivacyMode;
  readonly title: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly consentRequired: boolean;
  readonly advisoryOnly: true;
  readonly deterministicValidationRequired: true;
  readonly blockedByDefault: readonly AIPrivacyPayloadCategory[];
  readonly notes: readonly string[];
};

export type AIConsentDisclosureModeSummary = {
  readonly privacyMode: AIPrivacyMode;
  readonly title: string;
  readonly consentRequired: boolean;
  readonly providerPayloadAllowed: boolean;
  readonly advisoryOnly: true;
  readonly deterministicValidationRequired: true;
};

export type AIConsentDisclosurePayloadSummary = {
  readonly includedCategories: readonly AIPrivacyPayloadCategory[];
  readonly blockedByDefault: readonly AIPrivacyPayloadCategory[];
  readonly rawRowsBlocked: true;
  readonly sampleValuesBlocked: true;
  readonly topValuesBlocked: true;
  readonly queryResultsBlocked: true;
  readonly sqlDraftsBlocked: true;
  readonly tokenVaultBlocked: true;
  readonly providerResponsesBlocked: true;
};

export type AIConsentDisclosureAuditSummary = Pick<
  AIPrivacyAuditSummary,
  "privacyMode" | "includedCategories" | "excludedCategories" | "consentRequired"
> & {
  readonly disclosureStatus: AIConsentDisclosureStatus;
  readonly payloadSummary: AIConsentDisclosurePayloadSummary;
};

export type AIConsentDisclosureRiskCode =
  | "provider_boundary_closed"
  | "privacy_preserved_not_risk_free"
  | "raw_rows_blocked"
  | "sample_values_blocked"
  | "top_values_blocked"
  | "query_results_blocked"
  | "sql_drafts_blocked"
  | "token_vault_blocked"
  | "provider_responses_blocked"
  | "manual_insert_required"
  | "manual_run_required"
  | "deterministic_validation_required";

export type AIConsentDisclosureStatus =
  | "not_required"
  | "required"
  | "granted"
  | "revoked"
  | "expired"
  | "blocked_by_policy";

export type AIConsentDisclosureAction =
  | "grant"
  | "revoke"
  | "review_payload"
  | "learn_more"
  | "continue_without_llm";

export type AIModeChipViewModel = {
  readonly label: string;
  readonly privacyMode: AIPrivacyMode;
  readonly boundaryStatus: AIProviderBoundaryStatus;
  readonly disabled: boolean;
  readonly consentRequired: boolean;
  readonly status: AIConsentDisclosureStatus;
  readonly riskCodes: readonly AIConsentDisclosureRiskCode[];
};

export type AIProviderBoundaryDisclosure = {
  readonly status: AIProviderBoundaryStatus;
  readonly providerCallAllowed: boolean;
  readonly mode?: AIFutureProviderMode;
  readonly payloadScope?: AIProviderPayloadScope;
  readonly consentStatus?: AIProviderConsentStatus;
  readonly message: string;
  readonly blockedByDefault: readonly AIPrivacyPayloadCategory[];
};

export type AIManualControlDisclosure = {
  readonly llmCannotInsertSql: true;
  readonly llmCannotRunQuery: true;
  readonly insertSqlRequiresUserAction: true;
  readonly runQueryRequiresUserAction: true;
  readonly deterministicValidationRequired: true;
};

const BLOCKED_BY_DEFAULT: readonly AIPrivacyPayloadCategory[] = [
  "raw_rows",
  "sample_values",
  "top_values",
  "query_results",
  "sql_drafts",
  "tokenization_vault",
  "provider_response",
];

export const AI_CONSENT_DISCLOSURE_LEVEL_COPY: readonly AIConsentDisclosureLevelCopy[] = [
  {
    level: 0,
    privacyMode: "no_llm",
    title: "Level 0: No LLM",
    shortLabel: "No LLM",
    description: "No LLM is used and no provider payload is prepared or sent.",
    consentRequired: false,
    advisoryOnly: true,
    deterministicValidationRequired: true,
    blockedByDefault: BLOCKED_BY_DEFAULT,
    notes: ["FiltraQueri uses deterministic local behavior only."],
  },
  {
    level: 1,
    privacyMode: "metadata_only_llm",
    title: "Level 1: Metadata-only LLM",
    shortLabel: "Metadata only",
    description: "Only dataset, worksheet, column, relationship, profile, and sensitivity metadata may be considered; raw rows, sample values, and top values stay blocked.",
    consentRequired: false,
    advisoryOnly: true,
    deterministicValidationRequired: true,
    blockedByDefault: BLOCKED_BY_DEFAULT,
    notes: ["LLM output is advisory only; deterministic validation remains in control."],
  },
  {
    level: 2,
    privacyMode: "masked_synthetic_sample_llm",
    title: "Level 2: Masked/Synthetic Sample LLM",
    shortLabel: "Privacy-preserved shadow data",
    description: "Privacy-preserved shadow data may help the LLM reason after consent, but privacy-preserved does not mean risk-free.",
    consentRequired: true,
    advisoryOnly: true,
    deterministicValidationRequired: true,
    blockedByDefault: BLOCKED_BY_DEFAULT,
    notes: ["Insert SQL and Run Query remain manual user actions."],
  },
  {
    level: 3,
    privacyMode: "reversible_tokenized_private",
    title: "Level 3: Tokenized Private Mode",
    shortLabel: "Private/deferred",
    description: "Private or deferred tokenized mode keeps token vaults out of provider payloads and requires explicit consent before any future use.",
    consentRequired: true,
    advisoryOnly: true,
    deterministicValidationRequired: true,
    blockedByDefault: BLOCKED_BY_DEFAULT,
    notes: ["Token vaults and provider responses are blocked by default."],
  },
  {
    level: 4,
    privacyMode: "raw_data_prohibited",
    title: "Level 4: Raw-Data Mode Prohibited",
    shortLabel: "Raw data prohibited",
    description: "Raw-data LLM mode is prohibited; raw rows, query results, SQL drafts, provider responses, and token vaults remain blocked.",
    consentRequired: false,
    advisoryOnly: true,
    deterministicValidationRequired: true,
    blockedByDefault: BLOCKED_BY_DEFAULT,
    notes: ["This contract does not enable raw-data LLM behavior."],
  },
] as const;

export const AI_MANUAL_CONTROL_DISCLOSURE: AIManualControlDisclosure = {
  llmCannotInsertSql: true,
  llmCannotRunQuery: true,
  insertSqlRequiresUserAction: true,
  runQueryRequiresUserAction: true,
  deterministicValidationRequired: true,
};

export const getAIConsentDisclosureForPrivacyMode = (
  mode: AIPrivacyMode,
): AIConsentDisclosureLevelCopy =>
  AI_CONSENT_DISCLOSURE_LEVEL_COPY.find((copy) => copy.privacyMode === mode) ??
  AI_CONSENT_DISCLOSURE_LEVEL_COPY[0];

export const requiresAIConsentDisclosure = (mode: AIPrivacyMode): boolean =>
  requiresPrivacyConsent(mode);

export const isAIConsentGranted = (status: AIConsentDisclosureStatus): boolean =>
  status === "granted";

export const isAIConsentBlocked = (status: AIConsentDisclosureStatus): boolean =>
  status === "expired" || status === "revoked" || status === "blocked_by_policy";

export const createAIModeChipViewModel = (
  mode: AIPrivacyMode,
  boundaryStatus: AIProviderBoundaryStatus,
): AIModeChipViewModel => {
  const copy = getAIConsentDisclosureForPrivacyMode(mode);
  const disabled = boundaryStatus === "closed" || mode === "no_llm" || mode === "raw_data_prohibited";
  return {
    label: copy.shortLabel,
    privacyMode: mode,
    boundaryStatus,
    disabled,
    consentRequired: copy.consentRequired,
    status: copy.consentRequired ? "required" : "not_required",
    riskCodes: disabled ? ["provider_boundary_closed"] : [],
  };
};

export const createAIConsentPayloadDisclosureSummary = (
  auditSummary: Pick<AIPrivacyAuditSummary, "includedCategories" | "excludedCategories">,
): AIConsentDisclosurePayloadSummary => ({
  includedCategories: [...auditSummary.includedCategories],
  blockedByDefault: Array.from(new Set([...BLOCKED_BY_DEFAULT, ...auditSummary.excludedCategories])),
  rawRowsBlocked: true,
  sampleValuesBlocked: true,
  topValuesBlocked: true,
  queryResultsBlocked: true,
  sqlDraftsBlocked: true,
  tokenVaultBlocked: true,
  providerResponsesBlocked: true,
});
