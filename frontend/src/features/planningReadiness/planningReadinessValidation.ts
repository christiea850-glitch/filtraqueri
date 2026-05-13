import type { AnalysisPlan } from "../analysisPlan";
import type { EngineCompatibilitySummary } from "../engineAdapters";
import type { BusinessExplanation } from "../explanations";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { TaskConfiguration } from "../taskConfiguration";
import type {
  PlanningReadinessConfidence,
  PlanningReadinessStatus,
  PlanningWorkflowScope,
} from "./planningReadinessTypes";

export const collectPlanningBlockers = ({
  configuration,
  analysisPlan,
  engineCompatibility,
  relationshipPlan,
  explanation,
}: {
  configuration: TaskConfiguration | null;
  analysisPlan: AnalysisPlan | null;
  engineCompatibility: EngineCompatibilitySummary;
  relationshipPlan: RelationshipAwareTaskPlan;
  explanation: BusinessExplanation | null;
}) => {
  const blockers: string[] = [];

  if (!configuration) {
    blockers.push("Task configuration metadata is unavailable.");
  } else if (configuration.validationState === "incomplete") {
    blockers.push("Required task inputs still need guided configuration.");
  } else if (configuration.validationState === "invalid") {
    blockers.push("Task configuration metadata is invalid.");
  } else if (configuration.validationState === "unsupported") {
    blockers.push("Task configuration is unsupported.");
  }

  if (!analysisPlan) {
    blockers.push("Analysis plan metadata is unavailable.");
  } else if (analysisPlan.validationState === "invalid") {
    blockers.push("Analysis plan metadata is invalid.");
  } else if (analysisPlan.validationState === "unsupported") {
    blockers.push("Analysis plan is unsupported.");
  }

  if (engineCompatibility.compatibleEngines.length === 0) {
    blockers.push("No compatible future engine metadata is available.");
  }

  if (relationshipPlan.futureJoinRequirementStatus === "unsupported") {
    blockers.push("Workbook relationship support may need review before future execution.");
  }

  if (!explanation) {
    blockers.push("Business explanation metadata is unavailable.");
  }

  return blockers;
};

export const determinePlanningReadinessStatus = ({
  configuration,
  analysisPlan,
  engineCompatibility,
  relationshipPlan,
}: {
  configuration: TaskConfiguration | null;
  analysisPlan: AnalysisPlan | null;
  engineCompatibility: EngineCompatibilitySummary;
  relationshipPlan: RelationshipAwareTaskPlan;
}): PlanningReadinessStatus => {
  if (
    configuration?.validationState === "invalid" ||
    configuration?.validationState === "unsupported" ||
    analysisPlan?.validationState === "invalid" ||
    analysisPlan?.validationState === "unsupported"
  ) {
    return "unsupported";
  }

  if (!configuration || configuration.validationState === "incomplete" || !analysisPlan) {
    return "not_ready";
  }

  if (engineCompatibility.compatibleEngines.length === 0) {
    return "engine_limited";
  }

  if (relationshipPlan.futureJoinRequirementStatus === "unsupported") {
    return "relationship_dependent";
  }

  if (relationshipPlan.highestConfidence === "low") {
    return "relationship_dependent";
  }

  if (analysisPlan.validationState === "ready_for_future_execution") {
    return "ready_for_future_execution";
  }

  return "partially_ready";
};

export const determinePlanningConfidence = ({
  status,
  relationshipPlan,
  engineCompatibility,
}: {
  status: PlanningReadinessStatus;
  relationshipPlan: RelationshipAwareTaskPlan;
  engineCompatibility: EngineCompatibilitySummary;
}): PlanningReadinessConfidence => {
  if (status === "ready_for_future_execution") return "high";
  if (status === "unsupported" || status === "not_ready") return "low";
  if (engineCompatibility.compatibleEngines.length >= 2 && relationshipPlan.highestConfidence !== "low") {
    return "medium";
  }
  return "low";
};

export const determineWorkflowScope = ({
  status,
  relationshipPlan,
  engineCompatibility,
}: {
  status: PlanningReadinessStatus;
  relationshipPlan: RelationshipAwareTaskPlan;
  engineCompatibility: EngineCompatibilitySummary;
}): PlanningWorkflowScope => {
  if (status === "unsupported") return "unsupported";
  if (relationshipPlan.matchingJoinPreviews.length > 0) return "workbook_relationship_aware";
  if (engineCompatibility.compatibleEngines.length > 1) return "multi_engine_planning";
  return "single_worksheet";
};
