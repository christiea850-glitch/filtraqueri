import { useMemo } from "react";
import type { BusinessSemanticReport } from "../businessSemantics";
import type { ExecutionPreviewReport } from "../executionPreview";
import type { GuidedInputState } from "../guidedInputs";
import type { KpiIntelligenceReport } from "../kpiIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkflowRecommendationReport } from "../workflowRecommendations";
import { classifyBusinessQuestions } from "./businessQuestionClassifier";

export function useBusinessQuestions({
  datasetId,
  questions = [],
  businessSemanticReport,
  kpiIntelligenceReport,
  workflowRecommendationReport = null,
  executionPreview = null,
  guidedInputState = null,
  planningReadiness = null,
}: {
  datasetId: string | null;
  questions?: string[];
  businessSemanticReport: BusinessSemanticReport | null;
  kpiIntelligenceReport: KpiIntelligenceReport | null;
  workflowRecommendationReport?: WorkflowRecommendationReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  guidedInputState?: GuidedInputState | null;
  planningReadiness?: PlanningReadinessReport | null;
}) {
  const businessQuestionReport = useMemo(
    () =>
      classifyBusinessQuestions({
        datasetId,
        questions,
        businessSemanticReport,
        kpiIntelligenceReport,
        workflowRecommendationReport,
        executionPreview,
        guidedInputState,
        planningReadiness,
      }),
    [
      businessSemanticReport,
      datasetId,
      executionPreview,
      guidedInputState,
      kpiIntelligenceReport,
      planningReadiness,
      questions,
      workflowRecommendationReport,
    ],
  );

  return {
    businessQuestionReport,
    interpretedQuestions: businessQuestionReport?.interpretedQuestions || [],
    topInterpretation: businessQuestionReport?.topInterpretation || null,
    humanSummary:
      businessQuestionReport?.humanSummary ||
      "No business question summary is available yet.",
    analystSummary:
      businessQuestionReport?.analystSummary ||
      "No business question metadata is available yet.",
  };
}
