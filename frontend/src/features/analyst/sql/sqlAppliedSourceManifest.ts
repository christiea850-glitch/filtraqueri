import {
  WORKSHEET_SOURCE_REVISION_VERSION,
  type RelationshipEndpointSignature,
  type WorksheetSourceRevision,
  type WorksheetSourceKind,
  createDeterministicWorksheetSourceFingerprint,
} from "../../workbook/worksheetSourceRevision";

export const SQL_APPLIED_SOURCE_MANIFEST_VERSION = "sql-applied-source-manifest:v1";

export type SqlAppliedSourceManifestReasonCode =
  | "manifest_version_unsupported"
  | "manifest_binding_duplicate"
  | "manifest_binding_conflict"
  | "manifest_binding_dataset_mismatch"
  | "manifest_binding_workbook_mismatch"
  | "manifest_binding_worksheet_mismatch"
  | "manifest_fingerprint_mismatch"
  | "manifest_empty"
  | "unsupported_cleaned_source"
  | "unsupported_mixed_source";

export type SqlAppliedSourceBinding = {
  worksheetId: string;
  sourceRevision: WorksheetSourceRevision;
};

export type SqlAppliedSourceManifest = {
  version: typeof SQL_APPLIED_SOURCE_MANIFEST_VERSION;
  datasetId: string;
  workbookId: string;
  bindings: SqlAppliedSourceBinding[];
  manifestFingerprint: string;
};

export type SqlAppliedSourceManifestCreateResult =
  | {
      status: "created";
      manifest: SqlAppliedSourceManifest;
      reasonCodes: [];
    }
  | {
      status: "invalid";
      manifest: null;
      reasonCodes: SqlAppliedSourceManifestReasonCode[];
    };

export type SqlAppliedSourceManifestReadiness =
  | {
      status: "eligible";
      eligible: true;
      reasonCodes: [];
    }
  | {
      status: "blocked" | "not_ready" | "invalid";
      eligible: false;
      reasonCodes: SqlAppliedSourceManifestReasonCode[];
    };

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const normalizeRequiredString = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const manifestFingerprintPayload = (manifest: Omit<SqlAppliedSourceManifest, "manifestFingerprint">) => ({
  version: manifest.version,
  datasetId: manifest.datasetId,
  workbookId: manifest.workbookId,
  bindings: manifest.bindings.map((binding) => ({
    worksheetId: binding.worksheetId,
    sourceRevisionId: binding.sourceRevision.revisionId,
    sourceId: binding.sourceRevision.sourceIdentity.sourceId,
    sourceKind: binding.sourceRevision.sourceIdentity.sourceKind,
    structuralSchemaFingerprint: binding.sourceRevision.structuralSchemaFingerprint.fingerprint,
    materializationFingerprint: binding.sourceRevision.materializationFingerprint,
  })),
});

