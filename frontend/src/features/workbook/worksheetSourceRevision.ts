export const WORKSHEET_SOURCE_IDENTITY_VERSION = "worksheet-source-identity:v1";
export const WORKSHEET_SOURCE_REVISION_VERSION = "worksheet-source-revision:v1";
export const WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION =
  "worksheet-structural-schema-fingerprint:v1";
export const RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION =
  "relationship-evidence-fingerprint:v1";
export const RELATIONSHIP_ENDPOINT_SIGNATURE_VERSION =
  "relationship-endpoint-signature:v1";

export type WorksheetSourceKind = "original" | "cleaned_working_copy";

export type WorksheetStructuralColumnInput = {
  columnId?: string | null;
  ordinal: number;
  name: string;
  physicalType: string;
  logicalType: string;
  nullable?: boolean | null;
};

export type WorksheetStructuralColumnFingerprint = {
  columnId: string | null;
  ordinal: number;
  name: string;
  physicalType: string;
  logicalType: string;
  nullable: boolean | null;
};

export type WorksheetStructuralSchemaFingerprint = {
  version: typeof WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION;
  fingerprint: string;
  columns: WorksheetStructuralColumnFingerprint[];
};

export type RelationshipEvidenceFingerprintInput = {
  rowCount?: number | null;
  nullCount?: number | null;
  distinctCount?: number | null;
  uniquenessRatio?: number | null;
  cardinalityEvidence?: string | null;
  candidateKeyEvidence?: string | null;
  overlapPolicyId?: string | null;
  sampledOverlapRatio?: number | null;
  sampledOverlapCount?: number | null;
};

export type RelationshipEvidenceFingerprint = {
  version: typeof RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION;
  fingerprint: string;
  evidence: {
    rowCount: number | null;
    nullCount: number | null;
    distinctCount: number | null;
    uniquenessRatio: number | null;
    cardinalityEvidence: string | null;
    candidateKeyEvidence: string | null;
    overlapPolicyId: string | null;
    sampledOverlapRatio: number | null;
    sampledOverlapCount: number | null;
  };
};

export type WorksheetSourceIdentityInput = {
  datasetId: string;
  workbookId: string;
  worksheetId: string;
  sourceKind: WorksheetSourceKind;
  cleanedLineageId?: string | null;
};

export type WorksheetSourceIdentity = {
  version: typeof WORKSHEET_SOURCE_IDENTITY_VERSION;
  sourceId: string;
  datasetId: string;
  workbookId: string;
  worksheetId: string;
  sourceKind: WorksheetSourceKind;
  cleanedLineageId: string | null;
};

export type WorksheetSourceRevisionInput = {
  sourceIdentity: WorksheetSourceIdentity;
  tableName: string;
  structuralSchemaFingerprint: WorksheetStructuralSchemaFingerprint;
  materializationFingerprint: string;
  transformationLineageId?: string | null;
};

export type WorksheetSourceRevision = {
  version: typeof WORKSHEET_SOURCE_REVISION_VERSION;
  revisionId: string;
  sourceIdentity: WorksheetSourceIdentity;
  tableName: string;
  structuralSchemaFingerprint: WorksheetStructuralSchemaFingerprint;
  materializationFingerprint: string;
  transformationLineageId: string | null;
};

export type RelationshipEndpointSignatureInput = {
  sourceRevision: WorksheetSourceRevision;
  columnId?: string | null;
  columnName: string;
  columnOrdinal: number;
  physicalType: string;
  logicalType: string;
};

export type RelationshipEndpointSignature = {
  version: typeof RELATIONSHIP_ENDPOINT_SIGNATURE_VERSION;
  endpointSignatureId: string;
  sourceRevisionId: string;
  sourceId: string;
  datasetId: string;
  workbookId: string;
  worksheetId: string;
  sourceKind: WorksheetSourceKind;
  tableName: string;
  structuralSchemaFingerprint: string;
  columnId: string | null;
  columnName: string;
  columnOrdinal: number;
  physicalType: string;
  logicalType: string;
};

export const canonicalizeForWorksheetSource = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeForWorksheetSource(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeForWorksheetSource(record[key])}`)
    .join(",")}}`;
};

export const createDeterministicWorksheetSourceFingerprint = (
  prefix: string,
  value: unknown,
): string => {
  const canonical = canonicalizeForWorksheetSource(value);
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${prefix}:${canonical.length}:${hash.toString(16).padStart(8, "0")}`;
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeRequiredString = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
};

const normalizeOptionalString = (value: string | null | undefined, label: string): string | null => {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be blank when supplied.`);
  }
  return normalized;
};

