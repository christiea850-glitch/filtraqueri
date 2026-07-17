/** UX-S2A-3-3 — deterministic top-categories fixtures. */

import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import { computeTopCategoriesSummary } from "../computeTopCategoriesSummary";

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
  filename: "categories.csv",
  original_filename: "categories.csv",
  table_name: "categories",
  uploaded_at: "2026-01-01T00:00:00Z",
  row_count: 10,
  column_count: 3,
  schema: [
    column({ name: "amount", inferred_type: "numeric" }),
    column({ name: "created_at", inferred_type: "date" }),
    column({ name: "description", inferred_type: "text" }),
  ],
  ...overrides,
});

export const TOP_CATEGORIES_SUMMARY_FIXTURES: Fixture[] = [
  {
    name: "no categorical columns returns no-categorical empty reason",
    assert: () => {
      const summary = computeTopCategoriesSummary(dataset({}));
      return summary.emptyReason === "no_categorical_fields" &&
        summary.categoryColumnCount === 0 &&
        summary.categoryColumns.length === 0
        ? []
        : ["Expected no categorical fields."];
    },
  },
  {
    name: "categorical columns with top_values produce distribution metadata",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          schema: [
            column({
              name: "status",
              inferred_type: "categorical",
              unique_count: 3,
              top_values: [
                { value: "Active", count: 6 },
                { value: "Pending", count: 3 },
              ],
            }),
          ],
        }),
      );
      return summary.usableCategoryColumnCount === 1 &&
        summary.strongestCategory?.value === "Active" &&
        summary.strongestCategory.percent === 60
        ? []
        : ["Expected top category metadata."];
    },
  },
  {
    name: "categorical column without top_values reports unavailable counts",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          schema: [column({ name: "status", inferred_type: "categorical", unique_count: 3 })],
        }),
      );
      return summary.emptyReason === "top_values_unavailable" &&
        summary.columnsWithoutTopValuesCount === 1
        ? []
        : ["Expected top-values unavailable reason."];
    },
  },
  {
    name: "boolean columns are treated as categorical",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          schema: [
            column({
              name: "is_active",
              inferred_type: "boolean",
              unique_count: 2,
              top_values: [{ value: "true", count: 7 }],
            }),
          ],
        }),
      );
      return summary.categoryColumnCount === 1 &&
        summary.categoryColumns[0]?.inferredType === "boolean"
        ? []
        : ["Expected boolean as categorical."];
    },
  },
  {
    name: "identifier-like names are excluded",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          schema: [
            column({
              name: "account_code",
              inferred_type: "categorical",
              unique_count: 4,
              top_values: [{ value: "A-1", count: 2 }],
            }),
          ],
        }),
      );
      return summary.excludedIdentifierCount === 1 &&
        summary.categoryColumns.length === 0 &&
        summary.emptyReason === "only_identifiers"
        ? []
        : ["Expected identifier-like categorical field exclusion."];
    },
  },
  {
    name: "unique_count equal to row_count is excluded",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          schema: [
            column({
              name: "reference",
              inferred_type: "categorical",
              unique_count: 10,
              top_values: [{ value: "R-1", count: 1 }],
            }),
          ],
        }),
      );
      return summary.excludedIdentifierCount === 1 && summary.emptyReason === "only_identifiers"
        ? []
        : ["Expected unique categorical field exclusion."];
    },
  },
  {
    name: "percentages are computed from row_count",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          row_count: 20,
          schema: [
            column({
              name: "status",
              inferred_type: "categorical",
              unique_count: 2,
              top_values: [{ value: "Active", count: 5 }],
            }),
          ],
        }),
      );
      return summary.categoryColumns[0]?.topValues[0]?.percent === 25
        ? []
        : ["Expected percentage from row count."];
    },
  },
  {
    name: "row_count zero avoids division by zero",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          row_count: 0,
          schema: [
            column({
              name: "status",
              inferred_type: "categorical",
              unique_count: 0,
              top_values: [{ value: "Active", count: 0 }],
            }),
          ],
        }),
      );
      return summary.emptyReason === "row_count_zero" &&
        summary.categoryColumns[0]?.topValues[0]?.percent === 0
        ? []
        : ["Expected safe zero-row handling."];
    },
  },
  {
    name: "columns sort strongest first with stable tie-break",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          schema: [
            column({
              name: "second",
              inferred_type: "categorical",
              unique_count: 3,
              top_values: [{ value: "B", count: 5 }],
            }),
            column({
              name: "strongest",
              inferred_type: "categorical",
              unique_count: 4,
              top_values: [{ value: "A", count: 7 }],
            }),
            column({
              name: "third",
              inferred_type: "categorical",
              unique_count: 3,
              top_values: [{ value: "C", count: 5 }],
            }),
          ],
        }),
      );
      const order = summary.categoryColumns.map((item) => item.name).join(",");
      return order === "strongest,second,third" ? [] : [`Unexpected order: ${order}`];
    },
  },
  {
    name: "top values are limited to five",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          schema: [
            column({
              name: "status",
              inferred_type: "categorical",
              unique_count: 7,
              top_values: [
                { value: "A", count: 2 },
                { value: "B", count: 2 },
                { value: "C", count: 2 },
                { value: "D", count: 1 },
                { value: "E", count: 1 },
                { value: "F", count: 1 },
              ],
            }),
          ],
        }),
      );
      return summary.categoryColumns[0]?.topValues.length === 5
        ? []
        : ["Expected top 5 limit."];
    },
  },
  {
    name: "safe other count is included",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          row_count: 10,
          schema: [
            column({
              name: "status",
              inferred_type: "categorical",
              unique_count: 4,
              top_values: [
                { value: "A", count: 4 },
                { value: "B", count: 3 },
              ],
            }),
          ],
        }),
      );
      return summary.categoryColumns[0]?.other?.count === 3
        ? []
        : ["Expected safe other count."];
    },
  },
  {
    name: "unsafe negative other count is hidden",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          row_count: 5,
          schema: [
            column({
              name: "status",
              inferred_type: "categorical",
              unique_count: 3,
              top_values: [
                { value: "A", count: 4 },
                { value: "B", count: 4 },
              ],
            }),
          ],
        }),
      );
      return summary.categoryColumns[0]?.other === null
        ? []
        : ["Expected unsafe other count to be hidden."];
    },
  },
  {
    name: "workbook metadata does not fabricate worksheet category stats",
    assert: () => {
      const summary = computeTopCategoriesSummary(
        dataset({
          workbook_metadata: {
            worksheets: [
              {
                schema: [
                  column({
                    name: "worksheet_status",
                    inferred_type: "categorical",
                    unique_count: 2,
                    top_values: [{ value: "Open", count: 4 }],
                  }),
                ],
              },
            ],
          },
        } as unknown as Partial<DatasetMetadata>),
      );
      return summary.categoryColumns.every((columnSummary) => columnSummary.name !== "worksheet_status")
        ? []
        : ["Expected no fabricated worksheet category stats."];
    },
  },
];

export function runComputeTopCategoriesSummaryFixtures() {
  const results = TOP_CATEGORIES_SUMMARY_FIXTURES.map((fixture) => {
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
