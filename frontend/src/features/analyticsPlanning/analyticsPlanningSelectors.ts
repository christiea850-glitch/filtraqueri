import type { AnalyticsPlan, AnalyticsPlanStepCategory } from "./analyticsPlanningTypes";

export const selectAnalyticsPlanHumanSummary = (plan: AnalyticsPlan | null) =>
  plan?.humanSummary || "No analytics plan summary is available yet.";

export const selectAnalyticsPlanAnalystSummary = (plan: AnalyticsPlan | null) =>
  plan?.analystSummary || "No analytics plan metadata is available yet.";

export const listAnalyticsPlanSteps = (plan: AnalyticsPlan | null) => plan?.steps || [];

export const listBlockedAnalyticsPlanSteps = (plan: AnalyticsPlan | null) =>
  listAnalyticsPlanSteps(plan).filter((step) => step.status === "blocked" || step.status === "metadata_pending" || step.status === "relationship_pending");

export const listAnalyticsPlanStepsByCategory = (
  plan: AnalyticsPlan | null,
  category: AnalyticsPlanStepCategory,
) => listAnalyticsPlanSteps(plan).filter((step) => step.category === category);

export const listAnalyticsPlanMissingMetadata = (plan: AnalyticsPlan | null) =>
  plan?.requirements.flatMap((requirement) => requirement.missingMetadata) || [];
