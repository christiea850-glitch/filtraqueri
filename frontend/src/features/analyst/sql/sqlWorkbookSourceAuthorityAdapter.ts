import type {
  AcceptedRelationshipContract,
  WorkbookMetadata,
} from "../../workbook";
import {
  createDeterministicWorksheetSourceFingerprint,
  createWorksheetStructuralSchemaFingerprint,
  createWorksheetSourceRevision,
  createOriginalWorksheetSourceIdentity,
  WORKSHEET_SOURCE_REVISION_VERSION,
  type RelationshipEndpointSignature,
  type RelationshipEvidenceFingerprint,
  type WorksheetSourceRevision,
} from "../../workbook/worksheetSourceRevision";
import {
  RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
  RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
  type SourceAwareRelationshipAcceptanceHistory,
  type SourceAwareRelationshipValidationLedger,
} from "./sourceAwareRelationshipEligibility";
import {
  RELATIONSHIP_SOURCE_VALIDATION_VERSION,
  createRelationshipValidationIdentity,
  type RelationshipSourceValidation,
} from "./relationshipSourceValidation";

export type SqlWorkbookSourceAuthorityAdapterReasonCode =
  | "source_registry_missing_legacy"
  | "source_registry_version_unsupported"
  | "source_registry_malformed"
  | "source_registry_not_ready"
  | "source_identity_mismatch"
  | "source_revision_missing"
  | "source_revision_mismatch"
  | "structural_schema_mismatch"
  | "relationship_validation_ledger_missing"
  | "relationship_validation_ledger_version_unsupported"
  | "relationship_validation_ledger_malformed"
  | "relationship_validation_record_missing"
  | "relationship_validation_mismatch"
  | "relationship_acceptance_history_missing"
  | "relationship_acceptance_history_version_unsupported"
  | "relationship_acceptance_history_malformed"
  | "relationship_acceptance_missing"
  | "relationship_acceptance_mismatch"
  | "source_bound_relationship_missing"
  | "source_bound_relationship_mismatch";

export type ValidatedWorkbookSourceRegistry = {
  sources: ValidatedWorkbookSourceRecord[];
  revisions: ValidatedWorkbookSourceRevisionRecord[];
  currentRevisionBySourceId: Record<string, string>;
  sourceByWorksheetKey: Map<string, ValidatedWorkbookSourceRecord>;
  revisionById: Map<string, ValidatedWorkbookSourceRevisionRecord>;
};

export type ValidatedWorkbookSourceRecord = {
  sourceId: string;
  datasetId: string;
  workbookId: string;
  worksheetId: string;
  sourceKind: "original" | "cleaned_working_copy";
  tableName: string;
};

export type ValidatedWorkbookSourceRevisionRecord = {
  revisionId: string;
  sourceId: string;
  datasetId: string;
  workbookId: string;
  worksheetId: string;
  sourceKind: "original" | "cleaned_working_copy";
  tableName: string;
  revision: WorksheetSourceRevision;
};

export type SqlWorkbookSourceAuthorityAdapterResult =
  | {
      ready: true;
      reasonCodes: [];
      sourceRegistry: ValidatedWorkbookSourceRegistry;
      validationLedger: SourceAwareRelationshipValidationLedger;
      acceptanceHistory: SourceAwareRelationshipAcceptanceHistory;
    }
  | {
      ready: false;
      reasonCodes: SqlWorkbookSourceAuthorityAdapterReasonCode[];
      sourceRegistry: ValidatedWorkbookSourceRegistry | null;
      validationLedger: SourceAwareRelationshipValidationLedger | null;
      acceptanceHistory: SourceAwareRelationshipAcceptanceHistory | null;
    };

const A2_SOURCE_REGISTRY_VERSION = "workbook-source-registry:v1";
const A2_RELATIONSHIP_VALIDATION_LEDGER_VERSION = "relationship-source-validation-ledger:v1";
const A2_RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION = "relationship-source-acceptance-history:v1";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createWorkbookSourceRegistryWorksheetKey = (
  worksheetId: string,
  sourceKind: "original" | "cleaned_working_copy",
): string => `${worksheetId}:${sourceKind}`;

