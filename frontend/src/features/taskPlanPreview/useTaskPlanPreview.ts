import { useMemo } from "react";
import type { AnalysisPlan } from "../analysisPlan";
import type { EngineCompatibilitySummary } from "../engineAdapters";
import type { BusinessExplanation } from "../explanations";
import type { GuidedInputState } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import { buildTaskPlanPreview } from "./taskPlanPreviewBuilder";

export function useTaskPlanPreview({
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
  return useMemo(
    () =>
      buildTaskPlanPreview({
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
}
