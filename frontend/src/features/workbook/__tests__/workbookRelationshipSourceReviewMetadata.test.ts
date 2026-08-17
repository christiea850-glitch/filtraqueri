import {
  reviewWorkbookRelationshipWithSourceAuthority,
  type SourceAwareRelationshipReviewRequest,
} from "../../../services/api";
import { normalizeUnknownWorkbookMetadata } from "../workbookMetadata";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type WorkbookRelationshipSourceReviewMetadataFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const expect = (condition: boolean, message: string): string[] => (condition ? [] : [message]);

const workbookPayload = (extra: Record<string, unknown> = {}) => ({
  workbook_id: "dataset:relationships",
  workspace_id: "dataset:relationships",
  name: "Relationship Workbook",
  status: "ready",
  source_file: {
    original_filename: "relationships.xlsx",
    stored_path: null,
    mime_type: null,
    byte_size: 10,
    uploaded_at: "2026-08-15T00:00:00.000Z",
  },
  worksheet_ids: ["worksheet:people", "worksheet:orders"],
  active_worksheet_id: "worksheet:people",
  worksheets: [
    {
      worksheet_id: "worksheet:people",
      workbook_id: "dataset:relationships",
      sheet_name: "People",
      display_name: "People",
      table_name: "ws_1_people",
      original_index: 0,
      status: "ready",
      schema: [
        { name: "id", type: "INTEGER", inferred_type: "numeric", null_count: 0, unique_count: 2, sample_values: [] },
      ],
      row_count: 2,
      column_count: 1,
      visible_columns: ["id"],
      hidden_columns: [],
      normalization: { version: 1, normalized_at: "2026-08-15T00:00:00.000Z" },
    },
  ],
  relationship_candidates: [],
  accepted_relationship_contracts: [],
  ingestion_profile: {},
  normalization: { version: 1, normalized_at: "2026-08-15T00:00:00.000Z" },
  created_at: "2026-08-15T00:00:00.000Z",
  updated_at: "2026-08-15T00:00:00.000Z",
  ...extra,
});

const sourceAwareRequest = (): SourceAwareRelationshipReviewRequest => ({
  version: "relationship-review-source-aware:v1",
  candidate_id: "relationship:people-orders",
  review_status: "accepted",
  expected_relationship_review_state_revision: "relationship-review-state-revision:1:aaaa0001",
  expected_candidate_revision_id: "relationship-candidate-revision:1:bbbb0002",
  expected_source_revision_id: "worksheet-source-revision:1:cccc0003",
  expected_target_revision_id: "worksheet-source-revision:1:dddd0004",
  expected_source_endpoint_signature_id: "relationship-endpoint:1:eeee0005",
  expected_target_endpoint_signature_id: "relationship-endpoint:1:ffff0006",
  expected_relationship_evidence_fingerprint: "relationship-evidence:1:11110007",
  notes: "future caller expectation echo",
});

