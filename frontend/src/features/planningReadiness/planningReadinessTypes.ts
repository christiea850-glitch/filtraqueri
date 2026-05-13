import type { AnalysisPlanValidationState } from "../analysisPlan";
import type { EngineCompatibilitySummary } from "../engineAdapters";
import type { BusinessExplanation } from "../explanations";
import type { RelationshipAwareTaskPlan } from "../relationshipAwarePlanning";
import type { AnalyticsTask } from "../tasks";
import type { TaskValidationState } from "../taskConfiguration";

export type PlanningReadinessStatus =
  | "not_ready"
  | "partially_ready"
  | "relationship_dependent"
  | "engine_limited"
  | "ready_for_future_execution"
  | "unsupported";

export type PlanningReadinessConfidence = "low" | "medium" | "high";

export type PlanningWorkflowScope =
  | "single_worksheet"
  | "workbook_relationship_aware"
  | "multi_engine_planning"
  | "unsupported";

export type PlanningReadinessReport = {
  taskId: string;
  taskLabel: string;
  taskValidationStatus: TaskValidationState;
  analysisPlanReadiness: AnalysisPlanValidationState | "missing";
  relationshipAwareReadiness: RelationshipAwareTaskPlan["futureJoinRequirementStatus"];
  engineCompatibilitySummary: EngineCompatibilitySummary;
  explanationReadiness: BusinessExplanation["dynamicReadiness"] | "missing";
  status: PlanningReadinessStatus;
  confidenceLevel: PlanningReadinessConfidence;
  supportedWorkflowScope: PlanningWorkflowScope;
  futureExecutionBlockers: string[];
  futureExecutionNotes: string[];
  beginnerSummary: string;
  selectedTask: Pick<AnalyticsTask, "id" | "label" | "category" | "beginnerFriendly">;
};
