import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type {
  AcceptedRelationshipContract,
  WorkbookMetadata,
  WorksheetMetadata,
  WorksheetRelationshipCandidate,
} from "../../workbook";

export const RELATIONSHIP_REVIEW_ACTION_LABEL = "Review relationships";
export const RELATIONSHIP_REVIEW_PANEL_TITLE = "Worksheet relationships needed";
export const RELATIONSHIP_REVIEW_PANEL_DESCRIPTION =
  "FiltraQueri understands the question, but cross-table SQL is blocked until these worksheet relationships are confirmed.";
export const RELATIONSHIP_REVIEW_SQL_SAFETY_COPY =
  "FiltraQueri needs confirmed worksheet relationships before it can safely generate cross-table SQL.";

export type SqlRelationshipReviewStatus =
  | "missing"
  | "needs_confirmation"
  | "accepted";

export type SqlRelationshipReviewPair = {
  id: string;
  fromWorksheet: string;
  fromTable: string;
  toWorksheet: string;
  toTable: string;
  status: SqlRelationshipReviewStatus;
  statusLabel: "Missing relationship" | "Needs confirmation" | "Accepted";
  suggestedColumns: {
    fromColumn: string;
    toColumn: string;
    source: "relationship_candidate" | "accepted_relationship";
  } | null;
};

export type SqlRelationshipReviewModel = {
  title: typeof RELATIONSHIP_REVIEW_PANEL_TITLE;
  description: typeof RELATIONSHIP_REVIEW_PANEL_DESCRIPTION;
  safetyCopy: typeof RELATIONSHIP_REVIEW_SQL_SAFETY_COPY;
  actionLabel: typeof RELATIONSHIP_REVIEW_ACTION_LABEL;
  pairs: SqlRelationshipReviewPair[];
  relevantWorksheets: string[];
  noPersistence: true;
  noAcceptance: true;
  noSqlGeneration: true;
  noBackendCall: true;
  noRunQuery: true;
};

