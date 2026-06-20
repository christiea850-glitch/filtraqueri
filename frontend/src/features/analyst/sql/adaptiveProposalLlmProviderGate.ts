import type { AdaptiveProposalLlmPayload } from "./adaptiveProposalLlmContract";
import type { AdaptiveReportProposal } from "./adaptiveReportProposal";

export type AdaptiveProposalLlmGlobalProviderMode =
  | "provider_disabled"
  | "metadata_only_provider_ready";

export type AdaptiveProposalLlmDatasetEligibility =
  | "eligible_metadata_only"
  | "provider_disabled"
  | "restricted_blocked"
  | "redaction_too_high"
  | "payload_invalid";

export type AdaptiveProposalLlmRequestConsentState =
  | "not_required"
  | "required"
  | "granted"
  | "denied"
  | "expired";

export type AdaptiveProposalLlmRefinementStatus =
  | "idle"
  | "eligible"
  | "consent_required"
  | "blocked"
  | "sending"
  | "refined"
  | "failed"
  | "validation_rejected";

export type AdaptiveProposalLlmProviderGateReasonCode =
  | "provider_disabled"
  | "restricted_columns_present"
  | "redaction_ratio_too_high"
  | "candidate_columns_redacted"
  | "entity_context_redacted"
  | "missing_requirement_blocked"
  | "payload_fingerprint_missing";

export type AdaptiveProposalLlmProviderGateReason = {
  code: AdaptiveProposalLlmProviderGateReasonCode;
  message: string;
};

export type AdaptiveProposalLlmProviderGatePayloadSummary = {
  payloadFingerprint: string | null;
  payloadScope: "metadata_only";
  tableCount: number;
  includedColumnCount: number;
  redactedColumnCount: number;
  restrictedColumnCount: number;
  sensitiveColumnCount: number;
  excludedColumnCount: number;
  redactionRatio: number;
  rawRowsIncluded: false;
  sampleValuesIncluded: false;
  topValuesIncluded: false;
  sqlIncluded: false;
  promptTextIncluded: false;
  providerCallMade: false;
};

export type AdaptiveProposalLlmPlanningOnlyInvariants = {
  sql: null;
  rendererStatus: "not_rendered";
  rendererCanRender: false;
  canInsertSql: false;
  canRunSql: false;
};

export type AdaptiveProposalLlmProviderGateResult = {
  globalProviderMode: AdaptiveProposalLlmGlobalProviderMode;
  datasetEligibility: AdaptiveProposalLlmDatasetEligibility;
  requestConsent: AdaptiveProposalLlmRequestConsentState;
  refinementStatus: AdaptiveProposalLlmRefinementStatus;
  providerCallAllowed: false;
  providerCallMade: false;
  payloadScope: "metadata_only";
  payloadSummary: AdaptiveProposalLlmProviderGatePayloadSummary;
  blockedReasons: AdaptiveProposalLlmProviderGateReason[];
  planningOnly: AdaptiveProposalLlmPlanningOnlyInvariants;
};

export type EvaluateAdaptiveProposalLlmProviderGateInput = {
  payload: AdaptiveProposalLlmPayload;
  globalProviderMode?: AdaptiveProposalLlmGlobalProviderMode;
};

const METADATA_ONLY_SCOPE = "metadata_only" as const;

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isBlockedMissingRequirement = (message: string): boolean =>
  /\b(restricted|sensitive|redacted|excluded|blocked)\b/i.test(message);

const includedColumnCountForTable = (
  payload: AdaptiveProposalLlmPayload,
  tableName: string,
): number => {
  const table = payload.tables.find(
    (candidate) => normalize(candidate.tableName || "") === normalize(tableName),
  );
  return table?.columns.filter((column) => column.redaction === "included").length ?? 0;
};

const proposalCandidateColumnsAreRedacted = (
  payload: AdaptiveProposalLlmPayload,
): boolean => {
  const candidateColumns = [
    ...payload.proposal.metrics.map((metric) => ({
      tableName: metric.tableName,
      columnName: metric.columnName,
    })),
    ...payload.proposal.groupings.map((grouping) => ({
      tableName: grouping.tableName,
      columnName: grouping.columnName,
    })),
  ].filter(
    (candidate): candidate is { tableName: string; columnName: string } =>
      Boolean(candidate.tableName && candidate.columnName),
  );

  if (candidateColumns.length === 0) return false;

  return candidateColumns.every((candidate) => {
    const table = payload.tables.find(
      (payloadTable) => normalize(payloadTable.tableName || "") === normalize(candidate.tableName),
    );
    return !table?.columns.some(
      (column) =>
        column.redaction === "included" &&
        column.columnName &&
        normalize(column.columnName) === normalize(candidate.columnName),
    );
  });
};

const entityContextWasRedacted = (
  payload: AdaptiveProposalLlmPayload,
): boolean =>
  payload.proposal.entities.some(
    (entity) => entity.tableName && includedColumnCountForTable(payload, entity.tableName) === 0,
  );

