import type { AnalyticsIntentGraphReport } from "../analyticsIntentGraph";
import type { BusinessQuestionIntelligenceReport } from "../businessQuestionIntelligence";
import type { BusinessSemanticReport } from "../businessSemantics";
import type { DataProfileReport, FutureDialectRecommendationId } from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { KpiIntelligenceReport } from "../kpiIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkflowRecommendationReport } from "../workflowRecommendations";
import type {
  AnalyticsPlan,
  AnalyticsPlanComplexity,
  AnalyticsPlanDependency,
  AnalyticsPlanOutput,
  AnalyticsPlanOutputType,
  AnalyticsPlanRequirement,
  AnalyticsPlanStatus,
  AnalyticsPlanStep,
  AnalyticsPlanStepCategory,
  AnalyticsPlanWarning,
} from "./analyticsPlanningTypes";
import { validateAnalyticsPlan } from "./analyticsPlanningValidation";

type BuildArgs = {
  datasetId: string | null;
  dataProfile: DataProfileReport | null;
  workflowRecommendationReport: WorkflowRecommendationReport | null;
  kpiIntelligenceReport: KpiIntelligenceReport | null;
  businessSemanticReport: BusinessSemanticReport | null;
  businessQuestionReport: BusinessQuestionIntelligenceReport | null;
  analyticsIntentGraph: AnalyticsIntentGraphReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  planningReadiness?: PlanningReadinessReport | null;
};

const addStep = (steps: AnalyticsPlanStep[], step: AnalyticsPlanStep) => {
  if (!steps.some((existing) => existing.stepId === step.stepId)) steps.push(step);
};

const findStepId = (
  steps: AnalyticsPlanStep[],
  category: AnalyticsPlanStepCategory,
  fallbackStepId: string,
) => steps.find((step) => step.category === category)?.stepId || fallbackStepId;

const existingStepIds = (stepIds: Array<string | null | undefined>) =>
  stepIds.filter((stepId): stepId is string => Boolean(stepId));

const createStep = (
  datasetId: string,
  index: number,
  category: AnalyticsPlanStepCategory,
  label: string,
  description: string,
  status: AnalyticsPlanStatus,
  dependsOnStepIds: string[],
  futureEngines: FutureDialectRecommendationId[],
): AnalyticsPlanStep => ({
  stepId: `${datasetId}:analytics-plan:${category}:${index}`,
  category,
  label,
  description,
  status,
  dependsOnStepIds,
  futureEngines,
});

const statusFromRequirements = (
  requirements: AnalyticsPlanRequirement[],
  relationshipPending: boolean,
): AnalyticsPlanStatus => {
  if (requirements.some((requirement) => !requirement.satisfied && requirement.requirementId.includes("metric"))) {
    return "metadata_pending";
  }
  if (requirements.some((requirement) => !requirement.satisfied && requirement.requirementId.includes("date"))) {
    return "metadata_pending";
  }
  if (relationshipPending) return "relationship_pending";
  if (requirements.some((requirement) => !requirement.satisfied)) return "incomplete";
  return "ready";
};

const complexityFromSizing = (
  stepCount: number,
  relationshipComplexity: number,
  chartCount: number,
): AnalyticsPlanComplexity => {
  if (relationshipComplexity >= 3 || stepCount >= 12) return "enterprise";
  if (relationshipComplexity > 0 || stepCount >= 9 || chartCount >= 5) return "advanced";
  if (stepCount >= 6 || chartCount >= 3) return "moderate";
  return "simple";
};

const outputTypeFromGraph = (shape: string): AnalyticsPlanOutputType => {
  if (shape.includes("forecast")) return "forecasting_chart";
  if (shape.includes("trend")) return "trend_chart";
  if (shape.includes("statistical")) return "statistical_output";
  if (shape.includes("grouped") || shape.includes("ranked")) return "grouped_table";
  return "summary_table";
};

const buildHumanSummary = (
  status: AnalyticsPlanStatus,
  hasForecasting: boolean,
  relationshipPending: boolean,
) => {
  if (relationshipPending) return "Relationship confirmation is needed before connected workbook analysis.";
  if (hasForecasting && status !== "ready") return "Forecasting preparation is waiting for a valid date field.";
  if (status === "ready") return "A future revenue analysis workflow is prepared.";
  return "A metadata-only future analytics plan is prepared.";
};