const assertSupportedVersion = (
  actual: string,
  expected: string,
  label: string,
): void => {
  if (actual !== expected) {
    throw new Error(`${label} version is unsupported.`);
  }
};

const normalizeCount = (
  value: number | null | undefined,
  label: string,
): number | null => {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer.`);
  }
  return value;
};

const normalizeRatio = (
  value: number | null | undefined,
  label: string,
): number | null => {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a ratio from 0 to 1.`);
  }
  return value;
};

export function createWorksheetStructuralSchemaFingerprint({
  columns,
}: {
  columns: WorksheetStructuralColumnInput[];
}): WorksheetStructuralSchemaFingerprint {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("At least one structural column is required.");
  }
  const normalizedColumns = columns
    .map((column) => {
      if (!Number.isInteger(column.ordinal) || column.ordinal < 0) {
        throw new Error("Column ordinal must be a nonnegative integer.");
      }
      return {
        columnId: normalizeOptionalString(column.columnId, "columnId"),
        ordinal: column.ordinal,
        name: normalizeRequiredString(column.name, "column name"),
        physicalType: normalizeRequiredString(column.physicalType, "physical type"),
        logicalType: normalizeRequiredString(column.logicalType, "logical type"),
        nullable: column.nullable ?? null,
      };
    })
    .sort((left, right) => left.ordinal - right.ordinal || left.name.localeCompare(right.name));

  const ordinals = new Set<number>();
  normalizedColumns.forEach((column) => {
    if (ordinals.has(column.ordinal)) {
      throw new Error("Column ordinals must be unique.");
    }
    ordinals.add(column.ordinal);
  });

  return {
    version: WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION,
    fingerprint: createDeterministicWorksheetSourceFingerprint("worksheet-structural-schema", {
      version: WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION,
      columns: normalizedColumns,
    }),
    columns: normalizedColumns,
  };
}

export function createRelationshipEvidenceFingerprint(
  input: RelationshipEvidenceFingerprintInput,
): RelationshipEvidenceFingerprint {
  const evidence = {
    rowCount: normalizeCount(input.rowCount, "rowCount"),
    nullCount: normalizeCount(input.nullCount, "nullCount"),
    distinctCount: normalizeCount(input.distinctCount, "distinctCount"),
    uniquenessRatio: normalizeRatio(input.uniquenessRatio, "uniquenessRatio"),
    cardinalityEvidence: normalizeOptionalString(
      input.cardinalityEvidence,
      "cardinalityEvidence",
    ),
    candidateKeyEvidence: normalizeOptionalString(
      input.candidateKeyEvidence,
      "candidateKeyEvidence",
    ),
    overlapPolicyId: normalizeOptionalString(input.overlapPolicyId, "overlapPolicyId"),
    sampledOverlapRatio: normalizeRatio(input.sampledOverlapRatio, "sampledOverlapRatio"),
    sampledOverlapCount: normalizeCount(input.sampledOverlapCount, "sampledOverlapCount"),
  };
  const boundedCounts = [evidence.nullCount, evidence.distinctCount, evidence.sampledOverlapCount];
  const rowCount = evidence.rowCount;
  if (rowCount !== null && boundedCounts.some((count) => count !== null && count > rowCount)) {
    throw new Error("Evidence counts cannot exceed rowCount.");
  }

  return {
    version: RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION,
    fingerprint: createDeterministicWorksheetSourceFingerprint("relationship-evidence", {
      version: RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION,
      evidence,
    }),
    evidence,
  };
}

export function createWorksheetSourceIdentity(
  input: WorksheetSourceIdentityInput,
): WorksheetSourceIdentity {
  const sourceKind = input.sourceKind;
  if (sourceKind !== "original" && sourceKind !== "cleaned_working_copy") {
    throw new Error("Worksheet source kind is unsupported.");
  }
  const cleanedLineageId = normalizeOptionalString(input.cleanedLineageId, "cleanedLineageId");
  if (sourceKind === "cleaned_working_copy" && cleanedLineageId === null) {
    throw new Error("Cleaned worksheet sources require a cleanedLineageId.");
  }
  if (sourceKind === "original" && cleanedLineageId !== null) {
    throw new Error("Original worksheet sources cannot include a cleanedLineageId.");
  }

  const identity = {
    version: WORKSHEET_SOURCE_IDENTITY_VERSION,
    datasetId: normalizeRequiredString(input.datasetId, "datasetId"),
    workbookId: normalizeRequiredString(input.workbookId, "workbookId"),
    worksheetId: normalizeRequiredString(input.worksheetId, "worksheetId"),
    sourceKind,
    cleanedLineageId,
  } satisfies Omit<WorksheetSourceIdentity, "sourceId">;

  return {
    ...identity,
    sourceId: createDeterministicWorksheetSourceFingerprint("worksheet-source", identity),
  };
}

