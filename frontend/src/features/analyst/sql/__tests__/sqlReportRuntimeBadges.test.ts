/**
 * T-12F — report runtime/dialect badge fixtures.
 *
 * These pure fixtures verify that report recipes and opportunities describe
 * uploaded-dataset execution truthfully. The cases intentionally use generic
 * table/column names so badge derivation stays dataset-agnostic.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import { createReportOpportunities } from "../reportIntelligencePlanner";
import {
  createSqlReportRecipes,
  deriveSqlReportRuntimeBadge,
} from "../sqlReportRecipes";

type ReportRuntimeBadgeFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type ReportRuntimeBadgeFixtureReport = {
  results: ReportRuntimeBadgeFixtureResult[];
  passed: ReportRuntimeBadgeFixtureResult[];
  failed: ReportRuntimeBadgeFixtureResult[];
};

const expect = (
  condition: boolean,
  failureReason: string,
  failureReasons: string[],
) => {
  if (!condition) failureReasons.push(failureReason);
};

const schemaColumn = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"],
): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "DOUBLE" : "VARCHAR",
  inferred_type,
  null_count: 0,
  unique_count: 4,
  sample_values: inferred_type === "numeric" ? [10, 20] : ["alpha", "beta"],
});

const datasetFixture = (tableName: string, columns: SchemaColumn[]): DatasetMetadata => ({
  dataset_id: `dataset:${tableName}`,
  filename: `${tableName}.csv`,
  original_filename: `${tableName}.csv`,
  table_name: tableName,
  uploaded_at: "2026-06-12T00:00:00.000Z",
  row_count: 25,
  column_count: columns.length,
  schema: columns,
});

const runFixture = (
  name: string,
  fixture: (failureReasons: string[]) => void,
): ReportRuntimeBadgeFixtureResult => {
  const failureReasons: string[] = [];
  fixture(failureReasons);
  return {
    name,
    ok: failureReasons.length === 0,
    failureReasons,
  };
};

export function runSqlReportRuntimeBadgeFixtures(): ReportRuntimeBadgeFixtureReport {
  const genericDataset = datasetFixture("generic_upload", [
    schemaColumn("category_value", "categorical"),
    schemaColumn("metric_value", "numeric"),
    schemaColumn("event_date", "date"),
  ]);
  const alternateDataset = datasetFixture("alternate_upload", [
    schemaColumn("region_name", "categorical"),
    schemaColumn("score_total", "numeric"),
    schemaColumn("observed_on", "date"),
  ]);

  const results = [
    runFixture("DuckDB-compatible report SQL is labeled as DuckDB-runnable", (failureReasons) => {
      expect(
        deriveSqlReportRuntimeBadge({
          sql: "SELECT category_value FROM generic_upload LIMIT 10;",
          dialects: ["duckdb"],
          selectedDialect: "duckdb",
        }) === "Runs in DuckDB",
        "Expected DuckDB LIMIT report SQL to be labeled Runs in DuckDB.",
        failureReasons,
      );
    }),
    runFixture("Oracle FETCH FIRST report SQL is marked as an example needing conversion", (failureReasons) => {
      expect(
        deriveSqlReportRuntimeBadge({
          sql: "SELECT category_value FROM generic_upload FETCH FIRST 10 ROWS ONLY;",
          dialects: ["oracle"],
          selectedDialect: "oracle",
        }) === "Oracle example · may need conversion",
        "Expected Oracle FETCH FIRST report SQL to require conversion.",
        failureReasons,
      );
    }),
    runFixture("Common SQL report SQL is labeled for review before running", (failureReasons) => {
      expect(
        deriveSqlReportRuntimeBadge({
          sql: "SELECT COUNT(*) AS record_count FROM generic_upload;",
          selectedDialect: "duckdb",
        }) === "Common SQL · review before running",
        "Expected common report SQL to be labeled for review before running.",
        failureReasons,
      );
    }),
    runFixture("Selected dialect display name is not used alone as a runtime badge", (failureReasons) => {
      const badge = deriveSqlReportRuntimeBadge({
        sql: "SELECT category_value FROM generic_upload FETCH FIRST 5 ROWS ONLY;",
        dialects: ["oracle"],
        selectedDialect: "oracle",
      });

      expect(badge !== "Oracle SQL", "Expected badge not to be the selected Oracle display name alone.", failureReasons);
      expect(badge !== "MariaDB", "Expected badge not to be the selected MariaDB display name alone.", failureReasons);
    }),
    runFixture("Report badge derivation is dataset-agnostic", (failureReasons) => {
      const firstRecipe = createSqlReportRecipes(genericDataset, "duckdb").find(
        (recipe) => recipe.id === "top-performers",
      );
      const secondRecipe = createSqlReportRecipes(alternateDataset, "duckdb").find(
        (recipe) => recipe.id === "top-performers",
      );
      const firstOpportunity = createReportOpportunities(genericDataset, "duckdb").find(
        (opportunity) => opportunity.id.startsWith("top-categories-by-amount"),
      );
      const secondOpportunity = createReportOpportunities(alternateDataset, "duckdb").find(
        (opportunity) => opportunity.id.startsWith("top-categories-by-amount"),
      );

      expect(Boolean(firstRecipe && secondRecipe), "Expected comparable report recipes for both datasets.", failureReasons);
      expect(Boolean(firstOpportunity && secondOpportunity), "Expected comparable report opportunities for both datasets.", failureReasons);
      expect(
        deriveSqlReportRuntimeBadge({ sql: firstRecipe?.sql || null, dialects: firstRecipe?.dialects, selectedDialect: "duckdb" }) ===
          deriveSqlReportRuntimeBadge({ sql: secondRecipe?.sql || null, dialects: secondRecipe?.dialects, selectedDialect: "duckdb" }),
        "Expected recipe badges to be independent of table and column names.",
        failureReasons,
      );
      expect(
        deriveSqlReportRuntimeBadge({ sql: firstOpportunity?.sql || null, dialects: firstOpportunity?.dialects, selectedDialect: "duckdb" }) ===
          deriveSqlReportRuntimeBadge({ sql: secondOpportunity?.sql || null, dialects: secondOpportunity?.dialects, selectedDialect: "duckdb" }),
        "Expected opportunity badges to be independent of table and column names.",
        failureReasons,
      );
    }),
  ];

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