export const buildAnalyticsPlan = ({
  datasetId,
  dataProfile,
  workflowRecommendationReport,
  kpiIntelligenceReport,
  businessSemanticReport,
  businessQuestionReport,
  analyticsIntentGraph,
  executionPreview = null,
  planningReadiness = null,
}: BuildArgs): AnalyticsPlan | null => {
  const resolvedDatasetId =
    datasetId ||
    dataProfile?.datasetId ||
    analyticsIntentGraph?.datasetId ||
    kpiIntelligenceReport?.datasetId ||
    null;
  if (!resolvedDatasetId) return null;

  const possibleMetrics = dataProfile?.possibleMetrics || [];
  const possibleDimensions = dataProfile?.possibleDimensions || [];
  const dateTimeFields = dataProfile?.dateTimeFields || [];
  const hasMetric = possibleMetrics.length > 0;
  const hasDimension = possibleDimensions.length > 0;
  const hasDate = dateTimeFields.length > 0;
  const relationshipPending = Boolean(
    dataProfile?.workbookRelationshipContext.hasWorkbookContext &&
      dataProfile.workbookRelationshipContext.acceptedRelationshipCount === 0,
  );
  const futureEngines = Array.from(
    new Set([
      ...(analyticsIntentGraph?.recommendedFutureEngines || []),
      ...(kpiIntelligenceReport?.opportunities.flatMap((item) => item.recommendedFutureEngines) || []),
      ...(executionPreview?.supportedFutureEngines || []),
    ]),
  ).slice(0, 5) as FutureDialectRecommendationId[];
  const requirements: AnalyticsPlanRequirement[] = [
    {
      requirementId: `${resolvedDatasetId}:requirement:metric`,
      label: "Metric field",
      satisfied: hasMetric,
      missingMetadata: hasMetric ? [] : ["Select or detect a metric field."],
    },
    {
      requirementId: `${resolvedDatasetId}:requirement:dimension`,
      label: "Dimension field",
      satisfied: hasDimension,
      missingMetadata: hasDimension ? [] : ["Choose a grouping dimension."],
    },
    {
      requirementId: `${resolvedDatasetId}:requirement:date`,
      label: "Date field",
      satisfied: hasDate,
      missingMetadata: hasDate ? [] : ["Choose a date field for forecasting or trend analysis."],
    },
    {
      requirementId: `${resolvedDatasetId}:requirement:relationship`,
      label: "Workbook relationship confirmation",
      satisfied: !relationshipPending,
      missingMetadata: relationshipPending ? ["Confirm workbook relationships."] : [],
    },
  ];
  const planStatus = statusFromRequirements(requirements, relationshipPending);
  const steps: AnalyticsPlanStep[] = [];

  addStep(steps, createStep(resolvedDatasetId, 1, "data_preparation", "Data preparation", "Inspect dataset metadata and available fields.", "ready", [], futureEngines));
  const dataPreparationStepId = findStepId(steps, "data_preparation", "");
  if (relationshipPending || dataProfile?.workbookRelationshipContext.hasWorkbookContext) {
    addStep(steps, createStep(resolvedDatasetId, 2, "relationship_validation", "Relationship validation", "Confirm workbook relationship metadata before connected analysis.", relationshipPending ? "relationship_pending" : "ready", existingStepIds([dataPreparationStepId]), futureEngines));
  }
  addStep(steps, createStep(resolvedDatasetId, 3, "metric_selection", "Metric selection", "Select the metric field used by future KPI and analysis steps.", hasMetric ? "ready" : "metadata_pending", existingStepIds([dataPreparationStepId]), futureEngines));
  addStep(steps, createStep(resolvedDatasetId, 4, "dimension_selection", "Dimension selection", "Select dimensions for grouping and comparisons.", hasDimension ? "ready" : "metadata_pending", existingStepIds([dataPreparationStepId]), futureEngines));
  const metricSelectionStepId = findStepId(steps, "metric_selection", dataPreparationStepId);
  const dimensionSelectionStepId = findStepId(steps, "dimension_selection", dataPreparationStepId);
  addStep(steps, createStep(resolvedDatasetId, 5, "grouping", "Grouping", "Prepare grouped analysis metadata.", hasDimension ? "ready" : "metadata_pending", existingStepIds([metricSelectionStepId, dimensionSelectionStepId]), futureEngines));
  addStep(steps, createStep(resolvedDatasetId, 6, "aggregation", "Aggregation", "Prepare metric aggregation intent.", hasMetric ? "ready" : "metadata_pending", existingStepIds([metricSelectionStepId]), futureEngines));
  const aggregationStepId = findStepId(steps, "aggregation", metricSelectionStepId);

  if (workflowRecommendationReport?.recommendations.some((item) => item.category === "trend_analysis")) {
    addStep(steps, createStep(resolvedDatasetId, 7, "trend_analysis", "Trend analysis", "Prepare date-aware trend workflow metadata.", hasDate ? "ready" : "metadata_pending", existingStepIds([metricSelectionStepId]), futureEngines));
  }
  if (
    workflowRecommendationReport?.recommendations.some((item) => item.category === "time_series_forecasting") ||
    executionPreview?.expectedFutureResultShape === "forecast_output"
  ) {
    addStep(steps, createStep(resolvedDatasetId, 8, "forecasting", "Forecasting", "Prepare future forecasting workflow metadata.", hasDate ? "ready" : "metadata_pending", existingStepIds([metricSelectionStepId]), futureEngines));
  }
  if (
    workflowRecommendationReport?.recommendations.some((item) => item.category === "statistical_testing") ||
    executionPreview?.expectedFutureResultShape === "statistical_output"
  ) {
    addStep(steps, createStep(resolvedDatasetId, 9, "statistical_analysis", "Statistical analysis", "Prepare future statistical analysis metadata.", hasMetric ? "ready" : "metadata_pending", existingStepIds([metricSelectionStepId]), futureEngines));
  }
  if (workflowRecommendationReport?.recommendations.some((item) => item.category === "customer_segmentation")) {
    addStep(steps, createStep(resolvedDatasetId, 10, "segmentation", "Segmentation", "Prepare segmentation metadata.", hasDimension ? "ready" : "metadata_pending", existingStepIds([dimensionSelectionStepId]), futureEngines));
  }
  addStep(steps, createStep(resolvedDatasetId, 11, "dashboard_projection", "Dashboard projection", "Project future KPI cards and chart widgets.", "ready", existingStepIds([aggregationStepId]), futureEngines));
  addStep(steps, createStep(resolvedDatasetId, 12, "explanation_generation", "Explanation generation", "Prepare future business explanation output.", "ready", existingStepIds([aggregationStepId]), futureEngines));
  addStep(steps, createStep(resolvedDatasetId, 13, "export_projection", "Export projection", "Describe future exportable output metadata.", "ready", existingStepIds([aggregationStepId]), futureEngines));

  const dependencies: AnalyticsPlanDependency[] = [
    {
      dependencyId: `${resolvedDatasetId}:dependency:forecast-date`,
      label: "Forecasting requires date field",
      requiredByStepId: steps.find((step) => step.category === "forecasting")?.stepId || dataPreparationStepId,
      satisfied: hasDate,
      reason: "Forecasting requires date field metadata.",
    },
    {
      dependencyId: `${resolvedDatasetId}:dependency:kpi-metric`,
      label: "KPI tracking requires metric field",
      requiredByStepId: steps.find((step) => step.category === "aggregation")?.stepId || dataPreparationStepId,
      satisfied: hasMetric,
      reason: "KPI tracking requires metric metadata.",
    },
    {
      dependencyId: `${resolvedDatasetId}:dependency:group-dimension`,
      label: "Grouped analysis requires dimension field",
      requiredByStepId: steps.find((step) => step.category === "grouping")?.stepId || dataPreparationStepId,
      satisfied: hasDimension,
      reason: "Grouped analysis requires dimension metadata.",
    },
    {
      dependencyId: `${resolvedDatasetId}:dependency:workbook-relationship`,
      label: "Workbook relationship workflows require confirmation",
      requiredByStepId: steps.find((step) => step.category === "relationship_validation")?.stepId || dataPreparationStepId,
      satisfied: !relationshipPending,
      reason: "Workbook relationship workflows require relationship confirmation.",
    },
  ];
  const projectedOutputs: AnalyticsPlanOutput[] = [
    ...(analyticsIntentGraph?.recommendedChartPaths.map((chart, index) => ({
      outputId: `${resolvedDatasetId}:output:dashboard-widget:${index}`,
      label: chart.replace(/_/g, " "),
      outputType: chart.includes("forecast") ? "forecasting_chart" as const : chart.includes("trend") || chart.includes("line") ? "trend_chart" as const : "dashboard_widget" as const,
      projectedFromStepIds: steps.filter((step) => step.category === "dashboard_projection").map((step) => step.stepId),
    })) || []),
    ...(executionPreview
      ? [
          {
            outputId: `${resolvedDatasetId}:output:${executionPreview.expectedFutureResultShape}`,
            label: executionPreview.expectedFutureResultShape.replace(/_/g, " "),
            outputType: outputTypeFromGraph(executionPreview.expectedFutureResultShape),
            projectedFromStepIds: steps.map((step) => step.stepId).slice(0, 4),
          },
        ]
      : []),
    {
      outputId: `${resolvedDatasetId}:output:executive-summary`,
      label: "Executive summary",
      outputType: "executive_summary",
      projectedFromStepIds: steps.filter((step) => step.category === "explanation_generation").map((step) => step.stepId),
    },
  ];
  const warnings: AnalyticsPlanWarning[] = [
    ...requirements
      .filter((requirement) => !requirement.satisfied)
      .map((requirement) => ({
        warningId: `${requirement.requirementId}:warning`,
        message: requirement.missingMetadata.join(" "),
        severity: requirement.requirementId.includes("relationship") ? "warning" as const : "blocked" as const,
      })),
    ...(planningReadiness?.futureExecutionBlockers.map((blocker, index) => ({
      warningId: `${resolvedDatasetId}:planning-blocker:${index}`,
      message: blocker,
      severity: "warning" as const,
    })) || []),
  ];
  const estimatedRelationshipComplexity = dataProfile?.workbookRelationshipContext.relationshipCandidateCount || 0;
  const estimatedChartCount = analyticsIntentGraph?.recommendedChartPaths.length || 0;
  const interpretedQuestionCount = businessQuestionReport?.interpretedQuestions.length || 0;
  const estimatedKpiCount = kpiIntelligenceReport?.opportunities.length || businessSemanticReport?.possibleBusinessKpis.length || 0;
  const complexity = complexityFromSizing(steps.length, estimatedRelationshipComplexity, estimatedChartCount);
  const plan: AnalyticsPlan = {
    planId: `${resolvedDatasetId}:analytics-plan`,
    datasetId: resolvedDatasetId,
    status: warnings.some((warning) => warning.severity === "blocked") ? planStatus : planStatus,
    complexity,
    planningConfidence: analyticsIntentGraph?.confidence || "low",
    executionReadiness: planStatus,
    humanSummary: buildHumanSummary(
      planStatus,
      steps.some((step) => step.category === "forecasting"),
      relationshipPending,
    ),
    analystSummary: `${steps.length} ordered future steps, ${dependencies.filter((dependency) => !dependency.satisfied).length} unresolved dependencies, ${projectedOutputs.length} projected outputs, ${interpretedQuestionCount} interpreted business questions.`,
    steps,
    dependencies,
    requirements,
    projectedOutputs,
    warnings,
    futureEngines,
    sizing: {
      estimatedFutureStepCount: steps.length,
      estimatedRelationshipComplexity,
      estimatedChartCount,
      estimatedKpiCount,
    },
  };
  const validation = validateAnalyticsPlan(plan);

  if (validation.messages.length === 0) return plan;

  return {
    ...plan,
    warnings: [
      ...plan.warnings,
      ...validation.messages.map((message, index) => ({
        warningId: `${resolvedDatasetId}:validation:${index}`,
        message: message.message,
        severity: message.severity === "error" ? "blocked" as const : "warning" as const,
      })),
    ],
  };
};
