import { useMemo } from "react";
import type { BusinessQuestionIntelligenceReport } from "../businessQuestionIntelligence";
import type { BusinessSemanticReport } from "../businessSemantics";
import type { DataProfileReport, DialectRecommendationReport } from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { KpiIntelligenceReport } from "../kpiIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkflowRecommendationReport } from "../workflowRecommendations";
import { buildAnalyticsIntentGraph } from "./analyticsIntentGraphBuilder";

export function useAnalyticsIntentGraph({
  datasetId,
  dataProfile,
  dialectRecommendation,
  workflowRecommendationReport,
  businessSemanticReport,
  kpiIntelligenceReport,
  businessQuestionReport,
  executionPreview = null,
  planningReadiness = null,
}: {
  datasetId: string | null;
  dataProfile: DataProfileReport | null;
  dialectRecommendation: DialectRecommendationReport | null;
  workflowRecommendationReport: WorkflowRecommendationReport | null;
  businessSemanticReport: BusinessSemanticReport | null;
  kpiIntelligenceReport: KpiIntelligenceReport | null;
  businessQuestionReport: BusinessQuestionIntelligenceReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  planningReadiness?: PlanningReadinessReport | null;
}) {
  const analyticsIntentGraph = useMemo(
    () =>
      buildAnalyticsIntentGraph({
        datasetId,
        dataProfile,
        dialectRecommendation,
        workflowRecommendationReport,
        businessSemanticReport,
        kpiIntelligenceReport,
        businessQuestionReport,
        executionPreview,
        planningReadiness,
      }),
    [
      businessQuestionReport,
      businessSemanticReport,
      dataProfile,
      datasetId,
      dialectRecommendation,
      executionPreview,
      kpiIntelligenceReport,
      planningReadiness,
      workflowRecommendationReport,
    ],
  );

  return {
    analyticsIntentGraph,
    nodes: analyticsIntentGraph?.nodes || [],
    edges: analyticsIntentGraph?.edges || [],
    health: analyticsIntentGraph?.health || null,
    humanSummary:
      analyticsIntentGraph?.humanSummary ||
      "No analytics intent graph summary is available yet.",
    analystSummary:
      analyticsIntentGraph?.analystSummary ||
      "No analytics intent graph metadata is available yet.",
  };
}
