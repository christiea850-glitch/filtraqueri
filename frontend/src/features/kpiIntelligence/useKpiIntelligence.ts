import { useMemo } from "react";
import type { BusinessSemanticReport } from "../businessSemantics";
import type { DataProfileReport } from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkflowRecommendationReport } from "../workflowRecommendations";
import { buildKpiIntelligenceReport } from "./kpiIntelligenceBuilder";

export function useKpiIntelligence({
  dataProfile,
  businessSemanticReport,
  workflowRecommendationReport = null,
  executionPreview = null,
  guidedInputState = null,
  planningReadiness = null,
}: {
  dataProfile: DataProfileReport | null;
  businessSemanticReport: BusinessSemanticReport | null;
  workflowRecommendationReport?: WorkflowRecommendationReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  guidedInputState?: GuidedInputState | null;
  planningReadiness?: PlanningReadinessReport | null;
}) {
  const kpiIntelligenceReport = useMemo(
    () =>
      buildKpiIntelligenceReport({
        dataProfile,
        businessSemanticReport,
        workflowRecommendationReport,
        executionPreview,
        guidedInputState,
        planningReadiness,
      }),
    [
      businessSemanticReport,
      dataProfile,
      executionPreview,
      guidedInputState,
      planningReadiness,
      workflowRecommendationReport,
    ],
  );

  return {
    kpiIntelligenceReport,
    opportunities: kpiIntelligenceReport?.opportunities || [],
    topOpportunity: kpiIntelligenceReport?.topOpportunity || null,
    humanSummary:
      kpiIntelligenceReport?.humanSummary ||
      "No KPI intelligence summary is available yet.",
    analystSummary:
      kpiIntelligenceReport?.analystSummary ||
      "No KPI intelligence metadata is available yet.",
  };
}
