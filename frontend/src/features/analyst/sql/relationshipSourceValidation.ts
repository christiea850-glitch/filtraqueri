import {
  RELATIONSHIP_ENDPOINT_SIGNATURE_VERSION,
  RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION,
  areEndpointSignaturesStructurallyEquivalent,
  createDeterministicWorksheetSourceFingerprint,
  type RelationshipEndpointSignature,
  type RelationshipEvidenceFingerprint,
} from "../../workbook/worksheetSourceRevision";

export const RELATIONSHIP_SOURCE_VALIDATION_VERSION = "relationship-source-validation:v1";

export type RelationshipSourceValidationDirection = "directed" | "symmetric";

export type RelationshipSourceValidationReasonCode =
  | "relationship_validation_missing"
  | "relationship_legacy_source_blind"
  | "relationship_version_unsupported"
  | "relationship_validation_mismatch"
  | "relationship_validation_stale"
  | "relationship_source_revision_mismatch"
  | "relationship_schema_mismatch"
  | "relationship_endpoint_removed"
  | "relationship_endpoint_renamed"
  | "relationship_endpoint_type_changed"
  | "relationship_evidence_changed";

export type RelationshipSourceValidation = {
  version: typeof RELATIONSHIP_SOURCE_VALIDATION_VERSION;
  relationshipId: string;
  direction: RelationshipSourceValidationDirection;
  validationIdentity: string;
  assessmentId: string;
  leftEndpoint: RelationshipEndpointSignature;
  rightEndpoint: RelationshipEndpointSignature;
  evidenceFingerprint: RelationshipEvidenceFingerprint;
  status: "valid" | "stale" | "ineligible";
  reasonCodes: RelationshipSourceValidationReasonCode[];
};

