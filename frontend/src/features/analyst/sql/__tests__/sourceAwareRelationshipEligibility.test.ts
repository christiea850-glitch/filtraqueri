import {
  createOriginalWorksheetSourceIdentity,
  createRelationshipEndpointSignature,
  createRelationshipEvidenceFingerprint,
  createWorksheetSourceRevision,
  createWorksheetStructuralSchemaFingerprint,
} from "../../../workbook/worksheetSourceRevision";
import { createRelationshipSourceValidation } from "../relationshipSourceValidation";
import {
  RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
  RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
  evaluateSourceAwareRelationshipEligibility,
  evaluateSourceAwareRelationshipSetEligibility,
  type SourceAwareRelationshipAcceptanceHistory,
  type SourceAwareRelationshipRequest,
  type SourceAwareRelationshipValidationLedger,
} from "../sourceAwareRelationshipEligibility";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SourceAwareRelationshipEligibilityFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const assertEqual = (actual: unknown, expected: unknown, message: string) =>
  actual === expected ? [] : [`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`];

const schema = createWorksheetStructuralSchemaFingerprint({
  columns: [
    {
      columnId: "col:id",
      ordinal: 0,
      name: "id",
      physicalType: "INTEGER",
      logicalType: "number",
      nullable: false,
    },
  ],
});

const revisionFor = (worksheetId: string, materializationFingerprint: string) =>
  createWorksheetSourceRevision({
    sourceIdentity: createOriginalWorksheetSourceIdentity({
      datasetId: "dataset:property",
      workbookId: "workbook:property",
      worksheetId,
    }),
    tableName: worksheetId.replace("worksheet:", ""),
    structuralSchemaFingerprint: schema,
    materializationFingerprint,
  });

const unitsRevision = revisionFor("worksheet:units", "materialization:units:v1");
const rentsRevision = revisionFor("worksheet:rents", "materialization:rents:v1");
const changedUnitsRevision = revisionFor("worksheet:units", "materialization:units:v2");

const unitsEndpoint = createRelationshipEndpointSignature({
  sourceRevision: unitsRevision,
  columnId: "col:unit_id",
  columnName: "unit_id",
  columnOrdinal: 0,
  physicalType: "INTEGER",
  logicalType: "number",
});
const rentsEndpoint = createRelationshipEndpointSignature({
  sourceRevision: rentsRevision,
  columnId: "col:unit_id",
  columnName: "unit_id",
  columnOrdinal: 0,
  physicalType: "INTEGER",
  logicalType: "number",
});
const staleUnitsEndpoint = createRelationshipEndpointSignature({
  sourceRevision: changedUnitsRevision,
  columnId: "col:unit_id",
  columnName: "unit_id",
  columnOrdinal: 0,
  physicalType: "INTEGER",
  logicalType: "number",
});
const renamedUnitsEndpoint = createRelationshipEndpointSignature({
  sourceRevision: unitsRevision,
  columnId: "col:unit_id",
  columnName: "renamed_unit_id",
  columnOrdinal: 0,
  physicalType: "INTEGER",
  logicalType: "number",
});
const typedUnitsEndpoint = createRelationshipEndpointSignature({
  sourceRevision: unitsRevision,
  columnId: "col:unit_id",
  columnName: "unit_id",
  columnOrdinal: 0,
  physicalType: "VARCHAR",
  logicalType: "text",
});

const evidence = createRelationshipEvidenceFingerprint({
  rowCount: 10,
  nullCount: 0,
  distinctCount: 10,
  uniquenessRatio: 1,
  overlapPolicyId: "policy:exact",
  sampledOverlapRatio: 1,
  sampledOverlapCount: 10,
});
const changedEvidence = createRelationshipEvidenceFingerprint({
  rowCount: 10,
  nullCount: 0,
  distinctCount: 9,
  uniquenessRatio: 0.9,
  overlapPolicyId: "policy:exact",
  sampledOverlapRatio: 0.9,
  sampledOverlapCount: 9,
});

const validation = createRelationshipSourceValidation({
  relationshipId: "relationship:units-rents",
  direction: "directed",
  leftEndpoint: unitsEndpoint,
  rightEndpoint: rentsEndpoint,
  evidenceFingerprint: evidence,
});
const symmetricValidation = createRelationshipSourceValidation({
  relationshipId: "relationship:symmetric",
  direction: "symmetric",
  leftEndpoint: unitsEndpoint,
  rightEndpoint: rentsEndpoint,
  evidenceFingerprint: evidence,
});

