/** UX-S2A-3-1 — deterministic dataset-summary fixtures. */

import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import { computeDatasetSummary } from "../computeDatasetSummary";

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
  filename: "sample.csv",
  original_filename: "sample.csv",
  table_name: "sample",
  uploaded_at: "2026-01-01T00:00:00Z",
  row_count: 10,
  column_count: 3,
  schema: [
    column({ name: "customer_id", inferred_type: "text", unique_count: 10 }),
    column({ name: "amount", inferred_type: "numeric" }),
    column({ name: "status", inferred_type: "categorical" }),
  ],
  ...overrides,
});

const workbookDataset = dataset({
  original_filename: "operations.xlsx",
  workbook_metadata: {
    activeWorksheetId: "sheet-2",
    worksheets: [
      {
        worksheetId: "sheet-1",
        displayName: "Properties",
        sheetName: "Properties",
        tableName: "properties",
        rowCount: 6,
        columnCount: 4,
      },
      {
        worksheetId: "sheet-2",
        displayName: "Units",
        sheetName: "Units",
        tableName: "units",
        rowCount: 10,
        columnCount: 3,
      },
    ],
  },
} as unknown as Partial<DatasetMetadata>);

export const DATASET_SUMMARY_FIXTURES: Fixture[] = [
  {
    name: "flat CSV summary uses rows, columns, identifiers, and deterministic headline",
    assert: () => {
      const summary = computeDatasetSummary({ dataset: dataset({}) });
      const failures: string[] = [];
      if (summary.totalRows !== 10) failures.push("Expected row count.");
      if (summary.totalColumns !== 3) failures.push("Expected column count.");
      if (summary.totalWorksheets !== 1) failures.push("Expected single worksheet.");
      if (!summary.notableColumns.some((item) => item.kind === "identifier")) {
        failures.push("Expected identifier notable column.");
      }
      if (!summary.headline.includes("sample.csv contains 10 rows")) {
        failures.push("Expected deterministic headline.");
      }
      return failures;
    },
  },
  {
    name: "workbook summary exposes worksheet rows and active worksheet",
    assert: () => {
      const summary = computeDatasetSummary({ dataset: workbookDataset });
      const activeWorksheet = summary.worksheetRows.find((worksheet) => worksheet.isActive);
      return summary.totalWorksheets === 2 &&
        summary.worksheetRows.length === 2 &&
        activeWorksheet?.name === "Units"
        ? []
        : ["Expected workbook worksheet breakdown."];
    },
  },
  {
    name: "complete data reports no missing cells and full completeness",
    assert: () => {
      const summary = computeDatasetSummary({ dataset: dataset({}) });
      return summary.missingCellCount === 0 && summary.completenessPercent === 100
        ? []
        : ["Expected full completeness."];
    },
  },
  {
    name: "mixed null_count reports missing cells and affected columns",
    assert: () => {
      const summary = computeDatasetSummary({
        dataset: dataset({
          schema: [
            column({ name: "id", unique_count: 10 }),
            column({ name: "amount", inferred_type: "numeric", null_count: 2 }),
            column({ name: "status", inferred_type: "categorical", null_count: 3 }),
          ],
        }),
      });
      return summary.missingCellCount === 5 &&
        summary.columnsWithMissing === 2 &&
        summary.completenessPercent === 83.33333333333334
        ? []
        : ["Expected missing-cell metadata."];
    },
  },
  {
    name: "identifier detection requires matching name and row-level uniqueness",
    assert: () => {
      const positive = computeDatasetSummary({
        dataset: dataset({ schema: [column({ name: "account_code", unique_count: 10 })] }),
      });
      const negative = computeDatasetSummary({
        dataset: dataset({ schema: [column({ name: "account_name", unique_count: 10 })] }),
      });
      return positive.typeBreakdown.some((item) => item.kind === "identifier") &&
        !negative.typeBreakdown.some((item) => item.kind === "identifier")
        ? []
        : ["Expected identifier name guard."];
    },
  },
  {
    name: "date range is shown only when explicit date_range metadata exists",
    assert: () => {
      const withDate = computeDatasetSummary({
        dataset: dataset({
          schema: [
            column({
              name: "created_at",
              inferred_type: "date",
              date_range: { min: "2026-01-01", max: "2026-01-31" },
            }),
          ],
        }),
      });
      const withoutDate = computeDatasetSummary({
        dataset: dataset({ schema: [column({ name: "created_at", inferred_type: "date" })] }),
      });
      return withDate.notableColumns.some((item) => item.kind === "date_range") &&
        !withoutDate.notableColumns.some((item) => item.kind === "date_range")
        ? []
        : ["Expected no fabricated date range."];
    },
  },
  {
    name: "top category is shown only when top_values metadata exists",
    assert: () => {
      const withTopValues = computeDatasetSummary({
        dataset: dataset({
          schema: [
            column({
              name: "status",
              inferred_type: "categorical",
              top_values: [{ value: "Active", count: 7 }],
            }),
          ],
        }),
      });
      const withoutTopValues = computeDatasetSummary({
        dataset: dataset({ schema: [column({ name: "status", inferred_type: "categorical" })] }),
      });
      return withTopValues.notableColumns.some((item) => item.kind === "top_category") &&
        !withoutTopValues.notableColumns.some((item) => item.kind === "top_category")
        ? []
        : ["Expected no fabricated top category."];
    },
  },
  {
    name: "boolean columns are grouped as categorical",
    assert: () => {
      const summary = computeDatasetSummary({
        dataset: dataset({ schema: [column({ name: "is_active", inferred_type: "boolean" })] }),
      });
      const categorical = summary.typeBreakdown.find((item) => item.kind === "categorical");
      return categorical?.count === 1 ? [] : ["Expected boolean as categorical."];
    },
  },
  {
    name: "same input produces the same deterministic summary",
    assert: () => {
      const first = computeDatasetSummary({ dataset: workbookDataset });
      const second = computeDatasetSummary({ dataset: workbookDataset });
      return first.deterministicSummary === second.deterministicSummary
        ? []
        : ["Expected deterministic summary."];
    },
  },
];

export function runComputeDatasetSummaryFixtures() {
  const results = DATASET_SUMMARY_FIXTURES.map((fixture) => {
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
