import type { SchemaColumn } from "../../../dataset/datasetTypes";
import {
  normalizeWorkbookMetadata,
  type AcceptedRelationshipContract,
  type WorkbookMetadata,
} from "../../../workbook";
import {
  createDeterministicWorksheetSourceFingerprint,
  createOriginalWorksheetSourceIdentity,
  createRelationshipEndpointSignature,
  createRelationshipEvidenceFingerprint,
  createWorksheetSourceRevision,
  createWorksheetStructuralSchemaFingerprint,
  type WorksheetSourceRevision,
} from "../../../workbook/worksheetSourceRevision";
import {
  collectBusinessSqlPlanAppliedTables,
  evaluateBusinessSqlPlanningSourceReadiness,
} from "../businessSqlPlanningSourceReadiness";
import { createRelationshipSourceValidation } from "../relationshipSourceValidation";
import { adaptWorkbookSourceAuthority } from "../sqlWorkbookSourceAuthorityAdapter";
import {
  createBusinessSqlMeasureId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlJoinEdge,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import { createBusinessSqlRenderPreviewFromWorkspaceContext } from "../businessSqlRenderPreviewUiAdapter";
import { getBusinessSqlRendererPreviewManualInsertEligibility } from "../businessSqlRendererPreviewManualInsertGate";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type BusinessSqlPlanningSourceReadinessFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const expect = (condition: boolean, message: string): string[] => condition ? [] : [message];

const cloneWorkbook = (metadata: WorkbookMetadata): WorkbookMetadata =>
  JSON.parse(JSON.stringify(metadata)) as WorkbookMetadata;

const column = (name: string): SchemaColumn => ({
  name,
  type: "INTEGER",
  inferred_type: "numeric",
  null_count: 0,
  unique_count: 1,
  sample_values: [1],
});

const structural = createWorksheetStructuralSchemaFingerprint({
  columns: [
    {
      columnId: "column:key_id",
      ordinal: 0,
      name: "key_id",
      physicalType: "INTEGER",
      logicalType: "numeric",
      nullable: false,
    },
    {
      columnId: "column:value",
      ordinal: 1,
      name: "value",
      physicalType: "INTEGER",
      logicalType: "numeric",
      nullable: true,
    },
  ],
});

const revisionFor = ({
  datasetId = "dataset:generic",
  workbookId = "workbook:generic",
  worksheetId,
  tableName,
  materializationFingerprint,
}: {
  datasetId?: string;
  workbookId?: string;
  worksheetId: string;
  tableName: string;
  materializationFingerprint: string;
}) =>
  createWorksheetSourceRevision({
    sourceIdentity: createOriginalWorksheetSourceIdentity({
      datasetId,
      workbookId,
      worksheetId,
    }),
    tableName,
    structuralSchemaFingerprint: structural,
    materializationFingerprint,
  });

const sourceRecord = (
  revision: WorksheetSourceRevision,
  originalIndex: number,
) => ({
  source_identity: revision.sourceIdentity,
  source_id: revision.sourceIdentity.sourceId,
  dataset_id: revision.sourceIdentity.datasetId,
  workbook_id: revision.sourceIdentity.workbookId,
  worksheet_id: revision.sourceIdentity.worksheetId,
  source_kind: revision.sourceIdentity.sourceKind,
  worksheet_locator: {
    workbookId: revision.sourceIdentity.workbookId,
    worksheetId: revision.sourceIdentity.worksheetId,
    sheetName: revision.tableName,
    originalIndex,
  },
  table_name: revision.tableName,
});

const revisionRecord = (
  revision: WorksheetSourceRevision,
  originalIndex: number,
) => ({
  revision,
  revision_id: revision.revisionId,
  source_id: revision.sourceIdentity.sourceId,
  dataset_id: revision.sourceIdentity.datasetId,
  workbook_id: revision.sourceIdentity.workbookId,
  worksheet_id: revision.sourceIdentity.worksheetId,
  source_kind: revision.sourceIdentity.sourceKind,
  table_name: revision.tableName,
  worksheet_locator: {
    workbookId: revision.sourceIdentity.workbookId,
    worksheetId: revision.sourceIdentity.worksheetId,
    sheetName: revision.tableName,
    originalIndex,
  },
  materialization_fingerprint: {
    digest: revision.materializationFingerprint,
  },
  structural_schema_fingerprint: revision.structuralSchemaFingerprint,
});

const workbook = ({
  relationshipAuthority = false,
  sourceBlind = false,
}: {
  relationshipAuthority?: boolean;
  sourceBlind?: boolean;
} = {}): WorkbookMetadata => {
  const leftRevision = revisionFor({
    worksheetId: "worksheet:a",
    tableName: "table_a",
    materializationFingerprint: "materialization:a",
  });
  const rightRevision = revisionFor({
    worksheetId: "worksheet:b",
    tableName: "table_b",
    materializationFingerprint: "materialization:b",
  });
  const sourceRegistry = {
    version: "workbook-source-registry:v1",
    status: "ready",
    readiness: { ready: true, reason_codes: [] },
    source_kinds: ["original"],
    sources: [sourceRecord(leftRevision, 0), sourceRecord(rightRevision, 1)],
    revisions: [revisionRecord(leftRevision, 0), revisionRecord(rightRevision, 1)],
    current_revision_by_source_id: {
      [leftRevision.sourceIdentity.sourceId]: leftRevision.revisionId,
      [rightRevision.sourceIdentity.sourceId]: rightRevision.revisionId,
    },
  };
  const leftEndpoint = createRelationshipEndpointSignature({
    sourceRevision: leftRevision,
    columnId: "column:key_id",
    columnName: "key_id",
    columnOrdinal: 0,
    physicalType: "INTEGER",
    logicalType: "numeric",
  });
  const rightEndpoint = createRelationshipEndpointSignature({
    sourceRevision: rightRevision,
    columnId: "column:key_id",
    columnName: "key_id",
    columnOrdinal: 0,
    physicalType: "INTEGER",
    logicalType: "numeric",
  });
  const evidenceFingerprint = createRelationshipEvidenceFingerprint({
    rowCount: 2,
    nullCount: 0,
    distinctCount: 2,
    uniquenessRatio: 1,
    cardinalityEvidence: "one_to_many",
    candidateKeyEvidence: "unique",
    overlapPolicyId: "sampled-overlap:v1",
    sampledOverlapRatio: 1,
    sampledOverlapCount: 2,
  });
  const validation = createRelationshipSourceValidation({
    relationshipId: "relationship:a-b",
    direction: "symmetric",
    leftEndpoint,
    rightEndpoint,
    evidenceFingerprint,
  });
  const validationRecordId = createDeterministicWorksheetSourceFingerprint(
    "relationship-source-validation-record",
    {
      version: "relationship-source-validation-ledger:v1",
      validation,
    },
  );
  const acceptancePayload = {
    version: "relationship-source-acceptance-history:v1",
    relationship_id: "relationship:a-b",
    review_status: "accepted",
    validation_id: validation.assessmentId,
    validation_identity: validation.validationIdentity,
    contract_id: "contract:a-b",
  };
  const acceptanceRecordId = createDeterministicWorksheetSourceFingerprint(
    "relationship-source-acceptance",
    acceptancePayload,
  );
  const acceptedRelationship: AcceptedRelationshipContract = {
    contractId: "contract:a-b",
    sourceWorksheetId: "worksheet:a",
    sourceTableName: "table_a",
    sourceColumnName: "key_id",
    targetWorksheetId: "worksheet:b",
    targetTableName: "table_b",
    targetColumnName: "key_id",
    relationshipType: "one_to_many_candidate",
    confidence: 1,
    acceptedFromCandidateId: "relationship:a-b",
    acceptedAt: "2026-01-01T00:00:00.000Z",
    acceptedBy: null,
    status: "active",
    validationState: "valid",
    validationSummary: [],
    overlapRatio: 1,
    sourceUniqueRatio: 1,
    targetUniqueRatio: 1,
    inferredTypeCompatible: true,
    lastValidatedAt: "2026-01-01T00:00:00.000Z",
  };
  return normalizeWorkbookMetadata({
    workbookId: "workbook:generic",
    name: "Generic workbook",
    sourceFile: {
      originalFilename: "generic.xlsx",
      storedPath: null,
      mimeType: null,
      byteSize: null,
      uploadedAt: "2026-01-01T00:00:00.000Z",
    },
    worksheets: [
      {
        worksheetId: "worksheet:a",
        workbookId: "workbook:generic",
        sheetName: "A",
        displayName: "A",
        tableName: "table_a",
        originalIndex: 0,
        status: "ready",
        schema: [column("key_id"), column("value")],
        rowCount: 2,
        columnCount: 2,
        visibleColumns: ["key_id", "value"],
        hiddenColumns: [],
        normalization: {
          version: 1,
          normalizedAt: "2026-01-01T00:00:00.000Z",
          headerRowIndex: null,
          skippedLeadingRows: null,
          headerDetectionStrategy: null,
          headerDetectionConfidence: null,
          headerDetectionWarning: null,
          originalFirstRowPreview: null,
          selectedHeaderRowPreview: null,
          structuralColumnCandidates: [],
          structuralColumnDetectionWarning: null,
          structuralColumnDetectionConfidence: null,
          structuralColumnSampleSize: null,
          recommendedHiddenColumns: [],
          duplicateColumnCount: 0,
          emptyColumnCount: 0,
          warnings: [],
          templateStructureCandidate: false,
          templateStructureConfidence: "low",
          templateStructureEvidence: [],
        },
      },
      {
        worksheetId: "worksheet:b",
        workbookId: "workbook:generic",
        sheetName: "B",
        displayName: "B",
        tableName: "table_b",
        originalIndex: 1,
        status: "ready",
        schema: [column("key_id"), column("value")],
        rowCount: 2,
        columnCount: 2,
        visibleColumns: ["key_id", "value"],
        hiddenColumns: [],
        normalization: {
          version: 1,
          normalizedAt: "2026-01-01T00:00:00.000Z",
          headerRowIndex: null,
          skippedLeadingRows: null,
          headerDetectionStrategy: null,
          headerDetectionConfidence: null,
          headerDetectionWarning: null,
          originalFirstRowPreview: null,
          selectedHeaderRowPreview: null,
          structuralColumnCandidates: [],
          structuralColumnDetectionWarning: null,
          structuralColumnDetectionConfidence: null,
          structuralColumnSampleSize: null,
          recommendedHiddenColumns: [],
          duplicateColumnCount: 0,
          emptyColumnCount: 0,
          warnings: [],
          templateStructureCandidate: false,
          templateStructureConfidence: "low",
          templateStructureEvidence: [],
        },
      },
    ],
    cleanedWorkingCopies: [
      {
        cleanedCopyId: "cleaned:a",
        sourceWorksheetId: "worksheet:a",
        sourceTableName: "table_a",
        cleanedTableName: "table_a_cleaned",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    acceptedRelationshipContracts: relationshipAuthority ? [acceptedRelationship] : [],
    sourceRegistry,
    relationshipSourceValidationLedger: relationshipAuthority
      ? {
          version: "relationship-source-validation-ledger:v1",
          status: "ready",
          readiness: { ready: true, reason_codes: [] },
          records: [{ validation_record_id: validationRecordId, validation }],
          current_validation_by_relationship_id: {
            "relationship:a-b": validation.assessmentId,
          },
        }
      : null,
    relationshipAcceptanceHistory: relationshipAuthority
      ? {
          version: "relationship-source-acceptance-history:v1",
          status: "ready",
          readiness: { ready: true, reason_codes: [] },
          records: [{ acceptance_record_id: acceptanceRecordId, ...acceptancePayload }],
          current_acceptance_by_relationship_id: {
            "relationship:a-b": acceptanceRecordId,
          },
        }
      : null,
    current_source_bound_relationships: relationshipAuthority
      ? {
          "relationship:a-b": {
            relationship_id: "relationship:a-b",
            validation_record_id: validationRecordId,
            acceptance_record_id: acceptanceRecordId,
            validation_id: validation.assessmentId,
            validation_identity: validation.validationIdentity,
            contract_id: "contract:a-b",
            source_blind: sourceBlind,
          },
        }
      : undefined,
  });
};

const singlePlan = (tableName = "table_a"): BusinessSqlQueryPlan => {
  const measure = {
    measureId: createBusinessSqlMeasureId({
      kind: "count_rows",
      table: tableName,
      distinct: false,
    }),
    kind: "count_rows" as const,
    table: tableName,
    distinct: false,
    label: "row count",
    sqlAlias: "row_count",
  };
  return {
    ...createEmptyBusinessSqlQueryPlan(),
    id: `plan:${tableName}`,
    kind: "single_table_count_grouping",
    status: "resolved",
    support: "supported",
    entities: [
      { entity: "table_a", table: tableName, required: true, role: "source" },
      { entity: "table_unused", table: "table_unused", required: false, role: "context" },
    ],
    measures: [measure],
    groupings: [{ entity: "table_a", table: tableName, field: "key_id", label: "key_id" }],
    orderBy: [
      createBusinessSqlSortId({
        target: { kind: "measure", measureId: measure.measureId },
        direction: "desc",
      }),
    ].map((sortId) => ({
      sortId,
      target: { kind: "measure" as const, measureId: measure.measureId },
      direction: "desc" as const,
    })),
  };
};

const multiPlan = (edge: Partial<BusinessSqlJoinEdge> = {}): BusinessSqlQueryPlan => {
  const measure = {
    measureId: createBusinessSqlMeasureId({
      kind: "count_rows",
      table: "table_b",
      distinct: false,
    }),
    kind: "count_rows" as const,
    table: "table_b",
    distinct: false,
    label: "row count",
    sqlAlias: "row_count",
  };
  return {
    ...singlePlan(),
    id: "plan:multi",
    kind: "multi_table_count_grouping",
    entities: [
      { entity: "table_a", table: "table_a", required: true, role: "grouping_subject" },
      { entity: "table_b", table: "table_b", required: true, role: "metric_subject" },
    ],
    measures: [measure],
    groupings: [{ entity: "table_a", table: "table_a", field: "key_id", label: "key_id" }],
    joinPath: {
      required: true,
      status: "resolved",
      entities: ["table_a", "table_b"],
      requirements: [
        {
          fromEntity: "table_a",
          toEntity: "table_b",
          required: true,
          relationship: "descriptive relationship text",
          verified: true,
        },
      ],
      edges: [
        {
          fromEntity: "table_a",
          fromTable: "table_a",
          fromField: "key_id",
          toEntity: "table_b",
          toTable: "table_b",
          toField: "key_id",
          relationship: "descriptive relationship text",
          relationshipAuthority: {
            relationshipId: "relationship:a-b",
            contractId: "contract:a-b",
          },
          verified: true,
          ...edge,
        },
      ],
    },
  };
};

const workbookWithSourceRegistryPatch = (
  metadata: WorkbookMetadata,
  patch: Record<string, unknown>,
): WorkbookMetadata => ({
  ...cloneWorkbook(metadata),
  sourceRegistry: {
    ...((cloneWorkbook(metadata).sourceRegistry || {}) as Record<string, unknown>),
    ...patch,
  },
});

const workbookWithSourceBoundPatch = (
  metadata: WorkbookMetadata,
  patch: Record<string, unknown> | null,
): WorkbookMetadata => {
  const copy = cloneWorkbook(metadata);
  const current =
    (copy.current_source_bound_relationships as Record<string, Record<string, unknown>> | undefined) ||
    {};
  if (patch === null) {
    delete current["relationship:a-b"];
  } else {
    current["relationship:a-b"] = {
      ...(current["relationship:a-b"] || {}),
      ...patch,
    };
  }
  copy.current_source_bound_relationships = current;
  return copy;
};

export function runBusinessSqlPlanningSourceReadinessFixtures(): BusinessSqlPlanningSourceReadinessFixtureReport {
  const validWorkbook = workbook({ relationshipAuthority: true });
  const localOnlyWorkbook = workbook();
  const sourceBlindWorkbook = workbook({ relationshipAuthority: true, sourceBlind: true });
  const fixtures: FixtureResult[] = [
    {
      name: "valid A2 authority adapts to S1 normalized authority without changing persisted version",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: validWorkbook,
          datasetId: "dataset:generic",
        });
        return [
          ...expect(result.ready, "Expected adapter to accept valid A2 authority."),
          ...expect(
            result.ready &&
              result.acceptanceHistory.version === "relationship-acceptance-history:v1",
            "Expected adapter to emit S1 internal acceptance-history version.",
          ),
          ...expect(
            validWorkbook.relationshipAcceptanceHistory?.version ===
              "relationship-source-acceptance-history:v1",
            "Expected persisted A2 acceptance-history version to remain unchanged.",
          ),
          ...expect(
            result.ready && result.acceptanceHistory.records[0]?.sourceAware === true,
            "Expected source-aware acceptance to be proven.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "source-blind current source-bound record blocks",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: sourceBlindWorkbook,
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected source-blind authority to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_bound_relationship_mismatch"),
            "Expected source-bound mismatch reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "unsupported source registry version blocks",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceRegistryPatch(validWorkbook, { version: "workbook-source-registry:v0" }),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected unsupported registry version to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_registry_version_unsupported"),
            "Expected unsupported registry version reason.",
          ),
        ];
      })(),
      ok: false,
    },
    ...[
      {
        name: "missing registry status is malformed",
        patch: { status: undefined },
        expectedReason: "source_registry_malformed" as const,
      },
      {
        name: "missing registry readiness is malformed",
        patch: { readiness: undefined },
        expectedReason: "source_registry_malformed" as const,
      },
      {
        name: "missing registry readiness.ready is malformed",
        patch: { readiness: { reason_codes: [] } },
        expectedReason: "source_registry_malformed" as const,
      },
      {
        name: "explicit non-ready registry status blocks as not ready",
        patch: { status: "partial" },
        expectedReason: "source_registry_not_ready" as const,
      },
      {
        name: "explicit false registry readiness blocks as not ready",
        patch: { readiness: { ready: false, reason_codes: ["pending"] } },
        expectedReason: "source_registry_not_ready" as const,
      },
    ].map(({ name, patch, expectedReason }) => ({
      name,
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceRegistryPatch(validWorkbook, patch),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, `Expected ${name} to block.`),
          ...expect(
            !result.ready && result.reasonCodes.includes(expectedReason),
            `Expected ${expectedReason}.`,
          ),
        ];
      })(),
      ok: false,
    })),
    {
      name: "malformed source registry blocks",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceRegistryPatch(validWorkbook, { sources: "not-an-array" }),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected malformed registry to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_registry_malformed"),
            "Expected malformed registry reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "missing current source revision blocks",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceRegistryPatch(validWorkbook, {
            current_revision_by_source_id: {},
          }),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected missing current revision to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_revision_missing"),
            "Expected missing source revision reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "structural fingerprint mismatch blocks",
      failureReasons: (() => {
        const copy = cloneWorkbook(validWorkbook);
        const registry = copy.sourceRegistry as Record<string, unknown>;
        const revisions = registry.revisions as Record<string, unknown>[];
        const revisionRecordCopy = revisions[0];
        const revision = revisionRecordCopy?.revision as WorksheetSourceRevision | undefined;
        if (revision) {
          revision.structuralSchemaFingerprint = {
            ...revision.structuralSchemaFingerprint,
            fingerprint: "structural-schema-fingerprint:mismatch",
          };
        }
        const result = adaptWorkbookSourceAuthority({
          workbook: copy,
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected structural mismatch to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("structural_schema_mismatch"),
            "Expected structural mismatch reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "missing source-bound relationship projection blocks source-aware acceptance",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceBoundPatch(validWorkbook, null),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected missing source-bound projection to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_bound_relationship_missing"),
            "Expected missing source-bound reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "source-bound validation record mismatch blocks",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceBoundPatch(validWorkbook, {
            validation_record_id: "relationship-source-validation-record:mismatch",
          }),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected validation record mismatch to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_bound_relationship_mismatch"),
            "Expected source-bound mismatch reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "source-bound acceptance record mismatch blocks",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceBoundPatch(validWorkbook, {
            acceptance_record_id: "relationship-source-acceptance:mismatch",
          }),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected acceptance record mismatch to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_bound_relationship_mismatch"),
            "Expected source-bound mismatch reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "source-bound validation identity mismatch blocks",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceBoundPatch(validWorkbook, {
            validation_identity: "relationship-source-validation-identity:mismatch",
          }),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected validation identity mismatch to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_bound_relationship_mismatch"),
            "Expected source-bound mismatch reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "source-bound contract mismatch blocks",
      failureReasons: (() => {
        const result = adaptWorkbookSourceAuthority({
          workbook: workbookWithSourceBoundPatch(validWorkbook, {
            contract_id: "contract:mismatch",
          }),
          datasetId: "dataset:generic",
        });
        return [
          ...expect(!result.ready, "Expected contract mismatch to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("source_bound_relationship_mismatch"),
            "Expected source-bound mismatch reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "actual plan source collection excludes optional unused entity",
      failureReasons: (() => {
        const tables = collectBusinessSqlPlanAppliedTables(singlePlan());
        return [
          ...expect(tables.includes("table_a"), "Expected used source table."),
          ...expect(!tables.includes("table_unused"), "Expected unused optional context entity to be excluded."),
        ];
      })(),
      ok: false,
    },
    {
      name: "actual plan source collection includes filter derived aggregate and sort dependencies",
      failureReasons: (() => {
        const measure = {
          measureId: createBusinessSqlMeasureId({
            kind: "sum",
            table: "table_b",
            field: "value",
            distinct: false,
          }),
          kind: "sum" as const,
          table: "table_b",
          field: "value",
          distinct: false,
          label: "value sum",
          sqlAlias: "value_sum",
        };
        const plan: BusinessSqlQueryPlan = {
          ...multiPlan(),
          measures: [measure],
          filters: [
            {
              filterId: "filter:a",
              kind: "custom",
              target: { kind: "field", table: "table_a", field: "value" },
              operator: "greater_than",
              comparisonValue: { kind: "string", value: "0" },
              label: "value greater than zero",
            },
          ],
          derivedMeasures: [
            {
              derivedMeasureId: "derived:ratio",
              operator: "divide",
              leftMeasureId: measure.measureId,
              rightMeasureId: measure.measureId,
              divisionPolicy: { zeroDenominator: "null" },
              sqlAlias: "ratio",
              label: "ratio",
            },
          ],
          aggregateResultConditions: [
            {
              conditionId: "condition:value",
              target: { kind: "measure", measureId: measure.measureId },
              operator: "greater_than",
              comparisonValue: { kind: "number", value: 0 },
            },
          ],
          orderBy: [
            {
              sortId: "sort:field",
              target: { kind: "field", table: "table_a", field: "key_id" },
              direction: "asc",
            },
            {
              sortId: "sort:measure",
              target: { kind: "measure", measureId: measure.measureId },
              direction: "desc",
            },
          ],
        };
        const tables = collectBusinessSqlPlanAppliedTables(plan);
        return [
          ...expect(tables.includes("table_a"), "Expected table_a from grouping/filter/sort/join."),
          ...expect(tables.includes("table_b"), "Expected table_b from measure/derived/aggregate/join."),
          ...expect(
            tables.filter((table) => table === "table_a").length === 1,
            "Expected table_a to be deduplicated.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "single original source builds a ready manifest with zero relationships",
      failureReasons: (() => {
        const result = evaluateBusinessSqlPlanningSourceReadiness({
          plan: singlePlan(),
          datasetId: "dataset:generic",
          workbookMetadata: localOnlyWorkbook,
        });
        return [
          ...expect(result.ready, "Expected original single-source plan to be source ready."),
          ...expect(result.sourceMode === "original_only", "Expected original_only mode."),
          ...expect(
            result.ready && result.manifest.relationshipBindings.length === 0,
            "Expected no relationship bindings for single-source plan.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "valid multi-source authoritative relationship builds a manifest",
      failureReasons: (() => {
        const result = evaluateBusinessSqlPlanningSourceReadiness({
          plan: multiPlan(),
          datasetId: "dataset:generic",
          workbookMetadata: validWorkbook,
        });
        return [
          ...expect(result.ready, "Expected valid multi-source authority to be ready."),
          ...expect(
            result.ready && result.manifest.relationshipBindings.length === 1,
            "Expected one relationship binding.",
          ),
          ...expect(
            result.ready &&
              result.manifest.relationshipBindings[0]?.relationshipId === "relationship:a-b",
            "Expected manifest to use authoritative relationship ID.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "local accepted contract alone does not satisfy source readiness",
      failureReasons: (() => {
        const result = evaluateBusinessSqlPlanningSourceReadiness({
          plan: multiPlan(),
          datasetId: "dataset:generic",
          workbookMetadata: localOnlyWorkbook,
        });
        return [
          ...expect(!result.ready, "Expected local-only relationship to block source readiness."),
          ...expect(
            !result.ready && result.reasonCodes.includes("relationship_validation_projection_missing"),
            "Expected missing validation projection reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "cleaned source mode blocks without fabricating a revision",
      failureReasons: (() => {
        const result = evaluateBusinessSqlPlanningSourceReadiness({
          plan: singlePlan("table_a_cleaned"),
          datasetId: "dataset:generic",
          workbookMetadata: localOnlyWorkbook,
        });
        return [
          ...expect(!result.ready, "Expected cleaned source to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("unsupported_cleaned_source"),
            "Expected cleaned source reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "mixed source mode blocks",
      failureReasons: (() => {
        const plan = singlePlan("table_a_cleaned");
        plan.groupings = [{ entity: "table_a", table: "table_a", field: "key_id", label: "key_id" }];
        const result = evaluateBusinessSqlPlanningSourceReadiness({
          plan,
          datasetId: "dataset:generic",
          workbookMetadata: localOnlyWorkbook,
        });
        return [
          ...expect(!result.ready, "Expected mixed source mode to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("unsupported_mixed_source"),
            "Expected mixed source reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "unknown source mode blocks",
      failureReasons: (() => {
        const result = evaluateBusinessSqlPlanningSourceReadiness({
          plan: singlePlan("missing_table"),
          datasetId: "dataset:generic",
          workbookMetadata: localOnlyWorkbook,
        });
        return [
          ...expect(!result.ready, "Expected unknown source mode to block."),
          ...expect(
            !result.ready && result.reasonCodes.includes("plan_source_mapping_missing"),
            "Expected missing mapping reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "source-blocked preview has no SQL and insert gate reports source readiness",
      failureReasons: (() => {
        const preview = createBusinessSqlRenderPreviewFromWorkspaceContext({
          taskPrompt: "Count leases by status",
          selectedGuidanceDialect: "duckdb",
          datasetId: "dataset:generic",
          workbookMetadata: null,
        }).preview;
        const gate = getBusinessSqlRendererPreviewManualInsertEligibility({
          rendererPreviewUiModel: preview.rendererPreviewUiModel || null,
          activeSqlDraft: "",
          sourceReadiness: preview.sourceReadiness || null,
        });
        return [
          ...expect(preview.status === "blocked", "Expected source-blocked preview."),
          ...expect(preview.sql === null, "Expected blocked preview to omit SQL."),
          ...expect(!gate.eligible, "Expected insert gate to block."),
          ...expect(
            gate.reasonCode === "source_readiness_blocked",
            "Expected source-readiness insert reason.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "renderable generated preview without dataset id fails closed before rendering",
      failureReasons: (() => {
        const preview = createBusinessSqlRenderPreviewFromWorkspaceContext({
          taskPrompt: "Count leases by status",
          selectedGuidanceDialect: "duckdb",
          workbookMetadata: validWorkbook,
        }).preview;
        return [
          ...expect(preview.status === "blocked", "Expected missing dataset ID to block."),
          ...expect(preview.sql === null, "Expected missing dataset ID to omit SQL."),
          ...expect(
            preview.sourceReadiness?.ready === false &&
              preview.sourceReadiness.reasonCodes.includes("legacy_source_unverifiable"),
            "Expected legacy-source-unverifiable readiness block.",
          ),
          ...expect(
            !preview.rendererPreviewUiModel,
            "Expected source-blocked preview not to call renderer.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "renderable generated preview without workbook metadata fails closed before rendering",
      failureReasons: (() => {
        const preview = createBusinessSqlRenderPreviewFromWorkspaceContext({
          taskPrompt: "Count leases by status",
          selectedGuidanceDialect: "duckdb",
          datasetId: "dataset:generic",
          workbookMetadata: null,
        }).preview;
        return [
          ...expect(preview.status === "blocked", "Expected missing workbook metadata to block."),
          ...expect(preview.sql === null, "Expected missing workbook metadata to omit SQL."),
          ...expect(
            preview.sourceReadiness?.ready === false &&
              preview.sourceReadiness.reasonCodes.includes("legacy_source_unverifiable"),
            "Expected legacy-source-unverifiable readiness block.",
          ),
          ...expect(
            !preview.rendererPreviewUiModel,
            "Expected source-blocked preview not to call renderer.",
          ),
        ];
      })(),
      ok: false,
    },
    {
      name: "blocked non-source plan preserves primary blocker before missing authority",
      failureReasons: (() => {
        const preview = createBusinessSqlRenderPreviewFromWorkspaceContext({
          taskPrompt: "orders per customer",
          selectedGuidanceDialect: "duckdb",
          missingRelationships: [{ fromEntity: "customers", toEntity: "orders" }],
        }).preview;
        return [
          ...expect(preview.status === "blocked", "Expected existing blocker to remain blocked."),
          ...expect(preview.sql === null, "Expected blocked plan to omit SQL."),
          ...expect(!preview.sourceReadiness, "Expected source readiness not to mask plan blocker."),
          ...expect(preview.reasons.length > 0, "Expected existing non-source blocker reasons."),
        ];
      })(),
      ok: false,
    },
    {
      name: "needs-review non-source plan preserves review reason before missing authority",
      failureReasons: (() => {
        const preview = createBusinessSqlRenderPreviewFromWorkspaceContext({
          taskPrompt: "tickets per account",
          selectedGuidanceDialect: "duckdb",
        }).preview;
        return [
          ...expect(preview.status === "needs_review", "Expected existing review state."),
          ...expect(preview.sql === null, "Expected needs-review plan to omit SQL."),
          ...expect(!preview.sourceReadiness, "Expected source readiness not to mask review state."),
          ...expect(preview.reasons.length > 0, "Expected existing non-source review reasons."),
        ];
      })(),
      ok: false,
    },
    {
      name: "source-blocked generated preview does not change manual SQL run separation",
      failureReasons: (() => {
        const activeSqlDraft = "SELECT 1;";
        const result = createBusinessSqlRenderPreviewFromWorkspaceContext({
          taskPrompt: "Count leases by status",
          selectedGuidanceDialect: "duckdb",
          datasetId: "dataset:generic",
          workbookMetadata: null,
          activeSqlDraft,
          activeSqlDraftSource: "manual",
        });
        return [
          ...expect(result.activeSqlDraft === activeSqlDraft, "Expected manual SQL draft to remain untouched."),
          ...expect(result.activeSqlDraftSource === "manual", "Expected manual draft source to remain untouched."),
          ...expect(!result.preview.actions.canRunSql, "Expected generated preview not to expose Run Query."),
          ...expect(!result.preview.actions.canInsertSql, "Expected generated preview Insert to remain disabled."),
        ];
      })(),
      ok: false,
    },
  ].map((fixture) => ({
    ...fixture,
    ok: fixture.failureReasons.length === 0,
  }));

  return {
    results: fixtures,
    passed: fixtures.filter((fixture) => fixture.ok),
    failed: fixtures.filter((fixture) => !fixture.ok),
  };
}

export const BUSINESS_SQL_PLANNING_SOURCE_READINESS_FIXTURES_PASS =
  runBusinessSqlPlanningSourceReadinessFixtures().failed.length === 0;
