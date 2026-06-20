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
      <div className="sql-template-recommendation-title-row">
        <span className={`sql-grounding-badge ${model.status}`}>{model.chipLabel}</span>
      </div>
      <p>{model.safetyLine}</p>
      <p>{model.nonSqlWarning}</p>
      {model.status === "provider_disabled" && <p>{model.providerDisabledCopy}</p>}
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
        <summary>What would be sent?</summary>
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
            <dt>Payload fingerprint</dt>
            <dd>{model.payloadSummary.payloadFingerprint || "Unavailable"}</dd>
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
        <p>{model.payloadExclusions}</p>
      </details>
      <div className="sql-assistant-card-foot">
        <small>{model.disabledHelper}</small>
        <button type="button" className="secondary-button" disabled>
          {model.ctaLabel}
        </button>
      </div>
    </section>
  );
}

export default AdaptiveProposalLlmConsentShell;

