import {
  createOriginalWorksheetSourceIdentity,
  createCleanedWorksheetSourceIdentity,
  createWorksheetSourceRevision,
  createWorksheetStructuralSchemaFingerprint,
} from "../../../workbook/worksheetSourceRevision";
import {
  createSqlAppliedSourceManifest,
  evaluateSqlAppliedSourceManifestReadiness,
  validateSqlAppliedSourceManifestIntegrity,
  type SqlAppliedSourceManifest,
} from "../sqlAppliedSourceManifest";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlAppliedSourceManifestFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const assertEqual = (actual: unknown, expected: unknown, message: string): string[] =>
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

const revisionFor = ({
  worksheetId,
  sourceKind,
  materializationFingerprint,
  datasetId = "dataset:property",
  workbookId = "workbook:property",
}: {
  worksheetId: string;
  sourceKind: "original" | "cleaned_working_copy";
  materializationFingerprint: string;
  datasetId?: string;
  workbookId?: string;
}) =>
  createWorksheetSourceRevision({
    sourceIdentity:
      sourceKind === "original"
        ? createOriginalWorksheetSourceIdentity({
            datasetId,
            workbookId,
            worksheetId,
          })
        : createCleanedWorksheetSourceIdentity({
            datasetId,
            workbookId,
            worksheetId,
            cleanedLineageId: `lineage:${worksheetId}`,
          }),
    tableName: worksheetId.replace("worksheet:", ""),
    structuralSchemaFingerprint: schema,
    materializationFingerprint,
  });