export type RelationshipSourceValidationEligibility =
  | {
      status: "current_valid";
      eligible: true;
      revalidationRequired: false;
      reasonCodes: [];
    }
  | {
      status: "revalidation_required";
      eligible: false;
      revalidationRequired: true;
      reasonCodes: RelationshipSourceValidationReasonCode[];
    }
  | {
      status: "ineligible" | "invalid";
      eligible: false;
      revalidationRequired: false;
      reasonCodes: RelationshipSourceValidationReasonCode[];
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

const orderedEndpoints = (
  direction: RelationshipSourceValidationDirection,
  leftEndpoint: RelationshipEndpointSignature,
  rightEndpoint: RelationshipEndpointSignature,
): [RelationshipEndpointSignature, RelationshipEndpointSignature] => {
  if (direction === "directed") return [leftEndpoint, rightEndpoint];
  if (direction !== "symmetric") {
    throw new Error("Relationship validation direction is unsupported.");
  }
  return leftEndpoint.endpointSignatureId <= rightEndpoint.endpointSignatureId
    ? [leftEndpoint, rightEndpoint]
    : [rightEndpoint, leftEndpoint];
};

export const createRelationshipValidationIdentity = ({
  relationshipId,
  direction,
  leftEndpoint,
  rightEndpoint,
}: {
  relationshipId: string;
  direction: RelationshipSourceValidationDirection;
  leftEndpoint: RelationshipEndpointSignature;
  rightEndpoint: RelationshipEndpointSignature;
}): string => {
  const [orderedLeft, orderedRight] = orderedEndpoints(direction, leftEndpoint, rightEndpoint);
  return createDeterministicWorksheetSourceFingerprint("relationship-source-validation", {
    version: RELATIONSHIP_SOURCE_VALIDATION_VERSION,
    relationshipId: normalizeRequiredString(relationshipId, "relationshipId"),
    direction,
    endpoints: [
      {
        endpointSignatureId: orderedLeft.endpointSignatureId,
        sourceRevisionId: orderedLeft.sourceRevisionId,
      },
      {
        endpointSignatureId: orderedRight.endpointSignatureId,
        sourceRevisionId: orderedRight.sourceRevisionId,
      },
    ],
  });
};

export function createRelationshipSourceValidation({
  relationshipId,
  direction,
  leftEndpoint,
  rightEndpoint,
  evidenceFingerprint,
  status = "valid",
  reasonCodes = [],
}: {
  relationshipId: string;
  direction: RelationshipSourceValidationDirection;
  leftEndpoint: RelationshipEndpointSignature;
  rightEndpoint: RelationshipEndpointSignature;
  evidenceFingerprint: RelationshipEvidenceFingerprint;
  status?: "valid" | "stale" | "ineligible";
  reasonCodes?: RelationshipSourceValidationReasonCode[];
}): RelationshipSourceValidation {
  if (leftEndpoint.version !== RELATIONSHIP_ENDPOINT_SIGNATURE_VERSION) {
    throw new Error("Left endpoint signature version is unsupported.");
  }
  if (rightEndpoint.version !== RELATIONSHIP_ENDPOINT_SIGNATURE_VERSION) {
    throw new Error("Right endpoint signature version is unsupported.");
  }
  if (evidenceFingerprint.version !== RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION) {
    throw new Error("Evidence fingerprint version is unsupported.");
  }
  const normalizedRelationshipId = normalizeRequiredString(relationshipId, "relationshipId");
  const validationIdentity = createRelationshipValidationIdentity({
    relationshipId: normalizedRelationshipId,
    direction,
    leftEndpoint,
    rightEndpoint,
  });
  const normalizedReasonCodes = unique(reasonCodes);

  return {
    version: RELATIONSHIP_SOURCE_VALIDATION_VERSION,
    relationshipId: normalizedRelationshipId,
    direction,
    validationIdentity,
    assessmentId: createDeterministicWorksheetSourceFingerprint("relationship-source-assessment", {
      validationIdentity,
      evidenceFingerprint: evidenceFingerprint.fingerprint,
      status,
      reasonCodes: normalizedReasonCodes,
    }),
    leftEndpoint: cloneJson(leftEndpoint),
    rightEndpoint: cloneJson(rightEndpoint),
    evidenceFingerprint: cloneJson(evidenceFingerprint),
    status,
    reasonCodes: normalizedReasonCodes,
  };
}

const orderedPairMatches = (
  direction: RelationshipSourceValidationDirection,
  candidateLeft: RelationshipEndpointSignature,
  candidateRight: RelationshipEndpointSignature,
  validationLeft: RelationshipEndpointSignature,
  validationRight: RelationshipEndpointSignature,
  comparator: (
    candidate: RelationshipEndpointSignature,
    validation: RelationshipEndpointSignature,
  ) => boolean,
): boolean => {
  if (direction === "directed") {
    return comparator(candidateLeft, validationLeft) && comparator(candidateRight, validationRight);
  }
  return (
    (comparator(candidateLeft, validationLeft) && comparator(candidateRight, validationRight)) ||
    (comparator(candidateLeft, validationRight) && comparator(candidateRight, validationLeft))
  );
};

const collectEndpointChangeReasons = (
  currentEndpoint: RelationshipEndpointSignature,
  validationEndpoint: RelationshipEndpointSignature,
): RelationshipSourceValidationReasonCode[] => {
  const reasons: RelationshipSourceValidationReasonCode[] = [];
  if (
    currentEndpoint.physicalType !== validationEndpoint.physicalType ||
    currentEndpoint.logicalType !== validationEndpoint.logicalType
  ) {
    reasons.push("relationship_endpoint_type_changed");
  }
  if (currentEndpoint.columnName !== validationEndpoint.columnName) {
    reasons.push("relationship_endpoint_renamed");
  }
  if (currentEndpoint.structuralSchemaFingerprint !== validationEndpoint.structuralSchemaFingerprint) {
    reasons.push("relationship_schema_mismatch");
  }
  if (currentEndpoint.sourceRevisionId !== validationEndpoint.sourceRevisionId) {
    reasons.push("relationship_source_revision_mismatch");
  }
  return reasons;
};

export function evaluateRelationshipSourceValidationEligibility({
  relationshipId,
  direction,
  currentLeftEndpoint,
  currentRightEndpoint,
  currentEvidenceFingerprint,
  validation,
  legacyAcceptedRelationshipExists = false,
}: {
  relationshipId: string;
  direction: RelationshipSourceValidationDirection;
  currentLeftEndpoint: RelationshipEndpointSignature | null;
  currentRightEndpoint: RelationshipEndpointSignature | null;
  currentEvidenceFingerprint: RelationshipEvidenceFingerprint | null;
  validation: RelationshipSourceValidation | null;
  legacyAcceptedRelationshipExists?: boolean;
}): RelationshipSourceValidationEligibility {
  if (!validation) {
    return {
      status: "ineligible",
      eligible: false,
      revalidationRequired: false,
      reasonCodes: [
        legacyAcceptedRelationshipExists
          ? "relationship_legacy_source_blind"
          : "relationship_validation_missing",
      ],
    };
  }
  if (validation.version !== RELATIONSHIP_SOURCE_VALIDATION_VERSION) {
    return {
      status: "invalid",
      eligible: false,
      revalidationRequired: false,
      reasonCodes: ["relationship_version_unsupported"],
    };
  }
  if (!currentLeftEndpoint || !currentRightEndpoint) {
    return {
      status: "ineligible",
      eligible: false,
      revalidationRequired: false,
      reasonCodes: ["relationship_endpoint_removed"],
    };
  }
  if (validation.relationshipId !== relationshipId || validation.direction !== direction) {
    return {
      status: "invalid",
      eligible: false,
      revalidationRequired: false,
      reasonCodes: ["relationship_validation_mismatch"],
    };
  }

  const expectedIdentity = createRelationshipValidationIdentity({
    relationshipId,
    direction,
    leftEndpoint: validation.leftEndpoint,
    rightEndpoint: validation.rightEndpoint,
  });
  if (validation.validationIdentity !== expectedIdentity) {
    return {
      status: "invalid",
      eligible: false,
      revalidationRequired: false,
      reasonCodes: ["relationship_validation_mismatch"],
    };
  }
  if (validation.status !== "valid") {
    return {
      status: "ineligible",
      eligible: false,
      revalidationRequired: false,
      reasonCodes: unique(["relationship_validation_stale", ...validation.reasonCodes]),
    };
  }

  const exactMatch = orderedPairMatches(
    direction,
    currentLeftEndpoint,
    currentRightEndpoint,
    validation.leftEndpoint,
    validation.rightEndpoint,
    (candidate, accepted) => candidate.endpointSignatureId === accepted.endpointSignatureId,
  );
  if (exactMatch && currentEvidenceFingerprint?.fingerprint === validation.evidenceFingerprint.fingerprint) {
    return {
      status: "current_valid",
      eligible: true,
      revalidationRequired: false,
      reasonCodes: [],
    };
  }

  if (exactMatch && currentEvidenceFingerprint?.fingerprint !== validation.evidenceFingerprint.fingerprint) {
    return {
      status: "revalidation_required",
      eligible: false,
      revalidationRequired: true,
      reasonCodes: ["relationship_evidence_changed"],
    };
  }

  const structurallyEquivalent = orderedPairMatches(
    direction,
    currentLeftEndpoint,
    currentRightEndpoint,
    validation.leftEndpoint,
    validation.rightEndpoint,
    areEndpointSignaturesStructurallyEquivalent,
  );
  if (structurallyEquivalent) {
    return {
      status: "revalidation_required",
      eligible: false,
      revalidationRequired: true,
      reasonCodes: ["relationship_source_revision_mismatch"],
    };
  }

  const directReasons = [
    ...collectEndpointChangeReasons(currentLeftEndpoint, validation.leftEndpoint),
    ...collectEndpointChangeReasons(currentRightEndpoint, validation.rightEndpoint),
  ];
  return {
    status: "ineligible",
    eligible: false,
    revalidationRequired: false,
    reasonCodes: unique(directReasons.length > 0 ? directReasons : ["relationship_validation_mismatch"]),
  };
}
