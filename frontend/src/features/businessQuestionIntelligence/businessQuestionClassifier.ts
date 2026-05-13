import type {
  BusinessSemanticEntityCategory,
  BusinessSemanticReport,
} from "../businessSemantics";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { GuidedInputState } from "../guidedInputs";
import type {
  KpiChartRecommendationType,
  KpiIntelligenceReport,
  KpiOpportunityCategory,
} from "../kpiIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";
import type {
  WorkflowRecommendationCategory,
  WorkflowRecommendationReport,
} from "../workflowRecommendations";
import type {
  BusinessQuestionConfidence,
  BusinessQuestionIntelligenceReport,
  BusinessQuestionIntentCategory,
  BusinessQuestionInterpretation,
  BusinessQuestionSignal,
} from "./businessQuestionTypes";
import { validateBusinessQuestionReport } from "./businessQuestionValidation";

type BusinessQuestionClassifierInput = {
  datasetId: string | null;
  questions?: string[];
  businessSemanticReport: BusinessSemanticReport | null;
  kpiIntelligenceReport: KpiIntelligenceReport | null;
  workflowRecommendationReport?: WorkflowRecommendationReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  guidedInputState?: GuidedInputState | null;
  planningReadiness?: PlanningReadinessReport | null;
};

type QuestionRule = {
  category: BusinessQuestionIntentCategory;
  label: string;
  keywords: string[];
  semanticEntities: BusinessSemanticEntityCategory[];
  workflowPaths: WorkflowRecommendationCategory[];
  kpiConnections: KpiOpportunityCategory[];
  chartTypes: KpiChartRecommendationType[];
  followUps: string[];
};