export function runSqlAppliedSourceManifestFixtures(): SqlAppliedSourceManifestFixtureReport {
  const unitsRevision = revisionFor({
    worksheetId: "worksheet:units",
    sourceKind: "original",
    materializationFingerprint: "materialization:units:v1",
  });
  const rentsRevision = revisionFor({
    worksheetId: "worksheet:rents",
    sourceKind: "original",
    materializationFingerprint: "materialization:rents:v1",
  });
  const changedUnitsRevision = revisionFor({
    worksheetId: "worksheet:units",
    sourceKind: "original",
    materializationFingerprint: "materialization:units:v2",
  });
  const cleanedRevision = revisionFor({
    worksheetId: "worksheet:units",
    sourceKind: "cleaned_working_copy",
    materializationFingerprint: "materialization:units:cleaned:v1",
  });
  const cleanedRentsRevision = revisionFor({
    worksheetId: "worksheet:rents",
    sourceKind: "cleaned_working_copy",
    materializationFingerprint: "materialization:rents:cleaned:v1",
  });
  const originalManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [
      { worksheetId: "worksheet:rents", sourceRevision: rentsRevision },
      { worksheetId: "worksheet:units", sourceRevision: unitsRevision },
    ],
  });
  const reorderedManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [
      { worksheetId: "worksheet:units", sourceRevision: unitsRevision },
      { worksheetId: "worksheet:rents", sourceRevision: rentsRevision },
    ],
  });
  const duplicateManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [
      { worksheetId: "worksheet:units", sourceRevision: unitsRevision },
      { worksheetId: "worksheet:units", sourceRevision: unitsRevision },
    ],
  });
  const conflictingManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [
      { worksheetId: "worksheet:units", sourceRevision: unitsRevision },
      { worksheetId: "worksheet:units", sourceRevision: changedUnitsRevision },
    ],
  });
  const cleanedManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [{ worksheetId: "worksheet:units", sourceRevision: cleanedRevision }],
  });
  const mixedManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [
      { worksheetId: "worksheet:units", sourceRevision: unitsRevision },
      { worksheetId: "worksheet:rents", sourceRevision: cleanedRentsRevision },
    ],
  });
  const emptyManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [],
  });
  const datasetMismatchManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [
      {
        worksheetId: "worksheet:units",
        sourceRevision: revisionFor({
          worksheetId: "worksheet:units",
          sourceKind: "original",
          materializationFingerprint: "materialization:units:other-dataset",
          datasetId: "dataset:other",
        }),
      },
    ],
  });
  const workbookMismatchManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [
      {
        worksheetId: "worksheet:units",
        sourceRevision: revisionFor({
          worksheetId: "worksheet:units",
          sourceKind: "original",
          materializationFingerprint: "materialization:units:other-workbook",
          workbookId: "workbook:other",
        }),
      },
    ],
  });
  const worksheetMismatchManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [{ worksheetId: "worksheet:other", sourceRevision: unitsRevision }],
  });
  const unsupportedRevisionManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: [
      {
        worksheetId: "worksheet:units",
        sourceRevision: {
          ...unitsRevision,
          version: "worksheet-source-revision:v999",
        } as unknown as typeof unitsRevision,
      },
    ],
  });
  const mutableBindings = [{ worksheetId: "worksheet:units", sourceRevision: unitsRevision }];
  const immutableManifest = createSqlAppliedSourceManifest({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    bindings: mutableBindings,
  });
  mutableBindings.push({ worksheetId: "worksheet:rents", sourceRevision: rentsRevision });
  unitsRevision.sourceIdentity.worksheetId = "worksheet:mutated";

  const fixtures: FixtureResult[] = [
    {
      name: "manifest fingerprint is stable across binding order",
      failureReasons:
        originalManifest.status === "created" && reorderedManifest.status === "created"
          ? assertEqual(
              originalManifest.manifest.manifestFingerprint,
              reorderedManifest.manifest.manifestFingerprint,
              "Expected canonical binding order.",
            )
          : ["Expected both manifests to be created."],
      ok: false,
    },
    {
      name: "all-original source manifest is eligible",
      failureReasons:
        originalManifest.status === "created"
          ? assertEqual(
              evaluateSqlAppliedSourceManifestReadiness(originalManifest.manifest).status,
              "eligible",
              "Expected original sources to be eligible.",
            )
          : ["Expected original manifest to be created."],
      ok: false,
    },
    {
      name: "duplicate binding is invalid and not silently deduped",
      failureReasons:
        duplicateManifest.status === "invalid"
          ? assertEqual(
              duplicateManifest.reasonCodes.includes("manifest_binding_duplicate"),
              true,
              "Expected duplicate reason.",
            )
          : ["Expected duplicate manifest to be invalid."],
      ok: false,
    },
    {
      name: "conflicting worksheet binding is invalid",
      failureReasons:
        conflictingManifest.status === "invalid"
          ? assertEqual(
              conflictingManifest.reasonCodes.includes("manifest_binding_conflict"),
              true,
              "Expected conflict reason.",
            )
          : ["Expected conflicting manifest to be invalid."],
      ok: false,
    },
    {
      name: "cleaned source manifest is blocked at readiness",
      failureReasons:
        cleanedManifest.status === "created"
          ? assertEqual(
              evaluateSqlAppliedSourceManifestReadiness(cleanedManifest.manifest).reasonCodes[0],
              "unsupported_cleaned_source",
              "Expected cleaned source block.",
            )
          : ["Expected cleaned manifest to be created."],
      ok: false,
    },
    {
      name: "mixed source manifest is blocked with non-overlapping reason",
      failureReasons:
        mixedManifest.status === "created"
          ? assertEqual(
              evaluateSqlAppliedSourceManifestReadiness(mixedManifest.manifest).reasonCodes.join(","),
              "unsupported_mixed_source",
              "Expected mixed source block only.",
            )
          : ["Expected mixed manifest to be created."],
      ok: false,
    },
    {
      name: "empty manifest is representable but not ready",
      failureReasons:
        emptyManifest.status === "created"
          ? assertEqual(
              evaluateSqlAppliedSourceManifestReadiness(emptyManifest.manifest).reasonCodes[0],
              "manifest_empty",
              "Expected empty manifest readiness reason.",
            )
          : ["Expected empty manifest to be created."],
      ok: false,
    },
    {
      name: "supplied fingerprint mismatch invalidates manifest",
      failureReasons: assertEqual(
        createSqlAppliedSourceManifest({
          datasetId: "dataset:property",
          workbookId: "workbook:property",
          bindings: [{ worksheetId: "worksheet:units", sourceRevision: unitsRevision }],
          suppliedFingerprint: "sql-applied-source-manifest:tampered",
        }).status,
        "invalid",
        "Expected supplied fingerprint mismatch.",
      ),
      ok: false,
    },
    {
      name: "unsupported manifest version returns unsupported integrity verdict",
      failureReasons:
        originalManifest.status === "created"
          ? [
              ...assertEqual(
                validateSqlAppliedSourceManifestIntegrity({
                  ...originalManifest.manifest,
                  version: "sql-applied-source-manifest:v999",
                } as unknown as SqlAppliedSourceManifest).status,
                "invalid",
                "Expected unsupported manifest version to be invalid.",
              ),
              ...assertEqual(
                validateSqlAppliedSourceManifestIntegrity({
                  ...originalManifest.manifest,
                  version: "sql-applied-source-manifest:v999",
                } as unknown as SqlAppliedSourceManifest).reasonCodes[0],
                "manifest_version_unsupported",
                "Expected unsupported manifest reason.",
              ),
              ...assertEqual(
                validateSqlAppliedSourceManifestIntegrity({
                  ...originalManifest.manifest,
                  version: "sql-applied-source-manifest:v999",
                } as unknown as SqlAppliedSourceManifest).eligible,
                false,
                "Expected no eligible payload.",
              ),
            ]
          : ["Expected original manifest to be created."],
      ok: false,
    },
    {
      name: "binding dataset mismatch is invalid",
      failureReasons:
        datasetMismatchManifest.status === "invalid"
          ? assertEqual(
              datasetMismatchManifest.reasonCodes.join(","),
              "manifest_binding_dataset_mismatch",
              "Expected dataset mismatch reason.",
            )
          : ["Expected dataset mismatch manifest to be invalid."],
      ok: false,
    },
    {
      name: "binding workbook mismatch is invalid",
      failureReasons:
        workbookMismatchManifest.status === "invalid"
          ? assertEqual(
              workbookMismatchManifest.reasonCodes.join(","),
              "manifest_binding_workbook_mismatch",
              "Expected workbook mismatch reason.",
            )
          : ["Expected workbook mismatch manifest to be invalid."],
      ok: false,
    },
    {
      name: "binding worksheet mismatch is invalid",
      failureReasons:
        worksheetMismatchManifest.status === "invalid"
          ? assertEqual(
              worksheetMismatchManifest.reasonCodes.join(","),
              "manifest_binding_worksheet_mismatch",
              "Expected worksheet mismatch reason.",
            )
          : ["Expected worksheet mismatch manifest to be invalid."],
      ok: false,
    },
    {
      name: "unsupported source revision version invalidates manifest",
      failureReasons:
        unsupportedRevisionManifest.status === "invalid"
          ? assertEqual(
              unsupportedRevisionManifest.reasonCodes.join(","),
              "manifest_version_unsupported",
              "Expected source revision unsupported reason.",
            )
          : ["Expected unsupported source revision manifest to be invalid."],
      ok: false,
    },
    {
      name: "json round trip preserves canonical manifest verdicts",
      failureReasons:
        originalManifest.status === "created"
          ? [
              ...assertEqual(
                JSON.stringify(JSON.parse(JSON.stringify(originalManifest.manifest.bindings))),
                JSON.stringify(originalManifest.manifest.bindings),
                "Expected canonical bindings round trip.",
              ),
              ...assertEqual(
                JSON.parse(JSON.stringify(originalManifest.manifest)).manifestFingerprint,
                originalManifest.manifest.manifestFingerprint,
                "Expected manifest fingerprint round trip.",
              ),
              ...assertEqual(
                validateSqlAppliedSourceManifestIntegrity(
                  JSON.parse(JSON.stringify(originalManifest.manifest)) as SqlAppliedSourceManifest,
                ).status,
                "eligible",
                "Expected integrity verdict round trip.",
              ),
              ...assertEqual(
                evaluateSqlAppliedSourceManifestReadiness(
                  JSON.parse(JSON.stringify(originalManifest.manifest)) as SqlAppliedSourceManifest,
                ).status,
                "eligible",
                "Expected readiness verdict round trip.",
              ),
            ]
          : ["Expected original manifest to be created."],
      ok: false,
    },
    {
      name: "caller-input immutability preserves created manifest",
      failureReasons:
        immutableManifest.status === "created"
          ? [
              ...assertEqual(
                immutableManifest.manifest.bindings.length,
                1,
                "Expected binding array mutation not to affect manifest.",
              ),
              ...assertEqual(
                immutableManifest.manifest.bindings[0].sourceRevision.sourceIdentity.worksheetId,
                "worksheet:units",
                "Expected nested source revision mutation not to affect manifest.",
              ),
            ]
          : ["Expected immutable manifest to be created."],
      ok: false,
    },
    {
      name: "equivalent invalid inputs preserve deterministic reason ordering",
      failureReasons: assertEqual(
        createSqlAppliedSourceManifest({
          datasetId: "dataset:property",
          workbookId: "workbook:property",
          bindings: [
            { worksheetId: "worksheet:other", sourceRevision: unitsRevision },
            { worksheetId: "worksheet:other", sourceRevision: unitsRevision },
          ],
        }).status === "invalid"
          ? (
              createSqlAppliedSourceManifest({
                datasetId: "dataset:property",
                workbookId: "workbook:property",
                bindings: [
                  { worksheetId: "worksheet:other", sourceRevision: unitsRevision },
                  { worksheetId: "worksheet:other", sourceRevision: unitsRevision },
                ],
              }) as { status: "invalid"; reasonCodes: string[] }
            ).reasonCodes.join(",")
          : "",
        "manifest_binding_worksheet_mismatch,manifest_binding_duplicate",
        "Expected deterministic validation-priority reason order.",
      ),
      ok: false,
    },
    {
      name: "invalid results are atomically ineligible with no partial readiness",
      failureReasons:
        conflictingManifest.status === "invalid"
          ? [
              ...assertEqual(conflictingManifest.manifest, null, "Expected no partial manifest payload."),
              ...assertEqual(conflictingManifest.reasonCodes.length > 0, true, "Expected invalid reasons."),
            ]
          : ["Expected conflicting manifest to be invalid."],
      ok: false,
    },
    {
      name: "reordered valid bindings preserve canonical manifest body and fingerprint",
      failureReasons:
        originalManifest.status === "created" && reorderedManifest.status === "created"
          ? [
              ...assertEqual(
                JSON.stringify(originalManifest.manifest.bindings),
                JSON.stringify(reorderedManifest.manifest.bindings),
                "Expected canonical binding body.",
              ),
              ...assertEqual(
                originalManifest.manifest.manifestFingerprint,
                reorderedManifest.manifest.manifestFingerprint,
                "Expected canonical fingerprint.",
              ),
            ]
          : ["Expected reordered manifests to be created."],
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