const uniqueReasons = (
  values: SqlWorkbookSourceAuthorityAdapterReasonCode[],
): SqlWorkbookSourceAuthorityAdapterReasonCode[] => Array.from(new Set(values));

const validateEndpoint = (value: unknown): RelationshipEndpointSignature | null => {
  if (!isRecord(value)) return null;
  const endpoint = value as unknown as RelationshipEndpointSignature;
  return endpoint.version === "relationship-endpoint-signature:v1" &&
    stringValue(endpoint.endpointSignatureId) &&
    stringValue(endpoint.sourceRevisionId) &&
    stringValue(endpoint.sourceId) &&
    stringValue(endpoint.datasetId) &&
    stringValue(endpoint.workbookId) &&
    stringValue(endpoint.worksheetId) &&
    (endpoint.sourceKind === "original" || endpoint.sourceKind === "cleaned_working_copy") &&
    stringValue(endpoint.tableName) &&
    stringValue(endpoint.structuralSchemaFingerprint) &&
    stringValue(endpoint.columnName) &&
    Number.isInteger(endpoint.columnOrdinal) &&
    endpoint.columnOrdinal >= 0 &&
    stringValue(endpoint.physicalType) &&
    stringValue(endpoint.logicalType)
    ? cloneJson(endpoint)
    : null;
};

const validateEvidence = (value: unknown): RelationshipEvidenceFingerprint | null => {
  if (!isRecord(value)) return null;
  const evidence = value as unknown as RelationshipEvidenceFingerprint;
  return evidence.version === "relationship-evidence-fingerprint:v1" &&
    stringValue(evidence.fingerprint) &&
    isRecord(evidence.evidence)
    ? cloneJson(evidence)
    : null;
};

const validateRelationshipValidation = (value: unknown): RelationshipSourceValidation | null => {
  if (!isRecord(value)) return null;
  const validation = value as unknown as RelationshipSourceValidation;
  const leftEndpoint = validateEndpoint(validation.leftEndpoint);
  const rightEndpoint = validateEndpoint(validation.rightEndpoint);
  const evidenceFingerprint = validateEvidence(validation.evidenceFingerprint);
  if (
    validation.version !== RELATIONSHIP_SOURCE_VALIDATION_VERSION ||
    !stringValue(validation.relationshipId) ||
    (validation.direction !== "directed" && validation.direction !== "symmetric") ||
    !stringValue(validation.validationIdentity) ||
    !stringValue(validation.assessmentId) ||
    !leftEndpoint ||
    !rightEndpoint ||
    !evidenceFingerprint ||
    (validation.status !== "valid" && validation.status !== "stale" && validation.status !== "ineligible") ||
    !Array.isArray(validation.reasonCodes)
  ) {
    return null;
  }
  const expectedIdentity = createRelationshipValidationIdentity({
    relationshipId: validation.relationshipId,
    direction: validation.direction,
    leftEndpoint,
    rightEndpoint,
  });
  const expectedAssessmentId = createDeterministicWorksheetSourceFingerprint(
    "relationship-source-assessment",
    {
      validationIdentity: expectedIdentity,
      evidenceFingerprint: evidenceFingerprint.fingerprint,
      status: validation.status,
      reasonCodes: Array.from(new Set(validation.reasonCodes)).sort(),
    },
  );
  if (
    validation.validationIdentity !== expectedIdentity ||
    validation.assessmentId !== expectedAssessmentId
  ) {
    return null;
  }
  return {
    ...cloneJson(validation),
    leftEndpoint,
    rightEndpoint,
    evidenceFingerprint,
  };
};