export function createSqlAppliedSourceManifest({
  datasetId,
  workbookId,
  bindings,
  suppliedFingerprint,
}: {
  datasetId: string;
  workbookId: string;
  bindings: SqlAppliedSourceBinding[];
  suppliedFingerprint?: string | null;
}): SqlAppliedSourceManifestCreateResult {
  const normalizedDatasetId = normalizeRequiredString(datasetId, "datasetId");
  const normalizedWorkbookId = normalizeRequiredString(workbookId, "workbookId");
  const reasonCodes: SqlAppliedSourceManifestReasonCode[] = [];

  const normalizedBindings = bindings
    .map((binding) => ({
      worksheetId: normalizeRequiredString(binding.worksheetId, "worksheetId"),
      sourceRevision: cloneJson(binding.sourceRevision),
    }))
    .sort(
      (left, right) =>
        left.worksheetId.localeCompare(right.worksheetId) ||
        left.sourceRevision.sourceIdentity.sourceKind.localeCompare(
          right.sourceRevision.sourceIdentity.sourceKind,
        ) ||
        left.sourceRevision.sourceIdentity.sourceId.localeCompare(
          right.sourceRevision.sourceIdentity.sourceId,
        ) ||
        left.sourceRevision.revisionId.localeCompare(right.sourceRevision.revisionId),
    );

  const exactBindingKeys = new Set<string>();
  const revisionsByWorksheet = new Map<string, string>();
  normalizedBindings.forEach((binding) => {
    if (binding.sourceRevision.version !== WORKSHEET_SOURCE_REVISION_VERSION) {
      reasonCodes.push("manifest_version_unsupported");
    }
    if (binding.sourceRevision.sourceIdentity.datasetId !== normalizedDatasetId) {
      reasonCodes.push("manifest_binding_dataset_mismatch");
    }
    if (binding.sourceRevision.sourceIdentity.workbookId !== normalizedWorkbookId) {
      reasonCodes.push("manifest_binding_workbook_mismatch");
    }
    if (binding.sourceRevision.sourceIdentity.worksheetId !== binding.worksheetId) {
      reasonCodes.push("manifest_binding_worksheet_mismatch");
    }

    const exactKey = `${binding.worksheetId}\u001f${binding.sourceRevision.revisionId}`;
    if (exactBindingKeys.has(exactKey)) {
      reasonCodes.push("manifest_binding_duplicate");
    }
    exactBindingKeys.add(exactKey);

    const existingRevisionId = revisionsByWorksheet.get(binding.worksheetId);
    if (existingRevisionId && existingRevisionId !== binding.sourceRevision.revisionId) {
      reasonCodes.push("manifest_binding_conflict");
    }
    revisionsByWorksheet.set(binding.worksheetId, binding.sourceRevision.revisionId);
  });

  const manifestWithoutFingerprint = {
    version: SQL_APPLIED_SOURCE_MANIFEST_VERSION,
    datasetId: normalizedDatasetId,
    workbookId: normalizedWorkbookId,
    bindings: normalizedBindings,
  } satisfies Omit<SqlAppliedSourceManifest, "manifestFingerprint">;
  const manifestFingerprint = createDeterministicWorksheetSourceFingerprint(
    "sql-applied-source-manifest",
    manifestFingerprintPayload(manifestWithoutFingerprint),
  );
  if (suppliedFingerprint != null && suppliedFingerprint !== manifestFingerprint) {
    reasonCodes.push("manifest_fingerprint_mismatch");
  }

  const dedupedReasonCodes = unique(reasonCodes);
  if (dedupedReasonCodes.length > 0) {
    return {
      status: "invalid",
      manifest: null,
      reasonCodes: dedupedReasonCodes,
    };
  }

  return {
    status: "created",
    manifest: {
      ...manifestWithoutFingerprint,
      manifestFingerprint,
    },
    reasonCodes: [],
  };
}

export function validateSqlAppliedSourceManifestIntegrity(
  manifest: SqlAppliedSourceManifest,
): SqlAppliedSourceManifestReadiness {
  if (manifest.version !== SQL_APPLIED_SOURCE_MANIFEST_VERSION) {
    return {
      status: "invalid",
      eligible: false,
      reasonCodes: ["manifest_version_unsupported"],
    };
  }
  const expected = createDeterministicWorksheetSourceFingerprint(
    "sql-applied-source-manifest",
    manifestFingerprintPayload(manifest),
  );
  if (manifest.manifestFingerprint !== expected) {
    return {
      status: "invalid",
      eligible: false,
      reasonCodes: ["manifest_fingerprint_mismatch"],
    };
  }
  return {
    status: "eligible",
    eligible: true,
    reasonCodes: [],
  };
}

