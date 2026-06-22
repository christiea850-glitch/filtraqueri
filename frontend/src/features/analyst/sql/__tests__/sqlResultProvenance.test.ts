/**
 * T-15-4 — focused Result Preview provenance fixtures.
 *
 * Pure presentation fixtures only. No SQL execution, backend/API calls,
 * source resolution, or editor mutation.
 */

import type { ExecutedQuestionSnapshot, SqlPreviewResult } from "../sqlTypes";
import {
  SQL_RESULT_DRIFT_WARNING,
  createSqlResultProvenanceViewModel,
} from "../sqlResultProvenance";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlResultProvenanceFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const baseExecutedQuestion: ExecutedQuestionSnapshot = {
  taskPrompt: "Which customers have the most orders?",
  sqlAtRun: "SELECT customer_id, COUNT(*) AS order_count FROM orders GROUP BY customer_id;",
  ranAt: "2026-02-03T04:05:06.000Z",
  sourceLabel: "Orders worksheet",
  sourceTableName: "orders",
};

const createPreviewResult = (
  executedQuestion?: ExecutedQuestionSnapshot,
): SqlPreviewResult => ({
  columns: ["customer_id", "order_count"],
  rows: [{ customer_id: "C-001", order_count: 2 }],
  message: "Query returned 1 row.",
  ...(executedQuestion ? { executedQuestion } : {}),
});

const assertEqual = (actual: unknown, expected: unknown, message: string) =>
  actual === expected ? [] : [`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`];

export function runSqlResultProvenanceFixtures(): SqlResultProvenanceFixtureReport {
  const fixtures: FixtureResult[] = [
    {
      name: "shows question provenance when taskPrompt exists",
      failureReasons: assertEqual(
        createSqlResultProvenanceViewModel({
          previewResult: createPreviewResult(baseExecutedQuestion),
          currentTaskPrompt: baseExecutedQuestion.taskPrompt,
          currentSqlDraft: baseExecutedQuestion.sqlAtRun,
        }).summaryText,
        "Showing result for: Which customers have the most orders?",
        "Question provenance text mismatch.",
      ),
      ok: false,
    },
    {
      name: "shows SQL-run fallback when taskPrompt is empty",
      failureReasons: assertEqual(
        createSqlResultProvenanceViewModel({
          previewResult: createPreviewResult({ ...baseExecutedQuestion, taskPrompt: "" }),
          currentTaskPrompt: "",
          currentSqlDraft: baseExecutedQuestion.sqlAtRun,
        }).summaryText,
        "Showing result for SQL run on Orders worksheet",
        "SQL-run fallback text mismatch.",
      ),
      ok: false,
    },
    {
      name: "shows previous-run fallback when executedQuestion is undefined",
      failureReasons: assertEqual(
        createSqlResultProvenanceViewModel({
          previewResult: createPreviewResult(),
          currentTaskPrompt: "",
          currentSqlDraft: "SELECT 1;",
        }).summaryText,
        "Showing result from a previous run",
        "Previous-run fallback text mismatch.",
      ),
      ok: false,
    },
    {
      name: "renders source context when sourceLabel exists",
      failureReasons: assertEqual(
        createSqlResultProvenanceViewModel({
          previewResult: createPreviewResult(baseExecutedQuestion),
          currentTaskPrompt: baseExecutedQuestion.taskPrompt,
          currentSqlDraft: baseExecutedQuestion.sqlAtRun,
        }).sourceText,
        "Source: Orders worksheet",
        "Source context text mismatch.",
      ),
      ok: false,
    },
    {
      name: "renders timestamp when ranAt exists",
      failureReasons: assertEqual(
        createSqlResultProvenanceViewModel({
          previewResult: createPreviewResult(baseExecutedQuestion),
          currentTaskPrompt: baseExecutedQuestion.taskPrompt,
          currentSqlDraft: baseExecutedQuestion.sqlAtRun,
        }).ranAtText,
        "Ran: 2026-02-03 04:05 UTC",
        "Timestamp text mismatch.",
      ),
      ok: false,
    },
    {
      name: "warns when current prompt differs from snapshot",
      failureReasons: assertEqual(
        createSqlResultProvenanceViewModel({
          previewResult: createPreviewResult(baseExecutedQuestion),
          currentTaskPrompt: "Show revenue by customer",
          currentSqlDraft: baseExecutedQuestion.sqlAtRun,
        }).driftWarningText,
        SQL_RESULT_DRIFT_WARNING,
        "Prompt drift warning mismatch.",
      ),
      ok: false,
    },
    {
      name: "warns when current SQL draft differs from snapshot",
      failureReasons: assertEqual(
        createSqlResultProvenanceViewModel({
          previewResult: createPreviewResult(baseExecutedQuestion),
          currentTaskPrompt: baseExecutedQuestion.taskPrompt,
          currentSqlDraft: "SELECT * FROM orders;",
        }).driftWarningText,
        SQL_RESULT_DRIFT_WARNING,
        "SQL drift warning mismatch.",
      ),
      ok: false,
    },
    {
      name: "does not warn when prompt and SQL match snapshot",
      failureReasons: assertEqual(
        createSqlResultProvenanceViewModel({
          previewResult: createPreviewResult(baseExecutedQuestion),
          currentTaskPrompt: baseExecutedQuestion.taskPrompt,
          currentSqlDraft: baseExecutedQuestion.sqlAtRun,
        }).driftWarningText,
        null,
        "Unexpected drift warning.",
      ),
      ok: false,
    },
    {
      name: "preserves result rows and columns for existing table rendering",
      failureReasons: [
        ...assertEqual(createPreviewResult(baseExecutedQuestion).columns.length, 2, "Column count changed."),
        ...assertEqual(createPreviewResult(baseExecutedQuestion).rows.length, 1, "Row count changed."),
      ],
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

export const SQL_RESULT_PROVENANCE_FIXTURES_PASS = runSqlResultProvenanceFixtures().failed.length === 0;
