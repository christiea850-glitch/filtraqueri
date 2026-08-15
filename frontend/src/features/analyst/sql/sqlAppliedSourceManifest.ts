import {
  WORKSHEET_SOURCE_REVISION_VERSION,
  type WorksheetSourceRevision,
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