const validateSourceRegistry = (
  workbook: WorkbookMetadata,
  datasetId: string,
): {
  registry: ValidatedWorkbookSourceRegistry | null;
  reasons: SqlWorkbookSourceAuthorityAdapterReasonCode[];
} => {
  const registry = workbook.sourceRegistry;
  if (!registry) return { registry: null, reasons: ["source_registry_missing_legacy"] };
  if (!isRecord(registry)) return { registry: null, reasons: ["source_registry_malformed"] };
  if (registry.version !== A2_SOURCE_REGISTRY_VERSION) {
    return { registry: null, reasons: ["source_registry_version_unsupported"] };
  }
  if (
    typeof registry.status !== "string" ||
    !isRecord(registry.readiness) ||
    typeof registry.readiness.ready !== "boolean"
  ) {
    return { registry: null, reasons: ["source_registry_malformed"] };
  }
  if (registry.status !== "ready" || registry.readiness.ready === false) {
    return { registry: null, reasons: ["source_registry_not_ready"] };
  }
  const sources = registry.sources;
  const revisions = registry.revisions;
  const current = registry.current_revision_by_source_id;
  if (!Array.isArray(sources) || !Array.isArray(revisions) || !isRecord(current)) {
    return { registry: null, reasons: ["source_registry_malformed"] };
  }

  const reasons: SqlWorkbookSourceAuthorityAdapterReasonCode[] = [];
  const validatedSources: ValidatedWorkbookSourceRecord[] = [];
  const sourceById = new Map<string, ValidatedWorkbookSourceRecord>();
  const sourceByWorksheetKey = new Map<string, ValidatedWorkbookSourceRecord>();
  for (const item of sources) {
    if (!isRecord(item)) {
      reasons.push("source_registry_malformed");
      continue;
    }
    const sourceId = stringValue(item.source_id);
    const sourceIdentity = item.source_identity;
    const sourceKind =
      item.source_kind === "original" || item.source_kind === "cleaned_working_copy"
        ? item.source_kind
        : null;
    const workbookId = stringValue(item.workbook_id);
    const worksheetId = stringValue(item.worksheet_id);
    const tableName = stringValue(item.table_name);
    if (
      !sourceId ||
      !isRecord(sourceIdentity) ||
      sourceIdentity.version !== "worksheet-source-identity:v1" ||
      sourceIdentity.sourceId !== sourceId ||
      item.dataset_id !== datasetId ||
      workbookId !== workbook.workbookId ||
      sourceIdentity.datasetId !== datasetId ||
      sourceIdentity.workbookId !== workbook.workbookId ||
      sourceIdentity.worksheetId !== worksheetId ||
      !sourceKind ||
      sourceIdentity.sourceKind !== sourceKind ||
      !worksheetId ||
      !tableName
    ) {
      reasons.push("source_identity_mismatch");
      continue;
    }
    if (sourceKind === "original") {
      const expectedIdentity = createOriginalWorksheetSourceIdentity({
        datasetId,
        workbookId,
        worksheetId,
      });
      if (expectedIdentity.sourceId !== sourceId) reasons.push("source_identity_mismatch");
    }
    const source: ValidatedWorkbookSourceRecord = {
      sourceId,
      datasetId,
      workbookId,
      worksheetId,
      sourceKind,
      tableName,
    };
    const worksheetKey = createWorkbookSourceRegistryWorksheetKey(worksheetId, sourceKind);
    if (sourceById.has(sourceId)) reasons.push("source_registry_malformed");
    if (sourceByWorksheetKey.has(worksheetKey)) reasons.push("source_registry_malformed");
    sourceById.set(sourceId, source);
    sourceByWorksheetKey.set(worksheetKey, source);
    validatedSources.push(source);
  }

  const revisionById = new Map<string, ValidatedWorkbookSourceRevisionRecord>();
  const revisionIds = new Set<string>();
  for (const item of revisions) {
    if (!isRecord(item) || !isRecord(item.revision)) {
      reasons.push("source_registry_malformed");
      continue;
    }
    const revision = item.revision as unknown as WorksheetSourceRevision;
    const revisionId = stringValue(item.revision_id);
    const sourceId = stringValue(item.source_id);
    const source = sourceId ? sourceById.get(sourceId) : null;
    if (
      !revisionId ||
      !sourceId ||
      !source ||
      revision.version !== WORKSHEET_SOURCE_REVISION_VERSION ||
      revision.revisionId !== revisionId ||
      item.dataset_id !== datasetId ||
      item.workbook_id !== workbook.workbookId ||
      item.worksheet_id !== source.worksheetId ||
      item.source_kind !== source.sourceKind ||
      item.table_name !== source.tableName ||
      revision.sourceIdentity.sourceId !== source.sourceId ||
      revision.sourceIdentity.datasetId !== datasetId ||
      revision.sourceIdentity.workbookId !== workbook.workbookId ||
      revision.sourceIdentity.worksheetId !== source.worksheetId ||
      revision.sourceIdentity.sourceKind !== source.sourceKind ||
      revision.tableName !== source.tableName
    ) {
      reasons.push("source_revision_mismatch");
      continue;
    }
    try {
      const structural = createWorksheetStructuralSchemaFingerprint({
        columns: revision.structuralSchemaFingerprint.columns,
      });
      if (structural.fingerprint !== revision.structuralSchemaFingerprint.fingerprint) {
        reasons.push("structural_schema_mismatch");
      }
      const expectedRevision = createWorksheetSourceRevision({
        sourceIdentity: revision.sourceIdentity,
        tableName: revision.tableName,
        structuralSchemaFingerprint: revision.structuralSchemaFingerprint,
        materializationFingerprint: revision.materializationFingerprint,
        transformationLineageId: revision.transformationLineageId,
      });
      if (expectedRevision.revisionId !== revision.revisionId) {
        reasons.push("source_revision_mismatch");
      }
    } catch {
      reasons.push("source_revision_mismatch");
    }
    if (revisionIds.has(revisionId)) reasons.push("source_registry_malformed");
    revisionIds.add(revisionId);
    revisionById.set(revisionId, {
      revisionId,
      sourceId,
      datasetId,
      workbookId: workbook.workbookId,
      worksheetId: source.worksheetId,
      sourceKind: source.sourceKind,
      tableName: source.tableName,
      revision: cloneJson(revision),
    });
  }

  const currentRevisionBySourceId: Record<string, string> = {};
  Object.entries(current).forEach(([sourceId, value]) => {
    const revisionId = stringValue(value);
    if (!sourceById.has(sourceId) || !revisionId || !revisionById.has(revisionId)) {
      reasons.push("source_revision_missing");
      return;
    }
    const revision = revisionById.get(revisionId);
    if (revision?.sourceId !== sourceId) reasons.push("source_revision_mismatch");
    currentRevisionBySourceId[sourceId] = revisionId;
  });
  for (const sourceId of sourceById.keys()) {
    if (!currentRevisionBySourceId[sourceId]) reasons.push("source_revision_missing");
  }

  if (reasons.length > 0) return { registry: null, reasons: uniqueReasons(reasons) };
  return {
    registry: {
      sources: validatedSources.sort((left, right) => left.sourceId.localeCompare(right.sourceId)),
      revisions: Array.from(revisionById.values()).sort((left, right) =>
        left.revisionId.localeCompare(right.revisionId),
      ),
      currentRevisionBySourceId,
      sourceByWorksheetKey,
      revisionById,
    },
    reasons: [],
  };
};

