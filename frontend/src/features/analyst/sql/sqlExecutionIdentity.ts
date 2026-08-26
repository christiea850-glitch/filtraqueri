import { createDeterministicWorksheetSourceFingerprint } from "../../workbook/worksheetSourceRevision";

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

export const SQL_EXECUTION_IDENTITY_V2_VERSION = "sql-execution-identity:v2";

export type SqlExecutionModeV2 = "canonical_generated" | "manual";

export type SqlExecutionIdentityV2ReasonCode =
  | "execution_identity_missing"
  | "execution_identity_unsupported"
  | "execution_identity_malformed"
  | "execution_identity_fingerprint_mismatch"
  | "execution_mode_unsupported"
  | "manual_canonical_authority_forbidden";

export type SqlExecutionIdentityV2Base = {
  version: typeof SQL_EXECUTION_IDENTITY_V2_VERSION;
  mode: SqlExecutionModeV2;
  exactSqlFingerprint: string;
  dialect: string;
  executionTargetId: string;
  datasetId: string;
  executionPolicyId: string;
  identityFingerprint: string;
};

export type CanonicalSqlExecutionIdentityV2 = SqlExecutionIdentityV2Base & {
  mode: "canonical_generated";
  workbookId: string;
  appliedSourceManifestFingerprint: string;
  sourceRevisionIds: string[];
  structuralSchemaFingerprints: string[];
  validationAssessmentIds: string[];
  acceptanceRecordIds: string[];
  planId: string;
  planRevisionId: string;
  rendererId: string;
  rendererVersion: string;
};

export type ManualSqlExecutionIdentityV2 = SqlExecutionIdentityV2Base & {
  mode: "manual";
  workbookId: string | null;
  worksheetId: string | null;
  tableName: string | null;
};

export type SqlExecutionIdentityV2 =
  | CanonicalSqlExecutionIdentityV2
  | ManualSqlExecutionIdentityV2;

export type SqlExecutionIdentityV2Validation =
  | {
      status: "valid";
      identity: SqlExecutionIdentityV2;
      reasonCodes: [];
    }
  | {
      status: "invalid";
      identity: null;
      reasonCodes: SqlExecutionIdentityV2ReasonCode[];
    };

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const uniqueSortedStrings = (values: string[], label: string): string[] =>
  [...new Set(values.map((value) => normalizeRequired(value, label)))].sort();

