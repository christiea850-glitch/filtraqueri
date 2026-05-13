import type { EngineAdapter } from "../engineAdapters";
import type { GuidedInputSelection } from "../guidedInputs";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkbookJoinPlanPreview } from "../workbookRelationships";

export type TaskPlanPreviewConfidence = "low" | "moderate" | "high";

export type TaskPlanPreviewSection = {
  id: string;
  title: string;
  lines: string[];
};

export type TaskPlanPreview = {
  id: string;
  taskId: string;
  workflowSummary: string;
  selectedInputsSummary: string[];
  expectedFutureWorkflowBehavior: string[];
  workbookRelationshipUsage: string[];
  futureEnginePath: string[];
  futureExplanationReadiness: string[];
  safetyNotes: string[];
  confidence: TaskPlanPreviewConfidence;
  sections: TaskPlanPreviewSection[];
  sourceMetadata: {
    selectedInputs: GuidedInputSelection[];
    recommendedEngine: EngineAdapter | null;
    relationshipPreviews: WorkbookJoinPlanPreview[];
    planningStatus: PlanningReadinessReport["status"];
  };
};
