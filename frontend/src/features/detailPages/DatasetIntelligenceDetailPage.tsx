import type { DatasetIntelligencePreviewViewModel } from "../runtimeBridgeConsumers";
import FocusedWorkspaceShell from "../../components/layout/FocusedWorkspaceShell";

export type DatasetIntelligenceDetailPageProps = {
  readonly datasetIntelligencePreview: DatasetIntelligencePreviewViewModel;
  readonly sourceContext: string;
  readonly workbookContextLabel: string;
  readonly fieldTypeLabel: string;
  readonly backTargetLabel?: string;
  readonly preservedContextLabel?: string;
  readonly onBack: () => void;
};

function DatasetIntelligenceDetailPage({
  datasetIntelligencePreview,
  sourceContext,
  workbookContextLabel,
  fieldTypeLabel,
  backTargetLabel = "Data profile",
  preservedContextLabel = "preserve:dataset-intelligence-detail",
  onBack,
}: DatasetIntelligenceDetailPageProps) {
  return (
    <FocusedWorkspaceShell
      className="standalone-panel"
      eyebrow="Dataset intelligence"
      title="Data profile detail"
      summary={sourceContext}
      backLabel={`Back to ${backTargetLabel}`}
      onBack={onBack}
    >
      <div className="results-review-facts" aria-label="Dataset intelligence key facts">
        <span>
          <small>Dataset</small>
          <strong>{datasetIntelligencePreview.datasetLabel}</strong>
        </span>
        <span>
          <small>Rows</small>
          <strong>{datasetIntelligencePreview.rowCountLabel}</strong>
        </span>
        <span>
          <small>Columns</small>
          <strong>{datasetIntelligencePreview.columnCountLabel}</strong>
        </span>
        <span>
          <small>Workbook</small>
          <strong>{workbookContextLabel}</strong>
        </span>
      </div>

      <div>
        <p>{datasetIntelligencePreview.whyItMattersPreview}</p>
        <small>
          {datasetIntelligencePreview.detectedDataShapeSummary} / {fieldTypeLabel} /{" "}
          {datasetIntelligencePreview.readinessLabel}
        </small>
      </div>

      <div className="investigation-prompt-row" aria-label="Related dataset intelligence actions">
        <span>Related actions</span>
        <small>{datasetIntelligencePreview.opportunityPreview}</small>
        <small>Continue reviewing the current dataset profile</small>
      </div>

      <p className="status-message">
        {preservedContextLabel}: Back behavior preserves the current dataset, session, mode,
        workbook, worksheet, filters, pagination, result context, and expanded panels.
      </p>
    </FocusedWorkspaceShell>
  );
}

export default DatasetIntelligenceDetailPage;
