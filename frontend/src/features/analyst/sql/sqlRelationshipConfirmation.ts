import type { SchemaColumn } from "../../dataset/datasetTypes";

export type SqlRelationshipConfirmationStatus =
  | "suggested"
  | "needs_review"
  | "confirmed"
  | "rejected";

export type SqlRelationshipConfirmationScope = "tab" | "workbook" | "dataset";

export type SqlRelationshipConfirmationSource =
  | "user_confirmed"
  | "imported"
  | "inferred_then_confirmed";

export type SqlRelationshipEndpoint = {
  worksheetId: string;
  worksheetLabel: string;
  tableName: string;
  column: string;
};

export type SqlRelationshipConfirmationSafetyFlags = {
  schemaBackedColumns: true;
  noSqlGeneratedOnConfirm: true;
  noRunQueryOnConfirm: true;
  noBackendCallOnConfirm: true;
  userCanRemove: true;
  invalidatedWhenWorksheetMissing: true;
};

export type SqlRelationshipInvalidationReason =
  | "dataset_changed"
  | "workbook_changed"
  | "worksheet_missing"
  | "table_missing"
  | "column_missing"
  | "schema_mismatch";

export type SqlConfirmedWorksheetRelationship = SqlRelationshipConfirmationSafetyFlags & {
  relationshipId: string;
  fromWorksheetId: string;
  fromWorksheetLabel: string;
  fromTableName: string;
  fromColumn: string;
  toWorksheetId: string;
  toWorksheetLabel: string;
  toTableName: string;
  toColumn: string;
  cardinality?: "one_to_one" | "one_to_many" | "many_to_one" | "unknown";
  confidence?: number;
  status: "confirmed" | "rejected";
  confirmedAt?: string;
  rejectedAt?: string;
  confirmedByUser: true;
  scope: SqlRelationshipConfirmationScope;
  source: SqlRelationshipConfirmationSource;
  acceptedFromCandidateId?: string | null;
  workbookId?: string | null;
  datasetId?: string | null;
};

export type SqlRelationshipConfirmationState = {
  confirmedRelationships: SqlConfirmedWorksheetRelationship[];
  rejectedSuggestions: SqlConfirmedWorksheetRelationship[];
  invalidatedRelationshipIds: Record<string, SqlRelationshipInvalidationReason>;
};

export const SQL_RELATIONSHIP_CONFIRMATION_SAFETY_FLAGS: SqlRelationshipConfirmationSafetyFlags = {
  schemaBackedColumns: true,
  noSqlGeneratedOnConfirm: true,
  noRunQueryOnConfirm: true,
  noBackendCallOnConfirm: true,
  userCanRemove: true,
  invalidatedWhenWorksheetMissing: true,
};

const normalizeIdPart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";

const columnNames = (columns: readonly (string | Pick<SchemaColumn, "name">)[]): string[] =>
  columns.map((column) => (typeof column === "string" ? column : column.name));

const hasColumn = (
  columns: readonly (string | Pick<SchemaColumn, "name">)[],
  columnName: string,
): boolean => {
  const normalizedColumn = normalizeIdPart(columnName);
  return columnNames(columns).some((column) => normalizeIdPart(column) === normalizedColumn);
};

export const createSqlRelationshipId = (
  from: Pick<SqlRelationshipEndpoint, "worksheetId" | "tableName" | "column">,
  to: Pick<SqlRelationshipEndpoint, "worksheetId" | "tableName" | "column">,
): string => {
  const left = [
    normalizeIdPart(from.worksheetId),
    normalizeIdPart(from.tableName),
    normalizeIdPart(from.column),
  ].join(":");
  const right = [
    normalizeIdPart(to.worksheetId),
    normalizeIdPart(to.tableName),
    normalizeIdPart(to.column),
  ].join(":");

  return `sql-relationship:${[left, right].sort().join("::")}`;
};

export const isSqlConfirmedRelationshipActive = (
  relationship: Pick<SqlConfirmedWorksheetRelationship, "status">,
): boolean => relationship.status === "confirmed";

export const isSqlRelationshipSchemaBacked = ({
  fromColumn,
  fromColumns,
  toColumn,
  toColumns,
}: {
  fromColumn: string;
  fromColumns: readonly (string | Pick<SchemaColumn, "name">)[];
  toColumn: string;
  toColumns: readonly (string | Pick<SchemaColumn, "name">)[];
}): boolean => hasColumn(fromColumns, fromColumn) && hasColumn(toColumns, toColumn);

export const createEmptySqlRelationshipConfirmationState =
  (): SqlRelationshipConfirmationState => ({
    confirmedRelationships: [],
    rejectedSuggestions: [],
    invalidatedRelationshipIds: {},
  });
