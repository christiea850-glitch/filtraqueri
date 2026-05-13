import type { WorkbookMetadata } from "../workbook";
import type {
  WorkbookJoinPlanPreview,
  WorkbookRelationship,
  WorkbookRelationshipConfidence,
  WorkbookRelationshipStatus,
} from "./workbookRelationshipTypes";
import { buildWorkbookRelationshipRegistry } from "./workbookRelationshipRegistry";

export const listWorkbookRelationships = (workbook: WorkbookMetadata): WorkbookRelationship[] =>
  buildWorkbookRelationshipRegistry(workbook).relationships;

export const listWorkbookJoinPlanPreviews = (
  workbook: WorkbookMetadata,
): WorkbookJoinPlanPreview[] => buildWorkbookRelationshipRegistry(workbook).joinPlanPreviews;

export const listWorkbookRelationshipsByStatus = (
  workbook: WorkbookMetadata,
  status: WorkbookRelationshipStatus,
) => listWorkbookRelationships(workbook).filter((relationship) => relationship.relationshipStatus === status);

export const listWorkbookRelationshipsByConfidence = (
  workbook: WorkbookMetadata,
  confidence: WorkbookRelationshipConfidence,
) =>
  listWorkbookRelationships(workbook).filter(
    (relationship) => relationship.confidenceLevel === confidence,
  );

export const getWorkbookRelationshipById = (workbook: WorkbookMetadata, relationshipId: string) =>
  listWorkbookRelationships(workbook).find((relationship) => relationship.id === relationshipId) || null;
