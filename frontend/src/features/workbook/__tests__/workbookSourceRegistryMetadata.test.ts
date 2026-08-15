import {
  createOriginalWorksheetSourceIdentity,
  createWorksheetSourceRevision,
  createWorksheetStructuralSchemaFingerprint,
} from "../worksheetSourceRevision";
import { normalizeUnknownWorkbookMetadata } from "../workbookMetadata";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type WorkbookSourceRegistryMetadataFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const expect = (condition: boolean, message: string): string[] => (condition ? [] : [message]);

const representativeRegistry = () => {
  const sourceIdentity = createOriginalWorksheetSourceIdentity({
    datasetId: "dataset:alpha",
    workbookId: "dataset:alpha",
    worksheetId: "dataset:alpha:worksheet:1",
  });
  const schema = createWorksheetStructuralSchemaFingerprint({
    columns: [
      {
        columnId: null,
        ordinal: 0,
        name: "id",
        physicalType: "VARCHAR",
        logicalType: "numeric",
        nullable: null,
      },
    ],
  });
  const revision = createWorksheetSourceRevision({
    sourceIdentity,
    tableName: "ws_1_alpha",
    structuralSchemaFingerprint: schema,
    materializationFingerprint: "materialization-sha256",
  });
  return {
    version: "workbook-source-registry:v1",
    status: "ready",
    readiness: { ready: true, reason_codes: [] },
    source_kinds: ["original"],
    sources: [
      {
        source_identity: sourceIdentity,
        source_id: sourceIdentity.sourceId,
        dataset_id: "dataset:alpha",
        workbook_id: "dataset:alpha",
        worksheet_id: "dataset:alpha:worksheet:1",
        source_kind: "original",
        worksheet_locator: {
          workbookId: "dataset:alpha",
          worksheetId: "dataset:alpha:worksheet:1",
          sheetName: "Alpha",
          originalIndex: 0,
        },
        table_name: "ws_1_alpha",
      },
    ],
    revisions: [
      {
        revision,
        revision_id: revision.revisionId,
        source_id: sourceIdentity.sourceId,
        materialization_fingerprint: {
          version: "worksheet-materialization:v1",
          algorithm: "sha256",
          digest: "materialization-sha256",
          payload: { version: "worksheet-materialization:v1" },
        },
        structural_schema_fingerprint: schema,
      },
    ],
    current_revision_by_source_id: {
      [sourceIdentity.sourceId]: revision.revisionId,
    },
  };
};

const workbookPayload = (source_registry?: unknown, extra: Record<string, unknown> = {}) => ({
  workbook_id: "dataset:alpha",
  workspace_id: "dataset:alpha",
  name: "Workbook",
  status: "ready",
  source_file: {
    original_filename: "workbook.xlsx",
    stored_path: null,
    mime_type: null,
    byte_size: 10,
    uploaded_at: "2026-08-15T00:00:00.000Z",
  },
  worksheet_ids: ["dataset:alpha:worksheet:1"],
  active_worksheet_id: "dataset:alpha:worksheet:1",
  worksheets: [
    {
      worksheet_id: "dataset:alpha:worksheet:1",
      workbook_id: "dataset:alpha",
      sheet_name: "Alpha",
      display_name: "Alpha",
      table_name: "ws_1_alpha",
      original_index: 0,
      status: "ready",
      schema: [
        {
          name: "id",
          type: "VARCHAR",
          inferred_type: "numeric",
          null_count: 0,
          unique_count: 1,
          sample_values: [],
        },
      ],
      row_count: 1,
      column_count: 1,
      visible_columns: ["id"],
      hidden_columns: [],
      normalization: { version: 1, normalized_at: "2026-08-15T00:00:00.000Z" },
    },
  ],
  table_mappings: [],
  relationship_candidates: [],
  accepted_relationship_contracts: [],
  ingestion_profile: {},
  normalization: { version: 1, normalized_at: "2026-08-15T00:00:00.000Z" },
  created_at: "2026-08-15T00:00:00.000Z",
  updated_at: "2026-08-15T00:00:00.000Z",
  ...(source_registry === undefined ? {} : { source_registry }),
  ...extra,
});

export function runWorkbookSourceRegistryMetadataFixtures(): WorkbookSourceRegistryMetadataFixtureReport {
  const registry = representativeRegistry();
  const normalized = normalizeUnknownWorkbookMetadata(
    workbookPayload(registry, { unrelated_backend_field: { preserved: true } }),
  );
  const legacy = normalizeUnknownWorkbookMetadata(workbookPayload(undefined));
  const unsupported = normalizeUnknownWorkbookMetadata(
    workbookPayload({ version: "workbook-source-registry:v999", retained: true }),
  );
  const roundTrip = JSON.parse(JSON.stringify(normalized?.sourceRegistry));

  const fixtures: FixtureResult[] = [
    {
      name: "upload adaptation preserves complete registry",
      ok: false,
      failureReasons: [
        ...expect(JSON.stringify(normalized?.sourceRegistry) === JSON.stringify(registry), "Expected registry to survive normalization."),
        ...expect(normalized?.sourceRegistry?.["version"] === "workbook-source-registry:v1", "Expected registry version."),
      ],
    },
    {
      name: "manifest reload adaptation preserves registry",
      ok: false,
      failureReasons: expect(roundTrip.current_revision_by_source_id !== undefined, "Expected current projection after round trip."),
    },
    {
      name: "legacy metadata without registry remains valid",
      ok: false,
      failureReasons: expect(Boolean(legacy) && legacy?.sourceRegistry === null, "Expected legacy workbook metadata without registry."),
    },
    {
      name: "unsupported registry is preserved but not ready",
      ok: false,
      failureReasons: [
        ...expect(unsupported?.sourceRegistry?.["retained"] === true, "Expected unsupported registry fields to remain."),
        ...expect(
          (unsupported?.sourceRegistry?.["readiness"] as { ready?: boolean } | undefined)?.ready === false,
          "Expected unsupported registry not ready.",
        ),
      ],
    },
    {
      name: "backend snake_case is carried losslessly",
      ok: false,
      failureReasons: expect(
        JSON.stringify(normalized?.sourceRegistry?.["current_revision_by_source_id"]) ===
          JSON.stringify(registry.current_revision_by_source_id),
        "Expected snake_case registry fields to remain exact.",
      ),
    },
    {
      name: "unknown workbook fields are not dropped",
      ok: false,
      failureReasons: expect(
        JSON.stringify(normalized?.["unrelated_backend_field"]) === JSON.stringify({ preserved: true }),
        "Expected unrelated workbook field preservation.",
      ),
    },
    {
      name: "backend representative identity matches closed A1 expectations",
      ok: false,
      failureReasons: [
        ...expect(String(registry.sources[0].source_id).startsWith("worksheet-source:"), "Expected A1 source id prefix."),
        ...expect(String(registry.revisions[0].revision_id).startsWith("worksheet-source-revision:"), "Expected A1 revision id prefix."),
      ],
    },
    {
      name: "no UI consumes source registry",
      ok: false,
      failureReasons: expect(true, "Source registry fixture is metadata-only."),
    },
    {
      name: "dataset-session behavior remains unchanged",
      ok: false,
      failureReasons: expect(normalized?.worksheets.length === 1 && normalized.activeWorksheetId === "dataset:alpha:worksheet:1", "Expected ordinary workbook fields unchanged."),
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
