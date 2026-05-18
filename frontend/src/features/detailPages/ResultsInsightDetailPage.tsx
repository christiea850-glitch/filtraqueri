import type { ExplainabilityPreviewViewModel } from "../runtimeBridgeConsumers";

export type ResultsInsightDetailPageProps = {
  readonly explainabilityPreview: ExplainabilityPreviewViewModel;
  readonly sourceContext: string;
  readonly resultFactLabel: string;
  readonly filterSortLabel: string;
  readonly preservedContextLabel?: string;
  readonly backTargetLabel?: string;
  readonly onBack: () => void;
};

function ResultsInsightDetailPage({
  explainabilityPreview,
  sourceContext,
  resultFactLabel,
  filterSortLabel,
  preservedContextLabel = "preserve:results-insight-detail",
  backTargetLabel = "Results",
  onBack,
}: ResultsInsightDetailPageProps) {
  return (
    <section className="standalone-panel" aria-label="Results insight detail">
      <div>
        <p className="section-label">Results insight</p>
        <h2>Business takeaway detail</h2>
        <p>{sourceContext}</p>
      </div>

      <div className="workspace-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to {backTargetLabel}
        </button>
      </div>

      <div className="results-review-facts" aria-label="Results insight key facts">
        <span>
          <small>Confidence</small>
          <strong>{explainabilityPreview.confidenceLabel}</strong>
        </span>
        <span>
          <small>{explainabilityPreview.topEvidenceFact.label}</small>
          <strong>{explainabilityPreview.topEvidenceFact.value}</strong>
        </span>
        <span>
          <small>Result rows</small>
          <strong>{resultFactLabel}</strong>
        </span>
        <span>
          <small>Filters / sort</small>
          <strong>{filterSortLabel}</strong>
        </span>
      </div>

      <div>
        <p>{explainabilityPreview.takeawaySentence}</p>
        <small>{explainabilityPreview.whyItMattersPreview}</small>
      </div>

      <div className="investigation-prompt-row" aria-label="Related insight actions">
        <span>Related actions</span>
        <small>{explainabilityPreview.recommendationPreview}</small>
        <small>Keep reviewing the current result context</small>
      </div>

      <p className="status-message">
        {preservedContextLabel}: Back behavior preserves the current dataset, session, mode, filters, pagination,
        export state, result context, and expanded panels.
      </p>
    </section>
  );
}

export default ResultsInsightDetailPage;
