import { createSqlExecutionIdentity } from "../sqlExecutionIdentity";
import {
  deriveSqlExecutionDisplayStatus,
  type DeriveSqlExecutionDisplayStatusInput,
} from "../sqlExecutionDisplayStatus";
import type { SqlPreviewResult } from "../sqlTypes";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlExecutionDisplayStatusFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const assertEqual = (actual: unknown, expected: unknown, message: string) =>
  actual === expected
    ? []
    : [`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`];

const baseIdentity = createSqlExecutionIdentity({
  requestId: "sql-run:display:1",
  exactSql: "SELECT * FROM orders;",
  datasetId: "dataset-1",
  worksheetId: "worksheet-1",
});

const baseContext = {
  exactSql: "SELECT * FROM orders;",
  datasetId: "dataset-1",
  worksheetId: "worksheet-1",
};

const createPreviewResult = (
  overrides: Partial<SqlPreviewResult> = {},
): SqlPreviewResult => ({
  columns: [],
  rows: [],
  message: "No results yet.",
  errorInsight: null,
  ...overrides,
});

const deriveStatus = (input: Partial<DeriveSqlExecutionDisplayStatusInput> = {}) =>
  deriveSqlExecutionDisplayStatus({
    editorStatus: "success",
    previewResult: createPreviewResult({
      columns: ["status"],
      rows: [{ status: "Open" }],
      message: "Query returned 1 row.",
      executionIdentity: baseIdentity,
    }),
    currentContext: baseContext,
    ...input,
  }).status;

