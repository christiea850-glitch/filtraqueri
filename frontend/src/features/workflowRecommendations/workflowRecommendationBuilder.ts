import type {
  DataProfileReport,
  DialectRecommendationReport,
  FutureDialectRecommendationId,
} from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import type {
  WorkflowRecommendation,
  WorkflowRecommendationConfidence,
  WorkflowRecommendationReport,
  WorkflowRecommendationSignal,
} from "./workflowRecommendationTypes";
import { validateWorkflowRecommendationReport } from "./workflowRecommendationValidation";

type WorkflowRecommendationBuilderInput = {
  dataProfile: DataProfileReport | null;
  dialectRecommendation: DialectRecommendationReport | null;
  guidedInputState?: GuidedInputState | null;
  planningReadiness?: PlanningReadinessReport | null;
  executionPreview?: ExecutionPreviewReport | null;
};

type RecommendationDraft = Omit<WorkflowRecommendation, "id" | "rank" | "confidence"> & {
  score: number;
};

const confidenceFromScore = (score: number): WorkflowRecommendationConfidence => {
  if (score >= 7) return "high";
  if (score >= 4) return "moderate";
  return "low";
};

const signal = (id: string, label: string, description: string): WorkflowRecommendationSignal => ({
  id,
  label,
  description,
});

const hasEntityNamedField = (profile: DataProfileReport, terms: string[]) =>
  [...profile.possibleDimensions, ...profile.possibleIdFields].some((field) => {
    const name = field.name.toLowerCase();
    return terms.some((term) => name.includes(term));
  });

const listSelectedInputSignals = (guidedInputState: GuidedInputState | null | undefined) =>
  guidedInputState?.selections
    .filter((selection) => selection.value)
    .map((selection) =>
      signal(
        `guided-input:${selection.inputId}`,
        selection.inputId.replace(/-/g, " "),
        selection.label || selection.value || "Selected guided input",
      ),
    ) || [];

const listExecutionStageSignals = (executionPreview: ExecutionPreviewReport | null | undefined) =>
  executionPreview?.plannedStages.map((stage) =>
    signal(`execution-stage:${stage.stageType}`, stage.label, stage.description),
  ) || [];

const futureEnginesFromDialect = (
  dialectRecommendation: DialectRecommendationReport | null,
): FutureDialectRecommendationId[] =>
  dialectRecommendation?.recommendations
    .filter((recommendation) => recommendation.confidence !== "low")
    .slice(0, 3)
    .map((recommendation) => recommendation.id) || ["duckdb_sql"];

