import type { PlanningReadinessReport, PlanningReadinessStatus } from "./planningReadinessTypes";

export const getPlanningReadinessStatusLabel = (status: PlanningReadinessStatus) => {
  if (status === "ready_for_future_execution") return "Ready for future execution";
  if (status === "relationship_dependent") return "Relationship dependent";
  if (status === "engine_limited") return "Engine limited";
  if (status === "partially_ready") return "Partially ready";
  if (status === "unsupported") return "Unsupported";
  return "Not ready";
};

export const getPlanningReadinessTone = (status: PlanningReadinessStatus) => {
  if (status === "ready_for_future_execution") return "ready";
  if (status === "partially_ready") return "partial";
  if (status === "relationship_dependent" || status === "engine_limited") return "warning";
  return "blocked";
};

export const listPlanningReadinessBlockers = (report: PlanningReadinessReport | null) =>
  report?.futureExecutionBlockers || [];

export const listPlanningReadinessNotes = (report: PlanningReadinessReport | null) =>
  report?.futureExecutionNotes || [];
