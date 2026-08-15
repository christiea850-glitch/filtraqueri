import {
  createOriginalWorksheetSourceIdentity,
  createRelationshipEndpointSignature,
  createRelationshipEvidenceFingerprint,
  createWorksheetSourceRevision,
  createWorksheetStructuralSchemaFingerprint,
} from "../../../workbook/worksheetSourceRevision";
import {
  createRelationshipSourceValidation,
  createRelationshipValidationIdentity,
  evaluateRelationshipSourceValidationEligibility,
  type RelationshipSourceValidation,
} from "../relationshipSourceValidation";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type RelationshipSourceValidationFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const assertEqual = (actual: unknown, expected: unknown, message: string): string[] =>
  actual === expected ? [] : [`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`];

const makeRevision = ({
  worksheetId,
  materializationFingerprint,
  columnName = "unit_id",
  physicalType = "INTEGER",
}: {
  worksheetId: string;
  materializationFingerprint: string;
  columnName?: string;
  physicalType?: string;
}) => {
  const structuralSchemaFingerprint = createWorksheetStructuralSchemaFingerprint({
    columns: [
      {
        columnId: "col:unit-id",
        ordinal: 0,
        name: columnName,
        physicalType,
        logicalType: physicalType === "INTEGER" ? "number" : "text",
        nullable: false,
      },
    ],
  });
  return createWorksheetSourceRevision({
    sourceIdentity: createOriginalWorksheetSourceIdentity({
      datasetId: "dataset:property",
      workbookId: "workbook:property",
      worksheetId,
    }),
    tableName: worksheetId.replace("worksheet:", ""),
    structuralSchemaFingerprint,
    materializationFingerprint,
  });
};

const makeEndpoint = ({
  worksheetId,
  materializationFingerprint,
  columnName = "unit_id",
  physicalType = "INTEGER",
}: {
  worksheetId: string;
  materializationFingerprint: string;
  columnName?: string;
  physicalType?: string;
}) =>
  createRelationshipEndpointSignature({
    sourceRevision: makeRevision({
      worksheetId,
      materializationFingerprint,
      columnName,
      physicalType,
    }),
    columnId: "col:unit-id",
    columnName,
    columnOrdinal: 0,
    physicalType,
    logicalType: physicalType === "INTEGER" ? "number" : "text",
  });