export function evaluateSqlAppliedSourceManifestReadiness(
  manifest: SqlAppliedSourceManifest,
): SqlAppliedSourceManifestReadiness {
  const integrity = validateSqlAppliedSourceManifestIntegrity(manifest);
  if (integrity.status === "invalid") return integrity;
  if (manifest.bindings.length === 0) {
    return {
      status: "not_ready",
      eligible: false,
      reasonCodes: ["manifest_empty"],
    };
  }

  const sourceKinds = unique(
    manifest.bindings.map((binding) => binding.sourceRevision.sourceIdentity.sourceKind),
  );
  if (sourceKinds.includes("original") && sourceKinds.includes("cleaned_working_copy")) {
    return {
      status: "blocked",
      eligible: false,
      reasonCodes: ["unsupported_mixed_source"],
    };
  }
  if (sourceKinds.includes("cleaned_working_copy")) {
    return {
      status: "blocked",
      eligible: false,
      reasonCodes: ["unsupported_cleaned_source"],
    };
  }

  return {
    status: "eligible",
    eligible: true,
    reasonCodes: [],
  };
}

export const SQL_APPLIED_SOURCE_MANIFEST_V2_VERSION = "sql-applied-source-manifest:v2";

export type SqlAppliedSourceManifestV2SourceMode =
  | "original_only"
  | "cleaned_only"
  | "mixed"
  | "unknown";

export type SqlAppliedSourceManifestV2ReasonCode =
  | SqlAppliedSourceManifestReasonCode
  | "applied_source_manifest_missing"
  | "applied_source_manifest_unsupported"
  | "applied_source_manifest_malformed"
  | "source_revision_missing"
  | "source_revision_mismatch"
  | "structural_schema_mismatch"
  | "relationship_validation_missing"
  | "relationship_validation_stale"
  | "relationship_validation_mismatch"
  | "relationship_acceptance_missing"
  | "relationship_partial_eligibility_blocked"
  | "legacy_source_unverifiable";

export type SqlAppliedSourceManifestV2SourceBindingInput = {
  sourceId: string;
  sourceKind: WorksheetSourceKind;
  worksheetId: string;
  tableName: string;
  sourceRevisionId: string;
  structuralSchemaFingerprint: string;
};

export type SqlAppliedSourceManifestV2RelationshipBindingInput = {
  relationshipId: string;
  direction: "directed" | "symmetric";
  validationAssessmentId: string;
  validationIdentity: string;
  acceptanceRecordId: string;
  leftEndpoint: RelationshipEndpointSignature;
  rightEndpoint: RelationshipEndpointSignature;
};

export type SqlAppliedSourceManifestV2SourceBinding =
  SqlAppliedSourceManifestV2SourceBindingInput;

export type SqlAppliedSourceManifestV2RelationshipBinding =
  SqlAppliedSourceManifestV2RelationshipBindingInput;

export type SqlAppliedSourceManifestV2 = {
  version: typeof SQL_APPLIED_SOURCE_MANIFEST_V2_VERSION;
  datasetId: string;
  workbookId: string;
  sourceMode: SqlAppliedSourceManifestV2SourceMode;
  sourceBindings: SqlAppliedSourceManifestV2SourceBinding[];
  relationshipBindings: SqlAppliedSourceManifestV2RelationshipBinding[];
  manifestFingerprint: string;
};

export type VersionedSqlAppliedSourceManifest =
  | SqlAppliedSourceManifest
  | SqlAppliedSourceManifestV2;

export type SqlAppliedSourceManifestV2CreateResult =
  | {
      status: "created";
      manifest: SqlAppliedSourceManifestV2;
      reasonCodes: [];
    }
  | {
      status: "invalid";
      manifest: null;
      reasonCodes: SqlAppliedSourceManifestV2ReasonCode[];
    };

export type SqlAppliedSourceManifestV2Readiness =
  | {
      status: "eligible";
      eligible: true;
      reasonCodes: [];
    }
  | {
      status: "blocked" | "invalid";
      eligible: false;
      reasonCodes: SqlAppliedSourceManifestV2ReasonCode[];
    };

