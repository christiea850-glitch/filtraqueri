import { useMemo } from "react";
import type { AnalyticsTask } from "../tasks";
import type { TaskConfiguration } from "../taskConfiguration";
import { buildAnalysisPlan } from "./analysisPlanBuilder";

function useAnalysisPlan(
  task: AnalyticsTask | null,
  configuration: TaskConfiguration | null,
) {
  const analysisPlan = useMemo(
    () => (task ? buildAnalysisPlan(task, configuration) : null),
    [configuration, task],
  );

  return {
    analysisPlan,
  };
}

export default useAnalysisPlan;
