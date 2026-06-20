import type {
  AdaptiveProposalLlmGlobalProviderMode,
  AdaptiveProposalLlmProviderGatePayloadSummary,
  AdaptiveProposalLlmRequestConsentState,
} from "./adaptiveProposalLlmProviderGate";

export const ADAPTIVE_PROPOSAL_LLM_PROVIDER_COPY = {
  primaryCta: "Use metadata-only AI refinement",
  safetyLine:
    "Metadata only. No raw rows, sample values, prompt text, SQL drafts, or query results.",
  confirmationTitle: "Allow metadata-only AI refinement?",
  nonSqlWarning:
    "This is not SQL generation. The result can only update the planning outline.",
} as const;

export type AdaptiveProposalLlmConsentDecision = Extract<
  AdaptiveProposalLlmRequestConsentState,
  "granted" | "denied" | "expired"
>;

export type AdaptiveProposalLlmConsentStateInput = {
  payloadFingerprint: string | null;
  providerMode?: AdaptiveProposalLlmGlobalProviderMode;
  payloadScope?: "metadata_only";
  requestedAt?: string | null;
  decidedAt?: string | null;
  expiresAt?: string | null;
  now?: string | null;
  decision?: AdaptiveProposalLlmConsentDecision | null;
  decisionPayloadFingerprint?: string | null;
  sanitizedPayloadSummary: AdaptiveProposalLlmProviderGatePayloadSummary;
};

export type AdaptiveProposalLlmConsentState = {
  status: AdaptiveProposalLlmRequestConsentState;
  providerMode: AdaptiveProposalLlmGlobalProviderMode;
  payloadScope: "metadata_only";
  payloadFingerprint: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  expiresAt: string | null;
  sanitizedPayloadSummary: AdaptiveProposalLlmProviderGatePayloadSummary;
  safetyCopy: typeof ADAPTIVE_PROPOSAL_LLM_PROVIDER_COPY;
  rawPromptTextIncluded: false;
  rawPayloadIncluded: false;
  providerCallMade: false;
};

export type AdaptiveProposalLlmConsentSummary = {
  status: AdaptiveProposalLlmRequestConsentState;
  providerMode: AdaptiveProposalLlmGlobalProviderMode;
  payloadScope: "metadata_only";
  payloadFingerprint: string | null;
  safetyLine: string;
  nonSqlWarning: string;
  rawPromptTextIncluded: false;
  rawPayloadIncluded: false;
  providerCallMade: false;
};

const isExpired = ({
  decision,
  expiresAt,
  now,
}: {
  decision: AdaptiveProposalLlmConsentDecision | null | undefined;
  expiresAt: string | null | undefined;
  now: string | null | undefined;
}): boolean => {
  if (decision === "expired") return true;
  if (!expiresAt || !now) return false;
  return Date.parse(expiresAt) <= Date.parse(now);
};

export const createAdaptiveProposalLlmConsentState = ({
  payloadFingerprint,
  providerMode = "provider_disabled",
  payloadScope = "metadata_only",
  requestedAt = null,
  decidedAt = null,
  expiresAt = null,
  now = null,
  decision = null,
  decisionPayloadFingerprint = null,
  sanitizedPayloadSummary,
}: AdaptiveProposalLlmConsentStateInput): AdaptiveProposalLlmConsentState => {
  let status: AdaptiveProposalLlmRequestConsentState = "required";

  if (decision === "denied") {
    status = "denied";
  } else if (isExpired({ decision, expiresAt, now })) {
    status = "expired";
  } else if (
    decision === "granted" &&
    payloadFingerprint &&
    decisionPayloadFingerprint === payloadFingerprint
  ) {
    status = "granted";
  }

  return {
    status,
    providerMode,
    payloadScope,
    payloadFingerprint,
    requestedAt,
    decidedAt,
    expiresAt,
    sanitizedPayloadSummary,
    safetyCopy: ADAPTIVE_PROPOSAL_LLM_PROVIDER_COPY,
    rawPromptTextIncluded: false,
    rawPayloadIncluded: false,
    providerCallMade: false,
  };
};

export const summarizeAdaptiveProposalLlmConsent = (
  consent: AdaptiveProposalLlmConsentState,
): AdaptiveProposalLlmConsentSummary => ({
  status: consent.status,
  providerMode: consent.providerMode,
  payloadScope: consent.payloadScope,
  payloadFingerprint: consent.payloadFingerprint,
  safetyLine: consent.safetyCopy.safetyLine,
  nonSqlWarning: consent.safetyCopy.nonSqlWarning,
  rawPromptTextIncluded: false,
  rawPayloadIncluded: false,
  providerCallMade: false,
});