const reasonPriority: Record<SqlAppliedSourceManifestV2ReasonCode, number> = {
  applied_source_manifest_missing: 0,
  applied_source_manifest_unsupported: 1,
  applied_source_manifest_malformed: 2,
  manifest_version_unsupported: 3,
  manifest_binding_duplicate: 4,
  manifest_binding_conflict: 5,
  manifest_binding_dataset_mismatch: 6,
  manifest_binding_workbook_mismatch: 7,
  manifest_binding_worksheet_mismatch: 8,
  manifest_fingerprint_mismatch: 9,
  manifest_empty: 10,
  source_revision_missing: 11,
  source_revision_mismatch: 12,
  structural_schema_mismatch: 13,
  relationship_validation_missing: 14,
  relationship_validation_stale: 15,
  relationship_validation_mismatch: 16,
  relationship_acceptance_missing: 17,
  relationship_partial_eligibility_blocked: 18,
  unsupported_cleaned_source: 19,
  unsupported_mixed_source: 20,
  legacy_source_unverifiable: 21,
};

const normalizeReasonCodes = (
  values: SqlAppliedSourceManifestV2ReasonCode[],
): SqlAppliedSourceManifestV2ReasonCode[] =>
  unique(values).sort((left, right) => reasonPriority[left] - reasonPriority[right]);

const normalizeV2SourceMode = (
  sourceMode: SqlAppliedSourceManifestV2SourceMode | null | undefined,
): SqlAppliedSourceManifestV2SourceMode => sourceMode ?? "unknown";

const normalizePossiblyBlankString = (value: string, label: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  return value.trim();
};

const sourceModeFromBindings = (
  sourceMode: SqlAppliedSourceManifestV2SourceMode | null | undefined,
  bindings: SqlAppliedSourceManifestV2SourceBinding[],
): SqlAppliedSourceManifestV2SourceMode => {
  if (sourceMode) return sourceMode;
  const kinds = unique(bindings.map((binding) => binding.sourceKind));
  if (kinds.length === 0) return "unknown";
  if (kinds.includes("original") && kinds.includes("cleaned_working_copy")) return "mixed";
  if (kinds.includes("cleaned_working_copy")) return "cleaned_only";
  return "original_only";
};

const normalizeEndpoint = (endpoint: RelationshipEndpointSignature): RelationshipEndpointSignature =>
  cloneJson(endpoint);

const orderedRelationshipEndpoints = (
  relationship: SqlAppliedSourceManifestV2RelationshipBindingInput,
): [RelationshipEndpointSignature, RelationshipEndpointSignature] => {
  if (relationship.direction === "directed") {
    return [relationship.leftEndpoint, relationship.rightEndpoint];
  }
  return relationship.leftEndpoint.endpointSignatureId <= relationship.rightEndpoint.endpointSignatureId
    ? [relationship.leftEndpoint, relationship.rightEndpoint]
    : [relationship.rightEndpoint, relationship.leftEndpoint];
};

const v2ManifestFingerprintPayload = (
  manifest: Omit<SqlAppliedSourceManifestV2, "manifestFingerprint">,
) => ({
  version: manifest.version,
  datasetId: manifest.datasetId,
  workbookId: manifest.workbookId,
  sourceMode: manifest.sourceMode,
  sourceBindings: manifest.sourceBindings.map((binding) => ({
    sourceId: binding.sourceId,
    sourceKind: binding.sourceKind,
    worksheetId: binding.worksheetId,
    sourceRevisionId: binding.sourceRevisionId,
    structuralSchemaFingerprint: binding.structuralSchemaFingerprint,
  })),
  relationshipBindings: manifest.relationshipBindings.map((binding) => {
    const [leftEndpoint, rightEndpoint] = orderedRelationshipEndpoints(binding);
    return {
      relationshipId: binding.relationshipId,
      direction: binding.direction,
      validationAssessmentId: binding.validationAssessmentId,
      validationIdentity: binding.validationIdentity,
      acceptanceRecordId: binding.acceptanceRecordId,
      endpoints: [
        {
          endpointSignatureId: leftEndpoint.endpointSignatureId,
          sourceId: leftEndpoint.sourceId,
          sourceRevisionId: leftEndpoint.sourceRevisionId,
          worksheetId: leftEndpoint.worksheetId,
          structuralSchemaFingerprint: leftEndpoint.structuralSchemaFingerprint,
        },
        {
          endpointSignatureId: rightEndpoint.endpointSignatureId,
          sourceId: rightEndpoint.sourceId,
          sourceRevisionId: rightEndpoint.sourceRevisionId,
          worksheetId: rightEndpoint.worksheetId,
          structuralSchemaFingerprint: rightEndpoint.structuralSchemaFingerprint,
        },
      ],
    };
  }),
});

