import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";
import { useBusinessQuestions } from "../../features/businessQuestionIntelligence";
import { useBusinessSemantics } from "../../features/businessSemantics";
import { useDataIntelligence } from "../../features/dataIntelligence";
import { useKpiIntelligence } from "../../features/kpiIntelligence";
import { useWorkflowRecommendations } from "../../features/workflowRecommendations";
import {
  getDatasetActiveWorksheet,
  listWorkbookWorksheets,
  type WorksheetMetadata,
} from "../../features/workbook";
import { TaskLauncherPanel } from "../../features/tasksLauncher";
import WorkbookContextPanel from "../workbook/WorkbookContextPanel";

export type HumanIntent =
  | "summary"
  | "missing_values"
  | "top_categories"
  | "compare_columns"
  | "trends"
  | "unusual_values"
  | "simple_chart";

export type HumanGuidanceCard = {
  intent: HumanIntent;
  label: string;
};

type DatasetSummaryPanelProps = {
  dataset: DatasetMetadata | null;
  recentDatasets: DatasetSession[];
  onViewPreview: () => void;
  onHumanIntentSelect: (intent: HumanIntent) => void;
  onOpenDataset: () => void;
  onActivateRecentDataset: (datasetId: string) => void;
  onRemoveRecentDataset: (datasetId: string) => void;
  onClearCurrentDataset: () => void;
  onDeleteDataset: (datasetId: string) => void;
  onWorksheetSelect: (worksheetId: string) => void;
  isSwitchingWorksheet: boolean;
};

export const humanGuidanceCards: HumanGuidanceCard[] = [
  { intent: "summary", label: "Summarize" },
  { intent: "missing_values", label: "Missing values" },
  { intent: "top_categories", label: "Top categories" },
  { intent: "compare_columns", label: "Compare fields" },
  { intent: "trends", label: "Trend analysis" },
  { intent: "unusual_values", label: "Unusual values" },
  { intent: "simple_chart", label: "Visualize data" },
];

type DatasetSessionPanelProps = {
  dataset: DatasetMetadata;
  schemaTypeSummary: Record<string, number>;
  activeFilterLabels: string[];
  queryGroupBy: string[];
  onRelationshipReview?: (
    candidateId: string,
    reviewStatus: "pending" | "accepted" | "dismissed",
    notes?: string,
  ) => void;
};

export function DatasetSessionPanel({
  dataset,
  schemaTypeSummary,
  activeFilterLabels,
  queryGroupBy,
  onRelationshipReview,
}: DatasetSessionPanelProps) {
  return (
    <aside className="session-panel">
      <div>
        <p className="section-label">Context</p>
        <h2 title={dataset.original_filename}>{dataset.original_filename}</h2>
      </div>
      <div className="session-stat-list">
        <span>Rows</span>
        <strong>{dataset.row_count.toLocaleString()}</strong>
      </div>
      <div className="schema-type-list">
        <span>
          Columns
          <strong>{dataset.column_count.toLocaleString()}</strong>
        </span>
        <span>
          Types
          <strong>{Object.keys(schemaTypeSummary).length}</strong>
        </span>
      </div>
      <div className="active-context">
        <p>Filters</p>
        <small>{activeFilterLabels.length || "None"}</small>
      </div>
      <div className="active-context">
        <p>Grouping</p>
        <small>{queryGroupBy.length > 0 ? queryGroupBy.join(", ") : "None"}</small>
      </div>
      <WorkbookContextPanel
        dataset={dataset}
        variant="results"
        onRelationshipReview={onRelationshipReview}
      />
    </aside>
  );
}

type WorksheetSelectorProps = {
  worksheets: WorksheetMetadata[];
  activeWorksheetId: string | null;
  isSwitchingWorksheet: boolean;
  onWorksheetSelect: (worksheetId: string) => void;
};

