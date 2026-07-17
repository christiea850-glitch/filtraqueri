/** UX-S2A-3-4 — deterministic trends-readiness fixtures. */

import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import { computeTrendsSummary } from "../computeTrendsSummary";

type Fixture = {
  name: string;
  assert: () => string[];
};

const column = (overrides: Partial<SchemaColumn>): SchemaColumn => ({
  name: "column",
  type: "VARCHAR",
  inferred_type: "text",
  null_count: 0,
  unique_count: 1,
  sample_values: [],
  ...overrides,
});

const dataset = (overrides: Partial<DatasetMetadata>): DatasetMetadata => ({
  dataset_id: "dataset-1",
  filename: "trends.csv",
  original_filename: "trends.csv",
  table_name: "trends",
  uploaded_at: "2026-01-01T00:00:00Z",
  row_count: 10,
  column_count: 3,
  schema: [
    column({ name: "amount", inferred_type: "numeric" }),
    column({ name: "status", inferred_type: "categorical" }),
    column({ name: "notes", inferred_type: "text" }),
  ],
  ...overrides,
});

export const TRENDS_SUMMARY_FIXTURES: Fixture[] = [
  {
    name: "no date columns reports date-field blocker",
    assert: () => {
      const summary = computeTrendsSummary(dataset({}));
      return summary.dateColumnCount === 0 &&
        !summary.readiness.hasDateField &&
        summary.answer.includes("No usable date field")
        ? []
        : ["Expected no-date blocker."];
    },
  },
  {
    name: "date column with valid date_range is usable",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({
          schema: [
            column({
              name: "created_at",
              inferred_type: "date",
              date_range: { min: "2026-01-01", max: "2026-02-01" },
            }),
          ],
        }),
      );
      return summary.dateColumnsWithValidRange === 1 &&
        summary.widestDateRangeColumn?.name === "created_at" &&
        summary.readiness.canPrepareTrend &&
        !summary.readiness.canRenderTrendChart
        ? []
        : ["Expected usable date range without chart readiness."];
    },
  },
  {
    name: "date column without date_range reports unavailable range",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({ schema: [column({ name: "created_at", inferred_type: "date" })] }),
      );
      return summary.dateColumnCount === 1 &&
        summary.dateColumnsWithValidRange === 0 &&
        summary.answer.includes("does not include a usable date range")
        ? []
        : ["Expected missing date range message."];
    },
  },
  {
    name: "multiple date columns choose widest range",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({
          schema: [
            column({
              name: "short_date",
              inferred_type: "date",
              date_range: { min: "2026-01-01", max: "2026-01-10" },
            }),
            column({
              name: "long_date",
              inferred_type: "date",
              date_range: { min: "2025-01-01", max: "2026-01-01" },
            }),
          ],
        }),
      );
      return summary.widestDateRangeColumn?.name === "long_date"
        ? []
        : ["Expected widest range selection."];
    },
  },
  {
    name: "numeric columns count is deterministic",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({
          schema: [
            column({ name: "created_at", inferred_type: "date" }),
            column({ name: "amount", inferred_type: "numeric" }),
            column({ name: "count", inferred_type: "numeric" }),
          ],
        }),
      );
      return summary.numericColumnCount === 2 && summary.readiness.hasNumericFields
        ? []
        : ["Expected numeric column count."];
    },
  },
  {
    name: "missing date values compute completeness",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({
          row_count: 10,
          schema: [
            column({
              name: "created_at",
              inferred_type: "date",
              null_count: 2,
              date_range: { min: "2026-01-01", max: "2026-01-31" },
            }),
          ],
        }),
      );
      return summary.dateColumns[0]?.missingCount === 2 &&
        summary.dateColumns[0]?.completenessPercent === 80
        ? []
        : ["Expected date completeness metadata."];
    },
  },
  {
    name: "row_count zero is safe",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({
          row_count: 0,
          schema: [column({ name: "created_at", inferred_type: "date", null_count: 0 })],
        }),
      );
      return summary.rowsAvailable === 0 &&
        summary.dateColumns[0]?.completenessPercent === 100 &&
        !summary.readiness.canRenderTrendChart
        ? []
        : ["Expected zero-row safety."];
    },
  },
  {
    name: "empty schema reports no detected types",
    assert: () => {
      const summary = computeTrendsSummary(dataset({ column_count: 0, schema: [] }));
      return summary.dateColumnCount === 0 &&
        summary.numericColumnCount === 0 &&
        summary.detectedTypeCounts.text === 0
        ? []
        : ["Expected empty schema handling."];
    },
  },
  {
    name: "workbook metadata does not fabricate time buckets",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({
          workbook_metadata: {
            worksheets: [
              {
                schema: [
                  column({
                    name: "worksheet_date",
                    inferred_type: "date",
                    date_range: { min: "2026-01-01", max: "2026-03-01" },
                  }),
                ],
              },
            ],
          },
        } as unknown as Partial<DatasetMetadata>),
      );
      return summary.dateColumns.every((item) => item.name !== "worksheet_date") &&
        !summary.readiness.canRenderTrendChart
        ? []
        : ["Expected no workbook bucket fabrication."];
    },
  },
  {
    name: "no trend direction or buckets are fabricated",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({
          schema: [
            column({
              name: "created_at",
              inferred_type: "date",
              date_range: { min: "2026-01-01", max: "2026-12-31" },
            }),
          ],
        }),
      );
      const serialized = JSON.stringify(summary).toLowerCase();
      return !serialized.includes("rising") &&
        !serialized.includes("falling") &&
        !serialized.includes("buckets:[") &&
        !serialized.includes("bucketcount") &&
        !serialized.includes("bucket_count") &&
        !summary.readiness.canRenderTrendChart
        ? []
        : ["Expected no fabricated trend direction or buckets."];
    },
  },
  {
    name: "boolean columns are ignored as date and numeric fields",
    assert: () => {
      const summary = computeTrendsSummary(
        dataset({ schema: [column({ name: "is_active", inferred_type: "boolean" })] }),
      );
      return summary.dateColumnCount === 0 &&
        summary.numericColumnCount === 0 &&
        summary.detectedTypeCounts.boolean === 1
        ? []
        : ["Expected boolean to remain non-date and non-numeric."];
    },
  },
];

export function runComputeTrendsSummaryFixtures() {
  const results = TRENDS_SUMMARY_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert();
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