const adaptValidationLedger = (
  workbook: WorkbookMetadata,
): {
  ledger: SourceAwareRelationshipValidationLedger | null;
  reasons: SqlWorkbookSourceAuthorityAdapterReasonCode[];
} => {
  const ledger = workbook.relationshipSourceValidationLedger;
  if (!ledger) {
    return {
      ledger: {
        version: RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
        records: [],
        current: [],
      },
      reasons: [],
    };
  }
  if (!isRecord(ledger)) return { ledger: null, reasons: ["relationship_validation_ledger_malformed"] };
  if (ledger.version !== A2_RELATIONSHIP_VALIDATION_LEDGER_VERSION) {
    return { ledger: null, reasons: ["relationship_validation_ledger_version_unsupported"] };
  }
  const records = ledger.records;
  const current = ledger.current_validation_by_relationship_id;
  if (!Array.isArray(records) || !isRecord(current)) {
    return { ledger: null, reasons: ["relationship_validation_ledger_malformed"] };
  }
  const reasons: SqlWorkbookSourceAuthorityAdapterReasonCode[] = [];
  const normalizedRecords: SourceAwareRelationshipValidationLedger["records"] = [];
  const recordByAssessmentId = new Map<string, SourceAwareRelationshipValidationLedger["records"][number]>();
  const recordIds = new Set<string>();
  for (const item of records) {
    if (!isRecord(item)) {
      reasons.push("relationship_validation_ledger_malformed");
      continue;
    }
    const recordId = stringValue(item.validation_record_id);
    const validation = validateRelationshipValidation(item.validation);
    if (!recordId || !validation) {
      reasons.push("relationship_validation_mismatch");
      continue;
    }
    const expectedRecordId = createDeterministicWorksheetSourceFingerprint(
      "relationship-source-validation-record",
      {
        version: A2_RELATIONSHIP_VALIDATION_LEDGER_VERSION,
        validation,
      },
    );
    if (recordId !== expectedRecordId) reasons.push("relationship_validation_mismatch");
    if (recordIds.has(recordId)) reasons.push("relationship_validation_ledger_malformed");
    const normalizedRecord = { recordId, validation };
    normalizedRecords.push(normalizedRecord);
    recordIds.add(recordId);
    if (recordByAssessmentId.has(validation.assessmentId)) {
      reasons.push("relationship_validation_ledger_malformed");
    }
    recordByAssessmentId.set(validation.assessmentId, normalizedRecord);
  }
  const normalizedCurrent: SourceAwareRelationshipValidationLedger["current"] = [];
  Object.entries(current).forEach(([relationshipId, value]) => {
    const assessmentId = stringValue(value);
    const record = assessmentId ? recordByAssessmentId.get(assessmentId) : null;
    if (!assessmentId || !record) {
      reasons.push("relationship_validation_record_missing");
      return;
    }
    if (record.validation.relationshipId !== relationshipId) {
      reasons.push("relationship_validation_mismatch");
      return;
    }
    normalizedCurrent.push({
      relationshipId,
      validationRecordId: record.recordId,
      validationAssessmentId: record.validation.assessmentId,
      validationIdentity: record.validation.validationIdentity,
    });
  });
  if (reasons.length > 0) return { ledger: null, reasons: uniqueReasons(reasons) };
  return {
    ledger: {
      version: RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
      records: normalizedRecords.sort((left, right) => left.recordId.localeCompare(right.recordId)),
      current: normalizedCurrent.sort((left, right) => left.relationshipId.localeCompare(right.relationshipId)),
    },
    reasons: [],
  };
};