const normalizeV2SourceBinding = (
  binding: SqlAppliedSourceManifestV2SourceBindingInput,
): SqlAppliedSourceManifestV2SourceBinding => ({
  sourceId: normalizeRequiredString(binding.sourceId, "sourceId"),
  sourceKind: binding.sourceKind,
  worksheetId: normalizeRequiredString(binding.worksheetId, "worksheetId"),
  tableName: normalizeRequiredString(binding.tableName, "tableName"),
  sourceRevisionId: normalizePossiblyBlankString(binding.sourceRevisionId, "sourceRevisionId"),
  structuralSchemaFingerprint: normalizePossiblyBlankString(
    binding.structuralSchemaFingerprint,
    "structuralSchemaFingerprint",
  ),
});

const normalizeV2RelationshipBinding = (
  binding: SqlAppliedSourceManifestV2RelationshipBindingInput,
): SqlAppliedSourceManifestV2RelationshipBinding => ({
  relationshipId: normalizeRequiredString(binding.relationshipId, "relationshipId"),
  direction: binding.direction,
  validationAssessmentId: normalizeRequiredString(
    binding.validationAssessmentId,
    "validationAssessmentId",
  ),
  validationIdentity: normalizeRequiredString(binding.validationIdentity, "validationIdentity"),
  acceptanceRecordId: normalizeRequiredString(binding.acceptanceRecordId, "acceptanceRecordId"),
  leftEndpoint: normalizeEndpoint(binding.leftEndpoint),
  rightEndpoint: normalizeEndpoint(binding.rightEndpoint),
});

