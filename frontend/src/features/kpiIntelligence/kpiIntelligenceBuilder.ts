import type {
  BusinessSemanticEntityCategory,
  BusinessSemanticReport,
} from "../businessSemantics";
import type {
  DataProfileReport,
  FutureDialectRecommendationId,
} from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import type {
  WorkflowRecommendationCategory,
  WorkflowRecommendationReport,
} from "../workflowRecommendations";
import type {
  KpiIntelligenceReport,
  KpiIntelligenceSignal,
  KpiOpportunity,
  KpiOpportunityConfidence,
} from "./kpiIntelligenceTypes";
import { validateKpiIntelligenceReport } from "./kpiIntelligenceValidation";

type KpiIntelligenceBuilderInput = {
  dataProfile: DataProfileReport | null;
  businessSemanticReport: BusinessSemanticReport | null;
  workflowRecommendationReport?: WorkflowRecommendationReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  guidedInputState?: GuidedInputState | null;
  planningReadiness?: PlanningReadinessReport | null;
};

type KpiOpportunityDraft = Omit<KpiOpportunity, "id" | "rank" | "confidence"> & {
  score: number;
};

const confidenceFromScore = (score: number): KpiOpportunityConfidence => {
  if (score >= 7) return "high";
  if (score >= 4) return "moderate";
  return "low";
};

const createSignal = (
  id: string,
  label: string,
  description: string,
  source: KpiIntelligenceSignal["source"],
): KpiIntelligenceSignal => ({ id, label, description, source });

const uniqueSignals = (signals: KpiIntelligenceSignal[]) => {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) return false;
    seen.add(signal.id);
    return true;
  });
};

const hasSemanticEntity = (
  businessSemanticReport: BusinessSemanticReport,
  category: BusinessSemanticEntityCategory,
) => businessSemanticReport.detectedSemanticEntities.some((entity) => entity.category === category);

const hasWorkflow = (
  workflowRecommendationReport: WorkflowRecommendationReport | null | undefined,
  category: WorkflowRecommendationCategory,
) => workflowRecommendationReport?.recommendations.some(
  (recommendation) => recommendation.category === category && recommendation.confidence !== "low",
) || false;

const semanticSignals = (
  businessSemanticReport: BusinessSemanticReport,
  categories: BusinessSemanticEntityCategory[],
) =>
  businessSemanticReport.detectedSemanticEntities
    .filter((entity) => categories.includes(entity.category))
    .flatMap((entity) =>
      entity.supportingMetadataSignals.slice(0, 2).map((signal) =>
        createSignal(
          `semantic:${entity.category}:${signal.id}`,
          entity.label,
          signal.description,
          "business_semantics",
        ),
      ),
    );

const workflowSignals = (
  workflowRecommendationReport: WorkflowRecommendationReport | null | undefined,
  categories: WorkflowRecommendationCategory[],
) =>
  workflowRecommendationReport?.recommendations
    .filter((recommendation) => categories.includes(recommendation.category))
    .slice(0, 3)
    .map((recommendation) =>
      createSignal(
        `workflow:${recommendation.category}`,
        recommendation.label,
        recommendation.humanSummary,
        "workflow_recommendation",
      ),
    ) || [];

const guidedInputSignals = (guidedInputState: GuidedInputState | null | undefined) =>
  guidedInputState?.selections
    .filter((selection) => selection.value)
    .slice(0, 3)
    .map((selection) =>
      createSignal(
        `guided:${selection.inputId}`,
        selection.inputId.replace(/-/g, " "),
        selection.label || selection.value || "Selected guided input",
        "guided_input",
      ),
    ) || [];

const futureEnginesFor = (
  preferred: FutureDialectRecommendationId[],
  workflowRecommendationReport: WorkflowRecommendationReport | null | undefined,
) => {
  const workflowEngines =
    workflowRecommendationReport?.recommendations
      .flatMap((recommendation) => recommendation.recommendedFutureEnginePath)
      .slice(0, 3) || [];

  return Array.from(new Set([...preferred, ...workflowEngines])).slice(0, 4);
};

const createDraft = (draft: KpiOpportunityDraft): KpiOpportunityDraft => ({
  ...draft,
  supportingSignals: uniqueSignals(draft.supportingSignals).slice(0, 8),
  recommendedWorkflowPaths: Array.from(new Set(draft.recommendedWorkflowPaths)).slice(0, 5),
  recommendedFutureEngines: Array.from(new Set(draft.recommendedFutureEngines)).slice(0, 5),
});

