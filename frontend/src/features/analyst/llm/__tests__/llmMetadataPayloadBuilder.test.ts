/**
 * T-24D - Metadata-only LLM payload hardening fixtures.
 *
 * Pure fixture runner only. This does not send provider payloads, create clients,
 * call backend APIs, persist storage, render UI, synthesize shadow rows, tokenize
 * values, generate SQL, insert SQL, or run queries.
 */

import type { DatasetMetadata } from "../../../dataset/datasetTypes";
import {
  assertMetadataOnlyPayloadCategories,
  buildAIMetadataContextPayload,
  containsBlockedPayloadCategory,
  createMetadataOnlyPayloadAuditSummary,
  sanitizeMetadataOnlyColumnProfile,
  stripUnsafeMetadataPayloadFields,
  summarizeMetadataOnlyPayloadSafety,
} from "../llmMetadataPayloadBuilder";

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
export type LlmMetadataPayloadBuilderFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const unsafeDataset = {
  dataset_id: "ds_t24d",
  filename: "unsafe-fixture.csv",
  original_filename: "unsafe-fixture.csv",
  table_name: "unsafe_fixture",
  uploaded_at: "2026-06-23T00:00:00.000Z",
  row_count: 3,
  column_count: 5,
  preview: [{ ssn: "111-22-3333", notes: "Tenant called about payment" }],
  rawRows: [{ email: "alice@example.com", amount: 42 }],
  promptText: "Rank these people by rent risk",
  sqlDraft: "SELECT ssn FROM unsafe_fixture",
  queryResults: [{ ssn: "111-22-3333" }],
  providerResponse: { text: "sensitive response" },
  tokenizationVault: { tok_1: "alice@example.com" },
  apiKey: "sk-not-real",
  schema: [
    {
      name: "ssn",
      type: "VARCHAR",
      inferred_type: "text",
      null_count: 0,
      unique_count: 3,
      sample_values: ["111-22-3333", "222-33-4444"],
      top_values: [{ value: "111-22-3333", count: 1 }],
    },
    {
      name: "customer_email",
      type: "VARCHAR",
      inferred_type: "text",
      null_count: 0,
      unique_count: 3,
      sample_values: ["alice@example.com"],
      top_values: [{ value: "alice@example.com", count: 1 }],
    },
    {
      name: "customer_name",
      type: "VARCHAR",
      inferred_type: "text",
      null_count: 0,
      unique_count: 3,
      sample_values: ["Alice Smith"],
      top_values: [{ value: "Alice Smith", count: 1 }],
    },
    {
      name: "notes",
      type: "VARCHAR",
      inferred_type: "text",
      null_count: 1,
      unique_count: 2,
      sample_values: ["Tenant called about payment"],
      top_values: [{ value: "Tenant called about payment", count: 1 }],
      text_length_stats: { min_length: 5, max_length: 27, avg_length: 16 },
    },
    {
      name: "rent_amount",
      type: "DOUBLE",
      inferred_type: "numeric",
      null_count: 0,
      unique_count: 3,
      sample_values: [1200, 1300, 1400],
      top_values: [{ value: "1200", count: 1 }],
      numeric_stats: { min: 1200, max: 1400, mean: 1300, median: 1300, std: 100 },
    },
  ],
} satisfies DatasetMetadata & Record<string, unknown>;

const payload = buildAIMetadataContextPayload({
  dataset: unsafeDataset,
  selectedDialect: "duckdb",
  generatedAt: "2026-06-23T00:00:00.000Z",
});
const serialized = JSON.stringify(payload);
const safety = summarizeMetadataOnlyPayloadSafety(payload);

const fixture = (name: string, run: () => string[]): { name: string; run: () => string[] } => ({ name, run });
const excludes = (tokens: string[]) => tokens.filter((token) => serialized.includes(token));

