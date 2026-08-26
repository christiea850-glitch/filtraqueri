import {
  createSqlExecutionContextIdentity,
  createCanonicalSqlExecutionIdentityV2,
  createManualSqlExecutionIdentityV2,
  createSqlExecutionIdentity,
  doSqlExecutionIdentityV2FingerprintsMatch,
  doesSqlExecutionIdentityMatchContext,
  validateSqlExecutionIdentityV2,
} from "../sqlExecutionIdentity";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlExecutionIdentityFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const assertEqual = (actual: unknown, expected: unknown, message: string) =>
  actual === expected ? [] : [`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`];

const assertThrows = (run: () => unknown, message: string) => {
  try {
    run();
  } catch {
    return [];
  }
  return [message];
};

export function runSqlExecutionIdentityFixtures(): SqlExecutionIdentityFixtureReport {
  const validIdentity = createSqlExecutionIdentity({
    requestId: "sql-run:1:abc",
    exactSql: "SELECT * FROM orders;",
    datasetId: "dataset-1",
    worksheetId: "worksheet-1",
  });
  const whitespaceTrimmedIdentity = createSqlExecutionIdentity({
    requestId: "sql-run:2:def",
    exactSql: "\n  SELECT * FROM orders;  \t",
    datasetId: "  dataset-1  ",
    worksheetId: "  worksheet-1  ",
  });
  const internalDifferenceIdentity = createSqlExecutionIdentity({
    requestId: "sql-run:3:ghi",
    exactSql: "SELECT  * FROM orders;",
    datasetId: "dataset-1",
    worksheetId: "worksheet-1",
  });
  const nullWorksheetIdentity = createSqlExecutionIdentity({
    requestId: "sql-run:4:jkl",
    exactSql: "SELECT * FROM uploaded_dataset;",
    datasetId: "dataset-csv",
    worksheetId: null,
  });

  const frozenInput = Object.freeze({
    requestId: "sql-run:5:mno",
    exactSql: "  SELECT status FROM orders;  ",
    datasetId: "  dataset-frozen  ",
    worksheetId: "  worksheet-frozen  ",
  });
  const frozenInputBefore = JSON.stringify(frozenInput);
  const frozenResult = createSqlExecutionIdentity(frozenInput);
  const canonicalIdentity = createCanonicalSqlExecutionIdentityV2({
    exactSql: "SELECT unit_id FROM units;",
    dialect: "duckdb",
    executionTargetId: "target:local-duckdb",
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    appliedSourceManifestFingerprint: "manifest:v2:1",
    sourceRevisionIds: ["source-revision:2", "source-revision:1"],
    structuralSchemaFingerprints: ["schema:2", "schema:1"],
    validationAssessmentIds: ["assessment:2", "assessment:1"],
    acceptanceRecordIds: ["acceptance:2", "acceptance:1"],
    planId: "plan:1",
    planRevisionId: "plan-revision:1",
    rendererId: "renderer:duckdb",
    rendererVersion: "renderer-version:1",
    executionPolicyId: "policy:limited-preview",
  });
  const reorderedCanonicalIdentity = createCanonicalSqlExecutionIdentityV2({
    exactSql: "SELECT unit_id FROM units;",
    dialect: "duckdb",
    executionTargetId: "target:local-duckdb",
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    appliedSourceManifestFingerprint: "manifest:v2:1",
    sourceRevisionIds: ["source-revision:1", "source-revision:2"],
    structuralSchemaFingerprints: ["schema:1", "schema:2"],
    validationAssessmentIds: ["assessment:1", "assessment:2"],
    acceptanceRecordIds: ["acceptance:1", "acceptance:2"],
    planId: "plan:1",
    planRevisionId: "plan-revision:1",
    rendererId: "renderer:duckdb",
    rendererVersion: "renderer-version:1",
    executionPolicyId: "policy:limited-preview",
  });
  const manualIdentity = createManualSqlExecutionIdentityV2({
    exactSql: "SELECT unit_id FROM units;",
    dialect: "duckdb",
    executionTargetId: "target:local-duckdb",
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    worksheetId: "worksheet:units",
    tableName: "units",
    executionPolicyId: "policy:limited-preview",
  });
  const canonicalWith = (overrides: Partial<Parameters<typeof createCanonicalSqlExecutionIdentityV2>[0]>) =>
    createCanonicalSqlExecutionIdentityV2({
      exactSql: "SELECT unit_id FROM units;",
      dialect: "duckdb",
      executionTargetId: "target:local-duckdb",
      datasetId: "dataset:property",
      workbookId: "workbook:property",
      appliedSourceManifestFingerprint: "manifest:v2:1",
      sourceRevisionIds: ["source-revision:1"],
      structuralSchemaFingerprints: ["schema:1"],
      validationAssessmentIds: ["assessment:1"],
      acceptanceRecordIds: ["acceptance:1"],
      planId: "plan:1",
      planRevisionId: "plan-revision:1",
      rendererId: "renderer:duckdb",
      rendererVersion: "renderer-version:1",
      executionPolicyId: "policy:limited-preview",
      ...overrides,
    });

  const fixtures: FixtureResult[] = [
    {
      name: "constructs a valid execution identity",
      failureReasons: [
        ...assertEqual(validIdentity.requestId, "sql-run:1:abc", "Request ID mismatch."),
        ...assertEqual(validIdentity.exactSql, "SELECT * FROM orders;", "SQL mismatch."),
        ...assertEqual(validIdentity.datasetId, "dataset-1", "Dataset mismatch."),
        ...assertEqual(validIdentity.worksheetId, "worksheet-1", "Worksheet mismatch."),
      ],
      ok: false,
    },
    {
      name: "trims leading and trailing SQL whitespace",
      failureReasons: assertEqual(
        whitespaceTrimmedIdentity.exactSql,
        "SELECT * FROM orders;",
        "Expected boundary whitespace to be trimmed.",
      ),
      ok: false,
    },
    {
      name: "preserves internal SQL differences",
      failureReasons: assertEqual(
        internalDifferenceIdentity.exactSql === validIdentity.exactSql,
        false,
        "Internal SQL formatting must remain significant.",
      ),
      ok: false,
    },
    {
      name: "allows null worksheet identity",
      failureReasons: assertEqual(nullWorksheetIdentity.worksheetId, null, "Worksheet should remain null."),
      ok: false,
    },
    {
      name: "rejects blank request ID",
      failureReasons: assertThrows(
        () => createSqlExecutionIdentity({
          requestId: " ",
          exactSql: "SELECT 1;",
          datasetId: "dataset-1",
          worksheetId: null,
        }),
        "Expected blank request ID to throw.",
      ),
      ok: false,
    },
    {
      name: "rejects blank SQL",
      failureReasons: assertThrows(
        () => createSqlExecutionContextIdentity({
          exactSql: "\n\t ",
          datasetId: "dataset-1",
          worksheetId: null,
        }),
        "Expected blank SQL to throw.",
      ),
      ok: false,
    },
    {
      name: "rejects blank dataset ID",
      failureReasons: assertThrows(
        () => createSqlExecutionContextIdentity({
          exactSql: "SELECT 1;",
          datasetId: " ",
          worksheetId: null,
        }),
        "Expected blank dataset ID to throw.",
      ),
      ok: false,
    },
    {
      name: "matches exact current context",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(validIdentity, {
          exactSql: " SELECT * FROM orders; ",
          datasetId: "dataset-1",
          worksheetId: "worksheet-1",
        }),
        true,
        "Expected context to match.",
      ),
      ok: false,
    },
    {
      name: "detects SQL mismatch",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(validIdentity, {
          exactSql: "SELECT id FROM orders;",
          datasetId: "dataset-1",
          worksheetId: "worksheet-1",
        }),
        false,
        "Expected SQL mismatch.",
      ),
      ok: false,
    },
    {
      name: "detects dataset mismatch",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(validIdentity, {
          exactSql: "SELECT * FROM orders;",
          datasetId: "dataset-2",
          worksheetId: "worksheet-1",
        }),
        false,
        "Expected dataset mismatch.",
      ),
      ok: false,
    },
    {
      name: "detects worksheet mismatch",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(validIdentity, {
          exactSql: "SELECT * FROM orders;",
          datasetId: "dataset-1",
          worksheetId: "worksheet-2",
        }),
        false,
        "Expected worksheet mismatch.",
      ),
      ok: false,
    },
    {
      name: "survives JSON round trip",
      failureReasons: assertEqual(
        JSON.stringify(JSON.parse(JSON.stringify(validIdentity))),
        JSON.stringify(validIdentity),
        "Expected JSON round trip to preserve identity.",
      ),
      ok: false,
    },
    {
      name: "does not mutate caller input",
      failureReasons: [
        ...assertEqual(JSON.stringify(frozenInput), frozenInputBefore, "Input object changed."),
        ...assertEqual(frozenResult.datasetId, "dataset-frozen", "Expected normalized copy."),
      ],
      ok: false,
    },
    {
      name: "excludes request ID from context freshness comparison",
      failureReasons: assertEqual(
        doesSqlExecutionIdentityMatchContext(
          { ...validIdentity, requestId: "sql-run:999:different" },
          {
            exactSql: validIdentity.exactSql,
            datasetId: validIdentity.datasetId,
            worksheetId: validIdentity.worksheetId,
          },
        ),
        true,
        "Request ID must not affect context matching.",
      ),
      ok: false,
    },
    {
      name: "v2 canonical identity is deterministic",
      failureReasons: assertEqual(
        canonicalIdentity.identityFingerprint,
        createCanonicalSqlExecutionIdentityV2({
          exactSql: "SELECT unit_id FROM units;",
          dialect: "duckdb",
          executionTargetId: "target:local-duckdb",
          datasetId: "dataset:property",
          workbookId: "workbook:property",
          appliedSourceManifestFingerprint: "manifest:v2:1",
          sourceRevisionIds: ["source-revision:2", "source-revision:1"],
          structuralSchemaFingerprints: ["schema:2", "schema:1"],
          validationAssessmentIds: ["assessment:2", "assessment:1"],
          acceptanceRecordIds: ["acceptance:2", "acceptance:1"],
          planId: "plan:1",
          planRevisionId: "plan-revision:1",
          rendererId: "renderer:duckdb",
          rendererVersion: "renderer-version:1",
          executionPolicyId: "policy:limited-preview",
        }).identityFingerprint,
        "Expected deterministic canonical identity.",
      ),
      ok: false,
    },
    {
      name: "v2 manual identity is deterministic",
      failureReasons: assertEqual(
        manualIdentity.identityFingerprint,
        createManualSqlExecutionIdentityV2({
          exactSql: "SELECT unit_id FROM units;",
          dialect: "duckdb",
          executionTargetId: "target:local-duckdb",
          datasetId: "dataset:property",
          workbookId: "workbook:property",
          worksheetId: "worksheet:units",
          tableName: "units",
          executionPolicyId: "policy:limited-preview",
        }).identityFingerprint,
        "Expected deterministic manual identity.",
      ),
      ok: false,
    },
    {
      name: "v2 canonical and manual modes cannot share identity",
      failureReasons: assertEqual(
        canonicalIdentity.identityFingerprint === manualIdentity.identityFingerprint,
        false,
        "Expected mode-separated identity fingerprints.",
      ),
      ok: false,
    },
    {
      name: "v2 array order does not alter canonical identity",
      failureReasons: assertEqual(
        canonicalIdentity.identityFingerprint,
        reorderedCanonicalIdentity.identityFingerprint,
        "Expected sorted canonical authority arrays.",
      ),
      ok: false,
    },
    {
      name: "v2 canonical authority changes alter identity",
      failureReasons: [
        ...assertEqual(
          doSqlExecutionIdentityV2FingerprintsMatch(canonicalWith({ exactSql: "SELECT 1;" }), canonicalWith({ exactSql: "SELECT 2;" })),
          false,
          "Expected SQL change to alter identity.",
        ),
        ...assertEqual(
          canonicalWith({ appliedSourceManifestFingerprint: "manifest:v2:2" }).identityFingerprint === canonicalWith({}).identityFingerprint,
          false,
          "Expected manifest change to alter identity.",
        ),
        ...assertEqual(
          canonicalWith({ sourceRevisionIds: ["source-revision:2"] }).identityFingerprint === canonicalWith({}).identityFingerprint,
          false,
          "Expected source revision change to alter identity.",
        ),
        ...assertEqual(
          canonicalWith({ validationAssessmentIds: ["assessment:2"] }).identityFingerprint === canonicalWith({}).identityFingerprint,
          false,
          "Expected validation change to alter identity.",
        ),
        ...assertEqual(
          canonicalWith({ acceptanceRecordIds: ["acceptance:2"] }).identityFingerprint === canonicalWith({}).identityFingerprint,
          false,
          "Expected acceptance change to alter identity.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 plan renderer dialect target and policy changes alter identity",
      failureReasons: [
        ...assertEqual(canonicalWith({ planRevisionId: "plan-revision:2" }).identityFingerprint === canonicalWith({}).identityFingerprint, false, "Expected plan revision change."),
        ...assertEqual(canonicalWith({ rendererId: "renderer:other" }).identityFingerprint === canonicalWith({}).identityFingerprint, false, "Expected renderer change."),
        ...assertEqual(canonicalWith({ dialect: "postgres" }).identityFingerprint === canonicalWith({}).identityFingerprint, false, "Expected dialect change."),
        ...assertEqual(canonicalWith({ executionTargetId: "target:remote" }).identityFingerprint === canonicalWith({}).identityFingerprint, false, "Expected target change."),
        ...assertEqual(canonicalWith({ executionPolicyId: "policy:full" }).identityFingerprint === canonicalWith({}).identityFingerprint, false, "Expected policy change."),
      ],
      ok: false,
    },
    {
      name: "v2 ephemeral fields are excluded from identity",
      failureReasons: [
        ...assertEqual(
          validateSqlExecutionIdentityV2({ ...canonicalIdentity, requestId: "run:1", tabId: "tab:1" }).status,
          "valid",
          "Expected ephemeral fields not to invalidate canonical identity.",
        ),
        ...assertEqual(
          (
            validateSqlExecutionIdentityV2({
              ...canonicalIdentity,
              requestId: "run:2",
              tabId: "tab:2",
              label: "Renamed",
            }) as { status: "valid"; identity: typeof canonicalIdentity }
          ).identity.identityFingerprint,
          canonicalIdentity.identityFingerprint,
          "Expected ephemeral fields not to alter deterministic identity.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 validation accepts supported identity and rejects tampering",
      failureReasons: [
        ...assertEqual(
          validateSqlExecutionIdentityV2(canonicalIdentity).status,
          "valid",
          "Expected valid canonical identity.",
        ),
        ...assertEqual(
          validateSqlExecutionIdentityV2({ ...canonicalIdentity, identityFingerprint: "tampered" }).reasonCodes[0],
          "execution_identity_fingerprint_mismatch",
          "Expected tampered fingerprint rejection.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 manual canonical-field forgery is rejected",
      failureReasons: assertEqual(
        validateSqlExecutionIdentityV2({
          ...manualIdentity,
          appliedSourceManifestFingerprint: "manifest:v2:forged",
        }).reasonCodes[0],
        "manual_canonical_authority_forbidden",
        "Expected manual forgery block.",
      ),
      ok: false,
    },
    {
      name: "v2 unsupported version and discriminant fail closed",
      failureReasons: [
        ...assertEqual(
          validateSqlExecutionIdentityV2({ ...canonicalIdentity, version: "sql-execution-identity:v999" }).reasonCodes[0],
          "execution_identity_unsupported",
          "Expected unsupported version block.",
        ),
        ...assertEqual(
          validateSqlExecutionIdentityV2({ ...canonicalIdentity, mode: "batch" }).reasonCodes[0],
          "execution_mode_unsupported",
          "Expected unsupported mode block.",
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
