import {
  createOriginalWorksheetSourceIdentity,
  createCleanedWorksheetSourceIdentity,
  createRelationshipEndpointSignature,
  createWorksheetSourceRevision,
  createWorksheetStructuralSchemaFingerprint,
} from "../../../workbook/worksheetSourceRevision";
import {
  createSqlAppliedSourceManifest,
  createSqlAppliedSourceManifestV2,
  evaluateSqlAppliedSourceManifestReadiness,
  evaluateSqlAppliedSourceManifestV2Readiness,
  validateSqlAppliedSourceManifestIntegrity,
  validateSqlAppliedSourceManifestV2Integrity,
  type SqlAppliedSourceManifest,
  type SqlAppliedSourceManifestV2,
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

const endpointFor = (sourceRevision: ReturnType<typeof revisionFor>, columnName: string, ordinal: number) =>
  createRelationshipEndpointSignature({
    sourceRevision,
    columnId: `col:${columnName}`,
    columnName,
    columnOrdinal: ordinal,
    physicalType: "INTEGER",
    logicalType: "number",
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
  const v2UnitsRevision = revisionFor({
    worksheetId: "worksheet:units",
    sourceKind: "original",
    materializationFingerprint: "materialization:units:v1",
  });
  const v2RentsRevision = revisionFor({
    worksheetId: "worksheet:rents",
    sourceKind: "original",
    materializationFingerprint: "materialization:rents:v1",
  });
  const v2ChangedUnitsRevision = revisionFor({
    worksheetId: "worksheet:units",
    sourceKind: "original",
    materializationFingerprint: "materialization:units:v2",
  });
  const v2CleanedRevision = revisionFor({
    worksheetId: "worksheet:units",
    sourceKind: "cleaned_working_copy",
    materializationFingerprint: "materialization:units:cleaned:v1",
  });
  const v2CleanedRentsRevision = revisionFor({
    worksheetId: "worksheet:rents",
    sourceKind: "cleaned_working_copy",
    materializationFingerprint: "materialization:rents:cleaned:v1",
  });
  const unitsEndpoint = endpointFor(v2UnitsRevision, "unit_id", 0);
  const rentsEndpoint = endpointFor(v2RentsRevision, "unit_id", 0);
  const relationshipBinding = {
    relationshipId: "relationship:units-rents",
    direction: "directed" as const,
    validationAssessmentId: "assessment:units-rents:v1",
    validationIdentity: "validation:units-rents:v1",
    acceptanceRecordId: "acceptance:units-rents:v1",
    leftEndpoint: unitsEndpoint,
    rightEndpoint: rentsEndpoint,
  };
  const sourceBindingFor = (sourceRevision: ReturnType<typeof revisionFor>) => ({
    sourceId: sourceRevision.sourceIdentity.sourceId,
    sourceKind: sourceRevision.sourceIdentity.sourceKind,
    worksheetId: sourceRevision.sourceIdentity.worksheetId,
    tableName: sourceRevision.tableName,
    sourceRevisionId: sourceRevision.revisionId,
    structuralSchemaFingerprint: sourceRevision.structuralSchemaFingerprint.fingerprint,
  });
  const singleSourceV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2UnitsRevision)],
  });
  const multiSourceV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2RentsRevision), sourceBindingFor(v2UnitsRevision)],
    relationshipBindings: [relationshipBinding],
  });
  const reorderedMultiSourceV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2UnitsRevision), sourceBindingFor(v2RentsRevision)],
    relationshipBindings: [relationshipBinding],
  });
  const renamedTableV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [{ ...sourceBindingFor(v2UnitsRevision), tableName: "renamed_units" }],
  });
  const changedRevisionV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2ChangedUnitsRevision)],
  });
  const changedStructuralV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [
      {
        ...sourceBindingFor(v2UnitsRevision),
        structuralSchemaFingerprint: "worksheet-structural-schema:changed",
      },
    ],
  });
  const changedRelationshipV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2RentsRevision), sourceBindingFor(v2UnitsRevision)],
    relationshipBindings: [{ ...relationshipBinding, acceptanceRecordId: "acceptance:units-rents:v2" }],
  });
  const missingEndpointV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2UnitsRevision)],
    relationshipBindings: [relationshipBinding],
  });
  const missingRevisionV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [{ ...sourceBindingFor(v2UnitsRevision), sourceRevisionId: "" }],
  });
  const duplicateV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2UnitsRevision), sourceBindingFor(v2UnitsRevision)],
  });
  const conflictingV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [
      sourceBindingFor(v2UnitsRevision),
      { ...sourceBindingFor(v2UnitsRevision), sourceRevisionId: v2ChangedUnitsRevision.revisionId },
    ],
  });
  const cleanedV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2CleanedRevision)],
  });
  const mixedV2 = createSqlAppliedSourceManifestV2({
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    sourceBindings: [sourceBindingFor(v2UnitsRevision), sourceBindingFor(v2CleanedRentsRevision)],
  });

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
    {
      name: "v2 original single-source manifest is ready",
      failureReasons:
        singleSourceV2.status === "created"
          ? assertEqual(
              evaluateSqlAppliedSourceManifestV2Readiness({ manifest: singleSourceV2.manifest }).status,
              "eligible",
              "Expected V2 single-source manifest readiness.",
            )
          : ["Expected V2 single-source manifest to be created."],
      ok: false,
    },
    {
      name: "v2 multi-source manifest requires all relationship bindings",
      failureReasons:
        multiSourceV2.status === "created"
          ? [
              ...assertEqual(
                evaluateSqlAppliedSourceManifestV2Readiness({
                  manifest: multiSourceV2.manifest,
                  requiredRelationshipIds: ["relationship:units-rents"],
                }).status,
                "eligible",
                "Expected required relationship to be ready.",
              ),
              ...assertEqual(
                evaluateSqlAppliedSourceManifestV2Readiness({
                  manifest: multiSourceV2.manifest,
                  requiredRelationshipIds: ["relationship:missing"],
                }).reasonCodes[0],
                "relationship_partial_eligibility_blocked",
                "Expected missing relationship block.",
              ),
            ]
          : ["Expected V2 multi-source manifest to be created."],
      ok: false,
    },
    {
      name: "v2 ordering is deterministic for sources and relationships",
      failureReasons:
        multiSourceV2.status === "created" && reorderedMultiSourceV2.status === "created"
          ? assertEqual(
              multiSourceV2.manifest.manifestFingerprint,
              reorderedMultiSourceV2.manifest.manifestFingerprint,
              "Expected V2 order-independent fingerprint.",
            )
          : ["Expected reordered V2 manifests to be created."],
      ok: false,
    },
    {
      name: "v2 table rename metadata alone is not source authority",
      failureReasons:
        singleSourceV2.status === "created" && renamedTableV2.status === "created"
          ? assertEqual(
              singleSourceV2.manifest.manifestFingerprint,
              renamedTableV2.manifest.manifestFingerprint,
              "Expected table name to be excluded from V2 authority fingerprint.",
            )
          : ["Expected renamed V2 manifest to be created."],
      ok: false,
    },
    {
      name: "v2 source revision changes manifest fingerprint",
      failureReasons:
        singleSourceV2.status === "created" && changedRevisionV2.status === "created"
          ? assertEqual(
              singleSourceV2.manifest.manifestFingerprint === changedRevisionV2.manifest.manifestFingerprint,
              false,
              "Expected source revision change to alter V2 fingerprint.",
            )
          : ["Expected changed revision V2 manifest to be created."],
      ok: false,
    },
    {
      name: "v2 structural fingerprint changes manifest fingerprint",
      failureReasons:
        singleSourceV2.status === "created" && changedStructuralV2.status === "created"
          ? assertEqual(
              singleSourceV2.manifest.manifestFingerprint === changedStructuralV2.manifest.manifestFingerprint,
              false,
              "Expected structural change to alter V2 fingerprint.",
            )
          : ["Expected changed structural V2 manifest to be created."],
      ok: false,
    },
    {
      name: "v2 relationship validation or acceptance changes fingerprint",
      failureReasons:
        multiSourceV2.status === "created" && changedRelationshipV2.status === "created"
          ? assertEqual(
              multiSourceV2.manifest.manifestFingerprint === changedRelationshipV2.manifest.manifestFingerprint,
              false,
              "Expected relationship authority change to alter V2 fingerprint.",
            )
          : ["Expected changed relationship V2 manifest to be created."],
      ok: false,
    },
    {
      name: "v2 relationship endpoint absent from manifest blocks construction",
      failureReasons:
        missingEndpointV2.status === "invalid"
          ? assertEqual(
              missingEndpointV2.reasonCodes[0],
              "relationship_validation_missing",
              "Expected missing endpoint source block.",
            )
          : ["Expected missing endpoint V2 manifest to be invalid."],
      ok: false,
    },
    {
      name: "v2 missing source revision blocks construction",
      failureReasons:
        missingRevisionV2.status === "invalid"
          ? assertEqual(
              missingRevisionV2.reasonCodes[0],
              "source_revision_missing",
              "Expected missing revision reason.",
            )
          : ["Expected missing revision V2 manifest to be invalid."],
      ok: false,
    },
    {
      name: "v2 duplicate and conflicting source records fail closed",
      failureReasons: [
        ...assertEqual(
          duplicateV2.status === "invalid" ? duplicateV2.reasonCodes[0] : "",
          "manifest_binding_duplicate",
          "Expected duplicate V2 binding reason.",
        ),
        ...assertEqual(
          conflictingV2.status === "invalid" ? conflictingV2.reasonCodes[0] : "",
          "manifest_binding_conflict",
          "Expected conflicting V2 binding reason.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 cleaned and mixed source modes are represented but blocked",
      failureReasons: [
        ...assertEqual(
          cleanedV2.status === "created"
            ? evaluateSqlAppliedSourceManifestV2Readiness({ manifest: cleanedV2.manifest }).reasonCodes[0]
            : "",
          "unsupported_cleaned_source",
          "Expected cleaned-only block.",
        ),
        ...assertEqual(
          mixedV2.status === "created"
            ? evaluateSqlAppliedSourceManifestV2Readiness({ manifest: mixedV2.manifest }).reasonCodes[0]
            : "",
          "unsupported_mixed_source",
          "Expected mixed-source block.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 unsupported or malformed manifest fails closed",
      failureReasons:
        singleSourceV2.status === "created"
          ? [
              ...assertEqual(
                validateSqlAppliedSourceManifestV2Integrity({
                  ...singleSourceV2.manifest,
                  version: "sql-applied-source-manifest:v999",
                } as unknown as SqlAppliedSourceManifestV2).reasonCodes[0],
                "applied_source_manifest_unsupported",
                "Expected unsupported V2 version reason.",
              ),
              ...assertEqual(
                validateSqlAppliedSourceManifestV2Integrity({
                  ...singleSourceV2.manifest,
                  manifestFingerprint: "tampered",
                }).reasonCodes[0],
                "manifest_fingerprint_mismatch",
                "Expected V2 fingerprint mismatch.",
              ),
            ]
          : ["Expected V2 manifest to be created."],
      ok: false,
    },
    {
      name: "v2 invalid manifest exposes no partial relationship payload",
      failureReasons:
        conflictingV2.status === "invalid"
          ? [
              ...assertEqual(conflictingV2.manifest, null, "Expected no partial V2 manifest."),
              ...assertEqual(conflictingV2.reasonCodes.length > 0, true, "Expected V2 reasons."),
            ]
          : ["Expected conflicting V2 manifest to be invalid."],
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
