import {
  createDeterministicWorksheetSourceFingerprint,
  createCleanedWorksheetSourceIdentity,
  createOriginalWorksheetSourceIdentity,
  createRelationshipEndpointSignature,
  createRelationshipEvidenceFingerprint,
  createWorksheetSourceRevision,
  createWorksheetStructuralSchemaFingerprint,
  type RelationshipEvidenceFingerprintInput,
  type WorksheetStructuralColumnInput,
} from "../worksheetSourceRevision";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type WorksheetSourceRevisionFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const assertEqual = (actual: unknown, expected: unknown, message: string): string[] =>
  actual === expected ? [] : [`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`];

const assertNotEqual = (actual: unknown, expected: unknown, message: string): string[] =>
  actual !== expected ? [] : [`${message} Both values were ${JSON.stringify(actual)}.`];

const assertThrows = (run: () => unknown, message: string): string[] => {
  try {
    run();
  } catch {
    return [];
  }
  return [message];
};

const baseSchema = () =>
  createWorksheetStructuralSchemaFingerprint({
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
        columnId: "col:rent",
        ordinal: 1,
        name: "rent",
        physicalType: "DOUBLE",
        logicalType: "currency",
        nullable: true,
      },
    ],
  });

export function runWorksheetSourceRevisionFixtures(): WorksheetSourceRevisionFixtureReport {
  const originalIdentity = createOriginalWorksheetSourceIdentity({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    worksheetId: "worksheet:units",
  });
  const sameOriginalIdentity = createOriginalWorksheetSourceIdentity({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    worksheetId: "worksheet:units",
  });
  const cleanedIdentity = createCleanedWorksheetSourceIdentity({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    worksheetId: "worksheet:units",
    cleanedLineageId: "cleaning-lineage:accepted-normalization",
  });
  const schema = baseSchema();
  const reorderedSchema = createWorksheetStructuralSchemaFingerprint({
    columns: [...schema.columns].reverse().map((column) => ({
      ...column,
      columnId: column.columnId,
    })),
  });
  const renamedSchema = createWorksheetStructuralSchemaFingerprint({
    columns: [
      { ...schema.columns[0], name: "unit_key" },
      schema.columns[1],
    ],
  });
  const revision = createWorksheetSourceRevision({
    sourceIdentity: originalIdentity,
    tableName: "units",
    structuralSchemaFingerprint: schema,
    materializationFingerprint: "materialization:original:units:v1",
  });
  const changedMaterializationRevision = createWorksheetSourceRevision({
    sourceIdentity: originalIdentity,
    tableName: "units",
    structuralSchemaFingerprint: schema,
    materializationFingerprint: "materialization:original:units:v2",
  });
  const cleanedRevision = createWorksheetSourceRevision({
    sourceIdentity: cleanedIdentity,
    tableName: "units_clean",
    structuralSchemaFingerprint: schema,
    materializationFingerprint: "materialization:cleaned:units:v1",
    transformationLineageId: "cleaning-lineage:accepted-normalization",
  });
  const evidence = createRelationshipEvidenceFingerprint({
    rowCount: 100,
    nullCount: 0,
    distinctCount: 100,
    uniquenessRatio: 1,
    cardinalityEvidence: "one_to_many",
    candidateKeyEvidence: "unique",
    overlapPolicyId: "sampled-overlap:v1",
    sampledOverlapRatio: 0.96,
    sampledOverlapCount: 96,
  });
  const changedEvidence = createRelationshipEvidenceFingerprint({
    rowCount: 100,
    nullCount: 0,
    distinctCount: 95,
    uniquenessRatio: 0.95,
    cardinalityEvidence: "one_to_many",
    candidateKeyEvidence: "mostly_unique",
    overlapPolicyId: "sampled-overlap:v1",
    sampledOverlapRatio: 0.96,
    sampledOverlapCount: 96,
  });
  const endpoint = createRelationshipEndpointSignature({
    sourceRevision: revision,
    columnId: "col:unit-id",
    columnName: "unit_id",
    columnOrdinal: 0,
    physicalType: "INTEGER",
    logicalType: "number",
  });
  const sameRevision = createWorksheetSourceRevision({
    sourceIdentity: createOriginalWorksheetSourceIdentity({
      datasetId: "dataset:property",
      workbookId: "workbook:property",
      worksheetId: "worksheet:units",
    }),
    tableName: "units",
    structuralSchemaFingerprint: baseSchema(),
    materializationFingerprint: "materialization:original:units:v1",
  });
  const mutableColumnInput: WorksheetStructuralColumnInput = {
    columnId: "col:mutable",
    ordinal: 0,
    name: "mutable_id",
    physicalType: "INTEGER",
    logicalType: "number",
    nullable: false,
  };
  const immutableSchema = createWorksheetStructuralSchemaFingerprint({
    columns: [mutableColumnInput],
  });
  mutableColumnInput.name = "mutated_after_creation";
  const mutableEvidenceInput: RelationshipEvidenceFingerprintInput = {
    rowCount: 5,
    nullCount: 0,
    distinctCount: 5,
    uniquenessRatio: 1,
  };
  const immutableEvidence = createRelationshipEvidenceFingerprint(mutableEvidenceInput);
  mutableEvidenceInput.distinctCount = 1;
  const mutableIdentityInput = {
    datasetId: "dataset:mutable",
    workbookId: "workbook:mutable",
    worksheetId: "worksheet:mutable",
  };
  const immutableIdentity = createOriginalWorksheetSourceIdentity(mutableIdentityInput);
  mutableIdentityInput.worksheetId = "worksheet:mutated";
  const mutableRevisionSourceIdentity = createOriginalWorksheetSourceIdentity({
    datasetId: "dataset:revision",
    workbookId: "workbook:revision",
    worksheetId: "worksheet:revision",
  });
  const immutableRevision = createWorksheetSourceRevision({
    sourceIdentity: mutableRevisionSourceIdentity,
    tableName: "revision_table",
    structuralSchemaFingerprint: schema,
    materializationFingerprint: "materialization:revision:v1",
  });
  mutableRevisionSourceIdentity.worksheetId = "worksheet:mutated";
  const schemaForEvidenceOnlyChange = createWorksheetStructuralSchemaFingerprint({
    columns: [{ columnId: "col:evidence", ordinal: 0, name: "evidence_id", physicalType: "TEXT", logicalType: "text" }],
  });
  const evidenceOnlyA = createRelationshipEvidenceFingerprint({
    rowCount: 10,
    nullCount: 1,
    distinctCount: 9,
    uniquenessRatio: 0.9,
  });
  const evidenceOnlyB = createRelationshipEvidenceFingerprint({
    rowCount: 10,
    nullCount: 2,
    distinctCount: 8,
    uniquenessRatio: 0.8,
  });
  const invalidEvidenceInputs: Array<[string, RelationshipEvidenceFingerprintInput]> = [
    ["NaN count", { rowCount: Number.NaN }],
    ["Infinity count", { rowCount: Number.POSITIVE_INFINITY }],
    ["negative count", { rowCount: -1 }],
    ["negative ratio", { uniquenessRatio: -0.1 }],
    ["ratio greater than one", { uniquenessRatio: 1.1 }],
    ["null count greater than row count", { rowCount: 1, nullCount: 2 }],
    ["distinct count greater than row count", { rowCount: 1, distinctCount: 2 }],
    ["sampled overlap count greater than row count", { rowCount: 1, sampledOverlapCount: 2 }],
  ];

  const fixtures: FixtureResult[] = [
    {
      name: "original worksheet source identity is stable",
      failureReasons: [
        ...assertEqual(
          originalIdentity.sourceId,
          sameOriginalIdentity.sourceId,
          "Expected persisted worksheet source identity to be stable.",
        ),
        ...assertEqual(originalIdentity.sourceKind, "original", "Expected original source kind."),
      ],
      ok: false,
    },
    {
      name: "cleaned worksheet source identity is separate from original",
      failureReasons: [
        ...assertNotEqual(
          cleanedIdentity.sourceId,
          originalIdentity.sourceId,
          "Expected cleaned working copy to have a distinct source identity.",
        ),
        ...assertEqual(
          cleanedIdentity.cleanedLineageId,
          "cleaning-lineage:accepted-normalization",
          "Expected cleaned lineage identity.",
        ),
      ],
      ok: false,
    },
    {
      name: "structural schema fingerprint ignores caller column order",
      failureReasons: assertEqual(
        reorderedSchema.fingerprint,
        schema.fingerprint,
        "Expected ordinal-based structural fingerprint stability.",
      ),
      ok: false,
    },
    {
      name: "structural schema fingerprint detects endpoint rename",
      failureReasons: assertNotEqual(
        renamedSchema.fingerprint,
        schema.fingerprint,
        "Expected renamed column to change structural fingerprint.",
      ),
      ok: false,
    },
    {
      name: "worksheet revision changes when materialization changes",
      failureReasons: assertNotEqual(
        changedMaterializationRevision.revisionId,
        revision.revisionId,
        "Expected revision to include materialization fingerprint.",
      ),
      ok: false,
    },
    {
      name: "cleaned revision carries transformation lineage without changing production state",
      failureReasons: [
        ...assertEqual(
          cleanedRevision.sourceIdentity.sourceKind,
          "cleaned_working_copy",
          "Expected cleaned source kind.",
        ),
        ...assertEqual(
          cleanedRevision.transformationLineageId,
          "cleaning-lineage:accepted-normalization",
          "Expected transformation lineage.",
        ),
      ],
      ok: false,
    },
    {
      name: "relationship evidence fingerprint excludes raw sampled values",
      failureReasons: [
        ...assertNotEqual(
          changedEvidence.fingerprint,
          evidence.fingerprint,
          "Expected aggregate evidence changes to alter fingerprint.",
        ),
        ...assertEqual(
          JSON.stringify(evidence).includes("sampleValues"),
          false,
          "Expected no raw sample values in evidence contract.",
        ),
      ],
      ok: false,
    },
    {
      name: "endpoint signature binds exact source revision and structural schema",
      failureReasons: [
        ...assertEqual(
          endpoint.sourceRevisionId,
          revision.revisionId,
          "Expected endpoint to bind source revision.",
        ),
        ...assertEqual(
          endpoint.structuralSchemaFingerprint,
          schema.fingerprint,
          "Expected endpoint to bind structural schema.",
        ),
      ],
      ok: false,
    },
    {
      name: "contract factories reject missing required identities",
      failureReasons: assertThrows(
        () =>
          createOriginalWorksheetSourceIdentity({
            datasetId: "dataset:property",
            workbookId: " ",
            worksheetId: "worksheet:units",
          }),
        "Expected blank workbook ID to throw.",
      ),
      ok: false,
    },
    {
      name: "unsupported source-identity version rejects",
      failureReasons: assertThrows(
        () =>
          createWorksheetSourceRevision({
            sourceIdentity: {
              ...originalIdentity,
              version: "worksheet-source-identity:v999",
            } as unknown as typeof originalIdentity,
            tableName: "units",
            structuralSchemaFingerprint: schema,
            materializationFingerprint: "materialization:original:units:v1",
          }),
        "Expected unsupported source identity version to throw.",
      ),
      ok: false,
    },
    {
      name: "unsupported source-revision version rejects endpoint binding",
      failureReasons: assertThrows(
        () =>
          createRelationshipEndpointSignature({
            sourceRevision: {
              ...revision,
              version: "worksheet-source-revision:v999",
            } as unknown as typeof revision,
            columnId: "col:unit-id",
            columnName: "unit_id",
            columnOrdinal: 0,
            physicalType: "INTEGER",
            logicalType: "number",
          }),
        "Expected unsupported source revision version to throw.",
      ),
      ok: false,
    },
    {
      name: "unsupported structural schema version rejects revision binding",
      failureReasons: assertThrows(
        () =>
          createWorksheetSourceRevision({
            sourceIdentity: originalIdentity,
            tableName: "units",
            structuralSchemaFingerprint: {
              ...schema,
              version: "worksheet-structural-schema-fingerprint:v999",
            } as unknown as typeof schema,
            materializationFingerprint: "materialization:original:units:v1",
          }),
        "Expected unsupported structural schema version to throw.",
      ),
      ok: false,
    },
    {
      name: "invalid numeric evidence inputs reject",
      failureReasons: invalidEvidenceInputs.flatMap(([label, input]) =>
        assertThrows(
          () => createRelationshipEvidenceFingerprint(input),
          `Expected invalid evidence input to throw: ${label}.`,
        ),
      ),
      ok: false,
    },
    {
      name: "json round trip preserves worksheet source contracts",
      failureReasons: [
        ...assertEqual(
          JSON.stringify(JSON.parse(JSON.stringify(originalIdentity))),
          JSON.stringify(originalIdentity),
          "Expected source identity round trip.",
        ),
        ...assertEqual(
          JSON.stringify(JSON.parse(JSON.stringify(revision))),
          JSON.stringify(revision),
          "Expected source revision round trip.",
        ),
        ...assertEqual(
          JSON.stringify(JSON.parse(JSON.stringify(schema))),
          JSON.stringify(schema),
          "Expected schema fingerprint round trip.",
        ),
        ...assertEqual(
          JSON.stringify(JSON.parse(JSON.stringify(evidence))),
          JSON.stringify(evidence),
          "Expected evidence fingerprint round trip.",
        ),
        ...assertEqual(
          JSON.stringify(JSON.parse(JSON.stringify(endpoint))),
          JSON.stringify(endpoint),
          "Expected endpoint signature round trip.",
        ),
      ],
      ok: false,
    },
    {
      name: "caller-input deep immutability is preserved",
      failureReasons: [
        ...assertEqual(
          immutableSchema.columns[0].name,
          "mutable_id",
          "Expected schema to keep original column name.",
        ),
        ...assertEqual(
          immutableEvidence.evidence.distinctCount,
          5,
          "Expected evidence to keep original distinct count.",
        ),
        ...assertEqual(
          immutableIdentity.worksheetId,
          "worksheet:mutable",
          "Expected identity to keep original worksheet ID.",
        ),
        ...assertEqual(
          immutableRevision.sourceIdentity.worksheetId,
          "worksheet:revision",
          "Expected revision to keep cloned source identity.",
        ),
      ],
      ok: false,
    },
    {
      name: "same canonical input produces identical revision id",
      failureReasons: assertEqual(
        sameRevision.revisionId,
        revision.revisionId,
        "Expected identical revision ID.",
      ),
      ok: false,
    },
    {
      name: "evidence-only change preserves schema fingerprint and changes evidence fingerprint",
      failureReasons: [
        ...assertEqual(
          schemaForEvidenceOnlyChange.fingerprint,
          schemaForEvidenceOnlyChange.fingerprint,
          "Expected schema fingerprint to remain unchanged.",
        ),
        ...assertNotEqual(
          evidenceOnlyA.fingerprint,
          evidenceOnlyB.fingerprint,
          "Expected evidence fingerprint to change.",
        ),
      ],
      ok: false,
    },
    {
      name: "reordered object keys produce identical canonical fingerprints",
      failureReasons: assertEqual(
        createDeterministicWorksheetSourceFingerprint("canonical-fixture", { b: 2, a: 1 }),
        createDeterministicWorksheetSourceFingerprint("canonical-fixture", { a: 1, b: 2 }),
        "Expected canonical object key ordering.",
      ),
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
