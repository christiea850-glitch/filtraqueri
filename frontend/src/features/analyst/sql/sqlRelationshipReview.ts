import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type {
  AcceptedRelationshipContract,
  WorkbookMetadata,
  WorksheetMetadata,
  WorksheetRelationshipCandidate,
} from "../../workbook";

export const RELATIONSHIP_REVIEW_ACTION_LABEL = "Review worksheet connections";
export const RELATIONSHIP_REVIEW_PANEL_TITLE = "Review worksheet connections";
export const RELATIONSHIP_REVIEW_STEP_TITLE = "Step 3 - Review worksheet connections";
export const RELATIONSHIP_REVIEW_PANEL_DESCRIPTION =
  "This question uses more than one worksheet. FiltraQueri needs to know how the worksheets connect - which columns link rows across worksheets - before it can prepare SQL safely.";
export const RELATIONSHIP_REVIEW_SQL_SAFETY_COPY =
  "Confirming a connection is for this review only. It does not run SQL, insert SQL, or permanently change workbook metadata.";

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
  statusLabel: "Needs review" | "Suggested match" | "Confirmed";
  suggestedColumns: {
    fromColumn: string;
    toColumn: string;
    source: "relationship_candidate" | "accepted_relationship";
  } | null;
  suggestion: {
    candidateId: string;
    fromWorksheetId: string;
    fromWorksheetLabel: string;
    fromColumns: string[];
    toWorksheetId: string;
    toWorksheetLabel: string;
    toColumns: string[];
    cardinality: "one_to_one" | "one_to_many" | "many_to_one" | "unknown";
    confidence: number;
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

const relationshipTypeToCardinality = (
  relationshipType: WorksheetRelationshipCandidate["relationshipType"],
): "one_to_one" | "one_to_many" | "many_to_one" | "unknown" => {
  if (relationshipType === "one_to_one_candidate") return "one_to_one";
  if (relationshipType === "one_to_many_candidate") return "one_to_many";
  if (relationshipType === "many_to_one_candidate") return "many_to_one";
  return "unknown";
};

const columnNamesForWorksheet = (worksheet: WorksheetMetadata | null): string[] =>
  worksheet?.schema.map((column) => column.name) || [];

const statusLabelFor = (
  status: SqlRelationshipReviewStatus,
): SqlRelationshipReviewPair["statusLabel"] => {
  if (status === "accepted") return "Confirmed";
  if (status === "needs_confirmation") return "Suggested match";
  return "Needs review";
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
        suggestion:
          candidate && fromWorksheet && toWorksheet
            ? {
                candidateId: candidate.relationshipId,
                fromWorksheetId: fromWorksheet.worksheetId,
                fromWorksheetLabel: worksheetLabel(fromWorksheet),
                fromColumns: columnNamesForWorksheet(fromWorksheet),
                toWorksheetId: toWorksheet.worksheetId,
                toWorksheetLabel: worksheetLabel(toWorksheet),
                toColumns: columnNamesForWorksheet(toWorksheet),
                cardinality: relationshipTypeToCardinality(candidate.relationshipType),
                confidence: candidate.confidence,
              }
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