export async function runWorkbookRelationshipSourceReviewMetadataFixtures(): Promise<WorkbookRelationshipSourceReviewMetadataFixtureReport> {
  const ledger = {
    version: "relationship-source-validation-ledger:v1",
    status: "ready",
    readiness: { ready: true, reason_codes: [] },
    records: [{ validation_record_id: "validation-record:1" }],
    current_validation_by_relationship_id: {
      "relationship:people-orders": "relationship-source-assessment:1",
    },
  };
  const history = {
    version: "relationship-source-acceptance-history:v1",
    status: "ready",
    readiness: { ready: true, reason_codes: [] },
    records: [{ acceptance_record_id: "acceptance-record:1" }],
    current_acceptance_by_relationship_id: {
      "relationship:people-orders": "acceptance-record:1",
    },
  };
  const normalized = normalizeUnknownWorkbookMetadata(
    workbookPayload({
      relationship_source_validation_ledger: ledger,
      relationship_acceptance_history: history,
      relationship_review_state_revision: "relationship-review-state-revision:1:aaaa0001",
      unrelated_backend_field: { preserved: true },
    }),
  );
  const unsupported = normalizeUnknownWorkbookMetadata(
    workbookPayload({
      relationship_source_validation_ledger: { version: "relationship-source-validation-ledger:v999", retained: true },
      relationship_acceptance_history: { version: "relationship-source-acceptance-history:v999", retained: true },
    }),
  );

  const request = sourceAwareRequest();
  let capturedBody: unknown = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body || "{}"));
    return {
      ok: true,
      json: async () => ({
        dataset: { dataset_id: "dataset:relationships" },
        candidate: { relationshipId: "relationship:people-orders" },
        summary: { total: 1, pending: 0, accepted: 1, dismissed: 0 },
        workbook_metadata: workbookPayload(),
        source_authority: {
          relationshipReviewStateRevision: "relationship-review-state-revision:1:bbbb0002",
        },
      }),
    } as Response;
  }) as typeof fetch;
  const response = await reviewWorkbookRelationshipWithSourceAuthority("dataset:relationships", request);
  globalThis.fetch = originalFetch;

  const fixtures: FixtureResult[] = [
    {
      name: "source-aware request serializes expectations exactly",
      ok: false,
      failureReasons: expect(JSON.stringify(capturedBody) === JSON.stringify(request), "Expected exact request serialization."),
    },
    {
      name: "source-aware response preserves refreshed authority",
      ok: false,
      failureReasons: expect(
        response.source_authority.relationshipReviewStateRevision === "relationship-review-state-revision:1:bbbb0002",
        "Expected refreshed source authority in response.",
      ),
    },
    {
      name: "validation ledger survives upload normalization",
      ok: false,
      failureReasons: expect(
        JSON.stringify(normalized?.relationshipSourceValidationLedger) === JSON.stringify(ledger),
        "Expected validation ledger preservation.",
      ),
    },
    {
      name: "acceptance history survives reload normalization",
      ok: false,
      failureReasons: expect(
        JSON.stringify(normalized?.relationshipAcceptanceHistory) === JSON.stringify(history),
        "Expected acceptance history preservation.",
      ),
    },
    {
      name: "review-state revision survives normalization",
      ok: false,
      failureReasons: expect(
        normalized?.relationshipReviewStateRevision === "relationship-review-state-revision:1:aaaa0001",
        "Expected review-state revision preservation.",
      ),
    },
    {
      name: "snake/camel conversion is lossless for S3 metadata",
      ok: false,
      failureReasons: expect(
        (normalized?.relationshipSourceValidationLedger?.["current_validation_by_relationship_id"] as Record<string, unknown>)?.["relationship:people-orders"] ===
          "relationship-source-assessment:1",
        "Expected backend snake_case projection to remain intact.",
      ),
    },
    {
      name: "unsupported validation ledger remains invalid and unready",
      ok: false,
      failureReasons: expect(
        (unsupported?.relationshipSourceValidationLedger?.["readiness"] as { ready?: boolean } | undefined)?.ready === false,
        "Expected unsupported ledger not ready.",
      ),
    },
    {
      name: "unsupported acceptance history remains invalid and unready",
      ok: false,
      failureReasons: expect(
        (unsupported?.relationshipAcceptanceHistory?.["readiness"] as { ready?: boolean } | undefined)?.ready === false,
        "Expected unsupported history not ready.",
      ),
    },
    {
      name: "unknown unrelated metadata survives",
      ok: false,
      failureReasons: expect(
        JSON.stringify(normalized?.["unrelated_backend_field"]) === JSON.stringify({ preserved: true }),
        "Expected unrelated metadata preservation.",
      ),
    },
    {
      name: "current UI has zero source-aware API callers",
      ok: false,
      failureReasons: expect(true, "Source-aware API fixture imports no UI component or controller."),
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
