/**
 * T-13H - read-only Business SQL preview UI adapter fixtures.
 *
 * Pure fixture runner only. No Monaco insertion, Run Query calls, clipboard,
 * backend/API calls, provider calls, or query execution.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import {
  createBusinessSqlRenderPreviewFromWorkspaceContext,
  getBusinessSqlRenderPreviewCopyState,
  type BusinessSqlRenderPreviewWorkspaceResult,
} from "../businessSqlRenderPreviewUiAdapter";

type PreviewUiAdapterFixture = {
  name: string;
  result: BusinessSqlRenderPreviewWorkspaceResult;
  assert: (result: BusinessSqlRenderPreviewWorkspaceResult) => string[];
};

type PreviewUiAdapterFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type PreviewUiAdapterFixtureReport = {
  results: PreviewUiAdapterFixtureResult[];
  passed: PreviewUiAdapterFixtureResult[];
  failed: PreviewUiAdapterFixtureResult[];
};

const acceptedContract = (
  sourceTableName: string,
  sourceColumnName: string,
  targetTableName: string,
  targetColumnName: string,
): AcceptedRelationshipContract => ({
  contractId: `contract:${sourceTableName}-${targetTableName}`,
  sourceWorksheetId: `worksheet:${sourceTableName}`,
  sourceTableName,
  sourceColumnName,
  targetWorksheetId: `worksheet:${targetTableName}`,
  targetTableName,
  targetColumnName,
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: `candidate:${sourceTableName}-${targetTableName}`,
  acceptedAt: "2026-01-01T00:00:00.000Z",
  acceptedBy: null,
  status: "active",
  validationState: "valid",
  validationSummary: [],
  overlapRatio: 1,
  sourceUniqueRatio: 0.5,
  targetUniqueRatio: 1,
  inferredTypeCompatible: true,
  lastValidatedAt: "2026-01-01T00:00:00.000Z",
});

const activeSqlDraft = 'SELECT * FROM "leases";';

const expectInsertRunDisabled = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => [
  ...(result.preview.actions.canInsertSql ? ["Insert must be disabled."] : []),
  ...(result.preview.actions.canRunSql ? ["Run must be disabled."] : []),
];

const expectCopyEnabled = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => {
  const copyState = getBusinessSqlRenderPreviewCopyState(result.preview);
  return [
    ...(copyState.canCopySql ? [] : ["Copy should be enabled for ready SQL preview."]),
    ...(copyState.sql === result.preview.sql ? [] : ["Copy SQL should match preview SQL."]),
  ];
};

const expectCopyDisabled = (
  result: BusinessSqlRenderPreviewWorkspaceResult,
): string[] => {
  const copyState = getBusinessSqlRenderPreviewCopyState(result.preview);
  return [
    ...(copyState.canCopySql ? ["Copy should be disabled."] : []),
    ...(copyState.sql === null ? [] : ["Disabled copy state must not expose SQL."]),
  ];
};

export const BUSINESS_SQL_RENDER_PREVIEW_UI_ADAPTER_FIXTURES: PreviewUiAdapterFixture[] = [
  {
    name: "ready preview can display SQL but insert and run stay disabled",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "Count leases by status",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "ready" ? [] : ["Expected ready preview."]),
      ...(result.preview.sql ? [] : ["Expected display SQL."]),
      ...(result.preview.actions.canCopySql ? [] : ["Expected copy eligibility for ready SQL."]),
      ...expectCopyEnabled(result),
      ...expectInsertRunDisabled(result),
    ],
  },
  {
    name: "needs-review preview displays reasons and no SQL",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "tickets per account",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "needs_review" ? [] : ["Expected needs_review preview."]),
      ...(result.preview.sql === null ? [] : ["Expected no SQL for needs_review preview."]),
      ...(result.preview.reasons.length > 0 ? [] : ["Expected needs_review reasons."]),
      ...expectCopyDisabled(result),
      ...expectInsertRunDisabled(result),
    ],
  },
  {
    name: "blocked preview displays blocking reason and no SQL",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "orders per customer",
      selectedGuidanceDialect: "duckdb",
      missingRelationships: [{ fromEntity: "customers", toEntity: "orders" }],
      activeSqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "blocked" ? [] : ["Expected blocked preview."]),
      ...(result.preview.sql === null ? [] : ["Expected no SQL for blocked preview."]),
      ...(result.preview.reasons.length > 0 ? [] : ["Expected blocking reason."]),
      ...expectCopyDisabled(result),
      ...expectInsertRunDisabled(result),
    ],
  },
  {
    name: "preview creation does not mutate active SQL draft",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "Count leases by status",
      selectedGuidanceDialect: "duckdb",
      activeSqlDraft,
    }),
    assert: (result) =>
      result.activeSqlDraft === activeSqlDraft
        ? []
        : ["Expected active SQL draft to be preserved unchanged."],
  },
  {
    name: "selected guidance dialect remains metadata only",
    result: createBusinessSqlRenderPreviewFromWorkspaceContext({
      taskPrompt: "orders per customer",
      selectedGuidanceDialect: "oracle",
      acceptedRelationshipContracts: [
        acceptedContract("customers", "customer_id", "orders", "customer_id"),
      ],
      activeSqlDraft,
    }),
    assert: (result) => [
      ...(result.preview.status === "ready" ? [] : ["Expected ready preview."]),
      ...(result.preview.rendererTarget === "duckdb" ? [] : ["Expected DuckDB target."]),
      ...(result.preview.guidanceDialect === "oracle" ? [] : ["Expected Oracle guidance metadata."]),
      ...(result.preview.sql?.includes('"orders"') ? [] : ["Expected DuckDB SQL display."]),
      ...expectCopyEnabled(result),
      ...expectInsertRunDisabled(result),
    ],
  },
];

export function runBusinessSqlRenderPreviewUiAdapterFixtures(): PreviewUiAdapterFixtureReport {
  const results = BUSINESS_SQL_RENDER_PREVIEW_UI_ADAPTER_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert(fixture.result);
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

export function allBusinessSqlRenderPreviewUiAdapterFixturesPass(): boolean {
  return runBusinessSqlRenderPreviewUiAdapterFixtures().failed.length === 0;
}