const adaptAcceptanceHistory = (
  workbook: WorkbookMetadata,
  validationLedger: SourceAwareRelationshipValidationLedger,
): {
  history: SourceAwareRelationshipAcceptanceHistory | null;
  reasons: SqlWorkbookSourceAuthorityAdapterReasonCode[];
} => {
  const history = workbook.relationshipAcceptanceHistory;
  if (!history) {
    return {
      history: {
        version: RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
        records: [],
        current: [],
      },
      reasons: [],
    };
  }
  if (!isRecord(history)) return { history: null, reasons: ["relationship_acceptance_history_malformed"] };
  if (history.version !== A2_RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION) {
    return { history: null, reasons: ["relationship_acceptance_history_version_unsupported"] };
  }
  const records = history.records;
  const current = history.current_acceptance_by_relationship_id;
  const sourceBound = workbook.current_source_bound_relationships;
  if (!Array.isArray(records) || !isRecord(current)) {
    return { history: null, reasons: ["relationship_acceptance_history_malformed"] };
  }
  if (Object.keys(current).length > 0 && !isRecord(sourceBound)) {
    return { history: null, reasons: ["source_bound_relationship_missing"] };
  }

  const reasons: SqlWorkbookSourceAuthorityAdapterReasonCode[] = [];
  const acceptedContracts = workbook.acceptedRelationshipContracts || [];
  const validationByRelationship = new Map(
    validationLedger.current.map((projection) => [projection.relationshipId, projection]),
  );
  const validationRecordById = new Map(
    validationLedger.records.map((record) => [record.recordId, record]),
  );
  const recordsById = new Map<string, Record<string, unknown>>();
  for (const item of records) {
    if (!isRecord(item)) {
      reasons.push("relationship_acceptance_history_malformed");
      continue;
    }
    const recordId = stringValue(item.acceptance_record_id);
    if (!recordId || recordsById.has(recordId)) {
      reasons.push("relationship_acceptance_history_malformed");
      continue;
    }
    recordsById.set(recordId, item);
  }

  const normalizedRecords: SourceAwareRelationshipAcceptanceHistory["records"] = [];
  const normalizedCurrent: SourceAwareRelationshipAcceptanceHistory["current"] = [];
  Object.entries(current).forEach(([relationshipId, value]) => {
    const acceptanceRecordId = stringValue(value);
    const acceptance = acceptanceRecordId ? recordsById.get(acceptanceRecordId) : null;
    const validationProjection = validationByRelationship.get(relationshipId);
    const validationRecord = validationProjection
      ? validationRecordById.get(validationProjection.validationRecordId)
      : null;
    const contractId = stringValue(acceptance?.contract_id);
    const contract = acceptedContracts.find(
      (candidate: AcceptedRelationshipContract) =>
        candidate.acceptedFromCandidateId === relationshipId &&
        candidate.contractId === contractId &&
        candidate.status === "active" &&
        candidate.validationState !== "broken",
    );
    const sourceBoundRecord = isRecord(sourceBound) ? sourceBound[relationshipId] : null;
    if (!acceptanceRecordId || !acceptance || !validationProjection || !validationRecord) {
      reasons.push("relationship_acceptance_missing");
      return;
    }
    if (
      acceptance.relationship_id !== relationshipId ||
      acceptance.review_status !== "accepted" ||
      acceptance.validation_id !== validationProjection.validationAssessmentId ||
      acceptance.validation_identity !== validationProjection.validationIdentity ||
      !contractId ||
      !contract
    ) {
      reasons.push("relationship_acceptance_mismatch");
      return;
    }
    if (!isRecord(sourceBoundRecord)) {
      reasons.push("source_bound_relationship_missing");
      return;
    }
    if (
      sourceBoundRecord.relationship_id !== relationshipId ||
      sourceBoundRecord.validation_record_id !== validationRecord.recordId ||
      sourceBoundRecord.acceptance_record_id !== acceptanceRecordId ||
      sourceBoundRecord.validation_id !== validationProjection.validationAssessmentId ||
      sourceBoundRecord.validation_identity !== validationProjection.validationIdentity ||
      sourceBoundRecord.contract_id !== contract.contractId ||
      sourceBoundRecord.source_blind !== false
    ) {
      reasons.push("source_bound_relationship_mismatch");
      return;
    }
    normalizedRecords.push({
      recordId: acceptanceRecordId,
      relationshipId,
      validationRecordId: validationRecord.recordId,
      validationAssessmentId: validationProjection.validationAssessmentId,
      validationIdentity: validationProjection.validationIdentity,
      sourceAware: true,
    });
    normalizedCurrent.push({
      relationshipId,
      acceptanceRecordId,
      validationRecordId: validationRecord.recordId,
      validationAssessmentId: validationProjection.validationAssessmentId,
      validationIdentity: validationProjection.validationIdentity,
    });
  });
  if (reasons.length > 0) return { history: null, reasons: uniqueReasons(reasons) };
  return {
    history: {
      version: RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
      records: normalizedRecords.sort((left, right) => left.recordId.localeCompare(right.recordId)),
      current: normalizedCurrent.sort((left, right) => left.relationshipId.localeCompare(right.relationshipId)),
    },
    reasons: [],
  };
};

