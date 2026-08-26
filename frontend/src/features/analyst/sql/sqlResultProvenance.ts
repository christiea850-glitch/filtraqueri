import type { SqlPreviewResult } from "./sqlTypes";
import type {
  CanonicalSqlExecutionIdentityV2,
  ManualSqlExecutionIdentityV2,
  SqlExecutionIdentityV2,
} from "./sqlExecutionIdentity";

export const SQL_RESULT_DRIFT_WARNING =
  "Your question or SQL has changed since this result was run. Re-run to refresh.";

const normalizeDraftValue = (value: string) => value.trim();

const formatRunTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
};

const formatClarificationText = (
  executedQuestion: NonNullable<SqlPreviewResult["executedQuestion"]>,
): string | null => {
  const decision = executedQuestion.clarificationDecision;
  if (!decision) return null;
  const grouping =
    executedQuestion.detectedIntent?.grouping[0] ||
    executedQuestion.detectedIntent?.entities[0] ||
    "results";
  return decision.chosenOptionLabel
    ? `Clarification: ranked ${grouping} by ${decision.chosenOptionLabel}.`
    : `Clarification: selected ${decision.chosenOptionId}`;
};

export type SqlResultProvenanceViewModel = {
  summaryText: string;
  sourceText: string | null;
  ranAtText: string | null;
  clarificationText: string | null;
  driftWarningText: string | null;
};

export function createSqlResultProvenanceViewModel({
  previewResult,
  currentTaskPrompt,
  currentSqlDraft,
}: {
  previewResult: SqlPreviewResult;
  currentTaskPrompt: string;
  currentSqlDraft: string;
}): SqlResultProvenanceViewModel {
  const executedQuestion = previewResult.executedQuestion;

  if (!executedQuestion) {
    return {
      summaryText: "Showing result from a previous run",
      sourceText: null,
      ranAtText: null,
      clarificationText: null,
      driftWarningText: null,
    };
  }

  const taskPrompt = executedQuestion.taskPrompt.trim();
  const sourceName = executedQuestion.sourceLabel || executedQuestion.sourceTableName;
  const promptChanged =
    normalizeDraftValue(currentTaskPrompt) !== normalizeDraftValue(executedQuestion.taskPrompt);
  const sqlChanged = normalizeDraftValue(currentSqlDraft) !== normalizeDraftValue(executedQuestion.sqlAtRun);

  return {
    summaryText: taskPrompt
      ? `Showing result for: ${taskPrompt}`
      : `Showing result for SQL run on ${sourceName || "the selected source"}`,
    sourceText: sourceName ? `Source: ${sourceName}` : null,
    ranAtText: executedQuestion.ranAt ? `Ran: ${formatRunTimestamp(executedQuestion.ranAt)}` : null,
    clarificationText: formatClarificationText(executedQuestion),
    driftWarningText: promptChanged || sqlChanged ? SQL_RESULT_DRIFT_WARNING : null,
  };
}

export const SQL_RESULT_PROVENANCE_V2_VERSION = "sql-result-provenance:v2";

export type SqlResultProvenanceModeV2 =
  | "canonical_generated"
  | "manual"
  | "legacy_unverifiable";

export type SqlResultProvenanceV2ReasonCode =
  | "provenance_missing"
  | "unsupported_provenance_version"
  | "execution_identity_mismatch"
  | "manual_canonical_authority_forbidden";

export type SqlResultStalenessReasonCode =
  | "dataset_replaced"
  | "workbook_replaced"
  | "source_revision_changed"
  | "structural_schema_changed"
  | "relationship_validation_missing"
  | "relationship_validation_invalid"
  | "relationship_validation_superseded"
  | "acceptance_projection_changed"
  | "applied_source_manifest_changed"
  | "plan_revision_changed"
  | "renderer_identity_changed"
  | "dialect_changed"
  | "execution_target_changed"
  | "sql_artifact_changed"
  | "execution_policy_changed"
  | "scope_changed"
  | "legacy_unverifiable"
  | "unsupported_source_mode"
  | "unsupported_provenance_version";

export type SqlResultRunCorrelationV2 = {
  requestId?: string | null;
  runId?: string | null;
  tabId?: string | null;
};

export type CanonicalSqlResultProvenanceV2 = {
  version: typeof SQL_RESULT_PROVENANCE_V2_VERSION;
  mode: "canonical_generated";
  executionIdentity: CanonicalSqlExecutionIdentityV2;
  exactSqlFingerprint: string;
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
  dialect: string;
  executionTargetId: string;
  executionPolicyId: string;
  runCorrelation: SqlResultRunCorrelationV2 | null;
};

