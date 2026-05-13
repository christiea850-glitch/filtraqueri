import { useMemo } from "react";
import type { AnalyticsIntentGraphReport } from "../analyticsIntentGraph";
import type { BusinessQuestionIntelligenceReport } from "../businessQuestionIntelligence";
import type { BusinessSemanticReport } from "../businessSemantics";
import type { DataProfileReport } from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { KpiIntelligenceReport } from "../kpiIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkflowRecommendationReport } from "../workflowRecommendations";
import { buildAnalyticsPlan } from "./analyticsPlanningBuilder";

export function useAnalyticsPlanning({
  datasetId,
  dataProfile,
  workflowRecommendationReport,
  kpiIntelligenceReport,
  businessSemanticReport,
  businessQuestionReport,
  analyticsIntentGraph,
  executionPreview = null,
  planningReadiness = null,
}: {
  datasetId: string | null;
  dataProfile: DataProfileReport | null;
  workflowRecommendationReport: WorkflowRecommendationReport | null;
  kpiIntelligenceReport: KpiIntelligenceReport | null;
  businessSemanticReport: BusinessSemanticReport | null;
  businessQuestionReport: BusinessQuestionIntelligenceReport | null;
  analyticsIntentGraph: AnalyticsIntentGraphReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  planningReadiness?: PlanningReadinessReport | null;
}) {
  const analyticsPlan = useMemo(
    () =>
      buildAnalyticsPlan({
        datasetId,
        dataProfile,
        workflowRecommendationReport,
        kpiIntelligenceReport,
        businessSemanticReport,
        businessQuestionReport,
        analyticsIntentGraph,
        executionPreview,
        planningReadiness,
      }),
    [
      analyticsIntentGraph,
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
    analyticsPlan,
    steps: analyticsPlan?.steps || [],
    blockedSteps: analyticsPlan?.steps.filter((step) => step.status !== "ready") || [],
    projectedOutputs: analyticsPlan?.projectedOutputs || [],
    humanSummary: analyticsPlan?.humanSummary || "No analytics plan summary is available yet.",
    analystSummary: analyticsPlan?.analystSummary || "No analytics plan metadata is available yet.",
  };
}