const request: SourceAwareRelationshipRequest = {
  relationshipId: validation.relationshipId,
  direction: validation.direction,
  leftEndpoint: unitsEndpoint,
  rightEndpoint: rentsEndpoint,
  evidenceFingerprint: evidence.fingerprint,
};

const ledger = (record = validation): SourceAwareRelationshipValidationLedger => ({
  version: RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
  records: [{ recordId: "validation-record:1", validation: record }],
  current: [
    {
      relationshipId: record.relationshipId,
      validationRecordId: "validation-record:1",
      validationAssessmentId: record.assessmentId,
      validationIdentity: record.validationIdentity,
    },
  ],
});

const acceptance = (sourceAware = true): SourceAwareRelationshipAcceptanceHistory => ({
  version: RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
  records: [
    {
      recordId: "acceptance-record:1",
      relationshipId: validation.relationshipId,
      validationRecordId: "validation-record:1",
      validationAssessmentId: validation.assessmentId,
      validationIdentity: validation.validationIdentity,
      sourceAware,
    },
  ],
  current: [
    {
      relationshipId: validation.relationshipId,
      acceptanceRecordId: "acceptance-record:1",
      validationRecordId: "validation-record:1",
      validationAssessmentId: validation.assessmentId,
      validationIdentity: validation.validationIdentity,
    },
  ],
});

