/**
 * T-12D — SQL template runtime/dialect badge fixtures.
 *
 * These pure fixtures verify that template badges describe DuckDB runtime
 * truthfully while preserving dialect-style metadata. The checks do not depend
 * on any dataset-specific table or column names.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import {
  createSqlAssistantTemplates,
  deriveSqlTemplateRuntimeBadge,
} from "../sqlTemplateLibrary";

type TemplateRuntimeBadgeFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type TemplateRuntimeBadgeFixtureReport = {
  results: TemplateRuntimeBadgeFixtureResult[];
  passed: TemplateRuntimeBadgeFixtureResult[];
  failed: TemplateRuntimeBadgeFixtureResult[];
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
  unique_count: 3,
  sample_values: inferred_type === "numeric" ? [1, 2] : ["alpha", "beta"],
});

const datasetFixture = (tableName: string, columns: string[]): DatasetMetadata => ({
  dataset_id: `dataset:${tableName}`,
  filename: `${tableName}.csv`,
  original_filename: `${tableName}.csv`,
  table_name: tableName,
  uploaded_at: "2026-06-12T00:00:00.000Z",
  row_count: 10,
  column_count: columns.length,
  schema: columns.map((column, index) =>
    schemaColumn(column, index === 1 ? "numeric" : "categorical"),
  ),
});

const runFixture = (
  name: string,
  fixture: (failureReasons: string[]) => void,
): TemplateRuntimeBadgeFixtureResult => {
  const failureReasons: string[] = [];
  fixture(failureReasons);
  return {
    name,
    ok: failureReasons.length === 0,
    failureReasons,
  };
};

export function runSqlTemplateRuntimeBadgeFixtures(): TemplateRuntimeBadgeFixtureReport {
  const dataset = datasetFixture("generic_dataset", ["category_value", "metric_value"]);
  const alternateDataset = datasetFixture("alternate_upload", ["region_name", "score_total"]);
  const templates = createSqlAssistantTemplates(dataset, "duckdb");
  const alternateTemplates = createSqlAssistantTemplates(alternateDataset, "duckdb");

  const results = [
    runFixture("DuckDB LIMIT templates are labeled as DuckDB-runnable", (failureReasons) => {
      const previewTemplate = templates.find((template) => template.id === "preview-select");

      expect(Boolean(previewTemplate), "Expected preview template to exist.", failureReasons);
      expect(
        previewTemplate?.dialectLabel === "Runs in DuckDB" ||
          previewTemplate?.dialectLabel === "DuckDB/MariaDB style",
        `Expected DuckDB-compatible LIMIT label, got ${previewTemplate?.dialectLabel}.`,
        failureReasons,
      );
    }),
    runFixture("Oracle FETCH FIRST templates are marked as examples needing conversion", (failureReasons) => {
      const oracleTemplate = templates.find((template) => template.id === "oracle-fetch");

      expect(Boolean(oracleTemplate), "Expected Oracle FETCH FIRST template to exist.", failureReasons);
      expect(
        oracleTemplate?.dialectLabel === "Oracle example · may need conversion",
        `Expected Oracle conversion badge, got ${oracleTemplate?.dialectLabel}.`,
        failureReasons,
      );
    }),
    runFixture("Common SQL templates are labeled for review before running", (failureReasons) => {
      const countRowsTemplate = templates.find((template) => template.id === "count-rows");

      expect(Boolean(countRowsTemplate), "Expected count rows template to exist.", failureReasons);
      expect(
        countRowsTemplate?.dialectLabel === "Common SQL · review before running",
        `Expected common SQL review badge, got ${countRowsTemplate?.dialectLabel}.`,
        failureReasons,
      );
    }),
    runFixture("Badge derivation is independent of dataset-specific names", (failureReasons) => {
      const templateIds = ["preview-select", "count-rows", "oracle-fetch"];

      for (const templateId of templateIds) {
        const first = templates.find((template) => template.id === templateId);
        const second = alternateTemplates.find((template) => template.id === templateId);
        expect(Boolean(first && second), `Expected ${templateId} in both template sets.`, failureReasons);
        expect(
          first?.dialectLabel === second?.dialectLabel,
          `Expected ${templateId} badge to be dataset-independent, got ${first?.dialectLabel} and ${second?.dialectLabel}.`,
          failureReasons,
        );
      }
    }),
    runFixture("Standalone badge derivation uses syntax and dialect metadata only", (failureReasons) => {
      expect(
        deriveSqlTemplateRuntimeBadge({
          dialectLabel: "Oracle",
          dialects: ["oracle"],
          sql: "SELECT * FROM uploaded_dataset FETCH FIRST 5 ROWS ONLY;",
        }) === "Oracle example · may need conversion",
        "Expected FETCH FIRST syntax to require DuckDB conversion.",
        failureReasons,
      );
      expect(
        deriveSqlTemplateRuntimeBadge({
          dialectLabel: "Common",
          sql: "SELECT COUNT(*) AS row_count FROM uploaded_dataset;",
        }) === "Common SQL · review before running",
        "Expected common SQL without dialect metadata to require review.",
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