const normalizeTable = (value: string): string =>
  value.trim().toLowerCase().replace(/^["'`]+|["'`]+$/g, "");

const pairKey = (fromTable: string, toTable: string): string =>
  [normalizeTable(fromTable), normalizeTable(toTable)].sort().join("::");

const parseRelationshipPair = (value: string): { fromTable: string; toTable: string } | null => {
  const match = value.match(/^\s*(.+?)\s+(?:to|->|↔)\s+(.+?)\s*$/i);
  if (!match?.[1] || !match?.[2]) return null;
  return {
    fromTable: match[1].trim(),
    toTable: match[2].trim(),
  };
};

const worksheetLabel = (worksheet: WorksheetMetadata): string =>
  worksheet.displayName || worksheet.sheetName || worksheet.tableName;

const findWorksheetByTable = (
  workbook: WorkbookMetadata | null | undefined,
  tableName: string,
): WorksheetMetadata | null => {
  const normalized = normalizeTable(tableName);
  return (
    workbook?.worksheets.find(
      (worksheet) =>
        normalizeTable(worksheet.tableName) === normalized ||
        normalizeTable(worksheet.displayName) === normalized ||
        normalizeTable(worksheet.sheetName) === normalized,
    ) || null
  );
};

const isActiveContract = (contract: AcceptedRelationshipContract): boolean =>
  contract.status === "active" && contract.validationState !== "broken";

const contractMatchesPair = (
  contract: AcceptedRelationshipContract,
  fromTable: string,
  toTable: string,
): boolean =>
  pairKey(contract.sourceTableName, contract.targetTableName) === pairKey(fromTable, toTable);

const candidateMatchesPair = (
  candidate: WorksheetRelationshipCandidate,
  fromTable: string,
  toTable: string,
): boolean =>
  pairKey(candidate.sourceTable, candidate.targetTable) === pairKey(fromTable, toTable) &&
  candidate.reviewStatus !== "dismissed";

const orientAcceptedColumns = (
  contract: AcceptedRelationshipContract,
  fromTable: string,
) => {
  if (normalizeTable(contract.sourceTableName) === normalizeTable(fromTable)) {
    return {
      fromColumn: contract.sourceColumnName,
      toColumn: contract.targetColumnName,
      source: "accepted_relationship" as const,
    };
  }

  return {
    fromColumn: contract.targetColumnName,
    toColumn: contract.sourceColumnName,
    source: "accepted_relationship" as const,
  };
};

const orientCandidateColumns = (
  candidate: WorksheetRelationshipCandidate,
  fromTable: string,
) => {
  if (normalizeTable(candidate.sourceTable) === normalizeTable(fromTable)) {
    return {
      fromColumn: candidate.sourceColumn,
      toColumn: candidate.targetColumn,
      source: "relationship_candidate" as const,
    };
  }

  return {
    fromColumn: candidate.targetColumn,
    toColumn: candidate.sourceColumn,
    source: "relationship_candidate" as const,
  };
};

const statusLabelFor = (
  status: SqlRelationshipReviewStatus,
): SqlRelationshipReviewPair["statusLabel"] => {
  if (status === "accepted") return "Accepted";
  if (status === "needs_confirmation") return "Needs confirmation";
  return "Missing relationship";
};

export const createSqlRelationshipReviewModel = ({
  dataset,
  requiredRelationships,
}: {
  dataset: DatasetMetadata | null;
  requiredRelationships: readonly string[];
}): SqlRelationshipReviewModel => {
  const workbook = dataset?.workbook_metadata;
  const seenPairs = new Set<string>();
  const pairs = requiredRelationships
    .map(parseRelationshipPair)
    .filter((pair): pair is { fromTable: string; toTable: string } => Boolean(pair))
    .filter((pair) => {
      const key = pairKey(pair.fromTable, pair.toTable);
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    })
    .map((pair): SqlRelationshipReviewPair => {
      const fromWorksheet = findWorksheetByTable(workbook, pair.fromTable);
      const toWorksheet = findWorksheetByTable(workbook, pair.toTable);
      const accepted =
        workbook?.acceptedRelationshipContracts.find(
          (contract) => isActiveContract(contract) && contractMatchesPair(contract, pair.fromTable, pair.toTable),
        ) || null;
      const candidate =
        workbook?.relationshipCandidates.find((relationshipCandidate) =>
          candidateMatchesPair(relationshipCandidate, pair.fromTable, pair.toTable),
        ) || null;
      const status: SqlRelationshipReviewStatus = accepted
        ? "accepted"
        : candidate
          ? "needs_confirmation"
          : "missing";

      return {
        id: `${normalizeTable(pair.fromTable)}:${normalizeTable(pair.toTable)}`,
        fromWorksheet: fromWorksheet ? worksheetLabel(fromWorksheet) : pair.fromTable,
        fromTable: fromWorksheet?.tableName || pair.fromTable,
        toWorksheet: toWorksheet ? worksheetLabel(toWorksheet) : pair.toTable,
        toTable: toWorksheet?.tableName || pair.toTable,
        status,
        statusLabel: statusLabelFor(status),
        suggestedColumns: accepted
          ? orientAcceptedColumns(accepted, pair.fromTable)
          : candidate
            ? orientCandidateColumns(candidate, pair.fromTable)
            : null,
      };
    });
  const relevantWorksheets = Array.from(
    new Set(pairs.flatMap((pair) => [pair.fromWorksheet, pair.toWorksheet])),
  );

  return {
    title: RELATIONSHIP_REVIEW_PANEL_TITLE,
    description: RELATIONSHIP_REVIEW_PANEL_DESCRIPTION,
    safetyCopy: RELATIONSHIP_REVIEW_SQL_SAFETY_COPY,
    actionLabel: RELATIONSHIP_REVIEW_ACTION_LABEL,
    pairs,
    relevantWorksheets,
    noPersistence: true,
    noAcceptance: true,
    noSqlGeneration: true,
    noBackendCall: true,
    noRunQuery: true,
  };
};
