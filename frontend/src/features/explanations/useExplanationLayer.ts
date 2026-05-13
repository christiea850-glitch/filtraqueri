import { useMemo } from "react";
import type { AnalysisPlan } from "../analysisPlan";
import type { AnalyticsTask } from "../tasks";
import { buildBusinessExplanation } from "./explanationBuilder";

function useExplanationLayer(
  task: AnalyticsTask | null,
  analysisPlan: AnalysisPlan | null,
) {
  const businessExplanation = useMemo(
    () => (task ? buildBusinessExplanation({ task, analysisPlan }) : null),
    [analysisPlan, task],
  );

  return {
    businessExplanation,
  };
}

export default useExplanationLayer;