export function runRelationshipSourceValidationFixtures(): RelationshipSourceValidationFixtureReport {
  const leftEndpoint = makeEndpoint({
    worksheetId: "worksheet:units",
    materializationFingerprint: "materialization:units:v1",
  });
  const rightEndpoint = makeEndpoint({
    worksheetId: "worksheet:access-codes",
    materializationFingerprint: "materialization:access-codes:v1",
  });
  const leftNewRevisionSameStructure = makeEndpoint({
    worksheetId: "worksheet:units",
    materializationFingerprint: "materialization:units:v2",
  });
  const renamedEndpoint = makeEndpoint({
    worksheetId: "worksheet:units",
    materializationFingerprint: "materialization:units:v3",
    columnName: "unit_key",
  });
  const typeChangedEndpoint = makeEndpoint({
    worksheetId: "worksheet:units",
    materializationFingerprint: "materialization:units:v4",
    physicalType: "TEXT",
  });
  const schemaChangedRevision = createWorksheetSourceRevision({
    sourceIdentity: createOriginalWorksheetSourceIdentity({
      datasetId: "dataset:property",
      workbookId: "workbook:property",
      worksheetId: "worksheet:units",
    }),
    tableName: "units",
    structuralSchemaFingerprint: createWorksheetStructuralSchemaFingerprint({
      columns: [
        {
          columnId: "col:unit-id",
          ordinal: 0,
          name: "unit_id",
          physicalType: "INTEGER",
          logicalType: "number",
          nullable: false,
        },
        {
          columnId: "col:added",
          ordinal: 1,
          name: "added_column",
          physicalType: "TEXT",
          logicalType: "text",
          nullable: true,
        },
      ],
    }),
    materializationFingerprint: "materialization:units:schema-change",
  });
  const schemaChangedEndpoint = createRelationshipEndpointSignature({
    sourceRevision: schemaChangedRevision,
    columnId: "col:unit-id",
    columnName: "unit_id",
    columnOrdinal: 0,
    physicalType: "INTEGER",
    logicalType: "number",
  });
  const alternateColumnEndpoint = createRelationshipEndpointSignature({
    sourceRevision: makeRevision({
      worksheetId: "worksheet:units",
      materializationFingerprint: "materialization:units:alternate-column",
      columnName: "account_id",
    }),
    columnId: "col:account-id",
    columnName: "account_id",
    columnOrdinal: 0,
    physicalType: "INTEGER",
    logicalType: "number",
  });
  const thirdEndpoint = makeEndpoint({
    worksheetId: "worksheet:payments",
    materializationFingerprint: "materialization:payments:v1",
  });
  const fourthEndpoint = makeEndpoint({
    worksheetId: "worksheet:balances",
    materializationFingerprint: "materialization:balances:v1",
  });
  const evidence = createRelationshipEvidenceFingerprint({
    rowCount: 100,
    nullCount: 0,
    distinctCount: 100,
    uniquenessRatio: 1,
    cardinalityEvidence: "one_to_many",
    candidateKeyEvidence: "unique",
    overlapPolicyId: "sampled-overlap:v1",
    sampledOverlapRatio: 0.98,
    sampledOverlapCount: 98,
  });
  const changedEvidence = createRelationshipEvidenceFingerprint({
    rowCount: 100,
    nullCount: 2,
    distinctCount: 96,
    uniquenessRatio: 0.96,
    cardinalityEvidence: "one_to_many",
    candidateKeyEvidence: "mostly_unique",
    overlapPolicyId: "sampled-overlap:v1",
    sampledOverlapRatio: 0.94,
    sampledOverlapCount: 94,
  });
  const validation = createRelationshipSourceValidation({
    relationshipId: "relationship:units-access-codes",
    direction: "symmetric",
    leftEndpoint,
    rightEndpoint,
    evidenceFingerprint: evidence,
  });
  const reversedValidation = createRelationshipSourceValidation({
    relationshipId: "relationship:units-access-codes",
    direction: "symmetric",
    leftEndpoint: rightEndpoint,
    rightEndpoint: leftEndpoint,
    evidenceFingerprint: evidence,
  });
  const staleValidation = createRelationshipSourceValidation({
    relationshipId: "relationship:units-access-codes",
    direction: "symmetric",
    leftEndpoint,
    rightEndpoint,
    evidenceFingerprint: evidence,
    status: "stale",
    reasonCodes: ["relationship_validation_stale"],
  });
  const directedValidation = createRelationshipSourceValidation({
    relationshipId: "relationship:directed",
    direction: "directed",
    leftEndpoint,
    rightEndpoint,
    evidenceFingerprint: evidence,
  });
  const reversedDirectedValidation = createRelationshipSourceValidation({
    relationshipId: "relationship:directed",
    direction: "directed",
    leftEndpoint: rightEndpoint,
    rightEndpoint: leftEndpoint,
    evidenceFingerprint: evidence,
  });
  const alternateColumnValidation = createRelationshipSourceValidation({
    relationshipId: "relationship:alternate-column",
    direction: "symmetric",
    leftEndpoint: alternateColumnEndpoint,
    rightEndpoint,
    evidenceFingerprint: evidence,
  });
  const sameWorksheetDifferentRelationship = createRelationshipSourceValidation({
    relationshipId: "relationship:distinct-id",
    direction: "symmetric",
    leftEndpoint,
    rightEndpoint,
    evidenceFingerprint: evidence,
  });
  const edgeAB = createRelationshipSourceValidation({
    relationshipId: "relationship:edge-ab",
    direction: "directed",
    leftEndpoint,
    rightEndpoint,
    evidenceFingerprint: evidence,
  });
  const edgeBC = createRelationshipSourceValidation({
    relationshipId: "relationship:edge-bc",
    direction: "directed",
    leftEndpoint: rightEndpoint,
    rightEndpoint: thirdEndpoint,
    evidenceFingerprint: evidence,
  });
  const edgeCD = createRelationshipSourceValidation({
    relationshipId: "relationship:edge-cd",
    direction: "directed",
    leftEndpoint: thirdEndpoint,
    rightEndpoint: fourthEndpoint,
    evidenceFingerprint: evidence,
  });
  const mutableLeftEndpoint = makeEndpoint({
    worksheetId: "worksheet:mutable-left",
    materializationFingerprint: "materialization:mutable-left:v1",
  });
  const mutableRightEndpoint = makeEndpoint({
    worksheetId: "worksheet:mutable-right",
    materializationFingerprint: "materialization:mutable-right:v1",
  });
  const mutableEvidence = createRelationshipEvidenceFingerprint({ rowCount: 2, distinctCount: 2 });
  const immutableValidation = createRelationshipSourceValidation({
    relationshipId: "relationship:immutable",
    direction: "directed",
    leftEndpoint: mutableLeftEndpoint,
    rightEndpoint: mutableRightEndpoint,
    evidenceFingerprint: mutableEvidence,
  });
  mutableLeftEndpoint.columnName = "mutated_after_creation";
  mutableEvidence.evidence.distinctCount = 1;
  const historicalBefore = JSON.stringify(validation);

  const fixtures: FixtureResult[] = [
    {
      name: "symmetric relationship identity is endpoint-order independent",
      failureReasons: assertEqual(
        reversedValidation.validationIdentity,
        validation.validationIdentity,
        "Expected symmetric validation identity to be stable.",
      ),
      ok: false,
    },
    {
      name: "current validation remains eligible for exact endpoints and evidence",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation,
        }).status,
        "current_valid",
        "Expected current validation.",
      ),
      ok: false,
    },
    {
      name: "materialization-only source revision change requires revalidation",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: leftNewRevisionSameStructure,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation,
        }).reasonCodes[0],
        "relationship_source_revision_mismatch",
        "Expected source revision mismatch.",
      ),
      ok: false,
    },
    {
      name: "evidence change requires a new assessment",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: changedEvidence,
          validation,
        }).reasonCodes[0],
        "relationship_evidence_changed",
        "Expected evidence change reason.",
      ),
      ok: false,
    },
    {
      name: "stale validation is ineligible",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation: staleValidation,
        }).status,
        "ineligible",
        "Expected stale validation to be ineligible.",
      ),
      ok: false,
    },
    {
      name: "endpoint removal is detected without backend lookup",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: null,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation,
        }).reasonCodes[0],
        "relationship_endpoint_removed",
        "Expected endpoint removal.",
      ),
      ok: false,
    },
    {
      name: "endpoint rename is ineligible",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: renamedEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation,
        }).reasonCodes.join(",").includes("relationship_endpoint_renamed"),
        true,
        "Expected rename reason.",
      ),
      ok: false,
    },
    {
      name: "endpoint type change is ineligible",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: typeChangedEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation,
        }).reasonCodes.join(",").includes("relationship_endpoint_type_changed"),
        true,
        "Expected type change reason.",
      ),
      ok: false,
    },
    {
      name: "missing validation is ineligible",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation: null,
        }).reasonCodes[0],
        "relationship_validation_missing",
        "Expected missing validation reason.",
      ),
      ok: false,
    },
    {
      name: "legacy source-blind accepted relationship is distinct from missing validation",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation: null,
          legacyAcceptedRelationshipExists: true,
        }).reasonCodes[0],
        "relationship_legacy_source_blind",
        "Expected legacy source-blind reason.",
      ),
      ok: false,
    },
    {
      name: "unsupported relationship-validation version is invalid",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation: {
            ...validation,
            version: "relationship-source-validation:v999",
          } as unknown as RelationshipSourceValidation,
        }).reasonCodes[0],
        "relationship_version_unsupported",
        "Expected unsupported validation version.",
      ),
      ok: false,
    },
    {
      name: "relationship id mismatch is invalid",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:other",
          direction: "symmetric",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation,
        }).reasonCodes[0],
        "relationship_validation_mismatch",
        "Expected relationship ID mismatch.",
      ),
      ok: false,
    },
    {
      name: "direction mismatch is invalid",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "directed",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation,
        }).reasonCodes[0],
        "relationship_validation_mismatch",
        "Expected direction mismatch.",
      ),
      ok: false,
    },
    {
      name: "recomputed validation-identity mismatch is invalid",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: leftEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation: {
            ...validation,
            validationIdentity: createRelationshipValidationIdentity({
              relationshipId: "relationship:tampered",
              direction: "symmetric",
              leftEndpoint,
              rightEndpoint,
            }),
          },
        }).reasonCodes[0],
        "relationship_validation_mismatch",
        "Expected validation identity mismatch.",
      ),
      ok: false,
    },
    {
      name: "structural schema fingerprint change is ineligible",
      failureReasons: assertEqual(
        evaluateRelationshipSourceValidationEligibility({
          relationshipId: "relationship:units-access-codes",
          direction: "symmetric",
          currentLeftEndpoint: schemaChangedEndpoint,
          currentRightEndpoint: rightEndpoint,
          currentEvidenceFingerprint: evidence,
          validation,
        }).reasonCodes.join(",").includes("relationship_schema_mismatch"),
        true,
        "Expected structural schema mismatch reason.",
      ),
      ok: false,
    },
    {
      name: "different column pairs produce different validation identities",
      failureReasons: assertEqual(
        alternateColumnValidation.validationIdentity === validation.validationIdentity,
        false,
        "Expected different column-pair identity.",
      ),
      ok: false,
    },
    {
      name: "two distinct relationships between the same worksheets remain distinct",
      failureReasons: assertEqual(
        sameWorksheetDifferentRelationship.validationIdentity === validation.validationIdentity,
        false,
        "Expected relationship ID to distinguish validation identity.",
      ),
      ok: false,
    },
    {
      name: "three-edge multi-hop relationships validate independently",
      failureReasons: [
        ...assertEqual(
          evaluateRelationshipSourceValidationEligibility({
            relationshipId: "relationship:edge-ab",
            direction: "directed",
            currentLeftEndpoint: leftEndpoint,
            currentRightEndpoint: rightEndpoint,
            currentEvidenceFingerprint: evidence,
            validation: edgeAB,
          }).status,
          "current_valid",
          "Expected AB edge valid.",
        ),
        ...assertEqual(
          evaluateRelationshipSourceValidationEligibility({
            relationshipId: "relationship:edge-bc",
            direction: "directed",
            currentLeftEndpoint: rightEndpoint,
            currentRightEndpoint: thirdEndpoint,
            currentEvidenceFingerprint: evidence,
            validation: edgeBC,
          }).status,
          "current_valid",
          "Expected BC edge valid.",
        ),
        ...assertEqual(
          evaluateRelationshipSourceValidationEligibility({
            relationshipId: "relationship:edge-cd",
            direction: "directed",
            currentLeftEndpoint: thirdEndpoint,
            currentRightEndpoint: fourthEndpoint,
            currentEvidenceFingerprint: evidence,
            validation: edgeCD,
          }).status,
          "current_valid",
          "Expected CD edge valid.",
        ),
      ],
      ok: false,
    },
    {
      name: "json round trip preserves validation and eligibility",
      failureReasons: [
        ...assertEqual(
          JSON.parse(JSON.stringify(validation)).validationIdentity,
          validation.validationIdentity,
          "Expected validation identity round trip.",
        ),
        ...assertEqual(
          JSON.parse(JSON.stringify(validation)).assessmentId,
          validation.assessmentId,
          "Expected assessment identity round trip.",
        ),
        ...assertEqual(
          evaluateRelationshipSourceValidationEligibility({
            relationshipId: "relationship:units-access-codes",
            direction: "symmetric",
            currentLeftEndpoint: leftEndpoint,
            currentRightEndpoint: rightEndpoint,
            currentEvidenceFingerprint: evidence,
            validation: JSON.parse(JSON.stringify(validation)) as RelationshipSourceValidation,
          }).status,
          "current_valid",
          "Expected eligibility round trip.",
        ),
      ],
      ok: false,
    },
    {
      name: "caller-input immutability preserves stored relationship assessment",
      failureReasons: [
        ...assertEqual(
          immutableValidation.leftEndpoint.columnName,
          "unit_id",
          "Expected stored endpoint to ignore caller mutation.",
        ),
        ...assertEqual(
          immutableValidation.evidenceFingerprint.evidence.distinctCount,
          2,
          "Expected stored evidence to ignore caller mutation.",
        ),
      ],
      ok: false,
    },
    {
      name: "historical validation remains byte-identical after later revision evaluation",
      failureReasons: [
        ...assertEqual(
          evaluateRelationshipSourceValidationEligibility({
            relationshipId: "relationship:units-access-codes",
            direction: "symmetric",
            currentLeftEndpoint: leftNewRevisionSameStructure,
            currentRightEndpoint: rightEndpoint,
            currentEvidenceFingerprint: evidence,
            validation,
          }).status,
          "revalidation_required",
          "Expected later revision to require revalidation.",
        ),
        ...assertEqual(JSON.stringify(validation), historicalBefore, "Expected historical validation unchanged."),
      ],
      ok: false,
    },
    {
      name: "directed ordering is identity-significant",
      failureReasons: assertEqual(
        directedValidation.validationIdentity === reversedDirectedValidation.validationIdentity,
        false,
        "Expected directed endpoint order to matter.",
      ),
      ok: false,
    },
    {
      name: "symmetric reverse ordering is identity-stable",
      failureReasons: assertEqual(
        reversedValidation.validationIdentity,
        validation.validationIdentity,
        "Expected symmetric endpoint order not to matter.",
      ),
      ok: false,
    },
    {
      name: "atomic rejection exposes no partial eligible result",
      failureReasons: [
        ...assertEqual(
          evaluateRelationshipSourceValidationEligibility({
            relationshipId: "relationship:units-access-codes",
            direction: "symmetric",
            currentLeftEndpoint: null,
            currentRightEndpoint: rightEndpoint,
            currentEvidenceFingerprint: evidence,
            validation,
          }).eligible,
          false,
          "Expected rejection to be ineligible.",
        ),
        ...assertEqual(
          evaluateRelationshipSourceValidationEligibility({
            relationshipId: "relationship:units-access-codes",
            direction: "symmetric",
            currentLeftEndpoint: null,
            currentRightEndpoint: rightEndpoint,
            currentEvidenceFingerprint: evidence,
            validation,
          }).revalidationRequired,
          false,
          "Expected rejection not to expose partial revalidation result.",
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
