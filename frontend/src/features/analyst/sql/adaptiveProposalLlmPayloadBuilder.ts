import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type {
  AcceptedRelationshipContract,
  WorksheetMetadata,
} from "../../workbook";
import { classifySensitiveColumn } from "../llm/llmSensitiveColumnClassifier";
import type { AdaptiveReportProposal } from "./adaptiveReportProposal";
import {
  inferSemanticTableHints,
  type SemanticColumnHint,
} from "./semanticHintRegistry";
import type {
  AdaptiveProposalLlmPayload,
  AdaptiveProposalLlmPayloadProvenance,
  SanitizedAcceptedRelationship,
  SanitizedAdaptiveColumnMetadata,
  SanitizedAdaptiveTableMetadata,
  SanitizedSemanticHint,
} from "./adaptiveProposalLlmContract";

export type AdaptiveProposalLlmPayloadWorksheet = Pick<
  WorksheetMetadata,
  "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema" | "rowCount" | "columnCount"
>;

export type BuildAdaptiveProposalLlmPayloadInput = {
  proposal: AdaptiveReportProposal;
  worksheets: readonly AdaptiveProposalLlmPayloadWorksheet[];
  acceptedRelationshipContracts?: readonly AcceptedRelationshipContract[];
  selectedGuidanceDialect?: SqlDialectId;
};

