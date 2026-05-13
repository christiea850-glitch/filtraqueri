import { useMemo } from "react";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { AnalyticsTask } from "../tasks";
import { buildRelationshipAwareTaskPlan } from "./relationshipAwareTaskPlanner";

export function useRelationshipAwarePlanning(
  task: AnalyticsTask,
  dataset: DatasetMetadata | null,
) {
  return useMemo(
    () => buildRelationshipAwareTaskPlan(task, dataset),
    [dataset, task],
  );
}
