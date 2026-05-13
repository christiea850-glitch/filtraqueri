import type { WorkbookMetadata } from "../workbook";
import type {
  WorkbookRelationship,
  WorkbookRelationshipRegistry,
} from "./workbookRelationshipTypes";
import {
  mapCandidateToWorkbookRelationship,
  mapContractToWorkbookRelationship,
} from "./workbookRelationshipCandidates";
import { buildWorkbookJoinPlanPreviews } from "./workbookJoinPlanPreview";

const dedupeRelationships = (relationships: WorkbookRelationship[]) => {
  const seen = new Set<string>();
  return relationships.filter((relationship) => {
    const key = [
      relationship.sourceWorksheetId,
      relationship.targetWorksheetId,
      relationship.candidateKeys[0]?.sourceColumn,
      relationship.candidateKeys[0]?.targetColumn,
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildWorkbookRelationshipRegistry = (
  workbook: WorkbookMetadata,
): WorkbookRelationshipRegistry => {
  const acceptedRelationships = workbook.acceptedRelationshipContracts.map((contract) =>
    mapContractToWorkbookRelationship(contract, workbook),
  );
  const acceptedCandidateIds = new Set(
    acceptedRelationships
      .map((relationship) => relationship.sourceCandidateId)
      .filter((candidateId): candidateId is string => Boolean(candidateId)),
  );
  const inferredRelationships = workbook.relationshipCandidates
    .filter((candidate) => !acceptedCandidateIds.has(candidate.relationshipId))
    .map(mapCandidateToWorkbookRelationship);
  const relationships = dedupeRelationships([...acceptedRelationships, ...inferredRelationships]);

  return {
    workbookId: workbook.workbookId,
    relationships,
    joinPlanPreviews: buildWorkbookJoinPlanPreviews(relationships),
    sourceWorkbook: workbook,
  };
};