export const adaptWorkbookSourceAuthority = ({
  workbook,
  datasetId,
}: {
  workbook: WorkbookMetadata | null | undefined;
  datasetId: string;
}): SqlWorkbookSourceAuthorityAdapterResult => {
  if (!workbook) {
    return {
      ready: false,
      reasonCodes: ["source_registry_missing_legacy"],
      sourceRegistry: null,
      validationLedger: null,
      acceptanceHistory: null,
    };
  }
  const source = validateSourceRegistry(workbook, datasetId);
  const validation = adaptValidationLedger(workbook);
  const acceptance = validation.ledger
    ? adaptAcceptanceHistory(workbook, validation.ledger)
    : { history: null, reasons: [] };
  const reasonCodes = uniqueReasons([
    ...source.reasons,
    ...validation.reasons,
    ...acceptance.reasons,
  ]);
  if (reasonCodes.length > 0 || !source.registry || !validation.ledger || !acceptance.history) {
    return {
      ready: false,
      reasonCodes,
      sourceRegistry: source.registry,
      validationLedger: validation.ledger,
      acceptanceHistory: acceptance.history,
    };
  }
  return {
    ready: true,
    reasonCodes: [],
    sourceRegistry: source.registry,
    validationLedger: validation.ledger,
    acceptanceHistory: acceptance.history,
  };
};
