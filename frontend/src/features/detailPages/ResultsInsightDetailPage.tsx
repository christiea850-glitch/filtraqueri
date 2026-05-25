import type { ExplainabilityPreviewViewModel } from "../runtimeBridgeConsumers";
import FocusedWorkspaceShell from "../../components/layout/FocusedWorkspaceShell";

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
    <FocusedWorkspaceShell
      className="standalone-panel"
      eyebrow="Results insight"
      title="Business takeaway detail"
      summary={sourceContext}
      backLabel={`Back to ${backTargetLabel}`}
      onBack={onBack}
    >
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
    </FocusedWorkspaceShell>
  );
}

export default ResultsInsightDetailPage;
