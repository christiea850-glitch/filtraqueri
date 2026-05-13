import type { RelationshipAwareTaskPlan } from "./relationshipAwarePlanningTypes";

export const hasRelationshipAwarePlanningSupport = (plan: RelationshipAwareTaskPlan | null) =>
  Boolean(plan?.hasWorkbookContext && plan.matchingJoinPreviews.length > 0);

export const getRelationshipPlanningReadinessLabel = (
  plan: RelationshipAwareTaskPlan | null,
) => {
  if (!plan?.hasWorkbookContext) return "Single-dataset task context";
  if (plan.futureJoinRequirementStatus === "unsupported") return "Needs relationship review later";
  if (plan.futureJoinRequirementStatus === "may_help") return "Workbook relationships may help";
  if (plan.futureJoinRequirementStatus === "likely_required") return "Future multi-sheet support needed";
  return "Relationship support optional";
};

export const listRelationshipPlanningWorksheets = (
  plan: RelationshipAwareTaskPlan | null,
) => plan?.relatedWorksheets || [];