export function runSourceAwareRelationshipEligibilityFixtures(): SourceAwareRelationshipEligibilityFixtureReport {
  const fixtures: FixtureResult[] = [
    {
      name: "current validation plus matching source-aware acceptance succeeds",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request,
          validationLedger: ledger(),
          acceptanceHistory: acceptance(),
        }).ready,
        true,
        "Expected relationship eligibility.",
      ),
      ok: false,
    },
    {
      name: "legacy source-blind acceptance blocks source-aware readiness",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request,
          validationLedger: ledger(),
          acceptanceHistory: acceptance(false),
        }).reasonCodes[0],
        "relationship_acceptance_legacy_source_blind",
        "Expected legacy acceptance block.",
      ),
      ok: false,
    },
    {
      name: "missing validation record blocks",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request,
          validationLedger: { ...ledger(), records: [] },
          acceptanceHistory: acceptance(),
        }).reasonCodes[0],
        "relationship_validation_record_missing",
        "Expected missing validation record block.",
      ),
      ok: false,
    },
    {
      name: "missing acceptance record blocks",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request,
          validationLedger: ledger(),
          acceptanceHistory: { ...acceptance(), records: [] },
        }).reasonCodes[0],
        "relationship_acceptance_record_missing",
        "Expected missing acceptance record block.",
      ),
      ok: false,
    },
    {
      name: "projection-to-record mismatch blocks",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request,
          validationLedger: {
            ...ledger(),
            current: [{ ...ledger().current[0], validationAssessmentId: "assessment:tampered" }],
          },
          acceptanceHistory: acceptance(),
        }).reasonCodes[0],
        "relationship_validation_mismatch",
        "Expected projection mismatch.",
      ),
      ok: false,
    },
    {
      name: "validation-to-acceptance mismatch blocks",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request,
          validationLedger: ledger(),
          acceptanceHistory: {
            ...acceptance(),
            current: [{ ...acceptance().current[0], validationIdentity: "validation:tampered" }],
          },
        }).reasonCodes[0],
        "relationship_acceptance_mismatch",
        "Expected acceptance mismatch.",
      ),
      ok: false,
    },
    {
      name: "stale source revision blocks",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request: { ...request, leftEndpoint: staleUnitsEndpoint },
          validationLedger: ledger(),
          acceptanceHistory: acceptance(),
        }).reasonCodes[0],
        "relationship_source_revision_mismatch",
        "Expected stale source revision block.",
      ),
      ok: false,
    },
    {
      name: "endpoint signature mismatch blocks",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request: { ...request, leftEndpoint: renamedUnitsEndpoint },
          validationLedger: ledger(),
          acceptanceHistory: acceptance(),
        }).reasonCodes.join(",").includes("relationship_endpoint_renamed"),
        true,
        "Expected endpoint rename block.",
      ),
      ok: false,
    },
    {
      name: "structural or type mismatch blocks",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request: { ...request, leftEndpoint: typedUnitsEndpoint },
          validationLedger: ledger(),
          acceptanceHistory: acceptance(),
        }).reasonCodes.join(",").includes("relationship_endpoint_type_changed"),
        true,
        "Expected endpoint type block.",
      ),
      ok: false,
    },
    {
      name: "evidence mismatch requires revalidation",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request: { ...request, evidenceFingerprint: changedEvidence.fingerprint },
          validationLedger: ledger(),
          acceptanceHistory: acceptance(),
        }).reasonCodes[0],
        "relationship_evidence_changed",
        "Expected evidence change block.",
      ),
      ok: false,
    },
    {
      name: "unsupported ledger or history blocks",
      failureReasons: [
        ...assertEqual(
          evaluateSourceAwareRelationshipEligibility({
            request,
            validationLedger: { ...ledger(), version: "ledger:v999" as typeof RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION },
            acceptanceHistory: acceptance(),
          }).reasonCodes[0],
          "relationship_version_unsupported",
          "Expected unsupported ledger block.",
        ),
        ...assertEqual(
          evaluateSourceAwareRelationshipEligibility({
            request,
            validationLedger: ledger(),
            acceptanceHistory: { ...acceptance(), version: "history:v999" as typeof RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION },
          }).reasonCodes[0],
          "relationship_version_unsupported",
          "Expected unsupported history block.",
        ),
      ],
      ok: false,
    },
    {
      name: "tampered duplicate records block",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request,
          validationLedger: {
            ...ledger(),
            records: [
              ledger().records[0],
              { recordId: "validation-record:1", validation: { ...validation, assessmentId: "assessment:tampered" } },
            ],
          },
          acceptanceHistory: acceptance(),
        }).reasonCodes[0],
        "relationship_duplicate_conflict",
        "Expected duplicate conflict block.",
      ),
      ok: false,
    },
    {
      name: "directed reversal blocks",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request: { ...request, leftEndpoint: rentsEndpoint, rightEndpoint: unitsEndpoint },
          validationLedger: ledger(),
          acceptanceHistory: acceptance(),
        }).reasonCodes[0],
        "relationship_endpoint_signature_mismatch",
        "Expected directed reversal to block.",
      ),
      ok: false,
    },
    {
      name: "symmetric canonical ordering succeeds",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipEligibility({
          request: {
            relationshipId: symmetricValidation.relationshipId,
            direction: "symmetric",
            leftEndpoint: rentsEndpoint,
            rightEndpoint: unitsEndpoint,
            evidenceFingerprint: evidence.fingerprint,
          },
          validationLedger: ledger(symmetricValidation),
          acceptanceHistory: {
            version: RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
            records: [
              {
                recordId: "acceptance-record:1",
                relationshipId: symmetricValidation.relationshipId,
                validationRecordId: "validation-record:1",
                validationAssessmentId: symmetricValidation.assessmentId,
                validationIdentity: symmetricValidation.validationIdentity,
                sourceAware: true,
              },
            ],
            current: [
              {
                relationshipId: symmetricValidation.relationshipId,
                acceptanceRecordId: "acceptance-record:1",
                validationRecordId: "validation-record:1",
                validationAssessmentId: symmetricValidation.assessmentId,
                validationIdentity: symmetricValidation.validationIdentity,
              },
            ],
          },
        }).ready,
        true,
        "Expected symmetric endpoint order to be canonical.",
      ),
      ok: false,
    },
    {
      name: "multi-edge partial eligibility blocks complete set",
      failureReasons: assertEqual(
        evaluateSourceAwareRelationshipSetEligibility({
          requests: [request, { ...request, relationshipId: "relationship:missing" }],
          validationLedger: ledger(),
          acceptanceHistory: acceptance(),
          sourceBindingCount: 2,
        }).bindings,
        null,
        "Expected no partial set bindings.",
      ),
      ok: false,
    },
    {
      name: "empty edge set succeeds only for true single-source input",
      failureReasons: [
        ...assertEqual(
          evaluateSourceAwareRelationshipSetEligibility({
            requests: [],
            validationLedger: ledger(),
            acceptanceHistory: acceptance(),
            sourceBindingCount: 1,
          }).ready,
          true,
          "Expected single-source empty edge set readiness.",
        ),
        ...assertEqual(
          evaluateSourceAwareRelationshipSetEligibility({
            requests: [],
            validationLedger: ledger(),
            acceptanceHistory: acceptance(),
            sourceBindingCount: 2,
          }).reasonCodes[0],
          "relationship_multi_source_edges_missing",
          "Expected multi-source empty edge block.",
        ),
      ],
      ok: false,
    },
  ];

  const results = fixtures.map((fixture) => ({
    ...fixture,
    ok: fixture.failureReasons.length === 0,
  }));

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
