import { useMemo } from "react";
import type { AnalyticsIntentGraphReport } from "../analyticsIntentGraph";
import type { AnalyticsPlan } from "../analyticsPlanning";
import type { BusinessQuestionIntelligenceReport } from "../businessQuestionIntelligence";
import type { BusinessSemanticReport } from "../businessSemantics";
import type { DataProfileReport } from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { KpiIntelligenceReport } from "../kpiIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkflowRecommendationReport } from "../workflowRecommendations";
import { buildExecutionContract } from "./executionContractBuilder";

export function useExecutionContracts({
  datasetId,
  analyticsPlan,
  analyticsIntentGraph,
  dataProfile,
  workflowRecommendationReport,
  kpiIntelligenceReport,
  businessSemanticReport,
  businessQuestionReport,
  executionPreview = null,
  planningReadiness = null,
}: {
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
}) {
  const executionContract = useMemo(
    () =>
      buildExecutionContract({
        datasetId,
        analyticsPlan,
        analyticsIntentGraph,
        dataProfile,
        workflowRecommendationReport,
        kpiIntelligenceReport,
        businessSemanticReport,
        businessQuestionReport,
        executionPreview,
        planningReadiness,
      }),
    [
      analyticsIntentGraph,
      analyticsPlan,
      businessQuestionReport,
      businessSemanticReport,
      dataProfile,
      datasetId,
      executionPreview,
      kpiIntelligenceReport,
      planningReadiness,
      workflowRecommendationReport,
    ],
  );

  return {
    executionContract,
    stages: executionContract?.stages || [],
    outputs: executionContract?.outputs || [],
    engines: executionContract?.engines || [],
    humanSummary:
      executionContract?.humanSummary ||
      "No execution contract summary is available yet.",
    analystSummary:
      executionContract?.analystSummary ||
      "No execution contract metadata is available yet.",
  };
}