const normalizeOptionalString = (
  value: string | null | undefined,
  fieldName: string,
): string | null => {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} must be null or a non-blank string for SQL execution identity.`);
  }
  return normalized;
};

export const createSqlTextFingerprint = (exactSql: string): string =>
  createDeterministicWorksheetSourceFingerprint("sql-exact-text", {
    exactSql: normalizeRequired(exactSql, "exactSql"),
  });

const v2FingerprintPayload = (
  identity: Omit<SqlExecutionIdentityV2, "identityFingerprint">,
) => cloneJson(identity);

const createIdentityFingerprint = (
  identity: Omit<SqlExecutionIdentityV2, "identityFingerprint">,
): string =>
  createDeterministicWorksheetSourceFingerprint(
    "sql-execution-identity-v2",
    v2FingerprintPayload(identity),
  );

export function createCanonicalSqlExecutionIdentityV2({
  exactSql,
  dialect,
  executionTargetId,
  datasetId,
  workbookId,
  appliedSourceManifestFingerprint,
  sourceRevisionIds,
  structuralSchemaFingerprints,
  validationAssessmentIds,
  acceptanceRecordIds,
  planId,
  planRevisionId,
  rendererId,
  rendererVersion,
  executionPolicyId,
}: {
  exactSql: string;
  dialect: string;
  executionTargetId: string;
  datasetId: string;
  workbookId: string;
  appliedSourceManifestFingerprint: string;
  sourceRevisionIds: string[];
  structuralSchemaFingerprints: string[];
  validationAssessmentIds: string[];
  acceptanceRecordIds: string[];
  planId: string;
  planRevisionId: string;
  rendererId: string;
  rendererVersion: string;
  executionPolicyId: string;
}): CanonicalSqlExecutionIdentityV2 {
  const identityWithoutFingerprint = {
    version: SQL_EXECUTION_IDENTITY_V2_VERSION,
    mode: "canonical_generated",
    exactSqlFingerprint: createSqlTextFingerprint(exactSql),
    dialect: normalizeRequired(dialect, "dialect"),
    executionTargetId: normalizeRequired(executionTargetId, "executionTargetId"),
    datasetId: normalizeRequired(datasetId, "datasetId"),
    executionPolicyId: normalizeRequired(executionPolicyId, "executionPolicyId"),
    workbookId: normalizeRequired(workbookId, "workbookId"),
    appliedSourceManifestFingerprint: normalizeRequired(
      appliedSourceManifestFingerprint,
      "appliedSourceManifestFingerprint",
    ),
    sourceRevisionIds: uniqueSortedStrings(sourceRevisionIds, "sourceRevisionId"),
    structuralSchemaFingerprints: uniqueSortedStrings(
      structuralSchemaFingerprints,
      "structuralSchemaFingerprint",
    ),
    validationAssessmentIds: uniqueSortedStrings(validationAssessmentIds, "validationAssessmentId"),
    acceptanceRecordIds: uniqueSortedStrings(acceptanceRecordIds, "acceptanceRecordId"),
    planId: normalizeRequired(planId, "planId"),
    planRevisionId: normalizeRequired(planRevisionId, "planRevisionId"),
    rendererId: normalizeRequired(rendererId, "rendererId"),
    rendererVersion: normalizeRequired(rendererVersion, "rendererVersion"),
  } satisfies Omit<CanonicalSqlExecutionIdentityV2, "identityFingerprint">;
  return {
    ...identityWithoutFingerprint,
    identityFingerprint: createIdentityFingerprint(identityWithoutFingerprint),
  };
}

export function createManualSqlExecutionIdentityV2({
  exactSql,
  dialect,
  executionTargetId,
  datasetId,
  workbookId = null,
  worksheetId = null,
  tableName = null,
  executionPolicyId,
}: {
  exactSql: string;
  dialect: string;
  executionTargetId: string;
  datasetId: string;
  workbookId?: string | null;
  worksheetId?: string | null;
  tableName?: string | null;
  executionPolicyId: string;
}): ManualSqlExecutionIdentityV2 {
  const identityWithoutFingerprint = {
    version: SQL_EXECUTION_IDENTITY_V2_VERSION,
    mode: "manual",
    exactSqlFingerprint: createSqlTextFingerprint(exactSql),
    dialect: normalizeRequired(dialect, "dialect"),
    executionTargetId: normalizeRequired(executionTargetId, "executionTargetId"),
    datasetId: normalizeRequired(datasetId, "datasetId"),
    executionPolicyId: normalizeRequired(executionPolicyId, "executionPolicyId"),
    workbookId: normalizeOptionalString(workbookId, "workbookId"),
    worksheetId: normalizeOptionalString(worksheetId, "worksheetId"),
    tableName: normalizeOptionalString(tableName, "tableName"),
  } satisfies Omit<ManualSqlExecutionIdentityV2, "identityFingerprint">;
  return {
    ...identityWithoutFingerprint,
    identityFingerprint: createIdentityFingerprint(identityWithoutFingerprint),
  };
}

const manualForbiddenKeys = [
  "appliedSourceManifestFingerprint",
  "sourceRevisionIds",
  "structuralSchemaFingerprints",
  "validationAssessmentIds",
  "acceptanceRecordIds",
  "planId",
  "planRevisionId",
  "rendererId",
  "rendererVersion",
];

export function validateSqlExecutionIdentityV2(input: unknown): SqlExecutionIdentityV2Validation {
  if (!input || typeof input !== "object") {
    return {
      status: "invalid",
      identity: null,
      reasonCodes: ["execution_identity_missing"],
    };
  }
  const value = input as Record<string, unknown>;
  if (value.version !== SQL_EXECUTION_IDENTITY_V2_VERSION) {
    return {
      status: "invalid",
      identity: null,
      reasonCodes: ["execution_identity_unsupported"],
    };
  }
  try {
    if (value.mode === "canonical_generated") {
      const identityWithoutFingerprint = {
        version: SQL_EXECUTION_IDENTITY_V2_VERSION,
        mode: "canonical_generated",
        exactSqlFingerprint: normalizeRequired(
          String(value.exactSqlFingerprint ?? ""),
          "exactSqlFingerprint",
        ),
        dialect: normalizeRequired(String(value.dialect ?? ""), "dialect"),
        executionTargetId: normalizeRequired(String(value.executionTargetId ?? ""), "executionTargetId"),
        datasetId: normalizeRequired(String(value.datasetId ?? ""), "datasetId"),
        executionPolicyId: normalizeRequired(String(value.executionPolicyId ?? ""), "executionPolicyId"),
        workbookId: normalizeRequired(String(value.workbookId ?? ""), "workbookId"),
        appliedSourceManifestFingerprint: normalizeRequired(
          String(value.appliedSourceManifestFingerprint ?? ""),
          "appliedSourceManifestFingerprint",
        ),
        sourceRevisionIds: Array.isArray(value.sourceRevisionIds)
          ? uniqueSortedStrings(value.sourceRevisionIds.map(String), "sourceRevisionId")
          : [],
        structuralSchemaFingerprints: Array.isArray(value.structuralSchemaFingerprints)
          ? uniqueSortedStrings(value.structuralSchemaFingerprints.map(String), "structuralSchemaFingerprint")
          : [],
        validationAssessmentIds: Array.isArray(value.validationAssessmentIds)
          ? uniqueSortedStrings(value.validationAssessmentIds.map(String), "validationAssessmentId")
          : [],
        acceptanceRecordIds: Array.isArray(value.acceptanceRecordIds)
          ? uniqueSortedStrings(value.acceptanceRecordIds.map(String), "acceptanceRecordId")
          : [],
        planId: normalizeRequired(String(value.planId ?? ""), "planId"),
        planRevisionId: normalizeRequired(String(value.planRevisionId ?? ""), "planRevisionId"),
        rendererId: normalizeRequired(String(value.rendererId ?? ""), "rendererId"),
        rendererVersion: normalizeRequired(String(value.rendererVersion ?? ""), "rendererVersion"),
      } satisfies Omit<CanonicalSqlExecutionIdentityV2, "identityFingerprint">;
      const identity = {
        ...identityWithoutFingerprint,
        identityFingerprint: createIdentityFingerprint(identityWithoutFingerprint),
      };
      if (identity.identityFingerprint !== value.identityFingerprint) {
        return {
          status: "invalid",
          identity: null,
          reasonCodes: ["execution_identity_fingerprint_mismatch"],
        };
      }
      return { status: "valid", identity, reasonCodes: [] };
    }
    if (value.mode === "manual") {
      if (manualForbiddenKeys.some((key) => key in value)) {
        return {
          status: "invalid",
          identity: null,
          reasonCodes: ["manual_canonical_authority_forbidden"],
        };
      }
      const identityWithoutFingerprint = {
        version: SQL_EXECUTION_IDENTITY_V2_VERSION,
        mode: "manual",
        exactSqlFingerprint: normalizeRequired(
          String(value.exactSqlFingerprint ?? ""),
          "exactSqlFingerprint",
        ),
        dialect: normalizeRequired(String(value.dialect ?? ""), "dialect"),
        executionTargetId: normalizeRequired(String(value.executionTargetId ?? ""), "executionTargetId"),
        datasetId: normalizeRequired(String(value.datasetId ?? ""), "datasetId"),
        executionPolicyId: normalizeRequired(String(value.executionPolicyId ?? ""), "executionPolicyId"),
        workbookId: normalizeOptionalString(
          value.workbookId == null ? null : String(value.workbookId),
          "workbookId",
        ),
        worksheetId: normalizeOptionalString(
          value.worksheetId == null ? null : String(value.worksheetId),
          "worksheetId",
        ),
        tableName: normalizeOptionalString(
          value.tableName == null ? null : String(value.tableName),
          "tableName",
        ),
      } satisfies Omit<ManualSqlExecutionIdentityV2, "identityFingerprint">;
      const identity = {
        ...identityWithoutFingerprint,
        identityFingerprint: createIdentityFingerprint(identityWithoutFingerprint),
      };
      if (identity.identityFingerprint !== value.identityFingerprint) {
        return {
          status: "invalid",
          identity: null,
          reasonCodes: ["execution_identity_fingerprint_mismatch"],
        };
      }
      return { status: "valid", identity, reasonCodes: [] };
    }
  } catch {
    return {
      status: "invalid",
      identity: null,
      reasonCodes: ["execution_identity_malformed"],
    };
  }
  return {
    status: "invalid",
    identity: null,
    reasonCodes: ["execution_mode_unsupported"],
  };
}

export const doSqlExecutionIdentityV2FingerprintsMatch = (
  left: SqlExecutionIdentityV2,
  right: SqlExecutionIdentityV2,
): boolean => left.identityFingerprint === right.identityFingerprint;

export const summarizeSqlExecutionIdentityV2 = (
  identity: SqlExecutionIdentityV2,
): { version: typeof SQL_EXECUTION_IDENTITY_V2_VERSION; mode: SqlExecutionModeV2 } => ({
  version: identity.version,
  mode: identity.mode,
});
