/**
 * T-11D-2 — SQL workspace preview result errorInsight fixtures.
 *
 * These pure fixtures keep the runDraft preview-state builders testable without
 * mounting the React hook or invoking backend execution.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../../execution/workspaceExecutionTypes";
import type { AnalysisScopeSelection } from "../../../workbook";
import type { SqlTabSourceContext } from "../resolveSqlTabSourceContext";
import {
  createSqlErrorPreviewResult,
  createSqlSuccessPreviewResult,
} from "../useSqlWorkspace";

type SqlWorkspacePreviewFixtureResult = {
  name: string;
  ok: boolean;
  category: string | null;
  failureReasons: string[];
};

export type SqlWorkspacePreviewFixtureReport = {
  results: SqlWorkspacePreviewFixtureResult[];
  passed: SqlWorkspacePreviewFixtureResult[];
  failed: SqlWorkspacePreviewFixtureResult[];
};

const schemaColumn = (name: string): SchemaColumn => ({
  name,
  type: "VARCHAR",
  inferred_type: "text",
  null_count: 0,
  unique_count: 1,
  sample_values: [],
});

const dataset: DatasetMetadata = {
  dataset_id: "dataset-1",
  filename: "orders.csv",
  original_filename: "orders.csv",
  table_name: "orders",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 1,
  column_count: 2,
  schema: [schemaColumn("order_id"), schemaColumn("customer_id")],
};

const activeTabSourceContext: SqlTabSourceContext = {
  sourceLabel: "Orders",
  worksheetId: null,
  sourceType: "original",
  tableName: "orders",
  sourceTableName: "orders",
  originalTableName: "orders",
  cleanedTableName: null,
  schema: dataset.schema,
  rowCount: dataset.row_count,
  columnCount: dataset.column_count,
  isExecutableWithCurrentDataset: true,
  mismatchWarning: null,
  globalActiveSourceLabel: "Orders",
  globalActiveTableName: "orders",
};

const noAppliedScopeSelections: AnalysisScopeSelection[] = [];

const successExecutionResult: WorkspaceExecutionResult = {
  source: "sql",
  dataset: {
    datasetId: dataset.dataset_id,
    datasetName: dataset.filename,
    tableName: dataset.table_name,
  },
  inputRows: [],
  filters: [],
  queryBuilder: null,
  sql: {
    sql: "SELECT order_id FROM orders;",
    message: "Query completed.",
  },
  sorting: null,
  grouping: [],
  pagination: {
    page: 1,
    rowsPerPage: 100,
    totalCount: 1,
  },
  status: "success",
  error: null,
  executedAt: "2026-01-01T00:00:00.000Z",
  outputRows: [{ order_id: "A-1" }],
  outputVisibleColumns: ["order_id"],
  activeResult: {
    columns: ["order_id"],
    rows: [{ order_id: "A-1" }],
    totalCount: 1,
    page: 1,
    rowsPerPage: 100,
    sortColumn: "",
    sortDirection: "ASC",
  },
};

const expect = (
  condition: boolean,
  failureReason: string,
  failureReasons: string[],
) => {
  if (!condition) failureReasons.push(failureReason);
};

export function runSqlWorkspacePreviewFixtures(): SqlWorkspacePreviewFixtureReport {
  const fixtures: SqlWorkspacePreviewFixtureResult[] = [];

  const successFailureReasons: string[] = [];
  const successPreview = createSqlSuccessPreviewResult(successExecutionResult);
  expect(successPreview.errorInsight === null, "Expected success preview to clear errorInsight.", successFailureReasons);
  expect(successPreview.message === "Query completed.", "Expected success preview message to preserve execution message.", successFailureReasons);
  fixtures.push({
    name: "Successful SQL preview clears errorInsight",
    ok: successFailureReasons.length === 0,
    category: successPreview.errorInsight?.category || null,
    failureReasons: successFailureReasons,
  });

  const tableFailureReasons: string[] = [];
  const tablePreview = createSqlErrorPreviewResult({
    error: new Error('Query failed: Catalog Error: Table with name orders_2025 does not exist! Did you mean "orders"?'),
    sqlText: "SELECT * FROM orders_2025;",
    selectedDialect: "duckdb",
    dataset,
    activeTabSourceContext,
    appliedScopeSelections: noAppliedScopeSelections,
  });
  expect(tablePreview.errorInsight?.category === "table_not_found", "Expected table error to attach table_not_found insight.", tableFailureReasons);
  expect(tablePreview.message === tablePreview.errorInsight?.title, "Expected error preview message to use insight title.", tableFailureReasons);
  fixtures.push({
    name: "SQL error preview attaches table_not_found insight",
    ok: tableFailureReasons.length === 0,
    category: tablePreview.errorInsight?.category || null,
    failureReasons: tableFailureReasons,
  });

  const columnFailureReasons: string[] = [];
  const columnPreview = createSqlErrorPreviewResult({
    error: new Error('Query failed: Binder Error: Referenced column "custmer_id" not found in FROM clause! Candidate bindings: "customer_id", "order_id"'),
    sqlText: "SELECT custmer_id FROM orders;",
    selectedDialect: "duckdb",
    dataset,
    activeTabSourceContext,
    appliedScopeSelections: noAppliedScopeSelections,
  });
  expect(columnPreview.errorInsight?.category === "column_not_found", "Expected column error to attach column_not_found insight.", columnFailureReasons);
  fixtures.push({
    name: "SQL error preview attaches column_not_found insight",
    ok: columnFailureReasons.length === 0,
    category: columnPreview.errorInsight?.category || null,
    failureReasons: columnFailureReasons,
  });

  return {
    results: fixtures,
    passed: fixtures.filter((result) => result.ok),
    failed: fixtures.filter((result) => !result.ok),
  };
}