function WorksheetSelector({
  worksheets,
  activeWorksheetId,
  isSwitchingWorksheet,
  onWorksheetSelect,
}: WorksheetSelectorProps) {
  if (worksheets.length === 0) return null;

  return (
    <div className="worksheet-selector" aria-label="Workbook worksheets">
      <div className="worksheet-selector-header">
        <div>
          <p className="section-label">Workbook sheets</p>
          <h4>Worksheets</h4>
        </div>
        <span className="dataset-count-pill">{worksheets.length}</span>
      </div>
      <div className="worksheet-list">
        {worksheets.map((worksheet) => {
          const isActive = worksheet.worksheetId === activeWorksheetId;
          const isReady = worksheet.status === "ready";
          const label = worksheet.displayName || worksheet.sheetName;

          return (
            <button
              type="button"
              className={`worksheet-item${isActive ? " active" : ""}`}
              key={worksheet.worksheetId}
              disabled={!isReady || isActive || isSwitchingWorksheet}
              onClick={() => onWorksheetSelect(worksheet.worksheetId)}
              aria-current={isActive ? "true" : undefined}
              title={label}
            >
              <span className="worksheet-name">{label}</span>
              <span className={`worksheet-status ${worksheet.status}`}>{worksheet.status}</span>
              <span className="worksheet-metrics">
                {worksheet.rowCount.toLocaleString()} rows
                <span aria-hidden="true">/</span>
                {worksheet.columnCount.toLocaleString()} columns
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DatasetSummaryPanel({
  dataset,
  recentDatasets,
  onViewPreview,
  onHumanIntentSelect,
  onOpenDataset,
  onActivateRecentDataset,
  onRemoveRecentDataset,
  onClearCurrentDataset,
  onDeleteDataset,
  onWorksheetSelect,
  isSwitchingWorksheet,
}: DatasetSummaryPanelProps) {
  const createSchemaTypeSummary = (metadata: DatasetMetadata) =>
    metadata.schema.reduce<Record<string, number>>((summary, column) => {
      summary[column.inferred_type] = (summary[column.inferred_type] || 0) + 1;
      return summary;
    }, {});
  const workbookWorksheets = listWorkbookWorksheets(dataset);
  const activeWorksheet = getDatasetActiveWorksheet(dataset);
  const { dataProfile, dialectRecommendation, humanSummary } = useDataIntelligence(dataset);
  const {
    recommendations,
    humanSummary: workflowSummary,
    workflowRecommendationReport,
  } = useWorkflowRecommendations({
    dataProfile,
    dialectRecommendation,
  });
  const {
    businessSemanticReport,
    detectedSemanticEntities,
    possibleBusinessKpis,
    humanSummary: semanticSummary,
  } = useBusinessSemantics({
    dataset,
    dataProfile,
    workflowRecommendationReport,
  });
  const {
    opportunities: kpiOpportunities,
    kpiIntelligenceReport,
    humanSummary: kpiSummary,
  } = useKpiIntelligence({
    dataProfile,
    businessSemanticReport,
    workflowRecommendationReport,
  });
  const {
    interpretedQuestions,
    humanSummary: questionSummary,
  } = useBusinessQuestions({
    datasetId: dataset?.dataset_id || null,
    questions: [
      "Which products sell the most?",
      "Are sales increasing?",
      "Which regions perform best?",
      "Can this data support forecasting?",
      "Which customers generate the most revenue?",
    ],
    businessSemanticReport,
    kpiIntelligenceReport,
    workflowRecommendationReport,
  });

  return (
    <div className="human-dataset-workspace">
      <section className="dataset-hub-panel" aria-label="Dataset management hub">
        <div className="summary-header">
          <div>
            <p className="section-label">Data</p>
            <h2>{dataset ? "Current dataset" : "No dataset open. Choose CSV."}</h2>
          </div>
          <div className="dataset-summary-actions dataset-hub-actions">
            <button type="button" className="primary-button" onClick={onOpenDataset}>
              Open data
            </button>
            {dataset && (
              <button type="button" className="secondary-button" onClick={onClearCurrentDataset}>
                Clear session
              </button>
            )}
          </div>
        </div>

        {dataset ? (
          <div className="dataset-current-card">
            <div className="dataset-card-main">
              <span className="dataset-id">ID: {dataset.dataset_id.slice(0, 8)}</span>
              <h3 title={dataset.original_filename}>{dataset.original_filename}</h3>
              <p title={dataset.table_name}>{dataset.table_name}</p>
            </div>
            <div className="summary-grid dataset-hub-stats">
              <div>
                <span>Rows</span>
                <strong>{dataset.row_count.toLocaleString()}</strong>
              </div>
              <div>
                <span>Columns</span>
                <strong>{dataset.column_count.toLocaleString()}</strong>
              </div>
              {Object.entries(createSchemaTypeSummary(dataset)).map(([type, count]) => (
                <div key={type}>
                  <span>{type}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
            <div className="dataset-card-actions">
              <button type="button" className="secondary-button" onClick={onViewPreview}>
                View results
              </button>
              <button
                type="button"
                className="text-button danger-text-button"
                onClick={() => onDeleteDataset(dataset.dataset_id)}
              >
                Delete
              </button>
            </div>
            <WorksheetSelector
              worksheets={workbookWorksheets}
              activeWorksheetId={activeWorksheet?.worksheetId || null}
              isSwitchingWorksheet={isSwitchingWorksheet}
              onWorksheetSelect={onWorksheetSelect}
            />
          </div>
        ) : (
          <div className="dataset-empty-guidance">
            <p>No dataset open. Choose CSV.</p>
            <button type="button" className="primary-button" onClick={onOpenDataset}>
              Choose CSV
            </button>
          </div>
        )}
      </section>

      {dataset && dataProfile && (
        <section className="data-intelligence-panel" aria-label="Data intelligence profile">
          <div className="summary-header">
            <div>
              <p className="section-label">Data intelligence</p>
              <h2>Profile and future engine fit</h2>
              <p>{humanSummary}</p>
            </div>
            <span className="dataset-count-pill">
              {dialectRecommendation?.recommendedFutureEngine?.label || "Metadata only"}
            </span>
          </div>
          <div className="data-intelligence-grid">
            <span>
              Shape
              <strong>{dataProfile.shape.shapeLabel.replace(/_/g, " ")}</strong>
            </span>
            <span>
              Metrics
              <strong>{dataProfile.possibleMetrics.length}</strong>
            </span>
            <span>
              Dimensions
              <strong>{dataProfile.possibleDimensions.length}</strong>
            </span>
            <span>
              Dates
              <strong>{dataProfile.dateTimeFields.length}</strong>
            </span>
            <span>
              Time-series
              <strong>{dataProfile.timeSeriesReadiness.ready ? "Possible" : "Needs fields"}</strong>
            </span>
            <span>
              Statistics
              <strong>{dataProfile.statisticalReadiness.ready ? "Possible" : "Needs metrics"}</strong>
            </span>
          </div>
        </section>
      )}

      {dataset && recommendations.length > 0 && (
        <section className="workflow-recommendation-panel" aria-label="Workflow recommendations">
          <div className="summary-header">
            <div>
              <p className="section-label">Workflow recommendations</p>
              <h2>Likely analysis paths</h2>
              <p>{workflowSummary}</p>
            </div>
            <span className="dataset-count-pill">{recommendations.length}</span>
          </div>
          <div className="workflow-recommendation-list">
            {recommendations.slice(0, 4).map((recommendation) => (
              <article className="workflow-recommendation-card" key={recommendation.id}>
                <strong>{recommendation.label}</strong>
                <p>{recommendation.humanSummary}</p>
                <div>
                  <small>{recommendation.confidence} confidence</small>
                  <small>{recommendation.recommendedFutureEnginePath[0]?.replace(/_/g, " ") || "metadata only"}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {dataset && businessSemanticReport && (
        <section className="business-semantics-panel" aria-label="Business semantic intelligence">
          <div className="summary-header">
            <div>
              <p className="section-label">Business semantics</p>
              <h2>Detected business context</h2>
              <p>{semanticSummary}</p>
            </div>
            <span className="dataset-count-pill">{detectedSemanticEntities.length}</span>
          </div>
          <div className="business-semantics-grid">
            {detectedSemanticEntities.slice(0, 6).map((entity) => (
              <article className="business-semantic-card" key={entity.id}>
                <strong>{entity.label}</strong>
                <span>{entity.confidence} confidence</span>
                <p>{entity.supportingMetadataSignals[0]?.description || "Detected from metadata."}</p>
              </article>
            ))}
          </div>
          {possibleBusinessKpis.length > 0 && (
            <div className="business-kpi-list">
              <span>Possible KPIs</span>
              {possibleBusinessKpis.slice(0, 5).map((kpi) => (
                <small key={kpi.id}>{kpi.label}</small>
              ))}
            </div>
          )}
        </section>
      )}

      {dataset && kpiOpportunities.length > 0 && (
        <section className="kpi-intelligence-panel" aria-label="KPI intelligence opportunities">
          <div className="summary-header">
            <div>
              <p className="section-label">KPI intelligence</p>
              <h2>Insight opportunities</h2>
              <p>{kpiSummary}</p>
            </div>
            <span className="dataset-count-pill">{kpiOpportunities.length}</span>
          </div>
          <div className="kpi-opportunity-list">
            {kpiOpportunities.slice(0, 4).map((opportunity) => (
              <article className="kpi-opportunity-card" key={opportunity.id}>
                <strong>{opportunity.label}</strong>
                <p>{opportunity.humanSummary}</p>
                <div>
                  <small>{opportunity.confidence} confidence</small>
                  <small>{opportunity.possibleChartTypes[0]?.replace(/_/g, " ") || "chart metadata"}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {dataset && interpretedQuestions.length > 0 && (
        <section className="business-question-panel" aria-label="Business question intelligence">
          <div className="summary-header">
            <div>
              <p className="section-label">Business questions</p>
              <h2>Question intent mapping</h2>
              <p>{questionSummary}</p>
            </div>
            <span className="dataset-count-pill">{interpretedQuestions.length}</span>
          </div>
          <div className="business-question-list">
            {interpretedQuestions.slice(0, 4).map((interpretation) => (
              <article className="business-question-card" key={interpretation.id}>
                <strong>{interpretation.questionText}</strong>
                <p>{interpretation.humanSummary}</p>
                <div>
                  <small>{interpretation.confidence} confidence</small>
                  <small>{interpretation.detectedIntentCategory.replace(/_/g, " ")}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="dataset-hub-panel" aria-label="Recent files">
        <div className="summary-header">
          <div>
            <p className="section-label">Recent files</p>
            <h2>Recent files</h2>
          </div>
          <span className="dataset-count-pill">{recentDatasets.length}</span>
        </div>

        {recentDatasets.length === 0 ? (
          <div className="dataset-empty-guidance compact-dataset-empty">
            <p>No recent files.</p>
          </div>
        ) : (
          <div className="recent-dataset-list">
            {recentDatasets.map((session) => {
              const metadata = session.dataset;
              const typeSummary = createSchemaTypeSummary(metadata);

              return (
                <article className="recent-dataset-card" key={metadata.dataset_id}>
                  <div className="dataset-card-main">
                    <h3 title={metadata.original_filename}>{metadata.original_filename}</h3>
                    <p title={metadata.table_name}>{metadata.table_name}</p>
                  </div>
                  <div className="recent-dataset-meta">
                    <span>{metadata.row_count.toLocaleString()} rows</span>
                    <span>{metadata.column_count.toLocaleString()} columns</span>
                    {Object.entries(typeSummary)
                      .slice(0, 4)
                      .map(([type, count]) => (
                        <span key={type}>
                          {type}: {count}
                        </span>
                      ))}
                  </div>
                  <div className="dataset-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onActivateRecentDataset(metadata.dataset_id)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onRemoveRecentDataset(metadata.dataset_id)}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className="text-button danger-text-button"
                      onClick={() => onDeleteDataset(metadata.dataset_id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {dataset && (
        <TaskLauncherPanel dataset={dataset} />
      )}

      {dataset && (
        <section className="human-guidance-panel" aria-label="Human mode data guidance">
          <div>
            <p className="section-label">Guided analysis</p>
            <h2>Choose an insight</h2>
          </div>
          <div className="human-suggestion-grid">
            {humanGuidanceCards.map((suggestion) => (
              <button
                type="button"
                key={suggestion.intent}
                onClick={() => onHumanIntentSelect(suggestion.intent)}
              >
                <strong>{suggestion.label}</strong>
                <span>Human Mode</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default DatasetSummaryPanel;
