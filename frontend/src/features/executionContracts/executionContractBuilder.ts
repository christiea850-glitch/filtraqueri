import type { AnalyticsIntentGraphReport } from "../analyticsIntentGraph";
import type { AnalyticsPlan, AnalyticsPlanOutputType, AnalyticsPlanStepCategory } from "../analyticsPlanning";
import type { BusinessQuestionIntelligenceReport } from "../businessQuestionIntelligence";
import type { BusinessSemanticReport } from "../businessSemantics";
import type { DataProfileReport, FutureDialectRecommendationId } from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { KpiIntelligenceReport } from "../kpiIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkflowRecommendationReport } from "../workflowRecommendations";
import type {
  ExecutionContract,
  ExecutionDependencyContract,
  ExecutionEngineContract,
  ExecutionInputContract,
  ExecutionLifecycleState,
  ExecutionOutputContract,
  ExecutionProjectedOutputType,
  ExecutionStageCategory,
  ExecutionStageContract,
} from "./executionContractTypes";
import { validateExecutionContract } from "./executionContractValidation";

type BuildArgs = {
  datasetId: string | null;
  analyticsPlan: AnalyticsPlan | null;
  analyticsIntentGraph: AnalyticsIntentGraphReport | null;
  dataProfile: DataProfileReport | null;
  workflowRecommendationReport: WorkflowRecommendationReport | null;
  kpiIntelligenceReport: KpiIntelligenceReport | null;
  businessSemanticReport: BusinessSemanticReport | null;
  businessQuestionReport: BusinessQuestionIntelligenceReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  planningReadiness?: PlanningReadinessReport | null;
};

const engineLabels: Record<FutureDialectRecommendationId, string> = {
  duckdb_sql: "DuckDB",
  excel_workbook: "Excel workbook logic",
  python_analysis: "Python analytics",
  r_statistical_analysis: "R statistical engine",
  future_mariadb: "MariaDB future path",
  future_oracle: "Oracle future path",
  future_postgresql_general_sql: "PostgreSQL/general SQL future path",
};

const stageMap: Partial<Record<AnalyticsPlanStepCategory, ExecutionStageCategory>> = {
  data_preparation: "dataset_resolution",
  relationship_validation: "relationship_resolution",
  metric_selection: "metric_resolution",
  dimension_selection: "dimension_resolution",
  filtering: "filter_resolution",
  grouping: "dimension_resolution",
  aggregation: "aggregation_resolution",
  trend_analysis: "aggregation_resolution",
  forecasting: "forecasting_resolution",
  statistical_analysis: "statistical_resolution",
  segmentation: "dimension_resolution",
  dashboard_projection: "visualization_resolution",
  explanation_generation: "explanation_resolution",
  export_projection: "export_resolution",
};

const outputMap: Record<AnalyticsPlanOutputType, ExecutionProjectedOutputType> = {
  grouped_table: "grouped_table",
  summary_table: "summary_table",
  dashboard_widget: "dashboard_widget",
  forecasting_chart: "forecast_output",
  trend_chart: "trend_output",
  executive_summary: "executive_summary",
  statistical_output: "statistical_report",
};

const lifecycleFromPlanStatus = (status: AnalyticsPlan["status"]): ExecutionLifecycleState => {
  if (status === "ready") return "ready_for_execution";
  if (status === "relationship_pending") return "relationship_pending";
  if (status === "metadata_pending") return "metadata_pending";
  if (status === "blocked") return "blocked";
  return "pending_validation";
};

const readinessScore = (contractState: ExecutionLifecycleState, missingCount: number) => {
  if (contractState === "ready_for_execution") return Math.max(75, 100 - missingCount * 5);
  if (contractState === "relationship_pending") return 62;
  if (contractState === "metadata_pending") return 48;
  if (contractState === "blocked") return 20;
  return 55;
};

const buildHumanSummary = (
  state: ExecutionLifecycleState,
  hasForecasting: boolean,
  relationshipPending: boolean,
  hasKpis: boolean,
) => {
  if (relationshipPending) return "Relationship confirmation is required before workbook analysis.";
  if (hasForecasting) return "A future forecasting execution contract is prepared.";
  if (hasKpis && state === "ready_for_execution") return "KPI analysis is ready for future execution planning.";
  return "A metadata-only future execution contract is prepared.";
};

