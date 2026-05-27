import type { AnalysisPlan } from "../analysisPlan";
import type { EngineCompatibilitySummary } from "../engineAdapters";
import type { BusinessExplanation } from "../explanations";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import type { TaskConfiguration } from "../taskConfiguration";
import type { PlanningReadinessReport } from "./planningReadinessTypes";
import {
  collectPlanningBlockers,
  determinePlanningConfidence,
  determinePlanningReadinessStatus,
  determineWorkflowScope,
} from "./planningReadinessValidation";

const buildBeginnerSummary = (report: Pick<PlanningReadinessReport, "status" | "confidenceLevel">) => {
  if (report.status === "ready_for_future_execution") {
    return "This task appears structurally ready for future analytics execution.";
  }
  if (report.status === "relationship_dependent") {
    return "The workflow structure is available, but workbook relationships may need confirmation before future execution.";
  }
  if (report.status === "engine_limited") {
    return "This workflow needs stronger future engine support before it can be executed safely.";
  }
  if (report.status === "unsupported") {
    return "This workflow is not supported by the current planning metadata.";
  }
  if (report.status === "partially_ready") {
    return "The workflow can be described, but more planning metadata is needed before execution can be wired.";
  }
  return "This task still needs guided inputs before it can be prepared for future execution.";
};

export function buildPlanningReadinessReport({
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
}): PlanningReadinessReport {
  const status = determinePlanningReadinessStatus({
    configuration,
    analysisPlan,
    engineCompatibility,
    relationshipPlan,
  });
  const confidenceLevel = determinePlanningConfidence({
    status,
    relationshipPlan,
    engineCompatibility,
  });
  const supportedWorkflowScope = determineWorkflowScope({
    status,
    relationshipPlan,
    engineCompatibility,
  });
  const futureExecutionBlockers = collectPlanningBlockers({
    configuration,
    analysisPlan,
    engineCompatibility,
    relationshipPlan,
    explanation,
  });
  const futureExecutionNotes = [
    ...relationshipPlan.readinessNotes,
    `${engineCompatibility.compatibleEngines.length} future engine option${engineCompatibility.compatibleEngines.length === 1 ? "" : "s"} matched this task metadata.`,
    `Explanation readiness is ${explanation?.dynamicReadiness.replace(/_/g, " ") || "missing"}.`,
  ];

  return {
    taskId: task.id,
    taskLabel: task.label,
    taskValidationStatus: configuration?.validationState || "invalid",
    analysisPlanReadiness: analysisPlan?.validationState || "missing",
    relationshipAwareReadiness: relationshipPlan.futureJoinRequirementStatus,
    engineCompatibilitySummary: engineCompatibility,
    explanationReadiness: explanation?.dynamicReadiness || "missing",
    status,
    confidenceLevel,
    supportedWorkflowScope,
    futureExecutionBlockers,
    futureExecutionNotes,
    beginnerSummary: buildBeginnerSummary({ status, confidenceLevel }),
    selectedTask: {
      id: task.id,
      label: task.label,
      category: task.category,
      beginnerFriendly: task.beginnerFriendly,
    },
  };
}
