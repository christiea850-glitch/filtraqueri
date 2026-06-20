import type { AdaptiveProposalLlmValidationResult } from "./adaptiveProposalLlmContract";
import type { AdaptiveProposalLlmConsentState } from "./adaptiveProposalLlmConsent";
import type { AdaptiveProposalLlmProviderGateResult } from "./adaptiveProposalLlmProviderGate";

export type AdaptiveProposalLlmMergeResultSummary = {
  changed: boolean;
  changedFields: string[];
  originalProposalPreserved: boolean;
};

export type AdaptiveProposalLlmAuditSnapshotInput = {
  gate: AdaptiveProposalLlmProviderGateResult;
  consent: AdaptiveProposalLlmConsentState;
  timestamp?: string | null;
  validation?: AdaptiveProposalLlmValidationResult | null;
  mergeResult?: AdaptiveProposalLlmMergeResultSummary | null;
};

export type AdaptiveProposalLlmAuditSnapshot = {
  schemaVersion: "adaptive-proposal-llm-audit:v1";
  payloadFingerprint: string | null;
  providerMode: AdaptiveProposalLlmProviderGateResult["globalProviderMode"];
  consentStatus: AdaptiveProposalLlmConsentState["status"];
  timestamp: string | null;
  sanitizedPayloadSummary: AdaptiveProposalLlmProviderGateResult["payloadSummary"];
  provenance: {
    rawRowsIncluded: false;
    sampleValuesIncluded: false;
    topValuesIncluded: false;
    sqlIncluded: false;
    promptTextIncluded: false;
    providerCallMade: false;
  };
  governanceCounts: {
    restrictedColumnCount: number;
    sensitiveColumnCount: number;
    redactedColumnCount: number;
    excludedColumnCount: number;
  };
  eligibilityDecision: AdaptiveProposalLlmProviderGateResult["datasetEligibility"];
  refinementStatus: AdaptiveProposalLlmProviderGateResult["refinementStatus"];
  blockedReasons: AdaptiveProposalLlmProviderGateResult["blockedReasons"];
  validation: {
    supplied: boolean;
    ok: boolean | null;
    issueCodes: string[];
  };
  mergeResult: AdaptiveProposalLlmMergeResultSummary | null;
  noSqlGenerated: true;
  noInsertPerformed: true;
  noRunPerformed: true;
  providerCallMade: false;
  rawPromptTextStored: false;
  rawPayloadStored: false;
  rawProviderResponseStored: false;
};

export type AdaptiveProposalLlmAuditSnapshotSummary = {
  payloadFingerprint: string | null;
  providerMode: AdaptiveProposalLlmAuditSnapshot["providerMode"];
  consentStatus: AdaptiveProposalLlmAuditSnapshot["consentStatus"];
  eligibilityDecision: AdaptiveProposalLlmAuditSnapshot["eligibilityDecision"];
  refinementStatus: AdaptiveProposalLlmAuditSnapshot["refinementStatus"];
  changedFields: string[];
  providerCallMade: false;
  noSqlGenerated: true;
  noInsertPerformed: true;
  noRunPerformed: true;
};

export const createAdaptiveProposalLlmAuditSnapshot = ({
  gate,
  consent,
  timestamp = null,
  validation = null,
  mergeResult = null,
}: AdaptiveProposalLlmAuditSnapshotInput): AdaptiveProposalLlmAuditSnapshot => ({
  schemaVersion: "adaptive-proposal-llm-audit:v1",
  payloadFingerprint: gate.payloadSummary.payloadFingerprint,
  providerMode: gate.globalProviderMode,
  consentStatus: consent.status,
  timestamp,
  sanitizedPayloadSummary: gate.payloadSummary,
  provenance: {
    rawRowsIncluded: false,
    sampleValuesIncluded: false,
    topValuesIncluded: false,
    sqlIncluded: false,
    promptTextIncluded: false,
    providerCallMade: false,
  },
  governanceCounts: {
    restrictedColumnCount: gate.payloadSummary.restrictedColumnCount,
    sensitiveColumnCount: gate.payloadSummary.sensitiveColumnCount,
    redactedColumnCount: gate.payloadSummary.redactedColumnCount,
    excludedColumnCount: gate.payloadSummary.excludedColumnCount,
  },
  eligibilityDecision: gate.datasetEligibility,
  refinementStatus: validation?.ok === false ? "validation_rejected" : gate.refinementStatus,
  blockedReasons: gate.blockedReasons,
  validation: {
    supplied: Boolean(validation),
    ok: validation?.ok ?? null,
    issueCodes: validation?.issues.map((issue) => issue.code) ?? [],
  },
  mergeResult,
  noSqlGenerated: true,
  noInsertPerformed: true,
  noRunPerformed: true,
  providerCallMade: false,
  rawPromptTextStored: false,
  rawPayloadStored: false,
  rawProviderResponseStored: false,
});

export const summarizeAdaptiveProposalLlmAuditSnapshot = (
  snapshot: AdaptiveProposalLlmAuditSnapshot,
): AdaptiveProposalLlmAuditSnapshotSummary => ({
  payloadFingerprint: snapshot.payloadFingerprint,
  providerMode: snapshot.providerMode,
  consentStatus: snapshot.consentStatus,
  eligibilityDecision: snapshot.eligibilityDecision,
  refinementStatus: snapshot.refinementStatus,
  changedFields: snapshot.mergeResult?.changedFields ?? [],
  providerCallMade: false,
  noSqlGenerated: true,
  noInsertPerformed: true,
  noRunPerformed: true,
});