const questionRules: QuestionRule[] = [
  {
    category: "revenue_question",
    label: "Revenue question",
    keywords: ["revenue", "sales", "sell", "sold", "income"],
    semanticEntities: ["revenue", "sales", "metric_field"],
    workflowPaths: ["dashboard_reporting", "executive_summary"],
    kpiConnections: ["revenue_tracking", "sales_performance"],
    chartTypes: ["kpi_card", "bar_chart", "trend_chart"],
    followUps: ["Select a revenue metric.", "Choose a grouping dimension."],
  },
  {
    category: "growth_question",
    label: "Growth question",
    keywords: ["growth", "growing", "increase", "decrease", "change"],
    semanticEntities: ["date_dimension", "metric_field"],
    workflowPaths: ["trend_analysis", "executive_summary"],
    kpiConnections: ["growth_monitoring"],
    chartTypes: ["line_chart", "trend_chart"],
    followUps: ["Choose a date field.", "Select a metric to compare over time."],
  },
  {
    category: "forecasting_question",
    label: "Forecasting question",
    keywords: ["forecast", "predict", "future", "next", "projection"],
    semanticEntities: ["date_dimension", "metric_field"],
    workflowPaths: ["time_series_forecasting", "trend_analysis"],
    kpiConnections: ["forecasting_opportunity"],
    chartTypes: ["forecasting_chart", "line_chart"],
    followUps: ["Choose a date field for forecasting.", "Select a revenue metric."],
  },
  {
    category: "customer_question",
    label: "Customer question",
    keywords: ["customer", "client", "account", "buyer"],
    semanticEntities: ["customer", "metric_field"],
    workflowPaths: ["customer_segmentation"],
    kpiConnections: ["customer_behavior", "churn_risk"],
    chartTypes: ["bar_chart", "grouped_comparison"],
    followUps: ["Choose a customer identifier.", "Select a customer value metric."],
  },
  {
    category: "product_question",
    label: "Product question",
    keywords: ["product", "sku", "item", "top products"],
    semanticEntities: ["product", "sales", "revenue"],
    workflowPaths: ["product_analysis"],
    kpiConnections: ["product_performance", "sales_performance"],
    chartTypes: ["bar_chart", "grouped_comparison"],
    followUps: ["Choose a product field.", "Select a product performance metric."],
  },
  {
    category: "operational_question",
    label: "Operational question",
    keywords: ["operation", "delay", "status", "throughput", "ticket", "incident"],
    semanticEntities: ["operational_event", "date_dimension"],
    workflowPaths: ["operational_monitoring"],
    kpiConnections: ["operational_efficiency"],
    chartTypes: ["kpi_card", "trend_chart", "bar_chart"],
    followUps: ["Choose an operational status field.", "Choose a date field."],
  },
  {
    category: "comparison_question",
    label: "Comparison question",
    keywords: ["compare", "best", "worst", "most", "least", "underperforming", "perform best"],
    semanticEntities: ["dimension_field", "metric_field"],
    workflowPaths: ["dashboard_reporting"],
    kpiConnections: ["regional_performance", "product_performance"],
    chartTypes: ["bar_chart", "grouped_comparison"],
    followUps: ["Choose a grouping dimension.", "Select a comparison metric."],
  },
  {
    category: "trend_question",
    label: "Trend question",
    keywords: ["trend", "over time", "increasing", "decreasing"],
    semanticEntities: ["date_dimension", "metric_field"],
    workflowPaths: ["trend_analysis"],
    kpiConnections: ["growth_monitoring"],
    chartTypes: ["line_chart", "trend_chart"],
    followUps: ["Choose a date field.", "Select a metric for trend analysis."],
  },
  {
    category: "anomaly_question",
    label: "Anomaly question",
    keywords: ["unusual", "anomaly", "outlier", "unexpected", "spike", "drop"],
    semanticEntities: ["metric_field", "date_dimension"],
    workflowPaths: ["statistical_testing", "operational_monitoring"],
    kpiConnections: ["anomaly_detection"],
    chartTypes: ["scatter_plot", "line_chart", "heatmap"],
    followUps: ["Select a metric to monitor.", "Choose a date or grouping field."],
  },
  {
    category: "segmentation_question",
    label: "Segmentation question",
    keywords: ["segment", "group", "cohort", "category"],
    semanticEntities: ["dimension_field", "customer"],
    workflowPaths: ["customer_segmentation"],
    kpiConnections: ["customer_behavior"],
    chartTypes: ["grouped_comparison", "bar_chart"],
    followUps: ["Choose a grouping dimension.", "Select a segment metric."],
  },
  {
    category: "profitability_question",
    label: "Profitability question",
    keywords: ["profit", "margin", "cost", "expense"],
    semanticEntities: ["revenue", "expense", "metric_field"],
    workflowPaths: ["executive_summary", "dashboard_reporting"],
    kpiConnections: ["profitability_analysis"],
    chartTypes: ["kpi_card", "bar_chart"],
    followUps: ["Select revenue and expense metrics.", "Choose a grouping dimension."],
  },
  {
    category: "inventory_question",
    label: "Inventory question",
    keywords: ["inventory", "stock", "warehouse", "on hand"],
    semanticEntities: ["inventory", "product"],
    workflowPaths: ["operational_monitoring", "product_analysis"],
    kpiConnections: ["inventory_monitoring"],
    chartTypes: ["kpi_card", "bar_chart", "trend_chart"],
    followUps: ["Choose an inventory field.", "Choose a product or warehouse dimension."],
  },
  {
    category: "regional_question",
    label: "Regional question",
    keywords: ["region", "city", "state", "country", "location"],
    semanticEntities: ["region", "metric_field"],
    workflowPaths: ["location_analysis"],
    kpiConnections: ["regional_performance"],
    chartTypes: ["bar_chart", "heatmap", "grouped_comparison"],
    followUps: ["Choose a region or location field.", "Select a regional performance metric."],
  },
  {
    category: "workforce_question",
    label: "Workforce question",
    keywords: ["employee", "staff", "department", "team", "workforce"],
    semanticEntities: ["employee", "department", "metric_field"],
    workflowPaths: ["dashboard_reporting"],
    kpiConnections: ["workforce_monitoring"],
    chartTypes: ["bar_chart", "grouped_comparison"],
    followUps: ["Choose an employee or department field.", "Select a workforce metric."],
  },
  {
    category: "executive_summary_question",
    label: "Executive summary question",
    keywords: ["summary", "overview", "executive", "high level", "key metrics"],
    semanticEntities: ["metric_field", "dimension_field"],
    workflowPaths: ["executive_summary", "dashboard_reporting"],
    kpiConnections: ["executive_reporting"],
    chartTypes: ["kpi_card", "bar_chart", "trend_chart"],
    followUps: ["Select the KPIs to summarize.", "Choose key dimensions for the overview."],
  },
];

const normalizeQuestion = (question: string) => question.toLowerCase().replace(/[^a-z0-9]+/g, " ");

const confidenceFromScore = (score: number): BusinessQuestionConfidence => {
  if (score >= 6) return "high";
  if (score >= 3) return "moderate";
  return "low";
};

const createSignal = (
  id: string,
  label: string,
  description: string,
  source: BusinessQuestionSignal["source"],
): BusinessQuestionSignal => ({ id, label, description, source });

const hasSemanticEntity = (
  businessSemanticReport: BusinessSemanticReport | null,
  category: BusinessSemanticEntityCategory,
) => businessSemanticReport?.detectedSemanticEntities.some((entity) => entity.category === category) || false;

