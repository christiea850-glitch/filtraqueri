/**
 * T-15-4 — focused Result Preview provenance fixtures.
 *
 * Pure presentation fixtures only. No SQL execution, backend/API calls,
 * source resolution, or editor mutation.
 */

import type { ExecutedQuestionSnapshot, SqlPreviewResult } from "../sqlTypes";
import {
  SQL_RESULT_DRIFT_WARNING,
  createCanonicalSqlResultProvenanceV2,
  createLegacyUnverifiableSqlResultProvenanceV2,
  createManualSqlResultProvenanceV2,
  createSqlResultProvenanceViewModel,
  evaluateSqlResultStalenessV2,
  validateSqlResultProvenanceV2,
} from "../sqlResultProvenance";
import {
  createCanonicalSqlExecutionIdentityV2,
  createManualSqlExecutionIdentityV2,
} from "../sqlExecutionIdentity";

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
  const canonicalIdentity = createCanonicalSqlExecutionIdentityV2({
    exactSql: "SELECT unit_id FROM units;",
    dialect: "duckdb",
    executionTargetId: "target:local-duckdb",
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    appliedSourceManifestFingerprint: "manifest:v2:1",
    sourceRevisionIds: ["source-revision:1"],
    structuralSchemaFingerprints: ["schema:1"],
    validationAssessmentIds: ["assessment:1"],
    acceptanceRecordIds: ["acceptance:1"],
    planId: "plan:1",
    planRevisionId: "plan-revision:1",
    rendererId: "renderer:duckdb",
    rendererVersion: "renderer-version:1",
    executionPolicyId: "policy:limited-preview",
  });
  const canonicalProvenance = createCanonicalSqlResultProvenanceV2({
    executionIdentity: canonicalIdentity,
    runCorrelation: { requestId: "request:1", runId: "run:1", tabId: "tab:1" },
  });
  const matchingCanonicalContext = {
    sourceMode: "original_only" as const,
    executionIdentity: canonicalIdentity,
    exactSqlFingerprint: canonicalIdentity.exactSqlFingerprint,
    datasetId: canonicalIdentity.datasetId,
    workbookId: canonicalIdentity.workbookId,
    appliedSourceManifestFingerprint: canonicalIdentity.appliedSourceManifestFingerprint,
    sourceRevisionIds: canonicalIdentity.sourceRevisionIds,
    structuralSchemaFingerprints: canonicalIdentity.structuralSchemaFingerprints,
    validationAssessmentIds: canonicalIdentity.validationAssessmentIds,
    acceptanceRecordIds: canonicalIdentity.acceptanceRecordIds,
    planRevisionId: canonicalIdentity.planRevisionId,
    rendererId: canonicalIdentity.rendererId,
    rendererVersion: canonicalIdentity.rendererVersion,
    dialect: canonicalIdentity.dialect,
    executionTargetId: canonicalIdentity.executionTargetId,
    executionPolicyId: canonicalIdentity.executionPolicyId,
  };
  const manualIdentity = createManualSqlExecutionIdentityV2({
    exactSql: "SELECT unit_id FROM units;",
    dialect: "duckdb",
    executionTargetId: "target:local-duckdb",
    datasetId: "dataset:property",
    workbookId: "workbook:property",
    worksheetId: "worksheet:units",
    tableName: "units",
    executionPolicyId: "policy:limited-preview",
  });
  const manualProvenance = createManualSqlResultProvenanceV2({
    executionIdentity: manualIdentity,
    runCorrelation: { requestId: "request:manual" },
  });
  const matchingManualContext = {
    sourceMode: "original_only" as const,
    executionIdentity: manualIdentity,
    exactSqlFingerprint: manualIdentity.exactSqlFingerprint,
    datasetId: manualIdentity.datasetId,
    workbookId: manualIdentity.workbookId,
    worksheetId: manualIdentity.worksheetId,
    tableName: manualIdentity.tableName,
    dialect: manualIdentity.dialect,
    executionTargetId: manualIdentity.executionTargetId,
    executionPolicyId: manualIdentity.executionPolicyId,
  };

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
    {
      name: "v2 canonical provenance is immutable and source-aware",
      failureReasons: [
        ...assertEqual(canonicalProvenance.mode, "canonical_generated", "Expected canonical provenance mode."),
        ...assertEqual(
          Object.isFrozen(canonicalProvenance),
          true,
          "Expected immutable completed provenance shell.",
        ),
        ...assertEqual(
          canonicalProvenance.appliedSourceManifestFingerprint,
          "manifest:v2:1",
          "Expected manifest authority.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 manual provenance is honest and omits canonical authority",
      failureReasons: [
        ...assertEqual(manualProvenance.mode, "manual", "Expected manual provenance mode."),
        ...assertEqual(
          "appliedSourceManifestFingerprint" in manualProvenance,
          false,
          "Manual provenance must not claim manifest authority.",
        ),
        ...assertEqual(
          "planId" in manualProvenance,
          false,
          "Manual provenance must not claim plan authority.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 legacy provenance remains visible but unverifiable",
      failureReasons: assertEqual(
        evaluateSqlResultStalenessV2({
          provenance: createLegacyUnverifiableSqlResultProvenanceV2(),
          currentContext: matchingCanonicalContext,
        }).status,
        "legacy_unverifiable",
        "Expected legacy unverifiable status.",
      ),
      ok: false,
    },
    {
      name: "v2 unsupported provenance fails closed",
      failureReasons: assertEqual(
        validateSqlResultProvenanceV2({ ...canonicalProvenance, version: "sql-result-provenance:v999" }).status,
        "invalid",
        "Expected unsupported provenance rejection.",
      ),
      ok: false,
    },
    {
      name: "v2 current canonical comparison succeeds",
      failureReasons: assertEqual(
        evaluateSqlResultStalenessV2({
          provenance: canonicalProvenance,
          currentContext: matchingCanonicalContext,
        }).status,
        "current",
        "Expected matching canonical context to be current.",
      ),
      ok: false,
    },
    {
      name: "v2 canonical staleness exercises every authority reason",
      failureReasons: assertEqual(
        evaluateSqlResultStalenessV2({
          provenance: canonicalProvenance,
          currentContext: {
            ...matchingCanonicalContext,
            datasetId: "dataset:replacement",
            workbookId: "workbook:replacement",
            sourceRevisionIds: ["source-revision:2"],
            structuralSchemaFingerprints: ["schema:2"],
            validationAssessmentIds: ["assessment:2"],
            invalidValidationAssessmentIds: ["assessment:2"],
            acceptanceRecordIds: ["acceptance:2"],
            appliedSourceManifestFingerprint: "manifest:v2:2",
            planRevisionId: "plan-revision:2",
            rendererId: "renderer:other",
            dialect: "postgres",
            executionTargetId: "target:remote",
            exactSqlFingerprint: "sql-exact-text:changed",
            executionPolicyId: "policy:full",
          },
        }).reasonCodes.join(","),
        "dataset_replaced,workbook_replaced,source_revision_changed,structural_schema_changed,relationship_validation_invalid,relationship_validation_superseded,acceptance_projection_changed,applied_source_manifest_changed,plan_revision_changed,renderer_identity_changed,dialect_changed,execution_target_changed,sql_artifact_changed,execution_policy_changed",
        "Expected all canonical staleness reasons in deterministic order.",
      ),
      ok: false,
    },
    {
      name: "v2 missing validation current context is not current",
      failureReasons: assertEqual(
        evaluateSqlResultStalenessV2({
          provenance: canonicalProvenance,
          currentContext: {
            ...matchingCanonicalContext,
            validationAssessmentIds: [],
          },
        }).reasonCodes.join(",").includes("relationship_validation_missing"),
        true,
        "Expected missing validation reason.",
      ),
      ok: false,
    },
    {
      name: "v2 switching back to matching context becomes current without mutation",
      failureReasons: [
        ...assertEqual(
          evaluateSqlResultStalenessV2({
            provenance: canonicalProvenance,
            currentContext: { ...matchingCanonicalContext, planRevisionId: "plan-revision:2" },
          }).status,
          "stale",
          "Expected changed plan revision to be stale.",
        ),
        ...assertEqual(
          evaluateSqlResultStalenessV2({
            provenance: canonicalProvenance,
            currentContext: matchingCanonicalContext,
          }).status,
          "current",
          "Expected matching context to be current again.",
        ),
        ...assertEqual(
          canonicalProvenance.planRevisionId,
          "plan-revision:1",
          "Expected completed provenance not to mutate.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 manual staleness ignores canonical-only fields",
      failureReasons: assertEqual(
        evaluateSqlResultStalenessV2({
          provenance: manualProvenance,
          currentContext: {
            ...matchingManualContext,
            appliedSourceManifestFingerprint: "manifest:v2:other",
            validationAssessmentIds: ["assessment:other"],
            planRevisionId: "plan-revision:other",
          },
        }).status,
        "current",
        "Expected manual staleness to ignore canonical-only authority.",
      ),
      ok: false,
    },
    {
      name: "v2 manual staleness still detects honest manual authority changes",
      failureReasons: assertEqual(
        evaluateSqlResultStalenessV2({
          provenance: manualProvenance,
          currentContext: { ...matchingManualContext, tableName: "renamed_units" },
        }).reasonCodes[0],
        "scope_changed",
        "Expected manual scope change.",
      ),
      ok: false,
    },
    {
      name: "v2 cleaned or mixed current context is unsupported",
      failureReasons: [
        ...assertEqual(
          evaluateSqlResultStalenessV2({
            provenance: canonicalProvenance,
            currentContext: { ...matchingCanonicalContext, sourceMode: "cleaned_only" },
          }).reasonCodes[0],
          "unsupported_source_mode",
          "Expected cleaned context unsupported.",
        ),
        ...assertEqual(
          evaluateSqlResultStalenessV2({
            provenance: canonicalProvenance,
            currentContext: { ...matchingCanonicalContext, sourceMode: "mixed" },
          }).status,
          "unsupported",
          "Expected mixed context unsupported.",
        ),
      ],
      ok: false,
    },
    {
      name: "v2 raw worksheet values are absent and caller mutation cannot alter provenance",
      failureReasons: [
        ...assertEqual(
          JSON.stringify(canonicalProvenance).includes("rows"),
          false,
          "Expected no raw row values in provenance.",
        ),
        ...assertEqual(
          canonicalProvenance.sourceRevisionIds.join(","),
          "source-revision:1",
          "Expected detached source revisions.",
        ),
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