export type ManualSqlResultProvenanceV2 = {
  version: typeof SQL_RESULT_PROVENANCE_V2_VERSION;
  mode: "manual";
  executionIdentity: ManualSqlExecutionIdentityV2;
  exactSqlFingerprint: string;
  dialect: string;
  executionTargetId: string;
  datasetId: string;
  workbookId: string | null;
  worksheetId: string | null;
  tableName: string | null;
  executionPolicyId: string;
  runCorrelation: SqlResultRunCorrelationV2 | null;
};

export type LegacySqlResultProvenanceV2 = {
  version: typeof SQL_RESULT_PROVENANCE_V2_VERSION;
  mode: "legacy_unverifiable";
  legacyReason: "missing_v2_execution_identity";
  runCorrelation: SqlResultRunCorrelationV2 | null;
};

export type SqlResultProvenanceV2 =
  | CanonicalSqlResultProvenanceV2
  | ManualSqlResultProvenanceV2
  | LegacySqlResultProvenanceV2;

export type SqlResultProvenanceV2Validation =
  | {
      status: "valid";
      provenance: SqlResultProvenanceV2;
      reasonCodes: [];
    }
  | {
      status: "invalid";
      provenance: null;
      reasonCodes: SqlResultProvenanceV2ReasonCode[];
    };

export type SqlResultCurrentAuthorityContextV2 = {
  sourceMode: "original_only" | "cleaned_only" | "mixed" | "unknown";
  executionIdentity?: SqlExecutionIdentityV2 | null;
  exactSqlFingerprint?: string | null;
  datasetId?: string | null;
  workbookId?: string | null;
  appliedSourceManifestFingerprint?: string | null;
  sourceRevisionIds?: string[] | null;
  structuralSchemaFingerprints?: string[] | null;
  validationAssessmentIds?: string[] | null;
  invalidValidationAssessmentIds?: string[] | null;
  acceptanceRecordIds?: string[] | null;
  planRevisionId?: string | null;
  rendererId?: string | null;
  rendererVersion?: string | null;
  dialect?: string | null;
  executionTargetId?: string | null;
  executionPolicyId?: string | null;
  worksheetId?: string | null;
  tableName?: string | null;
};

export type SqlResultStalenessV2 =
  | {
      status: "current";
      current: true;
      reasonCodes: [];
    }
  | {
      status: "stale" | "legacy_unverifiable" | "unsupported";
      current: false;
      reasonCodes: SqlResultStalenessReasonCode[];
    };

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort();

const normalizeCorrelation = (
  runCorrelation: SqlResultRunCorrelationV2 | null | undefined,
): SqlResultRunCorrelationV2 | null => (runCorrelation ? cloneJson(runCorrelation) : null);

const createImmutable = <T>(value: T): T => Object.freeze(cloneJson(value)) as T;

const assertIdentityMatches = (
  left: string,
  right: string,
  label: string,
): void => {
  if (left !== right) {
    throw new Error(`${label} does not match execution identity.`);
  }
};

export function createCanonicalSqlResultProvenanceV2({
  executionIdentity,
  runCorrelation = null,
}: {
  executionIdentity: CanonicalSqlExecutionIdentityV2;
  runCorrelation?: SqlResultRunCorrelationV2 | null;
}): CanonicalSqlResultProvenanceV2 {
  const provenance = {
    version: SQL_RESULT_PROVENANCE_V2_VERSION,
    mode: "canonical_generated",
    executionIdentity: cloneJson(executionIdentity),
    exactSqlFingerprint: executionIdentity.exactSqlFingerprint,
    datasetId: executionIdentity.datasetId,
    workbookId: executionIdentity.workbookId,
    appliedSourceManifestFingerprint: executionIdentity.appliedSourceManifestFingerprint,
    sourceRevisionIds: uniqueSorted(executionIdentity.sourceRevisionIds),
    structuralSchemaFingerprints: uniqueSorted(executionIdentity.structuralSchemaFingerprints),
    validationAssessmentIds: uniqueSorted(executionIdentity.validationAssessmentIds),
    acceptanceRecordIds: uniqueSorted(executionIdentity.acceptanceRecordIds),
    planId: executionIdentity.planId,
    planRevisionId: executionIdentity.planRevisionId,
    rendererId: executionIdentity.rendererId,
    rendererVersion: executionIdentity.rendererVersion,
    dialect: executionIdentity.dialect,
    executionTargetId: executionIdentity.executionTargetId,
    executionPolicyId: executionIdentity.executionPolicyId,
    runCorrelation: normalizeCorrelation(runCorrelation),
  } satisfies CanonicalSqlResultProvenanceV2;
  return createImmutable(provenance);
}

