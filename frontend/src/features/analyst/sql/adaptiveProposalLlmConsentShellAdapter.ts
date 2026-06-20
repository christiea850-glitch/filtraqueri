import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { AdaptiveReportProposal } from "./adaptiveReportProposal";
import type { AdaptiveProposalLlmValidationResult } from "./adaptiveProposalLlmContract";
import {
  ADAPTIVE_PROPOSAL_LLM_PROVIDER_COPY,
  createAdaptiveProposalLlmConsentState,
  summarizeAdaptiveProposalLlmConsent,
} from "./adaptiveProposalLlmConsent";
import {
  buildAdaptiveProposalLlmPayload,
  type AdaptiveProposalLlmPayloadWorksheet,
} from "./adaptiveProposalLlmPayloadBuilder";
import {
  evaluateAdaptiveProposalLlmProviderGate,
  type AdaptiveProposalLlmGlobalProviderMode,
  type AdaptiveProposalLlmProviderGateResult,
} from "./adaptiveProposalLlmProviderGate";

export type AdaptiveProposalLlmConsentShellStatus =
  | "provider_disabled"
  | "metadata_only_eligible"
  | "consent_required"
  | "restricted_blocked"
  | "redaction_too_high_blocked"
  | "validation_rejected"
  | "refined_planning_only";

export type AdaptiveProposalLlmConsentShellPayloadSummary = {
  tableCount: number;
  includedColumnCount: number;
  redactedColumnCount: number;
  restrictedOrExcludedColumnCount: number;
  payloadFingerprint: string | null;
  providerMode: AdaptiveProposalLlmGlobalProviderMode;
  consentStatus: string;
};

export type AdaptiveProposalLlmConsentShellViewModel = {
  status: AdaptiveProposalLlmConsentShellStatus;
  chipLabel: string;
  ctaLabel: string;
  ctaDisabled: true;
  disabledHelper: string;
  safetyLine: string;
  nonSqlWarning: string;
  providerDisabledCopy: string;
  payloadExclusions: string;
  payloadSummary: AdaptiveProposalLlmConsentShellPayloadSummary;
  blockedReasons: string[];
  changedFields: string[];
  originalOutlineUnchanged: boolean;
  providerCallMade: false;
  noSqlGenerated: true;
  noInsertAvailable: true;
  noRunAvailable: true;
  rawPromptTextShown: false;
  rawPayloadShown: false;
  rawProviderResponseShown: false;
};

export type CreateAdaptiveProposalLlmConsentShellInput = {
  proposal: AdaptiveReportProposal;
  dataset: DatasetMetadata | null;
  selectedGuidanceDialect?: SqlDialectId;
  globalProviderMode?: AdaptiveProposalLlmGlobalProviderMode;
  displayStatus?: AdaptiveProposalLlmConsentShellStatus;
  validation?: AdaptiveProposalLlmValidationResult | null;
  changedFields?: readonly string[];
};

const PROVIDER_DISABLED_COPY =
  "Provider access is disabled. This shell is a preview of the consent step; no provider call can be made.";
const DISABLED_HELPER = "Provider access is disabled. No data has been sent.";
const PAYLOAD_EXCLUSIONS =
  "Not sent: raw rows, sample values, top values, raw prompt text, SQL drafts, query results, clipboard content, API keys, or provider responses.";

const resolveWorksheets = (
  dataset: DatasetMetadata,
): AdaptiveProposalLlmPayloadWorksheet[] => {
  const worksheets = dataset.workbook_metadata?.worksheets || [];
  if (worksheets.length > 0) {
    return worksheets.map((worksheet) => ({
      worksheetId: worksheet.worksheetId,
      displayName: worksheet.displayName,
      sheetName: worksheet.sheetName,
      tableName: worksheet.tableName,
      schema: worksheet.schema,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
    }));
  }

  return [
    {
      worksheetId: dataset.dataset_id,
      displayName: dataset.original_filename,
      sheetName: dataset.original_filename,
      tableName: dataset.table_name,
      schema: dataset.schema,
      rowCount: dataset.row_count,
      columnCount: dataset.column_count,
    },
  ];
};