export const buildExecutionContract = ({
  datasetId,
  analyticsPlan,
  analyticsIntentGraph,
  dataProfile,
  kpiIntelligenceReport,
  businessSemanticReport,
  executionPreview = null,
  planningReadiness = null,
}: BuildArgs): ExecutionContract | null => {
  const resolvedDatasetId =
    datasetId ||
    analyticsPlan?.datasetId ||
    analyticsIntentGraph?.datasetId ||
    dataProfile?.datasetId ||
    null;
  if (!resolvedDatasetId || !analyticsPlan) return null;

  const stages: ExecutionStageContract[] = analyticsPlan.steps.map((step) => ({
    stageId: `${resolvedDatasetId}:execution-contract:${stageMap[step.category] || "dataset_resolution"}:${step.stepId}`,
    label: step.label,
    category: stageMap[step.category] || "dataset_resolution",
    lifecycleState: lifecycleFromPlanStatus(step.status),
    dependencyIds: [],
    missingMetadata: analyticsPlan.requirements
      .filter((requirement) => !requirement.satisfied)
      .flatMap((requirement) => requirement.missingMetadata),
  }));
  const stageByPlanStep = new Map(analyticsPlan.steps.map((step, index) => [step.stepId, stages[index]]));
  const dependencies: ExecutionDependencyContract[] = analyticsPlan.dependencies.map((dependency) => {
    const targetStage = stageByPlanStep.get(dependency.requiredByStepId) || stages[0];
    const sourceStage = stages.find((stage) => {
      if (dependency.dependencyId.includes("forecast-date")) return stage.category === "metric_resolution";
      if (dependency.dependencyId.includes("group-dimension")) return stage.category === "dimension_resolution";
      if (dependency.dependencyId.includes("workbook-relationship")) return stage.category === "relationship_resolution";
      return stage.category === "dataset_resolution";
    }) || stages[0];

    return {
      dependencyId: dependency.dependencyId.replace(":dependency:", ":execution-dependency:"),
      label: dependency.label,
      sourceStageId: sourceStage.stageId,
      targetStageId: targetStage.stageId,
      satisfied: dependency.satisfied,
      reason: dependency.reason,
    };
  });
  const inputs: ExecutionInputContract[] = analyticsPlan.requirements.map((requirement) => ({
    inputId: requirement.requirementId.replace(":requirement:", ":execution-input:"),
    label: requirement.label,
    required: true,
    satisfied: requirement.satisfied,
    metadataSource: requirement.label.toLowerCase(),
  }));
  const outputs: ExecutionOutputContract[] = analyticsPlan.projectedOutputs.map((output) => ({
    outputId: output.outputId.replace(":output:", ":execution-output:"),
    label: output.label,
    outputType: outputMap[output.outputType],
    sourceStageIds: output.projectedFromStepIds
      .map((stepId) => stageByPlanStep.get(stepId)?.stageId)
      .filter((stageId): stageId is string => Boolean(stageId)),
  }));
  const engineIds = Array.from(
    new Set([
      ...analyticsPlan.futureEngines,
      ...(analyticsIntentGraph?.recommendedFutureEngines || []),
      ...(executionPreview?.supportedFutureEngines || []),
    ]),
  ) as FutureDialectRecommendationId[];
  const engines: ExecutionEngineContract[] = engineIds.map((engineId) => ({
    engineId,
    label: engineLabels[engineId],
    compatible: true,
    readinessState: lifecycleFromPlanStatus(analyticsPlan.status),
    reasons: ["Engine compatibility is projected from metadata recommendations."],
  }));
  const relationshipPending = Boolean(
    dataProfile?.workbookRelationshipContext.hasWorkbookContext &&
      dataProfile.workbookRelationshipContext.acceptedRelationshipCount === 0,
  );
  const missingMetadata = analyticsPlan.requirements.flatMap((requirement) => requirement.missingMetadata);
  const lifecycleState = lifecycleFromPlanStatus(analyticsPlan.status);
  const blockedReasons = [
    ...analyticsPlan.warnings.map((warning) => warning.message),
    ...(planningReadiness?.futureExecutionBlockers || []),
  ];
  const hasForecasting = stages.some((stage) => stage.category === "forecasting_resolution");
  const contract: ExecutionContract = {
    contractId: `${resolvedDatasetId}:execution-contract`,
    datasetId: resolvedDatasetId,
    lifecycleState,
    complexity: analyticsPlan.complexity,
    readinessScore: readinessScore(lifecycleState, missingMetadata.length),
    humanSummary: buildHumanSummary(
      lifecycleState,
      hasForecasting,
      relationshipPending,
      Boolean(kpiIntelligenceReport?.opportunities.length || businessSemanticReport?.possibleBusinessKpis.length),
    ),
    analystSummary: `${stages.length} execution stages, ${dependencies.filter((dependency) => !dependency.satisfied).length} unresolved dependencies, ${engines.length} compatible future engines.`,
    stages,
    inputs,
    outputs,
    dependencies,
    safety: {
      contractId: `${resolvedDatasetId}:execution-safety`,
      metadataOnly: true,
      executionLocked: true,
      sqlExecutionAllowed: false,
      codeGenerationAllowed: false,
      activeResultMutationAllowed: false,
      notes: [
        "Execution contract is metadata only.",
        "Future execution remains locked until an explicit execution pipeline is implemented.",
      ],
    },
    engines,
    blockedReasons,
    missingMetadata,
    relationshipDependencyChains: relationshipPending
      ? ["Workbook execution requires relationship confirmation before relationship resolution."]
      : [],
    sizing: {
      estimatedExecutionStages: stages.length,
      estimatedRelationshipCount: dataProfile?.workbookRelationshipContext.relationshipCandidateCount || 0,
      estimatedProjectedOutputs: outputs.length,
      estimatedKpiProjections: kpiIntelligenceReport?.opportunities.length || 0,
    },
  };
  const validation = validateExecutionContract(contract);

  if (validation.messages.length === 0) return contract;

  return {
    ...contract,
    blockedReasons: [
      ...contract.blockedReasons,
      ...validation.messages.map((message) => message.message),
    ],
  };
};