export function createManualSqlResultProvenanceV2({
  executionIdentity,
  runCorrelation = null,
}: {
  executionIdentity: ManualSqlExecutionIdentityV2;
  runCorrelation?: SqlResultRunCorrelationV2 | null;
}): ManualSqlResultProvenanceV2 {
  const provenance = {
    version: SQL_RESULT_PROVENANCE_V2_VERSION,
    mode: "manual",
    executionIdentity: cloneJson(executionIdentity),
    exactSqlFingerprint: executionIdentity.exactSqlFingerprint,
    dialect: executionIdentity.dialect,
    executionTargetId: executionIdentity.executionTargetId,
    datasetId: executionIdentity.datasetId,
    workbookId: executionIdentity.workbookId,
    worksheetId: executionIdentity.worksheetId,
    tableName: executionIdentity.tableName,
    executionPolicyId: executionIdentity.executionPolicyId,
    runCorrelation: normalizeCorrelation(runCorrelation),
  } satisfies ManualSqlResultProvenanceV2;
  return createImmutable(provenance);
}

export function createLegacyUnverifiableSqlResultProvenanceV2({
  runCorrelation = null,
}: {
  runCorrelation?: SqlResultRunCorrelationV2 | null;
} = {}): LegacySqlResultProvenanceV2 {
  return createImmutable({
    version: SQL_RESULT_PROVENANCE_V2_VERSION,
    mode: "legacy_unverifiable",
    legacyReason: "missing_v2_execution_identity",
    runCorrelation: normalizeCorrelation(runCorrelation),
  } satisfies LegacySqlResultProvenanceV2);
}

export function validateSqlResultProvenanceV2(input: unknown): SqlResultProvenanceV2Validation {
  if (!input || typeof input !== "object") {
    return {
      status: "invalid",
      provenance: null,
      reasonCodes: ["provenance_missing"],
    };
  }
  const value = input as SqlResultProvenanceV2;
  if (value.version !== SQL_RESULT_PROVENANCE_V2_VERSION) {
    return {
      status: "invalid",
      provenance: null,
      reasonCodes: ["unsupported_provenance_version"],
    };
  }
  try {
    if (value.mode === "canonical_generated") {
      assertIdentityMatches(
        value.executionIdentity.identityFingerprint,
        value.executionIdentity.identityFingerprint,
        "executionIdentity",
      );
      assertIdentityMatches(
        value.exactSqlFingerprint,
        value.executionIdentity.exactSqlFingerprint,
        "exactSqlFingerprint",
      );
      assertIdentityMatches(value.datasetId, value.executionIdentity.datasetId, "datasetId");
      assertIdentityMatches(value.workbookId, value.executionIdentity.workbookId, "workbookId");
      assertIdentityMatches(
        value.appliedSourceManifestFingerprint,
        value.executionIdentity.appliedSourceManifestFingerprint,
        "appliedSourceManifestFingerprint",
      );
      return {
        status: "valid",
        provenance: createCanonicalSqlResultProvenanceV2({
          executionIdentity: value.executionIdentity,
          runCorrelation: value.runCorrelation,
        }),
        reasonCodes: [],
      };
    }
    if (value.mode === "manual") {
      if (
        "appliedSourceManifestFingerprint" in value ||
        "planId" in value ||
        "validationAssessmentIds" in value
      ) {
        return {
          status: "invalid",
          provenance: null,
          reasonCodes: ["manual_canonical_authority_forbidden"],
        };
      }
      assertIdentityMatches(
        value.exactSqlFingerprint,
        value.executionIdentity.exactSqlFingerprint,
        "exactSqlFingerprint",
      );
      return {
        status: "valid",
        provenance: createManualSqlResultProvenanceV2({
          executionIdentity: value.executionIdentity,
          runCorrelation: value.runCorrelation,
        }),
        reasonCodes: [],
      };
    }
    if (value.mode === "legacy_unverifiable") {
      return {
        status: "valid",
        provenance: createLegacyUnverifiableSqlResultProvenanceV2({
          runCorrelation: value.runCorrelation,
        }),
        reasonCodes: [],
      };
    }
  } catch {
    return {
      status: "invalid",
      provenance: null,
      reasonCodes: ["execution_identity_mismatch"],
    };
  }
  return {
    status: "invalid",
    provenance: null,
    reasonCodes: ["unsupported_provenance_version"],
  };
}

const stalenessPriority: Record<SqlResultStalenessReasonCode, number> = {
  dataset_replaced: 0,
  workbook_replaced: 1,
  source_revision_changed: 2,
  structural_schema_changed: 3,
  relationship_validation_missing: 4,
  relationship_validation_invalid: 5,
  relationship_validation_superseded: 6,
  acceptance_projection_changed: 7,
  applied_source_manifest_changed: 8,
  plan_revision_changed: 9,
  renderer_identity_changed: 10,
  dialect_changed: 11,
  execution_target_changed: 12,
  sql_artifact_changed: 13,
  execution_policy_changed: 14,
  scope_changed: 15,
  legacy_unverifiable: 16,
  unsupported_source_mode: 17,
  unsupported_provenance_version: 18,
};