const missingRequirementsIncludeBlockedContext = (
  proposal: Pick<AdaptiveReportProposal, "missingRequirements">,
): boolean =>
  proposal.missingRequirements.some(
    (requirement) =>
      isBlockedMissingRequirement(requirement.kind) ||
      isBlockedMissingRequirement(requirement.message),
  );

const createPayloadSummary = (
  payload: AdaptiveProposalLlmPayload,
): AdaptiveProposalLlmProviderGatePayloadSummary => {
  const includedColumnCount = payload.tables.reduce(
    (sum, table) => sum + table.columns.filter((column) => column.redaction === "included").length,
    0,
  );
  const totalColumnCount = includedColumnCount + payload.governance.redactedColumnCount + payload.governance.excludedColumnCount;
  const redactedOrExcludedCount = payload.governance.redactedColumnCount + payload.governance.excludedColumnCount;

  return {
    payloadFingerprint: payload.proposal.payloadFingerprint || null,
    payloadScope: METADATA_ONLY_SCOPE,
    tableCount: payload.tables.length,
    includedColumnCount,
    redactedColumnCount: payload.governance.redactedColumnCount,
    restrictedColumnCount: payload.governance.restrictedColumnCount,
    sensitiveColumnCount: payload.governance.sensitiveColumnCount,
    excludedColumnCount: payload.governance.excludedColumnCount,
    redactionRatio: totalColumnCount > 0 ? redactedOrExcludedCount / totalColumnCount : 0,
    rawRowsIncluded: false,
    sampleValuesIncluded: false,
    topValuesIncluded: false,
    sqlIncluded: false,
    promptTextIncluded: false,
    providerCallMade: false,
  };
};

const createPlanningOnlyInvariants = (
  proposal: Pick<
    AdaptiveReportProposal,
    "sql" | "renderer" | "canInsertSql" | "canRunSql"
  >,
): AdaptiveProposalLlmPlanningOnlyInvariants => ({
  sql: null,
  rendererStatus: proposal.renderer.status,
  rendererCanRender: false,
  canInsertSql: false,
  canRunSql: false,
});

export const evaluateAdaptiveProposalLlmProviderGate = ({
  payload,
  globalProviderMode = "provider_disabled",
}: EvaluateAdaptiveProposalLlmProviderGateInput): AdaptiveProposalLlmProviderGateResult => {
  const payloadSummary = createPayloadSummary(payload);
  const blockedReasons: AdaptiveProposalLlmProviderGateReason[] = [];
  let datasetEligibility: AdaptiveProposalLlmDatasetEligibility = "eligible_metadata_only";

  if (globalProviderMode === "provider_disabled") {
    datasetEligibility = "provider_disabled";
    blockedReasons.push({
      code: "provider_disabled",
      message: "Provider mode is disabled by default.",
    });
  } else if (!payloadSummary.payloadFingerprint?.trim()) {
    datasetEligibility = "payload_invalid";
    blockedReasons.push({
      code: "payload_fingerprint_missing",
      message: "A valid payload fingerprint is required before provider refinement.",
    });
  } else if (payload.governance.restrictedColumnCount > 0) {
    datasetEligibility = "restricted_blocked";
    blockedReasons.push({
      code: "restricted_columns_present",
      message: "Restricted columns block metadata-only provider refinement.",
    });
  } else if (payloadSummary.redactionRatio > 0.5) {
    datasetEligibility = "redaction_too_high";
    blockedReasons.push({
      code: "redaction_ratio_too_high",
      message: "Too much context was redacted or excluded for safe provider refinement.",
    });
  } else if (proposalCandidateColumnsAreRedacted(payload)) {
    datasetEligibility = "redaction_too_high";
    blockedReasons.push({
      code: "candidate_columns_redacted",
      message: "All candidate metric or grouping columns were redacted or excluded.",
    });
  } else if (entityContextWasRedacted(payload)) {
    datasetEligibility = "redaction_too_high";
    blockedReasons.push({
      code: "entity_context_redacted",
      message: "Referenced entities have no included metadata columns left.",
    });
  } else if (missingRequirementsIncludeBlockedContext(payload.proposal)) {
    datasetEligibility = "redaction_too_high";
    blockedReasons.push({
      code: "missing_requirement_blocked",
      message: "Missing requirements reference blocked, sensitive, redacted, or excluded context.",
    });
  }

  const requestConsent: AdaptiveProposalLlmRequestConsentState =
    datasetEligibility === "eligible_metadata_only" ? "required" : "not_required";

  return {
    globalProviderMode,
    datasetEligibility,
    requestConsent,
    refinementStatus:
      datasetEligibility === "eligible_metadata_only" ? "consent_required" : "blocked",
    providerCallAllowed: false,
    providerCallMade: false,
    payloadScope: METADATA_ONLY_SCOPE,
    payloadSummary,
    blockedReasons,
    planningOnly: createPlanningOnlyInvariants({
      sql: null,
      renderer: {
        status: "not_rendered",
        canRender: false,
        targetDialect: "duckdb",
        notes: [],
      },
      canInsertSql: false,
      canRunSql: false,
    }),
  };
};

