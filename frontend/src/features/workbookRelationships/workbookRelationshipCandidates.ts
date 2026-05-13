import type { AnalyticsTaskCategory } from "../tasks";
import type {
  AcceptedRelationshipContract,
  WorkbookMetadata,
  WorksheetRelationshipCandidate,
} from "../workbook";
import type {
  WorkbookRelationship,
  WorkbookRelationshipConfidence,
  WorkbookRelationshipType,
} from "./workbookRelationshipTypes";

const relationshipTypeMap: Record<
  WorksheetRelationshipCandidate["relationshipType"],
  WorkbookRelationshipType
> = {
  one_to_one_candidate: "one_to_one",
  one_to_many_candidate: "one_to_many",
  many_to_one_candidate: "many_to_one",
  unknown_candidate: "unknown",
};

const confidenceFromScore = (score: number): WorkbookRelationshipConfidence => {
  if (score >= 0.75) return "high";
  if (score >= 0.52) return "medium";
  return "low";
};

const findWorksheetName = (workbook: WorkbookMetadata, worksheetId: string, fallback: string) =>
  workbook.worksheets.find((worksheet) => worksheet.worksheetId === worksheetId)?.displayName || fallback;

const relationshipAnalysisTypes = (
  sourceSheet: string,
  targetSheet: string,
  sourceColumn: string,
  targetColumn: string,
): AnalyticsTaskCategory[] => {
  const normalized = `${sourceSheet} ${targetSheet} ${sourceColumn} ${targetColumn}`.toLowerCase();
  const categories = new Set<AnalyticsTaskCategory>(["sales_analysis", "operational_intelligence"]);

  if (normalized.includes("customer") || normalized.includes("client") || normalized.includes("account")) {
    categories.add("customer_analytics");
  }
  if (normalized.includes("product") || normalized.includes("sale") || normalized.includes("order")) {
    categories.add("sales_analysis");
  }
  if (normalized.includes("department") || normalized.includes("employee") || normalized.includes("team")) {
    categories.add("workforce_analytics");
  }
  if (normalized.includes("profit") || normalized.includes("revenue") || normalized.includes("cost")) {
    categories.add("financial_analysis");
  }
  if (normalized.includes("date") || normalized.includes("month") || normalized.includes("year")) {
    categories.add("forecasting");
  }

  return Array.from(categories);
};

export const mapCandidateToWorkbookRelationship = (
  candidate: WorksheetRelationshipCandidate,
): WorkbookRelationship => ({
  id: `relationship:${candidate.relationshipId}`,
  sourceSheet: candidate.sourceWorksheetName,
  sourceWorksheetId: candidate.sourceWorksheetId,
  sourceTable: candidate.sourceTable,
  targetSheet: candidate.targetWorksheetName,
  targetWorksheetId: candidate.targetWorksheetId,
  targetTable: candidate.targetTable,
  relationshipType: relationshipTypeMap[candidate.relationshipType],
  candidateKeys: [
    {
      sourceColumn: candidate.sourceColumn,
      targetColumn: candidate.targetColumn,
      evidenceSummary: candidate.evidence.summaries,
    },
  ],
  confidenceLevel: candidate.confidenceLabel,
  relationshipStatus:
    candidate.reviewStatus === "accepted"
      ? "user_confirmed"
      : candidate.reviewStatus === "dismissed"
        ? "unsupported"
        : "inferred",
  supportedAnalysisTypes: relationshipAnalysisTypes(
    candidate.sourceWorksheetName,
    candidate.targetWorksheetName,
    candidate.sourceColumn,
    candidate.targetColumn,
  ),
  sourceCandidateId: candidate.relationshipId,
  sourceContractId: null,
});

export const mapContractToWorkbookRelationship = (
  contract: AcceptedRelationshipContract,
  workbook: WorkbookMetadata,
): WorkbookRelationship => {
  const sourceSheet = findWorksheetName(workbook, contract.sourceWorksheetId, "Source worksheet");
  const targetSheet = findWorksheetName(workbook, contract.targetWorksheetId, "Target worksheet");

  return {
    id: `accepted-relationship:${contract.contractId}`,
    sourceSheet,
    sourceWorksheetId: contract.sourceWorksheetId,
    sourceTable: contract.sourceTableName,
    targetSheet,
    targetWorksheetId: contract.targetWorksheetId,
    targetTable: contract.targetTableName,
    relationshipType: relationshipTypeMap[contract.relationshipType],
    candidateKeys: [
      {
        sourceColumn: contract.sourceColumnName,
        targetColumn: contract.targetColumnName,
        evidenceSummary: contract.validationSummary,
      },
    ],
    confidenceLevel: confidenceFromScore(contract.confidence),
    relationshipStatus:
      contract.status === "active" && contract.validationState !== "broken"
        ? "user_confirmed"
        : contract.validationState === "broken"
          ? "unsupported"
          : "unresolved",
    supportedAnalysisTypes: relationshipAnalysisTypes(
      sourceSheet,
      targetSheet,
      contract.sourceColumnName,
      contract.targetColumnName,
    ),
    sourceCandidateId: contract.acceptedFromCandidateId || null,
    sourceContractId: contract.contractId,
  };
};
