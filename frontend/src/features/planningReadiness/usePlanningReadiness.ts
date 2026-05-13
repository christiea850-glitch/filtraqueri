import { useMemo } from "react";
import type { AnalysisPlan } from "../analysisPlan";
import type { EngineCompatibilitySummary } from "../engineAdapters";
import type { BusinessExplanation } from "../explanations";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import type { TaskConfiguration } from "../taskConfiguration";
import { buildPlanningReadinessReport } from "./planningReadinessBuilder";

export function usePlanningReadiness({
  task,
  configuration,
  analysisPlan,
  engineCompatibility,
  relationshipPlan,
  explanation,
}: {
  task: AnalyticsTask;
  configuration: TaskConfiguration | null;
  analysisPlan: AnalysisPlan | null;
  engineCompatibility: EngineCompatibilitySummary;
  relationshipPlan: RelationshipAwareTaskPlan;
  explanation: BusinessExplanation | null;
}) {
  return useMemo(
    () =>
      buildPlanningReadinessReport({
        task,
        configuration,
        analysisPlan,
        engineCompatibility,
        relationshipPlan,
        explanation,
      }),
    [analysisPlan, configuration, engineCompatibility, explanation, relationshipPlan, task],
  );
}
