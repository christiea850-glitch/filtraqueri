import type { AnalyticsTaskCategory } from "../tasks";
import type {
  AcceptedRelationshipContract,
  WorkbookMetadata,
  WorksheetRelationshipCandidate,
} from "../workbook";

export type WorkbookRelationshipType =
  | "one_to_one"
  | "one_to_many"
  | "many_to_one"
  | "many_to_many"
  | "unknown";

export type WorkbookRelationshipStatus =
  | "inferred"
  | "user_confirmed"
  | "unresolved"
  | "unsupported";

export type WorkbookRelationshipConfidence = "low" | "medium" | "high";

export type WorkbookRelationshipKeyPair = {
  sourceColumn: string;
  targetColumn: string;
  evidenceSummary: string[];
};

export type WorkbookRelationship = {
  id: string;
  sourceSheet: string;
  sourceWorksheetId: string;
  sourceTable: string;
  targetSheet: string;
  targetWorksheetId: string;
  targetTable: string;
  relationshipType: WorkbookRelationshipType;
  candidateKeys: WorkbookRelationshipKeyPair[];
  confidenceLevel: WorkbookRelationshipConfidence;
  relationshipStatus: WorkbookRelationshipStatus;
  supportedAnalysisTypes: AnalyticsTaskCategory[];
  sourceCandidateId: string | null;
  sourceContractId: string | null;
};

export type WorkbookJoinPlanPreview = {
  id: string;
  relatedSheets: string[];
  suggestedRelationshipPath: string[];
  expectedJoinBehavior: string;
  supportedTaskCategories: AnalyticsTaskCategory[];
  futureExecutionNotes: string[];
  relationshipIds: string[];
};

export type WorkbookRelationshipRegistry = {
  workbookId: string;
  relationships: WorkbookRelationship[];
  joinPlanPreviews: WorkbookJoinPlanPreview[];
  sourceWorkbook: WorkbookMetadata;
};

export type WorkbookRelationshipCandidateSource =
  | WorksheetRelationshipCandidate
  | AcceptedRelationshipContract;
