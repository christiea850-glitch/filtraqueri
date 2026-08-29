import { useState } from "react";
import type { BusinessSqlPlanCandidateViewModel } from "./adaptiveProposalBusinessSqlBridgeUiAdapter";

type BusinessSqlPlanCandidatePanelProps = {
  model: BusinessSqlPlanCandidateViewModel | null;
  onPreviewSqlFromCandidate?: () => void;
};

function BusinessSqlPlanCandidatePanel({
  model,
  onPreviewSqlFromCandidate,
}: BusinessSqlPlanCandidatePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (!model) return null;

  return (
    <section
      className="business-sql-plan-candidate-panel"
      aria-label="Read-only Business SQL plan candidate"
    >
      <div className="business-sql-preview-head">
        <div>
          <span>Business SQL plan candidate</span>
          <strong>{model.heading}</strong>
        </div>
        <div className="business-sql-preview-badges" aria-label="Plan candidate state">
          <em>{model.statusLabel}</em>
          <em>Read-only</em>
        </div>
      </div>
      <p>{model.body}</p>
      <p>{model.safetyLine}</p>
      <button
        type="button"
        className="secondary-button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {model.actionLabel}
      </button>
      {isOpen && (
        <div className="business-sql-plan-candidate-details">
          <dl>
            {model.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.values.join(", ")}</dd>
              </div>
            ))}
          </dl>
          <p className="business-sql-preview-action-note">
            No SQL preview was created. Editor changes, execution, backend calls, provider calls, and LLM calls are not available from this candidate.
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={onPreviewSqlFromCandidate}
            disabled={!model.previewHandoffAction.canPreview}
            title={model.previewHandoffAction.disabledReason || undefined}
          >
            {model.previewHandoffAction.label}
          </button>
        </div>
      )}
    </section>
  );
}

export default BusinessSqlPlanCandidatePanel;