export const createOriginalWorksheetSourceIdentity = (input: {
  datasetId: string;
  workbookId: string;
  worksheetId: string;
}): WorksheetSourceIdentity =>
  createWorksheetSourceIdentity({ ...input, sourceKind: "original" });

export const createCleanedWorksheetSourceIdentity = (input: {
  datasetId: string;
  workbookId: string;
  worksheetId: string;
  cleanedLineageId: string;
}): WorksheetSourceIdentity =>
  createWorksheetSourceIdentity({ ...input, sourceKind: "cleaned_working_copy" });

export function createWorksheetSourceRevision(
  input: WorksheetSourceRevisionInput,
): WorksheetSourceRevision {
  assertSupportedVersion(
    input.sourceIdentity.version,
    WORKSHEET_SOURCE_IDENTITY_VERSION,
    "Worksheet source identity",
  );
  assertSupportedVersion(
    input.structuralSchemaFingerprint.version,
    WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION,
    "Worksheet structural schema fingerprint",
  );

  const sourceIdentity = cloneJson(input.sourceIdentity);
  const structuralSchemaFingerprint = cloneJson(input.structuralSchemaFingerprint);
  const revision = {
    version: WORKSHEET_SOURCE_REVISION_VERSION,
    sourceIdentity,
    tableName: normalizeRequiredString(input.tableName, "tableName"),
    structuralSchemaFingerprint,
    materializationFingerprint: normalizeRequiredString(
      input.materializationFingerprint,
      "materializationFingerprint",
    ),
    transformationLineageId: normalizeOptionalString(
      input.transformationLineageId,
      "transformationLineageId",
    ),
  } satisfies Omit<WorksheetSourceRevision, "revisionId">;

  return {
    ...revision,
    revisionId: createDeterministicWorksheetSourceFingerprint("worksheet-source-revision", revision),
  };
}

export function createRelationshipEndpointSignature(
  input: RelationshipEndpointSignatureInput,
): RelationshipEndpointSignature {
  assertSupportedVersion(
    input.sourceRevision.version,
    WORKSHEET_SOURCE_REVISION_VERSION,
    "Worksheet source revision",
  );
  const column = {
    columnId: normalizeOptionalString(input.columnId, "columnId"),
    columnName: normalizeRequiredString(input.columnName, "columnName"),
    columnOrdinal: input.columnOrdinal,
    physicalType: normalizeRequiredString(input.physicalType, "physicalType"),
    logicalType: normalizeRequiredString(input.logicalType, "logicalType"),
  };
  if (!Number.isInteger(column.columnOrdinal) || column.columnOrdinal < 0) {
    throw new Error("columnOrdinal must be a nonnegative integer.");
  }

  const signature = {
    version: RELATIONSHIP_ENDPOINT_SIGNATURE_VERSION,
    sourceRevisionId: input.sourceRevision.revisionId,
    sourceId: input.sourceRevision.sourceIdentity.sourceId,
    datasetId: input.sourceRevision.sourceIdentity.datasetId,
    workbookId: input.sourceRevision.sourceIdentity.workbookId,
    worksheetId: input.sourceRevision.sourceIdentity.worksheetId,
    sourceKind: input.sourceRevision.sourceIdentity.sourceKind,
    tableName: input.sourceRevision.tableName,
    structuralSchemaFingerprint: input.sourceRevision.structuralSchemaFingerprint.fingerprint,
    ...column,
  } satisfies Omit<RelationshipEndpointSignature, "endpointSignatureId">;

  return {
    ...signature,
    endpointSignatureId: createDeterministicWorksheetSourceFingerprint(
      "relationship-endpoint",
      signature,
    ),
  };
}

export const areEndpointSignaturesStructurallyEquivalent = (
  left: RelationshipEndpointSignature,
  right: RelationshipEndpointSignature,
): boolean =>
  left.sourceId === right.sourceId &&
  left.datasetId === right.datasetId &&
  left.workbookId === right.workbookId &&
  left.worksheetId === right.worksheetId &&
  left.sourceKind === right.sourceKind &&
  left.tableName === right.tableName &&
  left.structuralSchemaFingerprint === right.structuralSchemaFingerprint &&
  left.columnId === right.columnId &&
  left.columnName === right.columnName &&
  left.columnOrdinal === right.columnOrdinal &&
  left.physicalType === right.physicalType &&
  left.logicalType === right.logicalType;
