import type { AdaptiveProposalLlmConsentShellViewModel } from "./adaptiveProposalLlmConsentShellAdapter";

type AdaptiveProposalLlmConsentShellProps = {
  model: AdaptiveProposalLlmConsentShellViewModel | null;
};

const formatCount = (value: number): string => value.toLocaleString();

function AdaptiveProposalLlmConsentShell({
  model,
}: AdaptiveProposalLlmConsentShellProps) {
  if (!model) return null;

  return (
    <section className="adaptive-proposal-llm-consent-shell" aria-label="Metadata-only AI refinement consent preview">
      <div className="adaptive-proposal-llm-consent-head">
        <span className={`sql-grounding-badge ${model.status}`}>{model.chipLabel}</span>
      </div>
      <p>{model.disabledHelper}</p>
      {model.status === "validation_rejected" && (
        <p>AI response rejected. Original planning outline unchanged.</p>
      )}
      {model.status === "refined_planning_only" && model.changedFields.length > 0 && (
        <p>Changed fields: {model.changedFields.join(", ")}.</p>
      )}
      {model.blockedReasons.length > 0 && (
        <ul>
          {model.blockedReasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <details>
        <summary>Metadata-only AI refinement details</summary>
        <p>{model.safetyLine}</p>
        <p>{model.nonSqlWarning}</p>
        {model.status === "provider_disabled" && <p>{model.providerDisabledCopy}</p>}
        <dl>
          <div>
            <dt>Tables</dt>
            <dd>{formatCount(model.payloadSummary.tableCount)}</dd>
          </div>
          <div>
            <dt>Included columns</dt>
            <dd>{formatCount(model.payloadSummary.includedColumnCount)}</dd>
          </div>
          <div>
            <dt>Redacted columns</dt>
            <dd>{formatCount(model.payloadSummary.redactedColumnCount)}</dd>
          </div>
          <div>
            <dt>Restricted/excluded columns</dt>
            <dd>{formatCount(model.payloadSummary.restrictedOrExcludedColumnCount)}</dd>
          </div>
          <div>
            <dt>Provider mode</dt>
            <dd>{model.payloadSummary.providerMode}</dd>
          </div>
          <div>
            <dt>Consent status</dt>
            <dd>{model.payloadSummary.consentStatus}</dd>
          </div>
        </dl>
        <details className="adaptive-proposal-llm-audit-fingerprint">
          <summary>Developer/audit payload fingerprint</summary>
          <p>{model.payloadSummary.payloadFingerprint || "Unavailable"}</p>
        </details>
        <p>{model.payloadExclusions}</p>
      </details>
      <div className="sql-assistant-card-foot">
        <small>No provider call, SQL generation, insertion, or execution is available here.</small>
        <button type="button" className="secondary-button" disabled>
          {model.ctaLabel}
        </button>
      </div>
    </section>
  );
}

export default AdaptiveProposalLlmConsentShell;