const statusFromGate = (
  gate: AdaptiveProposalLlmProviderGateResult,
  validation: AdaptiveProposalLlmValidationResult | null | undefined,
  changedFields: readonly string[],
): AdaptiveProposalLlmConsentShellStatus => {
  if (validation?.ok === false) return "validation_rejected";
  if (changedFields.length > 0) return "refined_planning_only";
  if (gate.datasetEligibility === "provider_disabled") return "provider_disabled";
  if (gate.datasetEligibility === "restricted_blocked") return "restricted_blocked";
  if (gate.datasetEligibility === "redaction_too_high") return "redaction_too_high_blocked";
  if (gate.requestConsent === "required") return "consent_required";
  return "metadata_only_eligible";
};

const chipLabelForStatus = (
  status: AdaptiveProposalLlmConsentShellStatus,
): string => {
  switch (status) {
    case "provider_disabled":
      return "Provider disabled";
    case "metadata_only_eligible":
      return "Metadata-only eligible";
    case "consent_required":
      return "Consent required";
    case "restricted_blocked":
      return "Blocked: restricted fields";
    case "redaction_too_high_blocked":
      return "Blocked: too much context redacted";
    case "validation_rejected":
      return "AI response rejected";
    case "refined_planning_only":
      return "Planning outline refined";
  }
};

export const createAdaptiveProposalLlmConsentShellViewModel = ({
  proposal,
  dataset,
  selectedGuidanceDialect,
  globalProviderMode = "provider_disabled",
  displayStatus,
  validation = null,
  changedFields = [],
}: CreateAdaptiveProposalLlmConsentShellInput): AdaptiveProposalLlmConsentShellViewModel | null => {
  if (!dataset) return null;

  const payload = buildAdaptiveProposalLlmPayload({
    proposal,
    worksheets: resolveWorksheets(dataset),
    acceptedRelationshipContracts:
      dataset.workbook_metadata?.acceptedRelationshipContracts || [],
    selectedGuidanceDialect:
      selectedGuidanceDialect || proposal.renderer.selectedGuidanceDialect,
  });
  const gate = evaluateAdaptiveProposalLlmProviderGate({
    payload,
    globalProviderMode,
  });
  const consent = createAdaptiveProposalLlmConsentState({
    payloadFingerprint: gate.payloadSummary.payloadFingerprint,
    providerMode: gate.globalProviderMode,
    payloadScope: gate.payloadScope,
    sanitizedPayloadSummary: gate.payloadSummary,
  });
  const consentSummary = summarizeAdaptiveProposalLlmConsent(consent);
  const status = displayStatus ?? statusFromGate(gate, validation, changedFields);

  return {
    status,
    chipLabel: chipLabelForStatus(status),
    ctaLabel: ADAPTIVE_PROPOSAL_LLM_PROVIDER_COPY.primaryCta,
    ctaDisabled: true,
    disabledHelper: DISABLED_HELPER,
    safetyLine: consentSummary.safetyLine,
    nonSqlWarning: consentSummary.nonSqlWarning,
    providerDisabledCopy: PROVIDER_DISABLED_COPY,
    payloadExclusions: PAYLOAD_EXCLUSIONS,
    payloadSummary: {
      tableCount: gate.payloadSummary.tableCount,
      includedColumnCount: gate.payloadSummary.includedColumnCount,
      redactedColumnCount: gate.payloadSummary.redactedColumnCount,
      restrictedOrExcludedColumnCount:
        gate.payloadSummary.restrictedColumnCount + gate.payloadSummary.excludedColumnCount,
      payloadFingerprint: gate.payloadSummary.payloadFingerprint,
      providerMode: gate.globalProviderMode,
      consentStatus: consentSummary.status,
    },
    blockedReasons: gate.blockedReasons.map((reason) => reason.message),
    changedFields: [...changedFields],
    originalOutlineUnchanged: validation?.ok === false,
    providerCallMade: false,
    noSqlGenerated: true,
    noInsertAvailable: true,
    noRunAvailable: true,
    rawPromptTextShown: false,
    rawPayloadShown: false,
    rawProviderResponseShown: false,
  };
};
