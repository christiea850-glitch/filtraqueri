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

export type SqlRelationshipConfirmationWorksheetContext = {
  worksheetId: string;
  tableName: string;
  columns: readonly (string | Pick<SchemaColumn, "name">)[];
};

export type SqlRelationshipConfirmationInvalidationContext = {
  datasetId?: string | null;
  workbookId?: string | null;
  worksheets?: readonly SqlRelationshipConfirmationWorksheetContext[];
};

export type CreateSqlConfirmedRelationshipFromSuggestionInput = {
  from: SqlRelationshipEndpoint;
  fromColumns: readonly (string | Pick<SchemaColumn, "name">)[];
  to: SqlRelationshipEndpoint;
  toColumns: readonly (string | Pick<SchemaColumn, "name">)[];
  scope: SqlRelationshipConfirmationScope;
  source: SqlRelationshipConfirmationSource;
  status?: "confirmed" | "rejected";
  confirmedAt?: string;
  rejectedAt?: string;
  cardinality?: SqlConfirmedWorksheetRelationship["cardinality"];
  confidence?: number;
  acceptedFromCandidateId?: string | null;
  workbookId?: string | null;
  datasetId?: string | null;
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

const withoutRelationship = (
  relationships: readonly SqlConfirmedWorksheetRelationship[],
  relationshipId: string,
): SqlConfirmedWorksheetRelationship[] =>
  relationships.filter((relationship) => relationship.relationshipId !== relationshipId);

const upsertRelationship = (
  relationships: readonly SqlConfirmedWorksheetRelationship[],
  relationship: SqlConfirmedWorksheetRelationship,
): SqlConfirmedWorksheetRelationship[] => [
  ...withoutRelationship(relationships, relationship.relationshipId),
  relationship,
];

const withoutInvalidation = (
  invalidatedRelationshipIds: Record<string, SqlRelationshipInvalidationReason>,
  relationshipId: string,
): Record<string, SqlRelationshipInvalidationReason> => {
  const { [relationshipId]: _removed, ...rest } = invalidatedRelationshipIds;
  return rest;
};

export const addSqlConfirmedRelationship = (
  state: SqlRelationshipConfirmationState,
  relationship: SqlConfirmedWorksheetRelationship,
): SqlRelationshipConfirmationState => {
  if (relationship.status !== "confirmed" || !relationship.schemaBackedColumns) return state;

  return {
    confirmedRelationships: upsertRelationship(state.confirmedRelationships, relationship),
    rejectedSuggestions: withoutRelationship(state.rejectedSuggestions, relationship.relationshipId),
    invalidatedRelationshipIds: withoutInvalidation(
      state.invalidatedRelationshipIds,
      relationship.relationshipId,
    ),
  };
};

export const rejectSqlRelationshipSuggestion = (
  state: SqlRelationshipConfirmationState,
  rejectedRelationship: SqlConfirmedWorksheetRelationship,
): SqlRelationshipConfirmationState => {
  const relationship: SqlConfirmedWorksheetRelationship = {
    ...rejectedRelationship,
    status: "rejected",
    confirmedAt: undefined,
  };

  return {
    confirmedRelationships: withoutRelationship(
      state.confirmedRelationships,
      relationship.relationshipId,
    ),
    rejectedSuggestions: upsertRelationship(state.rejectedSuggestions, relationship),
    invalidatedRelationshipIds: withoutInvalidation(
      state.invalidatedRelationshipIds,
      relationship.relationshipId,
    ),
  };
};

export const removeSqlConfirmedRelationship = (
  state: SqlRelationshipConfirmationState,
  relationshipId: string,
): SqlRelationshipConfirmationState => ({
  confirmedRelationships: withoutRelationship(state.confirmedRelationships, relationshipId),
  rejectedSuggestions: state.rejectedSuggestions,
  invalidatedRelationshipIds: withoutInvalidation(state.invalidatedRelationshipIds, relationshipId),
});

export const clearSqlRelationshipConfirmationState = (
  _state: SqlRelationshipConfirmationState,
): SqlRelationshipConfirmationState => createEmptySqlRelationshipConfirmationState();

const worksheetFor = (
  context: SqlRelationshipConfirmationInvalidationContext,
  worksheetId: string,
): SqlRelationshipConfirmationWorksheetContext | null =>
  context.worksheets?.find((worksheet) => worksheet.worksheetId === worksheetId) || null;

const invalidationReasonFor = (
  relationship: SqlConfirmedWorksheetRelationship,
  context: SqlRelationshipConfirmationInvalidationContext,
): SqlRelationshipInvalidationReason | null => {
  if (
    context.datasetId !== undefined &&
    relationship.datasetId &&
    context.datasetId !== relationship.datasetId
  ) {
    return "dataset_changed";
  }
  if (
    context.workbookId !== undefined &&
    relationship.workbookId &&
    context.workbookId !== relationship.workbookId
  ) {
    return "workbook_changed";
  }
  if (!context.worksheets) return null;

  const fromWorksheet = worksheetFor(context, relationship.fromWorksheetId);
  const toWorksheet = worksheetFor(context, relationship.toWorksheetId);
  if (!fromWorksheet || !toWorksheet) return "worksheet_missing";
  if (
    normalizeIdPart(fromWorksheet.tableName) !== normalizeIdPart(relationship.fromTableName) ||
    normalizeIdPart(toWorksheet.tableName) !== normalizeIdPart(relationship.toTableName)
  ) {
    return "table_missing";
  }
  if (
    !hasColumn(fromWorksheet.columns, relationship.fromColumn) ||
    !hasColumn(toWorksheet.columns, relationship.toColumn)
  ) {
    return "column_missing";
  }

  return null;
};

export const invalidateSqlRelationshipConfirmations = (
  state: SqlRelationshipConfirmationState,
  context: SqlRelationshipConfirmationInvalidationContext,
): SqlRelationshipConfirmationState => {
  const invalidatedRelationshipIds = {
    ...state.invalidatedRelationshipIds,
  };

  for (const relationship of [
    ...state.confirmedRelationships,
    ...state.rejectedSuggestions,
  ]) {
    const reason = invalidationReasonFor(relationship, context);
    if (reason) invalidatedRelationshipIds[relationship.relationshipId] = reason;
  }

  return {
    ...state,
    invalidatedRelationshipIds,
  };
};

export const findSqlConfirmedRelationshipForEndpoints = (
  state: SqlRelationshipConfirmationState,
  from: Pick<SqlRelationshipEndpoint, "worksheetId" | "tableName" | "column">,
  to: Pick<SqlRelationshipEndpoint, "worksheetId" | "tableName" | "column">,
): SqlConfirmedWorksheetRelationship | null => {
  const relationshipId = createSqlRelationshipId(from, to);
  if (state.invalidatedRelationshipIds[relationshipId]) return null;

  return (
    state.confirmedRelationships.find(
      (relationship) =>
        relationship.relationshipId === relationshipId &&
        isSqlConfirmedRelationshipActive(relationship),
    ) || null
  );
};

export const createSqlConfirmedRelationshipFromSuggestion = ({
  from,
  fromColumns,
  to,
  toColumns,
  scope,
  source,
  status = "confirmed",
  confirmedAt,
  rejectedAt,
  cardinality,
  confidence,
  acceptedFromCandidateId = null,
  workbookId = null,
  datasetId = null,
}: CreateSqlConfirmedRelationshipFromSuggestionInput): SqlConfirmedWorksheetRelationship | null => {
  if (
    !isSqlRelationshipSchemaBacked({
      fromColumn: from.column,
      fromColumns,
      toColumn: to.column,
      toColumns,
    })
  ) {
    return null;
  }

  return {
    relationshipId: createSqlRelationshipId(from, to),
    fromWorksheetId: from.worksheetId,
    fromWorksheetLabel: from.worksheetLabel,
    fromTableName: from.tableName,
    fromColumn: from.column,
    toWorksheetId: to.worksheetId,
    toWorksheetLabel: to.worksheetLabel,
    toTableName: to.tableName,
    toColumn: to.column,
    cardinality,
    confidence,
    status,
    confirmedAt: status === "confirmed" ? confirmedAt : undefined,
    rejectedAt: status === "rejected" ? rejectedAt : undefined,
    confirmedByUser: true,
    scope,
    source,
    acceptedFromCandidateId,
    workbookId,
    datasetId,
    ...SQL_RELATIONSHIP_CONFIRMATION_SAFETY_FLAGS,
  };
};
