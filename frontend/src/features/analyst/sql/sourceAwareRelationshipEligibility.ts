import type { RelationshipEndpointSignature } from "../../workbook/worksheetSourceRevision";
import {
  RELATIONSHIP_SOURCE_VALIDATION_VERSION,
  evaluateRelationshipSourceValidationEligibility,
  type RelationshipSourceValidation,
  type RelationshipSourceValidationDirection,
  type RelationshipSourceValidationReasonCode,
} from "./relationshipSourceValidation";

export const SOURCE_AWARE_RELATIONSHIP_ELIGIBILITY_VERSION =
  "source-aware-relationship-eligibility:v1";
export const RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION =
  "relationship-source-validation-ledger:v1";
export const RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION =
  "relationship-acceptance-history:v1";

export type SourceAwareRelationshipEligibilityReasonCode =
  | RelationshipSourceValidationReasonCode
  | "relationship_missing"
  | "relationship_endpoint_mismatch"
  | "relationship_endpoint_signature_mismatch"
  | "relationship_structural_binding_mismatch"
  | "relationship_evidence_binding_mismatch"
  | "relationship_validation_record_missing"
  | "relationship_validation_projection_missing"
  | "relationship_acceptance_record_missing"
  | "relationship_acceptance_projection_missing"
  | "relationship_acceptance_mismatch"
  | "relationship_acceptance_legacy_source_blind"
  | "relationship_duplicate_conflict"
  | "relationship_request_duplicate"
  | "relationship_multi_source_edges_missing";

export type SourceAwareRelationshipValidationRecord = {
  recordId: string;
  validation: RelationshipSourceValidation;
};

export type SourceAwareRelationshipValidationProjection = {
  relationshipId: string;
  validationRecordId: string;
  validationAssessmentId: string;
  validationIdentity: string;
};

export type SourceAwareRelationshipValidationLedger = {
  version: typeof RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION;
  records: SourceAwareRelationshipValidationRecord[];
  current: SourceAwareRelationshipValidationProjection[];
};

export type SourceAwareRelationshipAcceptanceRecord = {
  recordId: string;
  relationshipId: string;
  validationRecordId: string;
  validationAssessmentId: string;
  validationIdentity: string;
  sourceAware: boolean;
};

export type SourceAwareRelationshipAcceptanceProjection = {
  relationshipId: string;
  acceptanceRecordId: string;
  validationRecordId: string;
  validationAssessmentId: string;
  validationIdentity: string;
};

export type SourceAwareRelationshipAcceptanceHistory = {
  version: typeof RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION;
  records: SourceAwareRelationshipAcceptanceRecord[];
  current: SourceAwareRelationshipAcceptanceProjection[];
};

export type SourceAwareRelationshipRequest = {
  relationshipId: string;
  direction: RelationshipSourceValidationDirection;
  leftEndpoint: RelationshipEndpointSignature;
  rightEndpoint: RelationshipEndpointSignature;
  evidenceFingerprint: string;
};

export type SourceAwareRelationshipEligibleBinding = {
  relationshipId: string;
  direction: RelationshipSourceValidationDirection;
  validationAssessmentId: string;
  validationIdentity: string;
  acceptanceRecordId: string;
  leftEndpoint: RelationshipEndpointSignature;
  rightEndpoint: RelationshipEndpointSignature;
};

export type SourceAwareRelationshipEligibilityResult =
  | {
      ready: true;
      reasonCodes: [];
      validationAssessmentId: string;
      validationIdentity: string;
      acceptanceRecordId: string;
      binding: SourceAwareRelationshipEligibleBinding;
    }
  | {
      ready: false;
      reasonCodes: SourceAwareRelationshipEligibilityReasonCode[];
      validationAssessmentId: null;
      validationIdentity: null;
      acceptanceRecordId: null;
      binding: null;
    };

