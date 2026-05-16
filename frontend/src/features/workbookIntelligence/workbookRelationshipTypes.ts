import type { WorkbookId, WorksheetId } from "../workbook";

export type WorkbookEntityRole =
  | "customers"
  | "orders"
  | "invoices"
  | "products"
  | "employees"
  | "managers"
  | "transactions"
  | "inventory"
  | "payments"
  | "regions"
  | "unknown";

export type WorkbookRelationshipConfidence = "high" | "medium" | "low";

export type WorkbookComplexityLevel = "simple" | "moderate" | "complex";

export type InferredWorkbookRelationshipType =
  | "lookup"
  | "transaction_detail"
  | "reference"
  | "same_entity"
  | "unknown";

export type WorkbookEntityRoleSummary = {
  worksheetId: WorksheetId;
  worksheetName: string;
  role: WorkbookEntityRole;
  confidence: WorkbookRelationshipConfidence;
  reasons: string[];
  recommendedStart: boolean;
};

export type WorkbookRelationshipEvidence = {
  normalizedNameMatch: boolean;
  nameSimilarity: number;
  uniquenessSimilarity: number;
  overlapRatio: number;
  idPatternMatch: boolean;
  rowCoverageConsistency: number;
  typeCompatible: boolean;
  reasons: string[];
};

export type WorkbookRelationshipJoinSuggestion = {
  id: string;
  sourceWorksheetId: WorksheetId;
  sourceWorksheetName: string;
  sourceColumn: string;
  targetWorksheetId: WorksheetId;
  targetWorksheetName: string;
  targetColumn: string;
  confidenceScore: number;
  confidence: WorkbookRelationshipConfidence;
  relationshipType: InferredWorkbookRelationshipType;
  guidance: string;
  evidence: WorkbookRelationshipEvidence;
};

export type WorkbookGraphNode = {
  id: WorksheetId;
  label: string;
  role: WorkbookEntityRole;
  rowCount: number;
  columnCount: number;
};

export type WorkbookGraphEdge = {
  id: string;
  source: WorksheetId;
  target: WorksheetId;
  confidence: WorkbookRelationshipConfidence;
  relationshipType: InferredWorkbookRelationshipType;
  sourceColumn: string;
  targetColumn: string;
  label: string;
};

export type WorkbookRelationshipGraphMetadata = {
  nodes: WorkbookGraphNode[];
  edges: WorkbookGraphEdge[];
};

export type WorkbookRelationshipIntelligence = {
  workbookId: WorkbookId;
  workbookName: string;
  worksheetCount: number;
  complexity: WorkbookComplexityLevel;
  recommendedStartingWorksheetId: WorksheetId | null;
  recommendedStartingWorksheetName: string | null;
  entityRoles: WorkbookEntityRoleSummary[];
  joinSuggestions: WorkbookRelationshipJoinSuggestion[];
  graph: WorkbookRelationshipGraphMetadata;
  humanSummary: string;
};
