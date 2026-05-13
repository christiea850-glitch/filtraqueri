import type { AnalyticsTaskCategory } from "../tasks";
import type {
  WorkbookJoinPlanPreview,
  WorkbookRelationshipConfidence,
} from "../workbookRelationships";

export type RelationshipJoinRequirementStatus =
  | "not_required"
  | "may_help"
  | "likely_required"
  | "unsupported";

export type RelationshipAwareTaskPlan = {
  taskId: string;
  hasWorkbookContext: boolean;
  matchingJoinPreviews: WorkbookJoinPlanPreview[];
  relatedWorksheets: string[];
  suggestedRelationshipPaths: string[][];
  highestConfidence: WorkbookRelationshipConfidence | null;
  supportedTaskCategories: AnalyticsTaskCategory[];
  futureJoinRequirementStatus: RelationshipJoinRequirementStatus;
  readinessNotes: string[];
  metadataAwareExplanation: string | null;
};