export type SourceAwareRelationshipSetEligibilityResult =
  | {
      ready: true;
      reasonCodes: [];
      bindings: SourceAwareRelationshipEligibleBinding[];
    }
  | {
      ready: false;
      reasonCodes: SourceAwareRelationshipEligibilityReasonCode[];
      bindings: null;
    };

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const reasonPriority: Record<SourceAwareRelationshipEligibilityReasonCode, number> = {
  relationship_missing: 0,
  relationship_request_duplicate: 1,
  relationship_multi_source_edges_missing: 2,
  relationship_version_unsupported: 3,
  relationship_duplicate_conflict: 4,
  relationship_validation_projection_missing: 5,
  relationship_validation_record_missing: 6,
  relationship_validation_missing: 7,
  relationship_legacy_source_blind: 8,
  relationship_validation_mismatch: 9,
  relationship_validation_stale: 10,
  relationship_source_revision_mismatch: 11,
  relationship_schema_mismatch: 12,
  relationship_endpoint_removed: 13,
  relationship_endpoint_renamed: 14,
  relationship_endpoint_type_changed: 15,
  relationship_evidence_changed: 16,
  relationship_endpoint_mismatch: 17,
  relationship_endpoint_signature_mismatch: 18,
  relationship_structural_binding_mismatch: 19,
  relationship_evidence_binding_mismatch: 20,
  relationship_acceptance_projection_missing: 21,
  relationship_acceptance_record_missing: 22,
  relationship_acceptance_mismatch: 23,
  relationship_acceptance_legacy_source_blind: 24,
};

const normalizeReasons = (
  reasonCodes: SourceAwareRelationshipEligibilityReasonCode[],
): SourceAwareRelationshipEligibilityReasonCode[] =>
  unique(reasonCodes).sort((left, right) => reasonPriority[left] - reasonPriority[right]);

const blocked = (
  reasonCodes: SourceAwareRelationshipEligibilityReasonCode[],
): SourceAwareRelationshipEligibilityResult => ({
  ready: false,
  reasonCodes: normalizeReasons(reasonCodes),
  validationAssessmentId: null,
  validationIdentity: null,
  acceptanceRecordId: null,
  binding: null,
});

const hasConflictingDuplicates = <T>(
  values: T[],
  keyFor: (value: T) => string,
  bodyFor: (value: T) => string,
): boolean => {
  const seen = new Map<string, string>();
  return values.some((value) => {
    const key = keyFor(value);
    const body = bodyFor(value);
    const existing = seen.get(key);
    seen.set(key, body);
    return existing != null && existing !== body;
  });
};

