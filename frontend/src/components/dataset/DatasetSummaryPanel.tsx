import { useState } from "react";
import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";
import { useAnalyticsIntentGraph } from "../../features/analyticsIntentGraph";
import { useAnalyticsPlanning } from "../../features/analyticsPlanning";
import { useBusinessQuestions } from "../../features/businessQuestionIntelligence";
import { useBusinessSemantics } from "../../features/businessSemantics";
import { useDataIntelligence } from "../../features/dataIntelligence";
import { useExecutionContracts } from "../../features/executionContracts";
import { useKpiIntelligence } from "../../features/kpiIntelligence";
import { useWorkflowRecommendations } from "../../features/workflowRecommendations";
import { RuntimeDisclosureSlot } from "../../features/workspaceRuntime";
import {
  getDatasetActiveWorksheet,
  listWorkbookWorksheets,
  type WorksheetMetadata,
} from "../../features/workbook";
import { TaskLauncherPanel } from "../../features/tasksLauncher";
import DrillInDetailPanel from "../layout/DrillInDetailPanel";
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
  selectedTaskId?: string | null;
  onSelectedTaskIdChange?: (taskId: string | null) => void;
};

type DataDrillInView = "columns" | "worksheets" | "dataIntelligence" | "businessSemantics";

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
  onViewPreview,
  onHumanIntentSelect,
  onOpenDataset,
  onClearCurrentDataset,
  onDeleteDataset,
  onWorksheetSelect,
  isSwitchingWorksheet,
  selectedTaskId,
  onSelectedTaskIdChange,
}: DatasetSummaryPanelProps) {
  const [activeDrillInView, setActiveDrillInView] = useState<DataDrillInView | null>(null);
  const createSchemaTypeSummary = (metadata: DatasetMetadata) =>
    (Array.isArray(metadata.schema) ? metadata.schema : []).reduce<Record<string, number>>((summary, column) => {
      const type = column.inferred_type || "unknown";
      summary[type] = (summary[type] || 0) + 1;
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
    businessQuestionReport,
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
  const {
    analyticsIntentGraph,
    humanSummary: graphSummary,
  } = useAnalyticsIntentGraph({
    datasetId: dataset?.dataset_id || null,
    dataProfile,
    dialectRecommendation,
    workflowRecommendationReport,
    businessSemanticReport,
    kpiIntelligenceReport,
    businessQuestionReport,
  });
  const {
    analyticsPlan,
    humanSummary: planningSummary,
  } = useAnalyticsPlanning({
    datasetId: dataset?.dataset_id || null,
    dataProfile,
    workflowRecommendationReport,
    kpiIntelligenceReport,
    businessSemanticReport,
    businessQuestionReport,
    analyticsIntentGraph,
  });
  const {
    executionContract,
    humanSummary: executionContractSummary,
  } = useExecutionContracts({
    datasetId: dataset?.dataset_id || null,
    analyticsPlan,
    analyticsIntentGraph,
    dataProfile,
    workflowRecommendationReport,
    kpiIntelligenceReport,
    businessSemanticReport,
    businessQuestionReport,
  });
  const schemaTypeSummary = dataset ? createSchemaTypeSummary(dataset) : {};
  const detectedColumns = Array.isArray(dataset?.schema) ? dataset.schema : [];
  const dateColumnCount = detectedColumns.filter((column) => column.inferred_type === "date").length;
  const numericColumnCount = detectedColumns.filter((column) => column.inferred_type === "numeric").length;
  const textColumnCount = detectedColumns.filter(
    (column) => column.inferred_type === "text" || column.inferred_type === "categorical",
  ).length;
  const closeDrillIn = () => setActiveDrillInView(null);

  return (
    <div className="human-dataset-workspace">
      <section className="dataset-hub-panel" aria-label="Dataset management hub">
        <div className="summary-header">
          <div>
            <p className="section-label">Data</p>
            <h2>{dataset ? "Data profile" : "Open data"}</h2>
          </div>
          {dataset && (
            <div className="dataset-summary-actions dataset-hub-actions">
              <button type="button" className="secondary-button" onClick={onClearCurrentDataset}>
                Clear session
              </button>
            </div>
          )}
        </div>

        {dataset ? (
          <div className="data-profile-surface">
            <div className="data-profile-overview">
              <div>
                <span>Detected structure</span>
                <strong>{Object.keys(schemaTypeSummary).length.toLocaleString()} field types</strong>
                <p>Column types and workbook structure are ready for review.</p>
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
            </div>
            <div className="data-profile-metrics" aria-label="Detected data profile">
              <span>
                Numeric
                <strong>{numericColumnCount.toLocaleString()}</strong>
              </span>
              <span>
                Text/category
                <strong>{textColumnCount.toLocaleString()}</strong>
              </span>
              <span>
                Date
                <strong>{dateColumnCount.toLocaleString()}</strong>
              </span>
              <span>
                Types
                <strong>{Object.keys(schemaTypeSummary).length.toLocaleString()}</strong>
              </span>
            </div>
            <div className="drill-in-summary-grid" aria-label="Data detail summaries">
              <button type="button" onClick={() => setActiveDrillInView("columns")}>
                <span>Detected columns</span>
                <strong>{detectedColumns.length.toLocaleString()}</strong>
                <small>Open column list</small>
              </button>
              <button type="button" onClick={() => setActiveDrillInView("worksheets")}>
                <span>Worksheets</span>
                <strong>{workbookWorksheets.length.toLocaleString()}</strong>
                <small>Review workbook sheets</small>
              </button>
              <button type="button" onClick={() => setActiveDrillInView("dataIntelligence")}>
                <span>Data intelligence</span>
                <strong>{dataProfile ? dataProfile.shape.shapeLabel.replace(/_/g, " ") : "Profile"}</strong>
                <small>Open metadata details</small>
              </button>
              <button type="button" onClick={() => setActiveDrillInView("businessSemantics")}>
                <span>Business semantics</span>
                <strong>{detectedSemanticEntities.length.toLocaleString()}</strong>
                <small>Review business context</small>
              </button>
            </div>
          </div>
        ) : (
          <div className="dataset-empty-guidance">
            <p>No dataset open. Choose a CSV or Excel workbook to inspect its profile.</p>
            <button type="button" className="primary-button" onClick={onOpenDataset}>
              Choose CSV
            </button>
          </div>
        )}
      </section>

      {dataset && activeDrillInView === "columns" && (
        <DrillInDetailPanel
          eyebrow="Data detail"
          title="Detected columns"
          summary="Column details are shown here so the main Data page stays compact."
          onBack={closeDrillIn}
        >
          <section className="detected-columns-section" aria-label="Detected columns">
            <div className="worksheet-selector-header">
              <div>
                <p className="section-label">Detected columns</p>
                <h4>Column profile</h4>
              </div>
              <span className="dataset-count-pill">{detectedColumns.length.toLocaleString()}</span>
            </div>
            <div className="detected-column-list">
              {detectedColumns.map((column) => (
                <span key={column.name} title={column.name}>
                  <strong>{column.name}</strong>
                  <small>{column.inferred_type || "unknown"}</small>
                </span>
              ))}
            </div>
          </section>
        </DrillInDetailPanel>
      )}

      {dataset && activeDrillInView === "worksheets" && (
        <DrillInDetailPanel
          eyebrow="Workbook detail"
          title="Worksheets"
          summary="Switch worksheets without leaving the Data workspace."
          onBack={closeDrillIn}
        >
          <WorksheetSelector
            worksheets={workbookWorksheets}
            activeWorksheetId={activeWorksheet?.worksheetId || null}
            isSwitchingWorksheet={isSwitchingWorksheet}
            onWorksheetSelect={onWorksheetSelect}
          />
        </DrillInDetailPanel>
      )}

      {dataset && dataProfile && activeDrillInView === "dataIntelligence" && (
        <DrillInDetailPanel
          eyebrow="Data detail"
          title="Data intelligence"
          summary={humanSummary}
          onBack={closeDrillIn}
        >
        <RuntimeDisclosureSlot
          id="runtime-slot-data-intelligence"
          label="Runtime slot"
          title="Data intelligence"
          summary={humanSummary}
          badge={dialectRecommendation?.recommendedFutureEngine?.label || "Metadata only"}
        >
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
        </RuntimeDisclosureSlot>
        </DrillInDetailPanel>
      )}

      {dataset && recommendations.length > 0 && activeDrillInView === "dataIntelligence" && (
        <RuntimeDisclosureSlot
          id="runtime-slot-workflow-recommendations"
          label="Runtime slot"
          title="Workflow recommendations"
          summary={workflowSummary}
          badge={`${recommendations.length}`}
        >
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
        </RuntimeDisclosureSlot>
      )}

      {dataset && activeDrillInView === "businessSemantics" && (
        <DrillInDetailPanel
          eyebrow="Business detail"
          title="Business semantics"
          summary={semanticSummary || "Business context is derived from available metadata only."}
          onBack={closeDrillIn}
        >
        {businessSemanticReport && (
        <RuntimeDisclosureSlot
          id="runtime-slot-business-semantics"
          label="Runtime slot"
          title="Business semantics"
          summary={semanticSummary}
          badge={`${detectedSemanticEntities.length}`}
        >
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
        </RuntimeDisclosureSlot>
        )}
        {!businessSemanticReport && (
          <p className="compact-empty">No business semantic metadata is available for this dataset yet.</p>
        )}
        </DrillInDetailPanel>
      )}

      {dataset && kpiOpportunities.length > 0 && activeDrillInView === "businessSemantics" && (
        <RuntimeDisclosureSlot
          id="runtime-slot-kpi-intelligence"
          label="Runtime slot"
          title="KPI intelligence"
          summary={kpiSummary}
          badge={`${kpiOpportunities.length}`}
        >
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
        </RuntimeDisclosureSlot>
      )}

      {dataset && interpretedQuestions.length > 0 && activeDrillInView === "businessSemantics" && (
        <RuntimeDisclosureSlot
          id="runtime-slot-business-questions"
          label="Runtime slot"
          title="Business questions"
          summary={questionSummary}
          badge={`${interpretedQuestions.length}`}
        >
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
        </RuntimeDisclosureSlot>
      )}

      {dataset && analyticsIntentGraph && activeDrillInView === "dataIntelligence" && (
        <RuntimeDisclosureSlot
          id="runtime-slot-intent-graph"
          label="Runtime slot"
          title="Intent graph"
          summary={graphSummary}
          badge={analyticsIntentGraph.confidence}
        >
        <section className="analytics-intent-graph-panel" aria-label="Analytics intent graph">
          <div className="summary-header">
            <div>
              <p className="section-label">Intent graph</p>
              <h2>Connected analytics metadata</h2>
              <p>{graphSummary}</p>
            </div>
            <span className="dataset-count-pill">{analyticsIntentGraph.confidence}</span>
          </div>
          <div className="analytics-intent-graph-grid">
            <span>
              Nodes
              <strong>{analyticsIntentGraph.nodes.length}</strong>
            </span>
            <span>
              Edges
              <strong>{analyticsIntentGraph.edges.length}</strong>
            </span>
            <span>
              Workflows
              <strong>{analyticsIntentGraph.connectedWorkflows.length}</strong>
            </span>
            <span>
              KPIs
              <strong>{analyticsIntentGraph.connectedKpis.length}</strong>
            </span>
            <span>
              Missing
              <strong>{analyticsIntentGraph.missingMetadataDependencies.length}</strong>
            </span>
          </div>
        </section>
        </RuntimeDisclosureSlot>
      )}

      {dataset && analyticsPlan && activeDrillInView === "dataIntelligence" && (
        <RuntimeDisclosureSlot
          id="runtime-slot-analytics-plan"
          label="Runtime slot"
          title="Analytics plan"
          summary={planningSummary}
          badge={analyticsPlan.status.replace(/_/g, " ")}
        >
        <section className="analytics-planning-panel" aria-label="Analytics planning engine">
          <div className="summary-header">
            <div>
              <p className="section-label">Analytics plan</p>
              <h2>Future workflow plan</h2>
              <p>{planningSummary}</p>
            </div>
            <span className="dataset-count-pill">{analyticsPlan.status.replace(/_/g, " ")}</span>
          </div>
          <div className="analytics-planning-grid">
            <span>
              Steps
              <strong>{analyticsPlan.sizing.estimatedFutureStepCount}</strong>
            </span>
            <span>
              Complexity
              <strong>{analyticsPlan.complexity}</strong>
            </span>
            <span>
              Outputs
              <strong>{analyticsPlan.projectedOutputs.length}</strong>
            </span>
            <span>
              Warnings
              <strong>{analyticsPlan.warnings.length}</strong>
            </span>
          </div>
        </section>
        </RuntimeDisclosureSlot>
      )}

      {dataset && executionContract && activeDrillInView === "dataIntelligence" && (
        <RuntimeDisclosureSlot
          id="runtime-slot-execution-contract"
          label="Runtime slot"
          title="Run boundary"
          summary={executionContractSummary}
          badge={executionContract.lifecycleState.replace(/_/g, " ")}
        >
        <section className="execution-contract-panel" aria-label="Run boundary layer">
          <div className="summary-header">
            <div>
              <p className="section-label">Run boundary</p>
              <h2>Future run boundary</h2>
              <p>{executionContractSummary}</p>
            </div>
            <span className="dataset-count-pill">{executionContract.lifecycleState.replace(/_/g, " ")}</span>
          </div>
          <div className="execution-contract-grid">
            <span>
              Stages
              <strong>{executionContract.sizing.estimatedExecutionStages}</strong>
            </span>
            <span>
              Outputs
              <strong>{executionContract.sizing.estimatedProjectedOutputs}</strong>
            </span>
            <span>
              Engines
              <strong>{executionContract.engines.length}</strong>
            </span>
            <span>
              Readiness
              <strong>{executionContract.readinessScore}</strong>
            </span>
          </div>
        </section>
        </RuntimeDisclosureSlot>
      )}

      {dataset && activeDrillInView === "dataIntelligence" && (
        <RuntimeDisclosureSlot
          id="runtime-slot-task-launcher"
          label="Runtime slot"
          title="Guided analytics tasks"
          summary="Preview task inputs and metadata-only planning context."
          badge="Tasks"
        >
        <TaskLauncherPanel
          dataset={dataset}
          selectedTaskId={selectedTaskId}
          onSelectedTaskIdChange={onSelectedTaskIdChange}
        />
        </RuntimeDisclosureSlot>
      )}

      {dataset && activeDrillInView === "businessSemantics" && (
        <RuntimeDisclosureSlot
          id="runtime-slot-human-guidance"
          label="Runtime slot"
          title="Human Mode guidance"
          summary="Choose a simple continuation into the existing Human Mode workflow."
          badge="Human Mode"
        >
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
        </RuntimeDisclosureSlot>
      )}
    </div>
  );
}

export default DatasetSummaryPanel;