const validateV2ManifestBody = (
  manifest: Omit<SqlAppliedSourceManifestV2, "manifestFingerprint">,
): SqlAppliedSourceManifestV2ReasonCode[] => {
  const reasons: SqlAppliedSourceManifestV2ReasonCode[] = [];
  const sourceById = new Map<string, SqlAppliedSourceManifestV2SourceBinding>();
  const sourceByWorksheet = new Map<string, SqlAppliedSourceManifestV2SourceBinding>();
  const exactSources = new Set<string>();

  manifest.sourceBindings.forEach((binding) => {
    if (!binding.sourceRevisionId) reasons.push("source_revision_missing");
    if (!binding.structuralSchemaFingerprint) reasons.push("structural_schema_mismatch");
    if (binding.sourceKind !== "original" && binding.sourceKind !== "cleaned_working_copy") {
      reasons.push("applied_source_manifest_malformed");
    }

    const exactKey = `${binding.sourceId}\u001f${binding.sourceRevisionId}\u001f${binding.structuralSchemaFingerprint}`;
    if (exactSources.has(exactKey)) reasons.push("manifest_binding_duplicate");
    exactSources.add(exactKey);

    const existingById = sourceById.get(binding.sourceId);
    if (
      existingById &&
      (existingById.sourceRevisionId !== binding.sourceRevisionId ||
        existingById.structuralSchemaFingerprint !== binding.structuralSchemaFingerprint ||
        existingById.worksheetId !== binding.worksheetId ||
        existingById.sourceKind !== binding.sourceKind)
    ) {
      reasons.push("manifest_binding_conflict");
    }
    sourceById.set(binding.sourceId, binding);

    const existingByWorksheet = sourceByWorksheet.get(binding.worksheetId);
    if (existingByWorksheet && existingByWorksheet.sourceId !== binding.sourceId) {
      reasons.push("manifest_binding_conflict");
    }
    sourceByWorksheet.set(binding.worksheetId, binding);
  });

  const relationshipById = new Map<string, SqlAppliedSourceManifestV2RelationshipBinding>();
  const exactRelationships = new Set<string>();
  manifest.relationshipBindings.forEach((binding) => {
    const exactKey = `${binding.relationshipId}\u001f${binding.validationAssessmentId}\u001f${binding.acceptanceRecordId}`;
    if (exactRelationships.has(exactKey)) reasons.push("manifest_binding_duplicate");
    exactRelationships.add(exactKey);

    const existing = relationshipById.get(binding.relationshipId);
    if (
      existing &&
      (existing.validationAssessmentId !== binding.validationAssessmentId ||
        existing.validationIdentity !== binding.validationIdentity ||
        existing.acceptanceRecordId !== binding.acceptanceRecordId ||
        existing.direction !== binding.direction)
    ) {
      reasons.push("manifest_binding_conflict");
    }
    relationshipById.set(binding.relationshipId, binding);

    [binding.leftEndpoint, binding.rightEndpoint].forEach((endpoint) => {
      const source = sourceById.get(endpoint.sourceId);
      if (!source) {
        reasons.push("relationship_validation_missing");
        return;
      }
      if (source.sourceRevisionId !== endpoint.sourceRevisionId) {
        reasons.push("source_revision_mismatch");
      }
      if (source.structuralSchemaFingerprint !== endpoint.structuralSchemaFingerprint) {
        reasons.push("structural_schema_mismatch");
      }
    });
  });

  return normalizeReasonCodes(reasons);
};

export function createSqlAppliedSourceManifestV2({
  datasetId,
  workbookId,
  sourceMode,
  sourceBindings,
  relationshipBindings = [],
  suppliedFingerprint,
}: {
  datasetId: string;
  workbookId: string;
  sourceMode?: SqlAppliedSourceManifestV2SourceMode | null;
  sourceBindings: SqlAppliedSourceManifestV2SourceBindingInput[];
  relationshipBindings?: SqlAppliedSourceManifestV2RelationshipBindingInput[];
  suppliedFingerprint?: string | null;
}): SqlAppliedSourceManifestV2CreateResult {
  const normalizedSourceBindings = sourceBindings
    .map(normalizeV2SourceBinding)
    .sort(
      (left, right) =>
        left.sourceId.localeCompare(right.sourceId) ||
        left.worksheetId.localeCompare(right.worksheetId) ||
        left.sourceRevisionId.localeCompare(right.sourceRevisionId),
    );
  const normalizedRelationshipBindings = relationshipBindings
    .map(normalizeV2RelationshipBinding)
    .sort(
      (left, right) =>
        left.relationshipId.localeCompare(right.relationshipId) ||
        left.validationAssessmentId.localeCompare(right.validationAssessmentId) ||
        left.acceptanceRecordId.localeCompare(right.acceptanceRecordId),
    );
  const manifestWithoutFingerprint = {
    version: SQL_APPLIED_SOURCE_MANIFEST_V2_VERSION,
    datasetId: normalizeRequiredString(datasetId, "datasetId"),
    workbookId: normalizeRequiredString(workbookId, "workbookId"),
    sourceMode: sourceModeFromBindings(sourceMode, normalizedSourceBindings),
    sourceBindings: normalizedSourceBindings,
    relationshipBindings: normalizedRelationshipBindings,
  } satisfies Omit<SqlAppliedSourceManifestV2, "manifestFingerprint">;
  const manifestFingerprint = createDeterministicWorksheetSourceFingerprint(
    "sql-applied-source-manifest-v2",
    v2ManifestFingerprintPayload(manifestWithoutFingerprint),
  );
  const reasons = validateV2ManifestBody(manifestWithoutFingerprint);
  if (suppliedFingerprint != null && suppliedFingerprint !== manifestFingerprint) {
    reasons.push("manifest_fingerprint_mismatch");
  }
  const normalizedReasons = normalizeReasonCodes(reasons);
  if (normalizedReasons.length > 0) {
    return {
      status: "invalid",
      manifest: null,
      reasonCodes: normalizedReasons,
    };
  }
  return {
    status: "created",
    manifest: {
      ...manifestWithoutFingerprint,
      manifestFingerprint,
    },
    reasonCodes: [],
  };
}