export function evaluateSourceAwareRelationshipEligibility({
  request,
  validationLedger,
  acceptanceHistory,
}: {
  request: SourceAwareRelationshipRequest;
  validationLedger: SourceAwareRelationshipValidationLedger;
  acceptanceHistory: SourceAwareRelationshipAcceptanceHistory;
}): SourceAwareRelationshipEligibilityResult {
  if (validationLedger.version !== RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION) {
    return blocked(["relationship_version_unsupported"]);
  }
  if (acceptanceHistory.version !== RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION) {
    return blocked(["relationship_version_unsupported"]);
  }
  if (
    hasConflictingDuplicates(
      validationLedger.records,
      (record) => record.recordId,
      (record) => JSON.stringify(record.validation),
    ) ||
    hasConflictingDuplicates(
      acceptanceHistory.records,
      (record) => record.recordId,
      (record) => JSON.stringify(record),
    )
  ) {
    return blocked(["relationship_duplicate_conflict"]);
  }

  const validationProjection = validationLedger.current.find(
    (projection) => projection.relationshipId === request.relationshipId,
  );
  if (!validationProjection) return blocked(["relationship_validation_projection_missing"]);

  const validationRecord = validationLedger.records.find(
    (record) => record.recordId === validationProjection.validationRecordId,
  );
  if (!validationRecord) return blocked(["relationship_validation_record_missing"]);

  const validation = validationRecord.validation;
  if (
    validation.version !== RELATIONSHIP_SOURCE_VALIDATION_VERSION ||
    validation.relationshipId !== request.relationshipId ||
    validation.direction !== request.direction ||
    validation.assessmentId !== validationProjection.validationAssessmentId ||
    validation.validationIdentity !== validationProjection.validationIdentity
  ) {
    return blocked(["relationship_validation_mismatch"]);
  }
  if (
    request.direction === "directed" &&
    request.leftEndpoint.endpointSignatureId === validation.rightEndpoint.endpointSignatureId &&
    request.rightEndpoint.endpointSignatureId === validation.leftEndpoint.endpointSignatureId
  ) {
    return blocked(["relationship_endpoint_signature_mismatch"]);
  }

  const eligibility = evaluateRelationshipSourceValidationEligibility({
    relationshipId: request.relationshipId,
    direction: request.direction,
    currentLeftEndpoint: request.leftEndpoint,
    currentRightEndpoint: request.rightEndpoint,
    currentEvidenceFingerprint: {
      version: validation.evidenceFingerprint.version,
      fingerprint: request.evidenceFingerprint,
      evidence: cloneJson(validation.evidenceFingerprint.evidence),
    },
    validation,
  });
  if (!eligibility.eligible) {
    return blocked(eligibility.reasonCodes);
  }

  const acceptanceProjection = acceptanceHistory.current.find(
    (projection) => projection.relationshipId === request.relationshipId,
  );
  if (!acceptanceProjection) return blocked(["relationship_acceptance_projection_missing"]);

  const acceptanceRecord = acceptanceHistory.records.find(
    (record) => record.recordId === acceptanceProjection.acceptanceRecordId,
  );
  if (!acceptanceRecord) return blocked(["relationship_acceptance_record_missing"]);
  if (!acceptanceRecord.sourceAware) {
    return blocked(["relationship_acceptance_legacy_source_blind"]);
  }
  if (
    acceptanceRecord.relationshipId !== request.relationshipId ||
    acceptanceRecord.validationRecordId !== validationProjection.validationRecordId ||
    acceptanceRecord.validationAssessmentId !== validation.assessmentId ||
    acceptanceRecord.validationIdentity !== validation.validationIdentity ||
    acceptanceProjection.validationRecordId !== acceptanceRecord.validationRecordId ||
    acceptanceProjection.validationAssessmentId !== acceptanceRecord.validationAssessmentId ||
    acceptanceProjection.validationIdentity !== acceptanceRecord.validationIdentity
  ) {
    return blocked(["relationship_acceptance_mismatch"]);
  }

  const binding = {
    relationshipId: validation.relationshipId,
    direction: validation.direction,
    validationAssessmentId: validation.assessmentId,
    validationIdentity: validation.validationIdentity,
    acceptanceRecordId: acceptanceRecord.recordId,
    leftEndpoint: cloneJson(validation.leftEndpoint),
    rightEndpoint: cloneJson(validation.rightEndpoint),
  };

  return {
    ready: true,
    reasonCodes: [],
    validationAssessmentId: validation.assessmentId,
    validationIdentity: validation.validationIdentity,
    acceptanceRecordId: acceptanceRecord.recordId,
    binding,
  };
}

export function evaluateSourceAwareRelationshipSetEligibility({
  requests,
  validationLedger,
  acceptanceHistory,
  sourceBindingCount,
}: {
  requests: SourceAwareRelationshipRequest[];
  validationLedger: SourceAwareRelationshipValidationLedger;
  acceptanceHistory: SourceAwareRelationshipAcceptanceHistory;
  sourceBindingCount: number;
}): SourceAwareRelationshipSetEligibilityResult {
  if (requests.length === 0) {
    if (sourceBindingCount <= 1) {
      return {
        ready: true,
        reasonCodes: [],
        bindings: [],
      };
    }
    return {
      ready: false,
      reasonCodes: ["relationship_multi_source_edges_missing"],
      bindings: null,
    };
  }

  const duplicateRequests = new Set<string>();
  const requestKeys = new Set<string>();
  requests.forEach((request) => {
    if (requestKeys.has(request.relationshipId)) duplicateRequests.add(request.relationshipId);
    requestKeys.add(request.relationshipId);
  });
  if (duplicateRequests.size > 0) {
    return {
      ready: false,
      reasonCodes: ["relationship_request_duplicate"],
      bindings: null,
    };
  }

  const results = requests.map((request) =>
    evaluateSourceAwareRelationshipEligibility({
      request,
      validationLedger,
      acceptanceHistory,
    }),
  );
  const reasons = normalizeReasons(results.flatMap((result) => result.reasonCodes));
  if (reasons.length > 0) {
    return {
      ready: false,
      reasonCodes: reasons,
      bindings: null,
    };
  }
  return {
    ready: true,
    reasonCodes: [],
    bindings: results
      .filter((result): result is Extract<SourceAwareRelationshipEligibilityResult, { ready: true }> =>
        result.ready,
      )
      .map((result) => result.binding)
      .sort((left, right) => left.relationshipId.localeCompare(right.relationshipId)),
  };
}