const normalizeStalenessReasons = (
  reasonCodes: SqlResultStalenessReasonCode[],
): SqlResultStalenessReasonCode[] =>
  [...new Set(reasonCodes)].sort((left, right) => stalenessPriority[left] - stalenessPriority[right]);

const compareScalar = (
  left: string | null | undefined,
  right: string | null | undefined,
  reason: SqlResultStalenessReasonCode,
): SqlResultStalenessReasonCode[] => (left === right ? [] : [reason]);

const compareSet = (
  left: string[],
  right: string[] | null | undefined,
  reason: SqlResultStalenessReasonCode,
): SqlResultStalenessReasonCode[] =>
  JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right ?? [])) ? [] : [reason];

export function evaluateSqlResultStalenessV2({
  provenance,
  currentContext,
}: {
  provenance: SqlResultProvenanceV2 | unknown;
  currentContext: SqlResultCurrentAuthorityContextV2;
}): SqlResultStalenessV2 {
  const validation = validateSqlResultProvenanceV2(provenance);
  if (validation.status === "invalid") {
    return {
      status: "unsupported",
      current: false,
      reasonCodes: ["unsupported_provenance_version"],
    };
  }
  const checkedProvenance = validation.provenance;
  if (checkedProvenance.mode === "legacy_unverifiable") {
    return {
      status: "legacy_unverifiable",
      current: false,
      reasonCodes: ["legacy_unverifiable"],
    };
  }
  if (currentContext.sourceMode !== "original_only") {
    return {
      status: "unsupported",
      current: false,
      reasonCodes: ["unsupported_source_mode"],
    };
  }

  const reasons: SqlResultStalenessReasonCode[] = [
    ...compareScalar(checkedProvenance.datasetId, currentContext.datasetId, "dataset_replaced"),
    ...compareScalar(checkedProvenance.dialect, currentContext.dialect, "dialect_changed"),
    ...compareScalar(
      checkedProvenance.executionTargetId,
      currentContext.executionTargetId,
      "execution_target_changed",
    ),
    ...compareScalar(
      checkedProvenance.exactSqlFingerprint,
      currentContext.exactSqlFingerprint,
      "sql_artifact_changed",
    ),
    ...compareScalar(
      checkedProvenance.executionPolicyId,
      currentContext.executionPolicyId,
      "execution_policy_changed",
    ),
  ];

  if (checkedProvenance.mode === "manual") {
    reasons.push(
      ...compareScalar(checkedProvenance.workbookId, currentContext.workbookId, "workbook_replaced"),
      ...compareScalar(checkedProvenance.worksheetId, currentContext.worksheetId, "scope_changed"),
      ...compareScalar(checkedProvenance.tableName, currentContext.tableName, "scope_changed"),
    );
  } else {
    reasons.push(
      ...compareScalar(checkedProvenance.workbookId, currentContext.workbookId, "workbook_replaced"),
      ...compareScalar(
        checkedProvenance.appliedSourceManifestFingerprint,
        currentContext.appliedSourceManifestFingerprint,
        "applied_source_manifest_changed",
      ),
      ...compareSet(
        checkedProvenance.sourceRevisionIds,
        currentContext.sourceRevisionIds,
        "source_revision_changed",
      ),
      ...compareSet(
        checkedProvenance.structuralSchemaFingerprints,
        currentContext.structuralSchemaFingerprints,
        "structural_schema_changed",
      ),
      ...compareSet(
        checkedProvenance.validationAssessmentIds,
        currentContext.validationAssessmentIds,
        "relationship_validation_superseded",
      ),
      ...compareSet(
        checkedProvenance.acceptanceRecordIds,
        currentContext.acceptanceRecordIds,
        "acceptance_projection_changed",
      ),
      ...compareScalar(
        checkedProvenance.planRevisionId,
        currentContext.planRevisionId,
        "plan_revision_changed",
      ),
      ...compareScalar(checkedProvenance.rendererId, currentContext.rendererId, "renderer_identity_changed"),
      ...compareScalar(
        checkedProvenance.rendererVersion,
        currentContext.rendererVersion,
        "renderer_identity_changed",
      ),
    );
    if ((currentContext.validationAssessmentIds ?? []).length === 0) {
      reasons.push("relationship_validation_missing");
    }
    if ((currentContext.invalidValidationAssessmentIds ?? []).length > 0) {
      reasons.push("relationship_validation_invalid");
    }
  }

  const normalizedReasons = normalizeStalenessReasons(reasons);
  if (normalizedReasons.length > 0) {
    return {
      status: "stale",
      current: false,
      reasonCodes: normalizedReasons,
    };
  }
  return {
    status: "current",
    current: true,
    reasonCodes: [],
  };
}