export function runSqlExecutionDisplayStatusFixtures(): SqlExecutionDisplayStatusFixtureReport {
  const frozenPreview = Object.freeze(
    createPreviewResult({
      columns: Object.freeze(["status"]) as unknown as string[],
      rows: Object.freeze([{ status: "Open" }]) as unknown as Record<string, unknown>[],
      message: "Query returned 1 row.",
      executionIdentity: Object.freeze({ ...baseIdentity }),
    }),
  );
  const frozenContext = Object.freeze({ ...baseContext });
  const frozenBefore = JSON.stringify({ frozenPreview, frozenContext });

  const fixtures: FixtureResult[] = [
    {
      name: "no result is not run",
      failureReasons: assertEqual(
        deriveStatus({
          editorStatus: "idle",
          previewResult: createPreviewResult(),
        }),
        "not_run",
        "Expected empty preview to be not run.",
      ),
      ok: false,
    },
    {
      name: "preview without execution identity is not run",
      failureReasons: assertEqual(
        deriveStatus({
          editorStatus: "draft-saved",
          previewResult: createPreviewResult({
            columns: ["status"],
            rows: [{ status: "Preview only" }],
            message: "Generated preview.",
          }),
        }),
        "not_run",
        "Expected identity-free preview to be not run.",
      ),
      ok: false,
    },
    {
      name: "running status is running",
      failureReasons: assertEqual(
        deriveStatus({ editorStatus: "running" }),
        "running",
        "Expected running editor status to be visible running.",
      ),
      ok: false,
    },
    {
      name: "running takes precedence over completed result",
      failureReasons: assertEqual(
        deriveStatus({
          editorStatus: "running",
          previewResult: createPreviewResult({
            columns: ["status"],
            rows: [{ status: "Older" }],
            message: "Query returned 1 row.",
            executionIdentity: baseIdentity,
          }),
          currentContext: {
            ...baseContext,
            exactSql: "SELECT * FROM changed_orders;",
          },
        }),
        "running",
        "Expected running to outrank stale completed data.",
      ),
      ok: false,
    },
    {
      name: "successful matching identity is current",
      failureReasons: assertEqual(deriveStatus(), "current", "Expected matching success to be current."),
      ok: false,
    },
    {
      name: "successful exact SQL mismatch is stale",
      failureReasons: assertEqual(
        deriveStatus({ currentContext: { ...baseContext, exactSql: "SELECT id FROM orders;" } }),
        "stale",
        "Expected SQL mismatch to be stale.",
      ),
      ok: false,
    },
    {
      name: "internal SQL difference is stale",
      failureReasons: assertEqual(
        deriveStatus({ currentContext: { ...baseContext, exactSql: "SELECT  * FROM orders;" } }),
        "stale",
        "Expected internal SQL spacing to be significant.",
      ),
      ok: false,
    },
    {
      name: "boundary whitespace-only SQL difference remains current",
      failureReasons: assertEqual(
        deriveStatus({ currentContext: { ...baseContext, exactSql: "\n SELECT * FROM orders;  " } }),
        "current",
        "Expected boundary whitespace to be normalized.",
      ),
      ok: false,
    },
    {
      name: "dataset mismatch is stale",
      failureReasons: assertEqual(
        deriveStatus({ currentContext: { ...baseContext, datasetId: "dataset-2" } }),
        "stale",
        "Expected dataset mismatch to be stale.",
      ),
      ok: false,
    },
    {
      name: "worksheet mismatch is stale",
      failureReasons: assertEqual(
        deriveStatus({ currentContext: { ...baseContext, worksheetId: "worksheet-2" } }),
        "stale",
        "Expected worksheet mismatch to be stale.",
      ),
      ok: false,
    },
    {
      name: "null worksheet matches null worksheet",
      failureReasons: assertEqual(
        deriveStatus({
          previewResult: createPreviewResult({
            columns: ["status"],
            rows: [{ status: "Open" }],
            message: "Query returned 1 row.",
            executionIdentity: createSqlExecutionIdentity({
              requestId: "sql-run:display:null-worksheet",
              exactSql: "SELECT * FROM uploaded_dataset;",
              datasetId: "dataset-csv",
              worksheetId: null,
            }),
          }),
          currentContext: {
            exactSql: "SELECT * FROM uploaded_dataset;",
            datasetId: "dataset-csv",
            worksheetId: null,
          },
        }),
        "current",
        "Expected null worksheet context to match.",
      ),
      ok: false,
    },
    {
      name: "matching failed execution is failed",
      failureReasons: assertEqual(
        deriveStatus({
          editorStatus: "error",
          previewResult: createPreviewResult({
            message: "Query failed.",
            errorInsight: {
              title: "Query failed",
              summary: "Binder error.",
              category: "unknown",
              likelyCause: "The SQL could not be executed.",
              confidence: "low",
              suggestions: [],
              howToFix: [],
              rawMessage: "Binder error.",
            },
            executionIdentity: baseIdentity,
          }),
        }),
        "failed",
        "Expected matching error result to be failed.",
      ),
      ok: false,
    },
    {
      name: "failed execution after SQL change is stale",
      failureReasons: assertEqual(
        deriveStatus({
          editorStatus: "error",
          previewResult: createPreviewResult({
            message: "Query failed.",
            errorInsight: {
              title: "Query failed",
              summary: "Binder error.",
              category: "unknown",
              likelyCause: "The SQL could not be executed.",
              confidence: "low",
              suggestions: [],
              howToFix: [],
              rawMessage: "Binder error.",
            },
            executionIdentity: baseIdentity,
          }),
          currentContext: { ...baseContext, exactSql: "SELECT id FROM orders;" },
        }),
        "stale",
        "Expected edited failed result to become stale.",
      ),
      ok: false,
    },
    {
      name: "request ID difference does not affect context matching",
      failureReasons: assertEqual(
        deriveStatus({
          previewResult: createPreviewResult({
            columns: ["status"],
            rows: [{ status: "Open" }],
            message: "Query returned 1 row.",
            executionIdentity: { ...baseIdentity, requestId: "sql-run:display:other" },
          }),
        }),
        "current",
        "Expected request ID to be ignored for context equality.",
      ),
      ok: false,
    },
    {
      name: "input objects are not mutated",
      failureReasons: [
        ...assertEqual(
          deriveStatus({
            previewResult: frozenPreview,
            currentContext: frozenContext,
          }),
          "current",
          "Expected frozen input to derive current.",
        ),
        ...assertEqual(
          JSON.stringify({ frozenPreview, frozenContext }),
          frozenBefore,
          "Expected derivation not to mutate input objects.",
        ),
      ],
      ok: false,
    },
    {
      name: "derivation is deterministic",
      failureReasons: assertEqual(
        deriveStatus(),
        deriveStatus(),
        "Expected repeated derivation to return the same status.",
      ),
      ok: false,
    },
    {
      name: "malformed identity is not treated as current",
      failureReasons: assertEqual(
        deriveStatus({
          editorStatus: "success",
          previewResult: createPreviewResult({
            columns: ["status"],
            rows: [{ status: "Open" }],
            message: "Query returned 1 row.",
            executionIdentity: {
              requestId: "sql-run:display:malformed",
              exactSql: "SELECT * FROM orders;",
              datasetId: "",
              worksheetId: "worksheet-1",
            },
          }),
        }),
        "stale",
        "Expected malformed identity not to fabricate current.",
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