const findKpiOpportunity = (
  kpiIntelligenceReport: KpiIntelligenceReport | null,
  category: KpiOpportunityCategory,
) => kpiIntelligenceReport?.opportunities.find((opportunity) => opportunity.category === category) || null;

const findWorkflow = (
  workflowRecommendationReport: WorkflowRecommendationReport | null | undefined,
  category: WorkflowRecommendationCategory,
) => workflowRecommendationReport?.recommendations.find((recommendation) => recommendation.category === category) || null;

const defaultQuestionsFromKpis = (kpiIntelligenceReport: KpiIntelligenceReport | null) => {
  const questions =
    kpiIntelligenceReport?.opportunities.flatMap((opportunity) => opportunity.likelyBusinessQuestions) || [];
  return Array.from(new Set(questions)).slice(0, 8);
};

const classifyQuestion = ({
  question,
  datasetId,
  businessSemanticReport,
  kpiIntelligenceReport,
  workflowRecommendationReport,
  executionPreview,
  guidedInputState,
  planningReadiness,
}: {
  question: string;
  datasetId: string;
  businessSemanticReport: BusinessSemanticReport | null;
  kpiIntelligenceReport: KpiIntelligenceReport | null;
  workflowRecommendationReport?: WorkflowRecommendationReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  guidedInputState?: GuidedInputState | null;
  planningReadiness?: PlanningReadinessReport | null;
}): BusinessQuestionInterpretation => {
  const normalized = normalizeQuestion(question);
  const scoredRules = questionRules.map((rule) => {
    const keywordHits = rule.keywords.filter((keyword) => normalized.includes(keyword)).length;
    const semanticHits = rule.semanticEntities.filter((category) =>
      hasSemanticEntity(businessSemanticReport, category),
    ).length;
    const kpiHits = rule.kpiConnections.filter((category) =>
      Boolean(findKpiOpportunity(kpiIntelligenceReport, category)),
    ).length;
    const workflowHits = rule.workflowPaths.filter((category) =>
      Boolean(findWorkflow(workflowRecommendationReport, category)),
    ).length;
    const score = keywordHits * 3 + semanticHits + kpiHits + workflowHits;

    return { rule, score, keywordHits, semanticHits, kpiHits, workflowHits };
  });
  const best = scoredRules.sort((left, right) => right.score - left.score)[0] || {
    rule: questionRules[0],
    score: 0,
    keywordHits: 0,
    semanticHits: 0,
    kpiHits: 0,
    workflowHits: 0,
  };
  const semanticEntities = best.rule.semanticEntities.filter((category) =>
    hasSemanticEntity(businessSemanticReport, category),
  );
  const kpiConnections = best.rule.kpiConnections.filter((category) =>
    Boolean(findKpiOpportunity(kpiIntelligenceReport, category)),
  );
  const workflows = best.rule.workflowPaths.filter((category) =>
    Boolean(findWorkflow(workflowRecommendationReport, category)),
  );
  const kpiCharts = kpiConnections
    .flatMap((category) => findKpiOpportunity(kpiIntelligenceReport, category)?.possibleChartTypes || []);
  const kpiEngines = kpiConnections
    .flatMap((category) => findKpiOpportunity(kpiIntelligenceReport, category)?.recommendedFutureEngines || []);
  const supportingSignals = [
    ...best.rule.keywords
      .filter((keyword) => normalized.includes(keyword))
      .map((keyword) =>
        createSignal(`keyword:${keyword}`, keyword, `Question matched keyword "${keyword}".`, "keyword_rule"),
      ),
    ...semanticEntities.map((category) =>
      createSignal(
        `semantic:${category}`,
        category.replace(/_/g, " "),
        `${category.replace(/_/g, " ")} metadata supports this interpretation.`,
        "business_semantics",
      ),
    ),
    ...kpiConnections.map((category) =>
      createSignal(
        `kpi:${category}`,
        category.replace(/_/g, " "),
        `${category.replace(/_/g, " ")} KPI opportunity supports this question.`,
        "kpi_intelligence",
      ),
    ),
    ...workflows.map((category) =>
      createSignal(
        `workflow:${category}`,
        category.replace(/_/g, " "),
        `${category.replace(/_/g, " ")} workflow metadata supports this question.`,
        "workflow_recommendation",
      ),
    ),
    ...(executionPreview
      ? [
          createSignal(
            "execution-preview:shape",
            "Execution preview",
            executionPreview.expectedFutureResultShape.replace(/_/g, " "),
            "execution_preview",
          ),
        ]
      : []),
    ...(guidedInputState?.readyForPlanning
      ? [createSignal("guided-input:ready", "Guided inputs", "Guided inputs are ready for planning.", "guided_input")]
      : []),
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
  const requiredMissingMetadata = [
    ...(semanticEntities.length > 0 ? [] : ["Supporting semantic entities are incomplete."]),
    ...(kpiConnections.length > 0 ? [] : ["No matching KPI opportunity is currently available."]),
    ...(best.rule.category === "forecasting_question" && !semanticEntities.includes("date_dimension")
      ? ["Choose a date field for forecasting."]
      : []),
  ];

  return {
    id: `${datasetId}:business-question:${best.rule.category}:${normalizeQuestion(question).replace(/\s+/g, "-").slice(0, 42)}`,
    questionText: question,
    detectedIntentCategory: best.rule.category,
    confidence: confidenceFromScore(best.score),
    humanSummary: humanSummaryForIntent(best.rule.category),
    supportingSignals,
    supportingSemanticEntities: semanticEntities,
    likelyWorkflowPath: workflows.length > 0 ? workflows : best.rule.workflowPaths,
    likelyKpiConnections: kpiConnections.length > 0 ? kpiConnections : best.rule.kpiConnections,
    recommendedChartTypes: Array.from(new Set([...kpiCharts, ...best.rule.chartTypes])),
    recommendedFutureEngines: Array.from(new Set(kpiEngines.length > 0 ? kpiEngines : ["duckdb_sql"])),
    requiredMissingMetadata,
    followUpSuggestions: Array.from(
      new Set([
        ...best.rule.followUps,
        ...(businessSemanticReport?.relatedWorksheets.length ? ["Confirm workbook relationships."] : []),
      ]),
    ),
  };
};

const humanSummaryForIntent = (category: BusinessQuestionIntentCategory) => {
  if (category === "forecasting_question") return "FiltraQueri detected a forecasting-related business question.";
  if (category === "regional_question") return "This appears to be a regional performance question.";
  if (category === "revenue_question") return "This question may relate to revenue analysis.";
  if (category === "product_question") return "This question may relate to product performance.";
  if (category === "customer_question") return "This question may relate to customer analysis.";
  if (category === "operational_question") return "This question may relate to operational monitoring.";
  return `This question may relate to ${category.replace(/_/g, " ")}.`;
};

const buildHumanSummary = (interpretations: BusinessQuestionInterpretation[]) =>
  interpretations[0]?.humanSummary || "FiltraQueri needs more metadata before interpreting business questions.";

const buildAnalystSummary = (interpretations: BusinessQuestionInterpretation[]) => {
  const top = interpretations[0];
  if (!top) return "No business question interpretation metadata is available.";
  return `${top.detectedIntentCategory.replace(/_/g, " ")} is the leading question intent with ${top.confidence} confidence.`;
};

export const classifyBusinessQuestions = ({
  datasetId,
  questions,
  businessSemanticReport,
  kpiIntelligenceReport,
  workflowRecommendationReport = null,
  executionPreview = null,
  guidedInputState = null,
  planningReadiness = null,
}: BusinessQuestionClassifierInput): BusinessQuestionIntelligenceReport | null => {
  const resolvedDatasetId = datasetId || businessSemanticReport?.datasetId || kpiIntelligenceReport?.datasetId || null;
  if (!resolvedDatasetId) return null;

  const resolvedQuestions = Array.from(
    new Set([...(questions || []), ...defaultQuestionsFromKpis(kpiIntelligenceReport)]),
  )
    .map((question) => question.trim())
    .filter(Boolean)
    .slice(0, 10);
  const interpretedQuestions = resolvedQuestions
    .map((question) =>
      classifyQuestion({
        question,
        datasetId: resolvedDatasetId,
        businessSemanticReport,
        kpiIntelligenceReport,
        workflowRecommendationReport,
        executionPreview,
        guidedInputState,
        planningReadiness,
      }),
    )
    .sort((left, right) => {
      const confidenceRank = { high: 0, moderate: 1, low: 2 };
      if (confidenceRank[left.confidence] !== confidenceRank[right.confidence]) {
        return confidenceRank[left.confidence] - confidenceRank[right.confidence];
      }
      return left.questionText.localeCompare(right.questionText);
    });
  const initialReport: BusinessQuestionIntelligenceReport = {
    datasetId: resolvedDatasetId,
    interpretedQuestions,
    topInterpretation: interpretedQuestions[0] || null,
    humanSummary: buildHumanSummary(interpretedQuestions),
    analystSummary: buildAnalystSummary(interpretedQuestions),
    safetyNotes: ["Business question intelligence is metadata only; it does not generate or execute queries."],
  };
  const validation = validateBusinessQuestionReport(initialReport);

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
