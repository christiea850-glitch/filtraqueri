import type { BusinessSqlRenderPreview } from "./businessSqlRenderPreview";
import type { AdaptiveProposalLlmConsentShellViewModel } from "./adaptiveProposalLlmConsentShellAdapter";

type AdaptiveProposalLlmConsentDisclosureProps = {
  model: AdaptiveProposalLlmConsentShellViewModel | null;
};

export type AdaptiveProposalLlmConsentDisclosureVisibilityInput = {
  model: AdaptiveProposalLlmConsentShellViewModel | null;
  businessSqlRenderPreview: BusinessSqlRenderPreview | null;
  activeSqlDraft: string;
};

export type AdaptiveProposalLlmConsentDisclosureRenderModel = {
  statusLabel: string;
  heading: string;
  safetyLine: string;
  nonSqlWarning: string;
  disabledHelper: string;
  payloadExclusions: string;
  summaryLine: string;
  payloadSummary: {
    tables: string;
    includedColumns: string;
    redactedColumns: string;
    restrictedOrExcludedColumns: string;
    payloadFingerprint: string;
    providerMode: string;
    consentStatus: string;
  };
  providerCallMade: false;
  noSqlGenerated: true;
  noInsertAvailable: true;
  noRunAvailable: true;
};

export const ADAPTIVE_PROPOSAL_LLM_DISCLOSURE_COPY = {
  heading: "Metadata-only AI refinement is unavailable here",
  nonSqlWarning:
    "This is not SQL generation. It can only describe possible planning-outline refinements.",
  summaryLine:
    "Would send counts only: tables, included columns, redacted columns, restricted/excluded columns, payload fingerprint, provider mode, and consent status.",
} as const;

const formatCount = (value: number): string => value.toLocaleString();

export const isBusinessSqlPreviewReadyRenderable = (
  preview: BusinessSqlRenderPreview | null,
): boolean => preview?.status === "ready" && Boolean(preview.sql);

export const shouldShowAdaptiveProposalLlmConsentDisclosure = ({
  model,
  businessSqlRenderPreview,
  activeSqlDraft,
}: AdaptiveProposalLlmConsentDisclosureVisibilityInput): boolean =>
  Boolean(model) &&
  Boolean(businessSqlRenderPreview) &&
  !isBusinessSqlPreviewReadyRenderable(businessSqlRenderPreview) &&
  !activeSqlDraft.trim();

export const createAdaptiveProposalLlmConsentDisclosureRenderModel = (
  model: AdaptiveProposalLlmConsentShellViewModel,
): AdaptiveProposalLlmConsentDisclosureRenderModel => ({
  statusLabel: model.chipLabel,
  heading: ADAPTIVE_PROPOSAL_LLM_DISCLOSURE_COPY.heading,
  safetyLine: model.safetyLine,
  nonSqlWarning: ADAPTIVE_PROPOSAL_LLM_DISCLOSURE_COPY.nonSqlWarning,
  disabledHelper: model.disabledHelper,
  payloadExclusions: model.payloadExclusions,
  summaryLine: ADAPTIVE_PROPOSAL_LLM_DISCLOSURE_COPY.summaryLine,
  payloadSummary: {
    tables: formatCount(model.payloadSummary.tableCount),
    includedColumns: formatCount(model.payloadSummary.includedColumnCount),
    redactedColumns: formatCount(model.payloadSummary.redactedColumnCount),
    restrictedOrExcludedColumns: formatCount(
      model.payloadSummary.restrictedOrExcludedColumnCount,
    ),
    payloadFingerprint: model.payloadSummary.payloadFingerprint || "Unavailable",
    providerMode: model.payloadSummary.providerMode,
    consentStatus: model.payloadSummary.consentStatus,
  },
  providerCallMade: false,
  noSqlGenerated: true,
  noInsertAvailable: true,
  noRunAvailable: true,
});

export const serializeAdaptiveProposalLlmConsentDisclosureForAudit = (
  model: AdaptiveProposalLlmConsentShellViewModel,
): string => JSON.stringify(createAdaptiveProposalLlmConsentDisclosureRenderModel(model));

function AdaptiveProposalLlmConsentDisclosure({
  model,
}: AdaptiveProposalLlmConsentDisclosureProps) {
  if (!model) return null;

  const disclosure = createAdaptiveProposalLlmConsentDisclosureRenderModel(model);

  return (
    <section
      className="adaptive-proposal-llm-consent-disclosure"
      aria-label="Metadata-only AI refinement provider-boundary disclosure"
    >
      <div className="business-sql-preview-badges" aria-label="Provider boundary state">
        <em>{disclosure.statusLabel}</em>
      </div>
      <strong>{disclosure.heading}</strong>
      <p>{disclosure.safetyLine}</p>
      <p>{disclosure.nonSqlWarning}</p>
      <p>{disclosure.disabledHelper}</p>
      <p>{disclosure.payloadExclusions}</p>
      <p>{disclosure.summaryLine}</p>
      <dl>
        <div>
          <dt>Tables</dt>
          <dd>{disclosure.payloadSummary.tables}</dd>
        </div>
        <div>
          <dt>Included columns</dt>
          <dd>{disclosure.payloadSummary.includedColumns}</dd>
        </div>
        <div>
          <dt>Redacted columns</dt>
          <dd>{disclosure.payloadSummary.redactedColumns}</dd>
        </div>
        <div>
          <dt>Restricted/excluded columns</dt>
          <dd>{disclosure.payloadSummary.restrictedOrExcludedColumns}</dd>
        </div>
        <div>
          <dt>Payload fingerprint</dt>
          <dd>{disclosure.payloadSummary.payloadFingerprint}</dd>
        </div>
        <div>
          <dt>Provider mode</dt>
          <dd>{disclosure.payloadSummary.providerMode}</dd>
        </div>
        <div>
          <dt>Consent status</dt>
          <dd>{disclosure.payloadSummary.consentStatus}</dd>
        </div>
      </dl>
    </section>
  );
}

export default AdaptiveProposalLlmConsentDisclosure;
