import { useMemo } from "react";
import type { AnalysisPlan } from "../analysisPlan";
import type { AnalyticsTask } from "../tasks";
import { getEngineCompatibilitySummary } from "./engineCompatibility";

export function useEngineAdapters(task: AnalyticsTask, analysisPlan: AnalysisPlan | null) {
  return useMemo(
    () => getEngineCompatibilitySummary({ task, analysisPlan }),
    [analysisPlan, task],
  );
}
