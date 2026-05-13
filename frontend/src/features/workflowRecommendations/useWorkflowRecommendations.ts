import { useMemo } from "react";
import type { DataProfileReport, DialectRecommendationReport } from "../dataIntelligence";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import { buildWorkflowRecommendationReport } from "./workflowRecommendationBuilder";

export function useWorkflowRecommendations({
  dataProfile,
  dialectRecommendation,
  guidedInputState = null,
  planningReadiness = null,
  executionPreview = null,
}: {
  dataProfile: DataProfileReport | null;
  dialectRecommendation: DialectRecommendationReport | null;
  guidedInputState?: GuidedInputState | null;
  planningReadiness?: PlanningReadinessReport | null;
  executionPreview?: ExecutionPreviewReport | null;
}) {
  const workflowRecommendationReport = useMemo(
    () =>
      buildWorkflowRecommendationReport({
        dataProfile,
        dialectRecommendation,
        guidedInputState,
        planningReadiness,
        executionPreview,
      }),
    [
      dataProfile,
      dialectRecommendation,
      executionPreview,
      guidedInputState,
      planningReadiness,
    ],
  );

  return {
    workflowRecommendationReport,
    recommendations: workflowRecommendationReport?.recommendations || [],
    topRecommendation: workflowRecommendationReport?.topRecommendation || null,
    humanSummary:
      workflowRecommendationReport?.humanSummary ||
      "No workflow recommendations are available yet.",
    analystSummary:
      workflowRecommendationReport?.analystSummary ||
      "No workflow recommendation metadata is available yet.",
  };
}
