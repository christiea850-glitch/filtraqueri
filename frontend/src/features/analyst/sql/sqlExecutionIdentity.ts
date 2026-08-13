export type SqlExecutionContextIdentity = {
  exactSql: string;
  datasetId: string;
  worksheetId: string | null;
};

export type SqlExecutionIdentity = SqlExecutionContextIdentity & {
  requestId: string;
};

export type CreateSqlExecutionContextIdentityInput = {
  exactSql: string;
  datasetId: string;
  worksheetId?: string | null;
};

export type CreateSqlExecutionIdentityInput = CreateSqlExecutionContextIdentityInput & {
  requestId: string;
};

const normalizeRequired = (value: string, fieldName: string) => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required for SQL execution identity.`);
  }
  return normalized;
};

const normalizeWorksheetId = (worksheetId: string | null | undefined) => {
  if (worksheetId == null) return null;
  const normalized = worksheetId.trim();
  if (!normalized) {
    throw new Error("worksheetId must be null or a non-blank string for SQL execution identity.");
  }
  return normalized;
};

export function createSqlExecutionContextIdentity({
  exactSql,
  datasetId,
  worksheetId = null,
}: CreateSqlExecutionContextIdentityInput): SqlExecutionContextIdentity {
  return {
    exactSql: normalizeRequired(exactSql, "exactSql"),
    datasetId: normalizeRequired(datasetId, "datasetId"),
    worksheetId: normalizeWorksheetId(worksheetId),
  };
}

export function createSqlExecutionIdentity({
  requestId,
  exactSql,
  datasetId,
  worksheetId = null,
}: CreateSqlExecutionIdentityInput): SqlExecutionIdentity {
  return {
    ...createSqlExecutionContextIdentity({ exactSql, datasetId, worksheetId }),
    requestId: normalizeRequired(requestId, "requestId"),
  };
}

export function doesSqlExecutionIdentityMatchContext(
  executionIdentity: SqlExecutionIdentity,
  currentContext: CreateSqlExecutionContextIdentityInput,
): boolean {
  const normalizedCurrentContext = createSqlExecutionContextIdentity(currentContext);
  return (
    executionIdentity.exactSql === normalizedCurrentContext.exactSql &&
    executionIdentity.datasetId === normalizedCurrentContext.datasetId &&
    executionIdentity.worksheetId === normalizedCurrentContext.worksheetId
  );
}