const PAYLOAD_PROVENANCE: AdaptiveProposalLlmPayloadProvenance = {
  source: "adaptive_proposal_metadata_only",
  rawRowsIncluded: false,
  sampleValuesIncluded: false,
  topValuesIncluded: false,
  sqlIncluded: false,
  promptTextIncluded: false,
  providerCallMade: false,
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactId = (value: string): string =>
  normalize(value).replace(/\s+/g, "-") || "unknown";

const semanticKey = (tableName: string, columnName: string): string =>
  `${normalize(tableName)}:${normalize(columnName)}`;

const isSensitiveOrRestricted = (
  level: SanitizedAdaptiveColumnMetadata["sensitivity"]["level"],
): boolean => level === "sensitive" || level === "restricted";

const sanitizeColumn = ({
  column,
  worksheet,
  index,
}: {
  column: SchemaColumn;
  worksheet: AdaptiveProposalLlmPayloadWorksheet;
  index: number;
}): SanitizedAdaptiveColumnMetadata => {
  const sensitivity = classifySensitiveColumn({
    column,
    worksheetName: worksheet.displayName || worksheet.sheetName,
    trustedTableName: worksheet.tableName,
  });
  const redactedColumnId = `redacted_column_${index + 1}`;

  if (sensitivity.level === "restricted") {
    return {
      id: `${compactId(worksheet.tableName)}:${redactedColumnId}`,
      columnName: null,
      redactedColumnId,
      inferredType: column.inferred_type,
      nullCount: column.null_count,
      uniqueCount: column.unique_count,
      sensitivity: {
        category: sensitivity.category,
        level: sensitivity.level,
        reasons: sensitivity.reasons,
      },
      redaction: "excluded_restricted",
    };
  }

  if (sensitivity.level === "sensitive") {
    return {
      id: `${compactId(worksheet.tableName)}:${redactedColumnId}`,
      columnName: null,
      redactedColumnId,
      inferredType: column.inferred_type,
      nullCount: column.null_count,
      uniqueCount: column.unique_count,
      sensitivity: {
        category: sensitivity.category,
        level: sensitivity.level,
        reasons: sensitivity.reasons,
      },
      redaction: "redacted_sensitive",
    };
  }

  return {
    id: `${compactId(worksheet.tableName)}:${compactId(column.name)}`,
    columnName: column.name,
    redactedColumnId: null,
    inferredType: column.inferred_type,
    nullCount: column.null_count,
    uniqueCount: column.unique_count,
    sensitivity: {
      category: sensitivity.category,
      level: sensitivity.level,
      reasons: sensitivity.reasons,
    },
    redaction: "included",
  };
};

const sanitizeTable = (
  worksheet: AdaptiveProposalLlmPayloadWorksheet,
): SanitizedAdaptiveTableMetadata => {
  const columns = worksheet.schema.map((column, index) =>
    sanitizeColumn({ column, worksheet, index }),
  );

  return {
    worksheetId: worksheet.worksheetId,
    displayName: worksheet.displayName || worksheet.sheetName,
    tableName: worksheet.tableName,
    redactedTableId: null,
    rowCount: worksheet.rowCount,
    columnCount: worksheet.columnCount,
    columns: columns.filter((column) => column.redaction !== "excluded_restricted"),
  };
};

const sanitizeSemanticHints = (
  hints: readonly SemanticColumnHint[],
  tables: readonly SanitizedAdaptiveTableMetadata[],
): SanitizedSemanticHint[] => {
  const tableColumns = new Map<string, SanitizedAdaptiveColumnMetadata>();
  for (const table of tables) {
    if (!table.tableName) continue;
    for (const column of table.columns) {
      const keyName = column.columnName || column.redactedColumnId || "";
      if (keyName) tableColumns.set(semanticKey(table.tableName, keyName), column);
    }
  }

  return hints
    .map((hint): SanitizedSemanticHint | null => {
      const exact = tableColumns.get(semanticKey(hint.tableName, hint.columnName));
      if (!exact) return null;
      if (exact.redaction === "excluded_restricted") return null;
      return {
        id: hint.id,
        tableName: hint.tableName,
        columnName: exact.redaction === "included" ? hint.columnName : null,
        redactedColumnId: exact.redaction === "included" ? null : exact.redactedColumnId,
        primaryRole: hint.primaryRole,
        roles: hint.roles,
        confidence: hint.confidence,
        reasons: hint.reasons,
      };
    })
    .filter((hint): hint is SanitizedSemanticHint => Boolean(hint));
};

const sanitizeRelationshipColumn = (
  tableName: string,
  columnName: string,
  tables: readonly SanitizedAdaptiveTableMetadata[],
): string | null => {
  const table = tables.find((candidate) => normalize(candidate.tableName || "") === normalize(tableName));
  const column = table?.columns.find(
    (candidate) => candidate.columnName && normalize(candidate.columnName) === normalize(columnName),
  );
  return column?.columnName || null;
};

const sanitizeRelationship = (
  contract: AcceptedRelationshipContract,
  tables: readonly SanitizedAdaptiveTableMetadata[],
): SanitizedAcceptedRelationship => ({
  contractId: contract.contractId,
  sourceTableName: contract.sourceTableName,
  sourceColumnName: sanitizeRelationshipColumn(
    contract.sourceTableName,
    contract.sourceColumnName,
    tables,
  ),
  targetTableName: contract.targetTableName,
  targetColumnName: sanitizeRelationshipColumn(
    contract.targetTableName,
    contract.targetColumnName,
    tables,
  ),
  relationshipType: contract.relationshipType,
  confidence: contract.confidence,
  status: contract.status,
  validationState: contract.validationState,
});

export const buildAdaptiveProposalLlmPayload = ({
  proposal,
  worksheets,
  acceptedRelationshipContracts = [],
  selectedGuidanceDialect,
}: BuildAdaptiveProposalLlmPayloadInput): AdaptiveProposalLlmPayload => {
  const tables = worksheets.map(sanitizeTable);
  const allColumns = worksheets.flatMap((worksheet) =>
    worksheet.schema.map((column, index) => sanitizeColumn({ column, worksheet, index })),
  );
  const restrictedColumnCount = allColumns.filter(
    (column) => column.sensitivity.level === "restricted",
  ).length;
  const sensitiveColumnCount = allColumns.filter(
    (column) => column.sensitivity.level === "sensitive",
  ).length;
  const redactedColumnCount = allColumns.filter(
    (column) => column.redaction === "redacted_sensitive",
  ).length;
  const excludedColumnCount = allColumns.filter(
    (column) => column.redaction === "excluded_restricted",
  ).length;
  const semanticHints = sanitizeSemanticHints(
    inferSemanticTableHints({
      tables: worksheets.map((worksheet) => ({
        worksheetId: worksheet.worksheetId,
        displayName: worksheet.displayName,
        sheetName: worksheet.sheetName,
        tableName: worksheet.tableName,
        schema: worksheet.schema,
      })),
      acceptedRelationshipContracts,
    }).columns,
    tables,
  );
  const relationships = acceptedRelationshipContracts.map((contract) =>
    sanitizeRelationship(contract, tables),
  );

  return {
    schemaVersion: "adaptive-proposal-llm:v1",
    provenance: PAYLOAD_PROVENANCE,
    selectedGuidanceDialect,
    detectedIntent: proposal.detectedIntent,
    proposal: {
      title: "Adaptive proposal planning outline",
      support: proposal.support,
      confidence: proposal.confidence,
      entities: proposal.entities,
      metrics: proposal.metrics,
      groupings: proposal.groupings,
      filters: proposal.filters,
      joinNeeds: proposal.joinNeeds,
      assumptions: proposal.assumptions,
      missingRequirements: proposal.missingRequirements,
      warnings: proposal.warnings,
      payloadFingerprint: proposal.payloadFingerprint,
      narrative: proposal.proposalNarrative,
    },
    tables,
    semanticHints,
    relationships,
    governance: {
      providerStatus: "closed",
      providerMode: "provider_disabled",
      consentStatus: "not_requested",
      restrictedColumnCount,
      sensitiveColumnCount,
      redactedColumnCount,
      excludedColumnCount,
      blockingReasons:
        restrictedColumnCount > 0
          ? ["Restricted columns were excluded and keep future provider calls closed."]
          : ["Provider remains disabled for this foundation slice."],
      notes: [
        "Metadata-only adaptive proposal payload; no raw rows, sample values, top values, SQL, prompt text, or provider calls.",
        "Sensitive columns are redacted; restricted columns are excluded.",
      ],
    },
  };
};

export const summarizeAdaptiveProposalLlmPayload = (
  payload: AdaptiveProposalLlmPayload,
): string => {
  const columnCount = payload.tables.reduce((sum, table) => sum + table.columns.length, 0);
  const redactedCount = payload.tables.reduce(
    (sum, table) =>
      sum + table.columns.filter((column) => isSensitiveOrRestricted(column.sensitivity.level)).length,
    0,
  );
  return `${payload.tables.length} table(s), ${columnCount} metadata column(s), ${redactedCount} sensitive/restricted column marker(s), provider ${payload.governance.providerStatus}.`;
};