const fixtures = [
  fixture("metadata-only payload excludes sample values", () =>
    excludes(["111-22-3333", "222-33-4444", "1200", "1300", "1400"]).map((t) => `Leaked ${t}`),
  ),
  fixture("metadata-only payload excludes top values", () =>
    payload.worksheets.flatMap((w) => w.columns).every((c) => !Object.prototype.hasOwnProperty.call(c.profile, "top_values") && !c.profile.topValuesIncluded)
      ? []
      : ["Expected top values to be excluded."],
  ),
  fixture("metadata-only payload excludes raw rows and preview rows", () =>
    excludes(["rawRows", "preview", "Tenant called about payment"]).map((t) => `Leaked ${t}`),
  ),
  fixture("metadata-only payload excludes prompt text", () =>
    excludes(["Rank these people", "promptText"]).map((t) => `Leaked ${t}`),
  ),
  fixture("metadata-only payload excludes SQL drafts", () =>
    excludes(["SELECT ssn", "sqlDraft"]).map((t) => `Leaked ${t}`),
  ),
  fixture("metadata-only payload excludes query results", () =>
    excludes(["queryResults"]).map((t) => `Leaked ${t}`),
  ),
  fixture("metadata-only payload excludes provider responses", () =>
    excludes(["providerResponse", "sensitive response"]).map((t) => `Leaked ${t}`),
  ),
  fixture("restricted columns are represented only as sensitivity metadata", () => {
    const ssn = payload.worksheets[0]?.columns.find((column) => column.name === "ssn");
    return ssn?.sensitivity.level === "restricted" && ssn.sensitivity.neverSendRawValues && excludes(["111-22-3333"]).length === 0
      ? []
      : ["Expected restricted column to expose sensitivity metadata only."];
  }),
  fixture("direct personal identifier columns are represented only as sensitivity metadata", () => {
    const name = payload.worksheets[0]?.columns.find((column) => column.name === "customer_name");
    return name?.sensitivity.category === "direct_personal_identifier" && excludes(["Alice Smith"]).length === 0
      ? []
      : ["Expected direct identifier column to expose sensitivity metadata only."];
  }),
  fixture("safe business metric columns expose metadata but not raw values", () => {
    const metric = payload.worksheets[0]?.columns.find((column) => column.name === "rent_amount");
    return metric?.name === "rent_amount" && metric.type === "DOUBLE" && metric.missing.nullCount === 0 && !metric.profile.rawValuesIncluded
      ? []
      : ["Expected safe metric metadata without raw values." ];
  }),
  fixture("payload category summary reports blocked value categories as excluded", () =>
    safety.excludedCategories.includes("raw_rows") &&
    safety.excludedCategories.includes("sample_values") &&
    safety.excludedCategories.includes("top_values") &&
    !containsBlockedPayloadCategory(safety)
      ? []
      : ["Expected blocked categories to be excluded."],
  ),
  fixture("helpers remain pure and do not expose side-effect capability", () => {
    const helperOutput = JSON.stringify({
      stripped: stripUnsafeMetadataPayloadFields({ rows: [{ secret: "x" }], keep: { name: "metadata" } }),
      profile: sanitizeMetadataOnlyColumnProfile({ uniqueCount: 2, topValues: ["x"], sampleValues: ["y"] }),
      audit: createMetadataOnlyPayloadAuditSummary(payload),
    });
    const forbidden = ["fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "runQuery", "insertSql", "SELECT "];
    return forbidden.some((token) => helperOutput.includes(token)) ? ["Expected pure helpers without side effects."] : [];
  }),
  fixture("existing metadata-only payload consumers remain compatible", () =>
    payload.schemaVersion === 1 &&
    payload.provenance.mode === "metadata_only" &&
    payload.dataset?.trustedActiveTableName === "unsafe_fixture" &&
    assertMetadataOnlyPayloadCategories(payload)
      ? []
      : ["Expected existing metadata payload shape to remain available."],
  ),
];

export function runLlmMetadataPayloadBuilderFixtures(): LlmMetadataPayloadBuilderFixtureReport {
  const results = fixtures.map((item) => {
    const failureReasons = item.run();
    return { name: item.name, ok: failureReasons.length === 0, failureReasons };
  });
  return { results, passed: results.filter((result) => result.ok), failed: results.filter((result) => !result.ok) };
}