export function validateSqlAppliedSourceManifestV2Integrity(
  manifest: SqlAppliedSourceManifestV2 | null | undefined,
): SqlAppliedSourceManifestV2Readiness {
  if (!manifest) {
    return {
      status: "invalid",
      eligible: false,
      reasonCodes: ["applied_source_manifest_missing"],
    };
  }
  if (manifest.version !== SQL_APPLIED_SOURCE_MANIFEST_V2_VERSION) {
    return {
      status: "invalid",
      eligible: false,
      reasonCodes: ["applied_source_manifest_unsupported"],
    };
  }
  const expected = createDeterministicWorksheetSourceFingerprint(
    "sql-applied-source-manifest-v2",
    v2ManifestFingerprintPayload(manifest),
  );
  const reasons = validateV2ManifestBody(manifest);
  if (manifest.manifestFingerprint !== expected) reasons.push("manifest_fingerprint_mismatch");
  const normalizedReasons = normalizeReasonCodes(reasons);
  if (normalizedReasons.length > 0) {
    return {
      status: "invalid",
      eligible: false,
      reasonCodes: normalizedReasons,
    };
  }
  return {
    status: "eligible",
    eligible: true,
    reasonCodes: [],
  };
}

export function evaluateSqlAppliedSourceManifestV2Readiness({
  manifest,
  requiredRelationshipIds = [],
}: {
  manifest: SqlAppliedSourceManifestV2 | null | undefined;
  requiredRelationshipIds?: string[];
}): SqlAppliedSourceManifestV2Readiness {
  const integrity = validateSqlAppliedSourceManifestV2Integrity(manifest);
  if (integrity.status === "invalid") return integrity;
  const checkedManifest = manifest as SqlAppliedSourceManifestV2;
  const reasons: SqlAppliedSourceManifestV2ReasonCode[] = [];

  if (checkedManifest.sourceBindings.length === 0) reasons.push("manifest_empty");
  if (normalizeV2SourceMode(checkedManifest.sourceMode) === "cleaned_only") {
    reasons.push("unsupported_cleaned_source");
  }
  if (normalizeV2SourceMode(checkedManifest.sourceMode) === "mixed") {
    reasons.push("unsupported_mixed_source");
  }
  if (normalizeV2SourceMode(checkedManifest.sourceMode) === "unknown") {
    reasons.push("applied_source_manifest_malformed");
  }

  const availableRelationships = new Set(
    checkedManifest.relationshipBindings.map((binding) => binding.relationshipId),
  );
  requiredRelationshipIds.forEach((relationshipId) => {
    if (!availableRelationships.has(relationshipId)) {
      reasons.push("relationship_partial_eligibility_blocked");
    }
  });

  const normalizedReasons = normalizeReasonCodes(reasons);
  if (normalizedReasons.length > 0) {
    return {
      status: "blocked",
      eligible: false,
      reasonCodes: normalizedReasons,
    };
  }
  return {
    status: "eligible",
    eligible: true,
    reasonCodes: [],
  };
}