const withUniqueSignals = (signals: WorkflowRecommendationSignal[]) => {
  const seen = new Set<string>();
  return signals.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const createDraft = ({
  category,
  label,
  score,
  humanSummary,
  whyRecommended,
  supportingMetadataSignals,
  missingMetadataBlockers,
  recommendedFutureEnginePath,
  possibleFutureResultShapes,
}: RecommendationDraft): RecommendationDraft => ({
  category,
  label,
  score,
  humanSummary,
  whyRecommended,
  supportingMetadataSignals: withUniqueSignals(supportingMetadataSignals),
  missingMetadataBlockers,
  recommendedFutureEnginePath,
  possibleFutureResultShapes,
});

const buildDrafts = ({
  dataProfile,
  dialectRecommendation,
  guidedInputState,
  planningReadiness,
  executionPreview,
}: WorkflowRecommendationBuilderInput): RecommendationDraft[] => {
  if (!dataProfile) return [];

  const selectedInputSignals = listSelectedInputSignals(guidedInputState);
  const executionSignals = listExecutionStageSignals(executionPreview);
  const futureEnginePath = futureEnginesFromDialect(dialectRecommendation);
  const hasMetrics = dataProfile.possibleMetrics.length > 0;
  const hasDimensions = dataProfile.possibleDimensions.length > 0;
  const hasDates = dataProfile.timeSeriesReadiness.ready;
  const hasStats = dataProfile.statisticalReadiness.ready;
  const hasWorkbookRelationships = dataProfile.workbookRelationshipContext.hasWorkbookContext;
  const hasProductEntity = hasEntityNamedField(dataProfile, ["product", "sku", "item", "category"]);
  const hasCustomerEntity = hasEntityNamedField(dataProfile, ["customer", "account", "client", "user"]);
  const hasLocationEntity = hasEntityNamedField(dataProfile, ["city", "state", "region", "country", "location"]);
  const hasExperimentEntity = hasEntityNamedField(dataProfile, ["variant", "group", "cohort", "test"]);
  const hasOperationalEntity = hasEntityNamedField(dataProfile, ["status", "ticket", "order", "operation"]);
  const planningReady = planningReadiness?.status === "ready_for_future_execution";
  const executionStageTypes = new Set(executionPreview?.plannedStages.map((stage) => stage.stageType) || []);
  const executionResultShape = executionPreview?.expectedFutureResultShape;

  return [
    createDraft({
      category: "summarization",
      label: "Summarization",
      score: 3 + (hasMetrics ? 1 : 0) + (hasDimensions ? 1 : 0),
      humanSummary: "This dataset may support summary workflows.",
      whyRecommended: ["Dataset metadata is available for row, column, and field-type summaries."],
      supportingMetadataSignals: [
        signal("shape", "Dataset shape", dataProfile.shape.shapeLabel.replace(/_/g, " ")),
        signal("columns", "Detected columns", `${dataProfile.shape.columnCount} columns detected.`),
      ],
      missingMetadataBlockers: dataProfile.shape.shapeLabel === "empty" ? ["Dataset has no populated profile shape."] : [],
      recommendedFutureEnginePath: ["duckdb_sql"],
      possibleFutureResultShapes: ["summary_table"],
    }),
    createDraft({
      category: "dashboard_reporting",
      label: "Dashboard reporting",
      score: 2 + (hasMetrics ? 3 : 0) + (hasDimensions ? 2 : 0) + (hasDates ? 1 : 0),
      humanSummary: "FiltraQueri detected business metrics suitable for dashboard reporting.",
      whyRecommended: ["Metrics and dimensions can support future dashboard-style summaries."],
      supportingMetadataSignals: [
        signal("metrics", "Metric candidates", `${dataProfile.possibleMetrics.length} possible metrics.`),
        signal("dimensions", "Dimension candidates", `${dataProfile.possibleDimensions.length} possible dimensions.`),
      ],
      missingMetadataBlockers: [
        ...(hasMetrics ? [] : ["No numeric metric candidates detected."]),
        ...(hasDimensions ? [] : ["No dimension candidates detected."]),
      ],
      recommendedFutureEnginePath: futureEnginePath,
      possibleFutureResultShapes: ["summary_table", "grouped_table", "trend_output"],
    }),
    createDraft({
      category: "executive_summary",
      label: "Executive summary",
      score: 2 + (hasMetrics ? 2 : 0) + (hasDates ? 1 : 0) + (planningReady ? 1 : 0),
      humanSummary: "This dataset may support executive summary workflows.",
      whyRecommended: ["High-level summaries can be prepared from metric and readiness metadata."],
      supportingMetadataSignals: [
        signal("profile-summary", "Profile summary", dataProfile.analystSummary),
        ...(planningReadiness
          ? [signal("planning-readiness", "Planning readiness", planningReadiness.status.replace(/_/g, " "))]
          : []),
      ],
      missingMetadataBlockers: hasMetrics ? [] : ["Executive summaries are stronger with numeric metrics."],
      recommendedFutureEnginePath: futureEnginePath,
      possibleFutureResultShapes: ["summary_table", "comparison_output"],
    }),
    createDraft({
      category: "product_analysis",
      label: "Product analysis",
      score: (hasProductEntity ? 4 : 0) + (hasMetrics ? 2 : 0) + (hasWorkbookRelationships ? 2 : 0),
      humanSummary: hasWorkbookRelationships
        ? "Workbook relationships may support product analysis."
        : "This dataset may support product analysis.",
      whyRecommended: ["Product-like fields, metric fields, or workbook relationships suggest product analysis."],
      supportingMetadataSignals: [
        ...(hasProductEntity ? [signal("product-field", "Product-like fields", "Product, SKU, item, or category metadata detected.")] : []),
        ...(hasWorkbookRelationships ? [signal("workbook", "Workbook relationships", dataProfile.workbookRelationshipContext.summary)] : []),
        signal("metrics", "Metric candidates", `${dataProfile.possibleMetrics.length} possible metrics.`),
      ],
      missingMetadataBlockers: hasProductEntity ? [] : ["No product-like entity field detected."],
      recommendedFutureEnginePath: hasWorkbookRelationships ? ["excel_workbook", "duckdb_sql"] : ["duckdb_sql"],
      possibleFutureResultShapes: ["ranked_output", "grouped_table", "comparison_output"],
    }),
    createDraft({
      category: "customer_segmentation",
      label: "Customer segmentation",
      score: (hasCustomerEntity ? 4 : 0) + (hasDimensions ? 2 : 0) + (hasMetrics ? 1 : 0),
      humanSummary: "This dataset may support customer segmentation workflows.",
      whyRecommended: ["Customer-like fields and dimensions can support grouping customers or accounts."],
      supportingMetadataSignals: [
        ...(hasCustomerEntity ? [signal("customer-field", "Customer-like fields", "Customer, account, client, or user metadata detected.")] : []),
        signal("dimensions", "Dimension candidates", `${dataProfile.possibleDimensions.length} possible dimensions.`),
      ],
      missingMetadataBlockers: hasCustomerEntity ? [] : ["No customer-like entity field detected."],
      recommendedFutureEnginePath: ["duckdb_sql", "python_analysis"],
      possibleFutureResultShapes: ["grouped_table", "comparison_output"],
    }),
    createDraft({
      category: "churn_analysis",
      label: "Churn analysis",
      score: (hasCustomerEntity ? 3 : 0) + (hasDates ? 2 : 0) + (hasMetrics ? 1 : 0),
      humanSummary: "This dataset may support churn or inactivity workflows.",
      whyRecommended: ["Customer-like fields plus dates can support future churn or inactivity checks."],
      supportingMetadataSignals: [
        ...(hasCustomerEntity ? [signal("customer-field", "Customer-like fields", "Customer metadata detected.")] : []),
        signal("time-series", "Time-series readiness", dataProfile.timeSeriesReadiness.summary),
      ],
      missingMetadataBlockers: [
        ...(hasCustomerEntity ? [] : ["No customer-like field detected."]),
        ...(hasDates ? [] : ["Churn workflows usually need a date/time field."]),
      ],
      recommendedFutureEnginePath: ["python_analysis", "duckdb_sql"],
      possibleFutureResultShapes: ["summary_table", "trend_output"],
    }),
    createDraft({
      category: "time_series_forecasting",
      label: "Time-series forecasting",
      score:
        (hasDates ? 5 : 0) +
        (executionStageTypes.has("forecasting") ? 2 : 0) +
        (executionResultShape === "forecast_output" ? 1 : 0),
      humanSummary: "This dataset may support forecasting workflows.",
      whyRecommended: ["Date/time fields and metrics indicate future forecasting readiness."],
      supportingMetadataSignals: [
        signal("time-series", "Time-series readiness", dataProfile.timeSeriesReadiness.summary),
        ...executionSignals.filter((item) => item.id.includes("forecasting")),
      ],
      missingMetadataBlockers: hasDates ? [] : ["Forecasting needs at least one date/time field and one metric."],
      recommendedFutureEnginePath: ["python_analysis", "r_statistical_analysis"],
      possibleFutureResultShapes: ["forecast_output", "trend_output"],
    }),
    createDraft({
      category: "trend_analysis",
      label: "Trend analysis",
      score: (hasDates ? 4 : 0) + (hasMetrics ? 2 : 0) + (executionResultShape === "trend_output" ? 1 : 0),
      humanSummary: "This dataset may support trend analysis workflows.",
      whyRecommended: ["Date/time and metric metadata can support future trend comparisons."],
      supportingMetadataSignals: [
        signal("time-series", "Time-series readiness", dataProfile.timeSeriesReadiness.summary),
        ...executionSignals.filter((item) => item.id.includes("aggregation")),
      ],
      missingMetadataBlockers: hasDates ? [] : ["Trend analysis needs date/time metadata."],
      recommendedFutureEnginePath: ["duckdb_sql", "python_analysis"],
      possibleFutureResultShapes: ["trend_output", "grouped_table"],
    }),
    createDraft({
      category: "correlation_analysis",
      label: "Correlation analysis",
      score:
        (dataProfile.possibleMetrics.length >= 2 ? 5 : 0) +
        (executionStageTypes.has("statistical_analysis") ? 2 : 0),
      humanSummary: "This dataset may support correlation workflows.",
      whyRecommended: ["Multiple numeric metrics can support future correlation analysis."],
      supportingMetadataSignals: [
        signal("statistics", "Statistical readiness", dataProfile.statisticalReadiness.summary),
        ...executionSignals.filter((item) => item.id.includes("statistical_analysis")),
      ],
      missingMetadataBlockers:
        dataProfile.possibleMetrics.length >= 2 ? [] : ["Correlation analysis usually needs at least two numeric metrics."],
      recommendedFutureEnginePath: ["r_statistical_analysis", "python_analysis"],
      possibleFutureResultShapes: ["statistical_output"],
    }),
    createDraft({
      category: "statistical_testing",
      label: "Statistical testing",
      score: (hasStats ? 5 : 0) + (hasDimensions ? 1 : 0),
      humanSummary: "This dataset may support statistical testing workflows.",
      whyRecommended: ["Statistical readiness signals indicate numeric and grouping metadata."],
      supportingMetadataSignals: [
        signal("statistics", "Statistical readiness", dataProfile.statisticalReadiness.summary),
        signal("dimensions", "Dimension candidates", `${dataProfile.possibleDimensions.length} possible dimensions.`),
      ],
      missingMetadataBlockers: hasStats ? [] : ["Statistical testing needs stronger numeric or grouping metadata."],
      recommendedFutureEnginePath: ["r_statistical_analysis", "python_analysis"],
      possibleFutureResultShapes: ["statistical_output", "comparison_output"],
    }),
    createDraft({
      category: "ab_testing",
      label: "A/B testing",
      score: (hasExperimentEntity ? 4 : 0) + (hasMetrics ? 2 : 0) + (hasStats ? 1 : 0),
      humanSummary: "This dataset may support A/B testing workflows.",
      whyRecommended: ["Experiment-like grouping fields and metrics can support future test comparisons."],
      supportingMetadataSignals: [
        ...(hasExperimentEntity ? [signal("experiment-field", "Experiment-like fields", "Variant, group, cohort, or test metadata detected.")] : []),
        signal("metrics", "Metric candidates", `${dataProfile.possibleMetrics.length} possible metrics.`),
      ],
      missingMetadataBlockers: [
        ...(hasExperimentEntity ? [] : ["No variant, group, cohort, or test field detected."]),
        ...(hasMetrics ? [] : ["A/B testing needs a metric field."]),
      ],
      recommendedFutureEnginePath: ["r_statistical_analysis", "python_analysis"],
      possibleFutureResultShapes: ["statistical_output", "comparison_output"],
    }),
    createDraft({
      category: "location_analysis",
      label: "Location analysis",
      score: (hasLocationEntity ? 4 : 0) + (hasMetrics ? 2 : 0),
      humanSummary: "This dataset may support location analysis workflows.",
      whyRecommended: ["Location-like dimensions can support geographic grouping or comparison."],
      supportingMetadataSignals: [
        ...(hasLocationEntity ? [signal("location-field", "Location-like fields", "Region, city, state, country, or location metadata detected.")] : []),
        signal("metrics", "Metric candidates", `${dataProfile.possibleMetrics.length} possible metrics.`),
      ],
      missingMetadataBlockers: hasLocationEntity ? [] : ["No location-like field detected."],
      recommendedFutureEnginePath: ["duckdb_sql", "future_postgresql_general_sql"],
      possibleFutureResultShapes: ["grouped_table", "comparison_output"],
    }),
    createDraft({
      category: "recommendation_analysis",
      label: "Recommendation analysis",
      score: (hasProductEntity ? 2 : 0) + (hasCustomerEntity ? 2 : 0) + (hasWorkbookRelationships ? 2 : 0),
      humanSummary: "This dataset may support recommendation analysis workflows.",
      whyRecommended: ["Customer, product, and relationship metadata can support future recommendation-style analysis."],
      supportingMetadataSignals: [
        ...(hasProductEntity ? [signal("product-field", "Product-like fields", "Product metadata detected.")] : []),
        ...(hasCustomerEntity ? [signal("customer-field", "Customer-like fields", "Customer metadata detected.")] : []),
        ...(hasWorkbookRelationships ? [signal("workbook", "Workbook relationships", dataProfile.workbookRelationshipContext.summary)] : []),
      ],
      missingMetadataBlockers:
        hasProductEntity && hasCustomerEntity ? [] : ["Recommendation analysis benefits from both product and customer metadata."],
      recommendedFutureEnginePath: ["python_analysis", "excel_workbook"],
      possibleFutureResultShapes: ["ranked_output", "grouped_table"],
    }),
    createDraft({
      category: "operational_monitoring",
      label: "Operational monitoring",
      score: (hasOperationalEntity ? 3 : 0) + (hasDates ? 2 : 0) + (hasMetrics ? 1 : 0),
      humanSummary: "This dataset may support operational monitoring workflows.",
      whyRecommended: ["Operational fields, dates, and metrics can support monitoring-style analysis."],
      supportingMetadataSignals: [
        ...(hasOperationalEntity ? [signal("operational-field", "Operational fields", "Status, ticket, order, or operation metadata detected.")] : []),
        signal("shape", "Dataset shape", dataProfile.shape.shapeLabel.replace(/_/g, " ")),
      ],
      missingMetadataBlockers: hasOperationalEntity ? [] : ["No operational status or process-like field detected."],
      recommendedFutureEnginePath: ["duckdb_sql", "python_analysis"],
      possibleFutureResultShapes: ["summary_table", "trend_output"],
    }),
  ].map((draft) => ({
    ...draft,
    supportingMetadataSignals: withUniqueSignals([
      ...draft.supportingMetadataSignals,
      ...selectedInputSignals,
    ]).slice(0, 6),
  }));
};

const buildHumanSummary = (recommendations: WorkflowRecommendation[]) => {
  const top = recommendations[0];
  if (!top) return "FiltraQueri needs more metadata before recommending workflows.";
  return top.humanSummary;
};

const buildAnalystSummary = (recommendations: WorkflowRecommendation[]) => {
  const top = recommendations[0];
  if (!top) return "No workflow recommendation metadata is available.";
  return `${top.label} is currently ranked first with ${top.confidence} confidence. ${recommendations.length} workflow recommendation${recommendations.length === 1 ? "" : "s"} available.`;
};

export const buildWorkflowRecommendationReport = (
  input: WorkflowRecommendationBuilderInput,
): WorkflowRecommendationReport | null => {
  if (!input.dataProfile) return null;

  const drafts = buildDrafts(input)
    .filter((draft) => draft.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.label.localeCompare(right.label);
    });
  const recommendations = drafts.map<WorkflowRecommendation>((draft, index) => ({
    id: `${input.dataProfile?.datasetId || "dataset"}:workflow:${draft.category}`,
    category: draft.category,
    label: draft.label,
    rank: index + 1,
    confidence: confidenceFromScore(draft.score),
    humanSummary: draft.humanSummary,
    whyRecommended: draft.whyRecommended,
    supportingMetadataSignals: draft.supportingMetadataSignals,
    missingMetadataBlockers: draft.missingMetadataBlockers,
    recommendedFutureEnginePath: draft.recommendedFutureEnginePath,
    possibleFutureResultShapes: draft.possibleFutureResultShapes,
  }));
  const initialReport: WorkflowRecommendationReport = {
    datasetId: input.dataProfile.datasetId,
    recommendations,
    topRecommendation: recommendations[0] || null,
    humanSummary: buildHumanSummary(recommendations),
    analystSummary: buildAnalystSummary(recommendations),
    sourceMetadata: {
      planningReadinessStatus: input.planningReadiness?.status || "missing",
      executionPreviewStages: input.executionPreview?.plannedStages.map((stage) => stage.stageType) || [],
      guidedInputReady: input.guidedInputState?.readyForPlanning ?? null,
    },
  };
  const validation = validateWorkflowRecommendationReport(initialReport);

  if (validation.messages.length === 0) return initialReport;

  return {
    ...initialReport,
    recommendations: initialReport.recommendations.map((recommendation) =>
      recommendation.rank === 1
        ? {
            ...recommendation,
            missingMetadataBlockers: [
              ...recommendation.missingMetadataBlockers,
              ...validation.messages
                .filter((message) => message.severity === "warning")
                .map((message) => message.message),
            ],
          }
        : recommendation,
    ),
  };
};
