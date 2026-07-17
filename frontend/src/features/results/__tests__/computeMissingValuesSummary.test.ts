/** UX-S2A-3-2 — deterministic missing-values fixtures. */

import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import { computeMissingValuesSummary } from "../computeMissingValuesSummary";

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
  filename: "quality.csv",
  original_filename: "quality.csv",
  table_name: "quality",
  uploaded_at: "2026-01-01T00:00:00Z",
  row_count: 10,
  column_count: 4,
  schema: [
    column({ name: "id", unique_count: 10 }),
    column({ name: "status", inferred_type: "categorical" }),
    column({ name: "amount", inferred_type: "numeric" }),
    column({ name: "created_at", inferred_type: "date" }),
  ],
  ...overrides,
});

const worksheet = (
  id: string,
  name: string,
  rowCount: number,
  schema: SchemaColumn[],
) => ({
  worksheetId: id,
  workbookId: "workbook-1",
  sheetName: name,
  displayName: name,
  tableName: name.toLowerCase(),
  originalIndex: 0,
  status: "ready",
  schema,
  rowCount,
  columnCount: schema.length,
  visibleColumns: schema.map((item) => item.name),
  hiddenColumns: [],
  normalization: {},
});

export const MISSING_VALUES_SUMMARY_FIXTURES: Fixture[] = [
  {
    name: "no missing values reports complete profile",
    assert: () => {
      const summary = computeMissingValuesSummary(dataset({}));
      return summary.totalMissingCells === 0 &&
        summary.percentComplete === 100 &&
        summary.columnsWithMissing.length === 0 &&
        summary.completeColumns.length === 4
        ? []
        : ["Expected complete profile."];
    },
  },
  {
    name: "mixed missing values computes totals and affected columns",
    assert: () => {
      const summary = computeMissingValuesSummary(
        dataset({
          schema: [
            column({ name: "id" }),
            column({ name: "status", inferred_type: "categorical", null_count: 3 }),
            column({ name: "amount", inferred_type: "numeric", null_count: 1 }),
            column({ name: "created_at", inferred_type: "date" }),
          ],
        }),
      );
      return summary.totalCells === 40 &&
        summary.totalMissingCells === 4 &&
        summary.percentComplete === 90 &&
        summary.columnsWithMissing.length === 2
        ? []
        : ["Expected mixed missing-values metadata."];
    },
  },
  {
    name: "all missing values computes zero completeness",
    assert: () => {
      const summary = computeMissingValuesSummary(
        dataset({
          row_count: 5,
          column_count: 2,
          schema: [
            column({ name: "a", null_count: 5 }),
            column({ name: "b", null_count: 5 }),
          ],
        }),
      );
      return summary.totalMissingCells === 10 && summary.percentComplete === 0
        ? []
        : ["Expected all-missing profile."];
    },
  },
  {
    name: "row_count zero avoids division by zero and treats profile as complete",
    assert: () => {
      const summary = computeMissingValuesSummary(dataset({ row_count: 0 }));
      return summary.totalCells === 0 && summary.percentComplete === 100
        ? []
        : ["Expected safe zero-row handling."];
    },
  },
  {
    name: "column_count zero avoids division by zero and treats profile as complete",
    assert: () => {
      const summary = computeMissingValuesSummary(dataset({ column_count: 0, schema: [] }));
      return summary.totalCells === 0 &&
        summary.percentMissing === 0 &&
        summary.percentComplete === 100
        ? []
        : ["Expected safe zero-column handling."];
    },
  },
  {
    name: "empty schema returns no columns",
    assert: () => {
      const summary = computeMissingValuesSummary(dataset({ column_count: 0, schema: [] }));
      return summary.columns.length === 0 &&
        summary.columnsWithMissing.length === 0 &&
        summary.completeColumns.length === 0
        ? []
        : ["Expected empty schema handling."];
    },
  },
  {
    name: "flat CSV hides worksheet summaries",
    assert: () => {
      const summary = computeMissingValuesSummary(dataset({}));
      return summary.worksheetSummaries.length === 0
        ? []
        : ["Expected no worksheet summaries for flat CSV."];
    },
  },
  {
    name: "multi-worksheet workbook computes worksheet stats",
    assert: () => {
      const summary = computeMissingValuesSummary(
        dataset({
          original_filename: "quality.xlsx",
          workbook_metadata: {
            worksheets: [
              worksheet("sheet-1", "Clean", 10, [column({ name: "id" })]),
              worksheet("sheet-2", "Gaps", 10, [
                column({ name: "status", null_count: 4 }),
                column({ name: "amount", inferred_type: "numeric", null_count: 1 }),
              ]),
            ],
          },
        } as unknown as Partial<DatasetMetadata>),
      );
      return summary.worksheetSummaries.length === 2 &&
        summary.worksheetSummaries[0].name === "Gaps" &&
        summary.worksheetSummaries[0].missingCells === 5
        ? []
        : ["Expected workbook worksheet quality metadata."];
    },
  },
  {
    name: "boolean columns map to categorical visual group",
    assert: () => {
      const summary = computeMissingValuesSummary(
        dataset({ schema: [column({ name: "is_active", inferred_type: "boolean" })] }),
      );
      return summary.columns[0]?.visualType === "categorical"
        ? []
        : ["Expected boolean visual grouping."];
    },
  },
  {
    name: "columns sort worst-first with stable tie-break",
    assert: () => {
      const summary = computeMissingValuesSummary(
        dataset({
          schema: [
            column({ name: "first", null_count: 2 }),
            column({ name: "worst", null_count: 4 }),
            column({ name: "second", null_count: 2 }),
          ],
        }),
      );
      const order = summary.columns.map((item) => item.name).join(",");
      return order === "worst,first,second" ? [] : [`Unexpected order: ${order}`];
    },
  },
];

export function runComputeMissingValuesSummaryFixtures() {
  const results = MISSING_VALUES_SUMMARY_FIXTURES.map((fixture) => {
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
