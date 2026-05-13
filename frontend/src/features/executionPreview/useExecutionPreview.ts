import { useMemo } from "react";
import type { AnalysisPlan } from "../analysisPlan";
import type { EngineCompatibilitySummary } from "../engineAdapters";
import type { BusinessExplanation } from "../explanations";
import type { GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import { buildExecutionPreview } from "./executionPreviewBuilder";

export function useExecutionPreview({
  task,
  guidedInputState,
  analysisPlan,
  relationshipPlan,
  engineCompatibility,
  planningReadiness,
  explanation,
}: {
  task: AnalyticsTask;
  guidedInputState: GuidedInputState;
  analysisPlan: AnalysisPlan | null;
  relationshipPlan: RelationshipAwareTaskPlan;
  engineCompatibility: EngineCompatibilitySummary;
  planningReadiness: PlanningReadinessReport;
  explanation: BusinessExplanation | null;
}) {
  const executionPreview = useMemo(
    () =>
      buildExecutionPreview({
        task,
        guidedInputState,
        analysisPlan,
        relationshipPlan,
        engineCompatibility,
        planningReadiness,
        explanation,
      }),
    [
      analysisPlan,
      engineCompatibility,
      explanation,
      guidedInputState,
      planningReadiness,
      relationshipPlan,
      task,
    ],
  );

  return {
    executionPreview,
    confidence: executionPreview.confidence,
    resultShape: executionPreview.expectedFutureResultShape,
    analystNotes: executionPreview.analystNotes,
    safetyNotes: executionPreview.safetyNotes,
  };
}
