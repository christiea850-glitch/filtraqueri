import type { DatasetIntelligencePreviewViewModel } from "../runtimeBridgeConsumers";

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
    <section className="standalone-panel" aria-label="Dataset intelligence detail">
      <div>
        <p className="section-label">Dataset intelligence</p>
        <h2>Data profile detail</h2>
        <p>{sourceContext}</p>
      </div>

      <div className="workspace-actions">
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to {backTargetLabel}
        </button>
      </div>

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
    </section>
  );
}

export default DatasetIntelligenceDetailPage;