const buildDrafts = ({
  dataProfile,
  businessSemanticReport,
  workflowRecommendationReport,
  executionPreview,
  guidedInputState,
  planningReadiness,
}: {
  dataProfile: DataProfileReport;
  businessSemanticReport: BusinessSemanticReport;
  workflowRecommendationReport?: WorkflowRecommendationReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  guidedInputState?: GuidedInputState | null;
  planningReadiness?: PlanningReadinessReport | null;
}): KpiOpportunityDraft[] => {
  const hasRevenue = hasSemanticEntity(businessSemanticReport, "revenue");
  const hasSales = hasSemanticEntity(businessSemanticReport, "sales");
  const hasCustomer = hasSemanticEntity(businessSemanticReport, "customer");
  const hasProduct = hasSemanticEntity(businessSemanticReport, "product");
  const hasRegion = hasSemanticEntity(businessSemanticReport, "region");
  const hasEmployee = hasSemanticEntity(businessSemanticReport, "employee");
  const hasInventory = hasSemanticEntity(businessSemanticReport, "inventory");
  const hasOperational = hasSemanticEntity(businessSemanticReport, "operational_event");
  const hasTransaction = hasSemanticEntity(businessSemanticReport, "transaction");
  const hasExpense = hasSemanticEntity(businessSemanticReport, "expense");
  const hasMetric = hasSemanticEntity(businessSemanticReport, "metric_field");
  const hasDate = hasSemanticEntity(businessSemanticReport, "date_dimension");
  const hasRelationships = dataProfile.workbookRelationshipContext.hasWorkbookContext;
  const hasForecastingPreview = executionPreview?.expectedFutureResultShape === "forecast_output";
  const hasStatisticalPreview = executionPreview?.expectedFutureResultShape === "statistical_output";
  const readyPlanning = planningReadiness?.status === "ready_for_future_execution";
  const commonSignals = [
    createSignal("profile:metrics", "Metric fields", `${dataProfile.possibleMetrics.length} possible metric fields.`, "data_profile"),
    createSignal("profile:dimensions", "Dimension fields", `${dataProfile.possibleDimensions.length} possible dimension fields.`, "data_profile"),
    ...(planningReadiness
      ? [
          createSignal(
            "planning:readiness",
            "Planning readiness",
            planningReadiness.status.replace(/_/g, " "),
            "planning_readiness",
          ),
        ]
      : []),
  ];

  return [
    createDraft({
      category: "revenue_tracking",
      label: "Revenue tracking",
      score: (hasRevenue ? 4 : 0) + (hasSales ? 2 : 0) + (hasMetric ? 1 : 0),
      humanSummary: "This dataset may support revenue monitoring.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["revenue", "sales", "metric_field"]),
        ...workflowSignals(workflowRecommendationReport, ["dashboard_reporting", "executive_summary"]),
        ...commonSignals,
      ],
      missingMetadataBlockers: hasRevenue || hasSales ? [] : ["Revenue or sales semantic metadata was not detected."],
      possibleKpiFormulas: ["sum(revenue metric)", "sum(sales amount)", "revenue by period"],
      possibleChartTypes: ["kpi_card", "line_chart", "trend_chart", "bar_chart"],
      possibleDashboardWidgets: ["Revenue KPI card", "Revenue trend widget", "Revenue by dimension table"],
      likelyBusinessQuestions: ["Are sales increasing over time?", "Which products generate the most revenue?"],
      recommendedWorkflowPaths: ["dashboard_reporting", "executive_summary", "trend_analysis"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql"], workflowRecommendationReport),
    }),
    createDraft({
      category: "growth_monitoring",
      label: "Growth monitoring",
      score: (hasDate ? 3 : 0) + (hasMetric ? 2 : 0) + (dataProfile.timeSeriesReadiness.ready ? 2 : 0),
      humanSummary: "This dataset may support growth monitoring.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["date_dimension", "metric_field"]),
        createSignal("profile:time-series", "Time-series readiness", dataProfile.timeSeriesReadiness.summary, "data_profile"),
      ],
      missingMetadataBlockers: hasDate ? [] : ["Growth monitoring needs date or period metadata."],
      possibleKpiFormulas: ["current period metric - prior period metric", "period over period growth rate"],
      possibleChartTypes: ["line_chart", "trend_chart", "kpi_card"],
      possibleDashboardWidgets: ["Growth KPI card", "Period comparison widget"],
      likelyBusinessQuestions: ["Are sales increasing over time?", "Which periods are growing fastest?"],
      recommendedWorkflowPaths: ["trend_analysis", "executive_summary"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql", "python_analysis"], workflowRecommendationReport),
    }),
    createDraft({
      category: "customer_behavior",
      label: "Customer behavior",
      score: (hasCustomer ? 4 : 0) + (hasMetric ? 2 : 0) + (hasTransaction ? 1 : 0),
      humanSummary: "This dataset may support customer behavior analysis.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["customer", "transaction", "metric_field"]),
        ...workflowSignals(workflowRecommendationReport, ["customer_segmentation", "recommendation_analysis"]),
      ],
      missingMetadataBlockers: hasCustomer ? [] : ["Customer semantic metadata was not detected."],
      possibleKpiFormulas: ["count(transactions) by customer", "sum(value) by customer", "average customer value"],
      possibleChartTypes: ["bar_chart", "grouped_comparison", "heatmap"],
      possibleDashboardWidgets: ["Top customers list", "Customer segment comparison"],
      likelyBusinessQuestions: ["Which customers contribute the most value?", "Which customer groups behave differently?"],
      recommendedWorkflowPaths: ["customer_segmentation", "recommendation_analysis"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql", "python_analysis"], workflowRecommendationReport),
    }),
    createDraft({
      category: "operational_efficiency",
      label: "Operational efficiency",
      score: (hasOperational ? 4 : 0) + (hasDate ? 1 : 0) + (hasMetric ? 1 : 0),
      humanSummary: "Operational efficiency monitoring may be possible.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["operational_event", "date_dimension", "metric_field"]),
        ...workflowSignals(workflowRecommendationReport, ["operational_monitoring"]),
      ],
      missingMetadataBlockers: hasOperational ? [] : ["Operational event or status metadata was not detected."],
      possibleKpiFormulas: ["count(events) by period", "average cycle time", "open events by status"],
      possibleChartTypes: ["kpi_card", "bar_chart", "trend_chart"],
      possibleDashboardWidgets: ["Operational throughput card", "Status breakdown widget"],
      likelyBusinessQuestions: ["Are operational delays increasing?", "Where is throughput changing?"],
      recommendedWorkflowPaths: ["operational_monitoring", "trend_analysis"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql", "python_analysis"], workflowRecommendationReport),
    }),
    createDraft({
      category: "inventory_monitoring",
      label: "Inventory monitoring",
      score: (hasInventory ? 5 : 0) + (hasProduct ? 1 : 0) + (hasDate ? 1 : 0),
      humanSummary: "Inventory movement monitoring may be possible.",
      supportingSignals: semanticSignals(businessSemanticReport, ["inventory", "product", "date_dimension"]),
      missingMetadataBlockers: hasInventory ? [] : ["Inventory semantic metadata was not detected."],
      possibleKpiFormulas: ["sum(stock quantity)", "inventory movement by period", "stock by product"],
      possibleChartTypes: ["kpi_card", "bar_chart", "trend_chart"],
      possibleDashboardWidgets: ["Inventory level card", "Inventory movement chart"],
      likelyBusinessQuestions: ["Which products have changing inventory?", "Where is stock concentrated?"],
      recommendedWorkflowPaths: ["operational_monitoring", "product_analysis"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql"], workflowRecommendationReport),
    }),
    createDraft({
      category: "sales_performance",
      label: "Sales performance",
      score: (hasSales ? 4 : 0) + (hasRevenue ? 1 : 0) + (hasProduct ? 1 : 0) + (hasMetric ? 1 : 0),
      humanSummary: "Sales performance tracking may be possible.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["sales", "revenue", "product", "metric_field"]),
        ...guidedInputSignals(guidedInputState),
      ],
      missingMetadataBlockers: hasSales ? [] : ["Sales semantic metadata was not detected."],
      possibleKpiFormulas: ["sum(sales metric)", "sales by product", "sales by period"],
      possibleChartTypes: ["kpi_card", "bar_chart", "line_chart", "grouped_comparison"],
      possibleDashboardWidgets: ["Sales KPI card", "Sales leaderboard", "Sales trend widget"],
      likelyBusinessQuestions: ["Which products generate the most revenue?", "Are sales increasing over time?"],
      recommendedWorkflowPaths: ["product_analysis", "dashboard_reporting", "trend_analysis"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql"], workflowRecommendationReport),
    }),
    createDraft({
      category: "regional_performance",
      label: "Regional performance",
      score: (hasRegion ? 4 : 0) + (hasMetric ? 2 : 0),
      humanSummary: "Regional performance tracking may be possible.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["region", "metric_field"]),
        ...workflowSignals(workflowRecommendationReport, ["location_analysis"]),
      ],
      missingMetadataBlockers: hasRegion ? [] : ["Region or location semantic metadata was not detected."],
      possibleKpiFormulas: ["metric by region", "regional share of total", "regional period comparison"],
      possibleChartTypes: ["bar_chart", "heatmap", "grouped_comparison"],
      possibleDashboardWidgets: ["Regional ranking", "Region heatmap", "Regional comparison table"],
      likelyBusinessQuestions: ["Which regions are underperforming?", "Where is performance strongest?"],
      recommendedWorkflowPaths: ["location_analysis", "executive_summary"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql", "future_postgresql_general_sql"], workflowRecommendationReport),
    }),
    createDraft({
      category: "workforce_monitoring",
      label: "Workforce monitoring",
      score: (hasEmployee ? 4 : 0) + (hasMetric ? 1 : 0),
      humanSummary: "Workforce monitoring may be possible.",
      supportingSignals: semanticSignals(businessSemanticReport, ["employee", "department", "metric_field"]),
      missingMetadataBlockers: hasEmployee ? [] : ["Employee or workforce semantic metadata was not detected."],
      possibleKpiFormulas: ["metric by employee", "metric by department", "employee count by group"],
      possibleChartTypes: ["bar_chart", "grouped_comparison", "kpi_card"],
      possibleDashboardWidgets: ["Department comparison", "Workforce KPI card"],
      likelyBusinessQuestions: ["Which departments are performing differently?", "Where are workforce metrics concentrated?"],
      recommendedWorkflowPaths: ["dashboard_reporting", "executive_summary"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql"], workflowRecommendationReport),
    }),
    createDraft({
      category: "forecasting_opportunity",
      label: "Forecasting opportunity",
      score: (dataProfile.timeSeriesReadiness.ready ? 5 : 0) + (hasForecastingPreview ? 2 : 0),
      humanSummary: "Forecasting opportunities are available.",
      supportingSignals: [
        createSignal("profile:forecasting", "Forecast readiness", dataProfile.timeSeriesReadiness.summary, "data_profile"),
        ...(executionPreview
          ? [
              createSignal(
                "execution:shape",
                "Execution preview shape",
                executionPreview.expectedFutureResultShape.replace(/_/g, " "),
                "execution_preview",
              ),
            ]
          : []),
      ],
      missingMetadataBlockers: dataProfile.timeSeriesReadiness.ready ? [] : ["Forecasting needs date/time and metric metadata."],
      possibleKpiFormulas: ["forecast(metric by period)", "forecast variance against historical trend"],
      possibleChartTypes: ["forecasting_chart", "line_chart", "trend_chart"],
      possibleDashboardWidgets: ["Forecast chart", "Forecast confidence widget"],
      likelyBusinessQuestions: ["Are sales expected to increase?", "What future periods may need attention?"],
      recommendedWorkflowPaths: ["time_series_forecasting", "trend_analysis"],
      recommendedFutureEngines: futureEnginesFor(["python_analysis", "r_statistical_analysis"], workflowRecommendationReport),
    }),
    createDraft({
      category: "anomaly_detection",
      label: "Anomaly detection",
      score: (hasMetric ? 3 : 0) + (hasDate ? 2 : 0) + (hasStatisticalPreview ? 1 : 0),
      humanSummary: "This dataset may support anomaly detection.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["metric_field", "date_dimension", "operational_event"]),
        createSignal("profile:statistics", "Statistical readiness", dataProfile.statisticalReadiness.summary, "data_profile"),
      ],
      missingMetadataBlockers: hasMetric ? [] : ["Anomaly detection needs metric metadata."],
      possibleKpiFormulas: ["metric deviation from baseline", "outlier count by period", "unexpected change score"],
      possibleChartTypes: ["line_chart", "scatter_plot", "heatmap"],
      possibleDashboardWidgets: ["Anomaly watchlist", "Outlier trend chart"],
      likelyBusinessQuestions: ["Which values look unusual?", "Are operational delays increasing?"],
      recommendedWorkflowPaths: ["operational_monitoring", "statistical_testing"],
      recommendedFutureEngines: futureEnginesFor(["python_analysis", "r_statistical_analysis"], workflowRecommendationReport),
    }),
    createDraft({
      category: "profitability_analysis",
      label: "Profitability analysis",
      score: (hasRevenue ? 3 : 0) + (hasExpense ? 3 : 0) + (hasMetric ? 1 : 0),
      humanSummary: "Profitability analysis may be possible.",
      supportingSignals: semanticSignals(businessSemanticReport, ["revenue", "expense", "metric_field"]),
      missingMetadataBlockers: hasRevenue && hasExpense ? [] : ["Profitability analysis benefits from revenue and expense metadata."],
      possibleKpiFormulas: ["revenue - expense", "profit margin", "profit by product or region"],
      possibleChartTypes: ["kpi_card", "bar_chart", "grouped_comparison"],
      possibleDashboardWidgets: ["Profit KPI card", "Profitability comparison"],
      likelyBusinessQuestions: ["Which products are most profitable?", "Where are costs reducing margin?"],
      recommendedWorkflowPaths: ["executive_summary", "dashboard_reporting"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql"], workflowRecommendationReport),
    }),
    createDraft({
      category: "churn_risk",
      label: "Churn risk",
      score: (hasCustomer ? 3 : 0) + (hasDate ? 2 : 0) + (hasWorkflow(workflowRecommendationReport, "churn_analysis") ? 2 : 0),
      humanSummary: "Churn risk monitoring may be possible.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["customer", "date_dimension", "metric_field"]),
        ...workflowSignals(workflowRecommendationReport, ["churn_analysis", "customer_segmentation"]),
      ],
      missingMetadataBlockers: hasCustomer && hasDate ? [] : ["Churn monitoring needs customer and date/activity metadata."],
      possibleKpiFormulas: ["inactive customers by period", "customer activity recency", "churn risk count"],
      possibleChartTypes: ["kpi_card", "bar_chart", "trend_chart"],
      possibleDashboardWidgets: ["Churn risk card", "Inactive customer list"],
      likelyBusinessQuestions: ["Which customers may be at risk?", "Is inactivity increasing?"],
      recommendedWorkflowPaths: ["churn_analysis", "customer_segmentation"],
      recommendedFutureEngines: futureEnginesFor(["python_analysis", "duckdb_sql"], workflowRecommendationReport),
    }),
    createDraft({
      category: "product_performance",
      label: "Product performance",
      score: (hasProduct ? 4 : 0) + (hasSales || hasRevenue ? 2 : 0) + (hasRelationships ? 1 : 0),
      humanSummary: "Product performance tracking may be possible.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["product", "sales", "revenue", "metric_field"]),
        ...(hasRelationships
          ? [
              createSignal(
                "profile:relationships",
                "Workbook relationships",
                dataProfile.workbookRelationshipContext.summary,
                "data_profile",
              ),
            ]
          : []),
      ],
      missingMetadataBlockers: hasProduct ? [] : ["Product semantic metadata was not detected."],
      possibleKpiFormulas: ["sum(metric) by product", "product rank by revenue", "product contribution share"],
      possibleChartTypes: ["bar_chart", "grouped_comparison", "kpi_card"],
      possibleDashboardWidgets: ["Top products", "Product ranking", "Product contribution card"],
      likelyBusinessQuestions: ["Which products generate the most revenue?", "Which products are underperforming?"],
      recommendedWorkflowPaths: ["product_analysis", "dashboard_reporting"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql", "excel_workbook"], workflowRecommendationReport),
    }),
    createDraft({
      category: "transaction_monitoring",
      label: "Transaction monitoring",
      score: (hasTransaction ? 4 : 0) + (hasDate ? 1 : 0) + (hasMetric ? 1 : 0),
      humanSummary: "Transaction monitoring may be possible.",
      supportingSignals: semanticSignals(businessSemanticReport, ["transaction", "payment", "invoice", "date_dimension", "metric_field"]),
      missingMetadataBlockers: hasTransaction ? [] : ["Transaction semantic metadata was not detected."],
      possibleKpiFormulas: ["count(transactions)", "average transaction value", "transaction volume by period"],
      possibleChartTypes: ["kpi_card", "line_chart", "bar_chart"],
      possibleDashboardWidgets: ["Transaction volume card", "Average transaction value card"],
      likelyBusinessQuestions: ["Is transaction volume changing?", "Which transactions create the most value?"],
      recommendedWorkflowPaths: ["dashboard_reporting", "trend_analysis"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql"], workflowRecommendationReport),
    }),
    createDraft({
      category: "executive_reporting",
      label: "Executive reporting",
      score: (hasMetric ? 3 : 0) + (businessSemanticReport.possibleBusinessKpis.length > 0 ? 2 : 0) + (readyPlanning ? 1 : 0),
      humanSummary: "This dataset may support executive reporting.",
      supportingSignals: [
        ...semanticSignals(businessSemanticReport, ["metric_field", "dimension_field"]),
        ...workflowSignals(workflowRecommendationReport, ["executive_summary", "dashboard_reporting"]),
      ],
      missingMetadataBlockers: hasMetric ? [] : ["Executive reporting needs metric metadata."],
      possibleKpiFormulas: businessSemanticReport.possibleBusinessKpis.map((kpi) => kpi.label),
      possibleChartTypes: ["kpi_card", "bar_chart", "trend_chart", "grouped_comparison"],
      possibleDashboardWidgets: ["Executive KPI strip", "Top drivers panel", "Trend summary"],
      likelyBusinessQuestions: ["What changed most recently?", "Which areas need executive attention?"],
      recommendedWorkflowPaths: ["executive_summary", "dashboard_reporting"],
      recommendedFutureEngines: futureEnginesFor(["duckdb_sql"], workflowRecommendationReport),
    }),
  ].map((draft) => ({
    ...draft,
    supportingSignals: uniqueSignals([
      ...draft.supportingSignals,
      ...guidedInputSignals(guidedInputState),
    ]),
  }));
};

const buildHumanSummary = (opportunities: KpiOpportunity[]) => {
  const top = opportunities[0];
  if (!top) return "More metadata is needed before suggesting KPI opportunities.";
  return top.humanSummary;
};

const buildAnalystSummary = (opportunities: KpiOpportunity[]) => {
  const top = opportunities[0];
  if (!top) return "No KPI opportunity metadata is available.";
  return `${top.label} is ranked first with ${top.confidence} confidence. ${opportunities.length} KPI opportunit${opportunities.length === 1 ? "y" : "ies"} available.`;
};

export const buildKpiIntelligenceReport = ({
  dataProfile,
  businessSemanticReport,
  workflowRecommendationReport = null,
  executionPreview = null,
  guidedInputState = null,
  planningReadiness = null,
}: KpiIntelligenceBuilderInput): KpiIntelligenceReport | null => {
  if (!dataProfile || !businessSemanticReport) return null;

  const drafts = buildDrafts({
    dataProfile,
    businessSemanticReport,
    workflowRecommendationReport,
    executionPreview,
    guidedInputState,
    planningReadiness,
  })
    .filter((draft) => draft.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.label.localeCompare(right.label);
    });
  const opportunities = drafts.map<KpiOpportunity>((draft, index) => ({
    id: `${dataProfile.datasetId}:kpi-opportunity:${draft.category}`,
    category: draft.category,
    label: draft.label,
    rank: index + 1,
    confidence: confidenceFromScore(draft.score),
    humanSummary: draft.humanSummary,
    supportingSignals: draft.supportingSignals,
    missingMetadataBlockers: draft.missingMetadataBlockers,
    possibleKpiFormulas: draft.possibleKpiFormulas,
    possibleChartTypes: draft.possibleChartTypes,
    possibleDashboardWidgets: draft.possibleDashboardWidgets,
    likelyBusinessQuestions: draft.likelyBusinessQuestions,
    recommendedWorkflowPaths: draft.recommendedWorkflowPaths,
    recommendedFutureEngines: draft.recommendedFutureEngines,
  }));
  const initialReport: KpiIntelligenceReport = {
    datasetId: dataProfile.datasetId,
    opportunities,
    topOpportunity: opportunities[0] || null,
    humanSummary: buildHumanSummary(opportunities),
    analystSummary: buildAnalystSummary(opportunities),
    safetyNotes: ["KPI intelligence is inferred from metadata only; no KPI values are calculated."],
  };
  const validation = validateKpiIntelligenceReport(initialReport);

  if (validation.messages.length === 0) return initialReport;

  return {
    ...initialReport,
    safetyNotes: Array.from(
      new Set([
        ...initialReport.safetyNotes,
        ...validation.messages.map((message) => message.message),
      ]),
    ),
  };
};
