import { useMemo } from "react";
import type { AnalysisPlan } from "../analysisPlan";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import { buildBusinessExplanation } from "./explanationBuilder";

function useExplanationLayer(
  task: AnalyticsTask | null,
  analysisPlan: AnalysisPlan | null,
  relationshipPlan?: RelationshipAwareTaskPlan | null,
) {
  const businessExplanation = useMemo(
    () => (task ? buildBusinessExplanation({ task, analysisPlan, relationshipPlan }) : null),
    [analysisPlan, relationshipPlan, task],
  );

  return {
    businessExplanation,
  };
}

export default useExplanationLayer;
