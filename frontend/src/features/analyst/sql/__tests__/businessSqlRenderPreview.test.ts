/**
 * T-13G - safe render preview contract fixtures.
 *
 * Pure fixture runner only. No SQL insertion, Run Query calls, backend/API
 * calls, provider calls, or query execution.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import { planBusinessSqlQueryRequest } from "../businessSqlQueryPlanner";
import {
  createBusinessSqlRenderPreview,
  summarizeBusinessSqlRenderPreview,
  type BusinessSqlRenderPreview,
} from "../businessSqlRenderPreview";
import type { BusinessSqlQueryPlan } from "../businessSqlQueryPlan";

type RenderPreviewFixture = {
  name: string;
  plan: BusinessSqlQueryPlan;
  assert: (
    plan: BusinessSqlQueryPlan,
    preview: BusinessSqlRenderPreview,
  ) => string[];
};

type RenderPreviewFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type RenderPreviewFixtureReport = {
  results: RenderPreviewFixtureResult[];
  passed: RenderPreviewFixtureResult[];
  failed: RenderPreviewFixtureResult[];
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

const leasesByStatusPlan = planBusinessSqlQueryRequest({
  prompt: "Count leases by status",
});

const ordersPerCustomerPlan = planBusinessSqlQueryRequest({
  prompt: "orders per customer",
  acceptedRelationshipContracts: [
    acceptedContract("customers", "customer_id", "orders", "customer_id"),
  ],
});

const unresolvedJoinPlan = planBusinessSqlQueryRequest({
  prompt: "tickets per account",
});

const blockedMissingRelationshipPlan = planBusinessSqlQueryRequest({
  prompt: "orders per customer",
  missingRelationships: [{ fromEntity: "customers", toEntity: "orders" }],
});

const unsupportedPromptPlan = planBusinessSqlQueryRequest({
  prompt: "Show me something interesting about the workbook",
});

const oracleGuidancePlan = planBusinessSqlQueryRequest({
  prompt: "Count leases by status",
  selectedGuidanceDialect: "oracle",
});

const expectPreview = (
  preview: BusinessSqlRenderPreview,
  status: BusinessSqlRenderPreview["status"],
): string[] => {
  if (preview.status === status) return [];
  return [`Expected preview ${status} but got ${preview.status}.`];
};

const expectSafeActions = (preview: BusinessSqlRenderPreview): string[] => [
  ...(preview.actions.canInsertSql ? ["canInsertSql must always be false."] : []),
  ...(preview.actions.canRunSql ? ["canRunSql must always be false."] : []),
];

export const BUSINESS_SQL_RENDER_PREVIEW_FIXTURES: RenderPreviewFixture[] = [
  {
    name: "leases by status produces ready preview with SQL and copy",
    plan: leasesByStatusPlan,
    assert: (_plan, preview) => [
      ...expectPreview(preview, "ready"),
      ...(preview.sql?.includes('FROM "leases"') ? [] : ["Expected rendered lease SQL."]),
      ...(preview.actions.canCopySql ? [] : ["Expected canCopySql true."]),
      ...expectSafeActions(preview),
    ],
  },
  {
    name: "resolved orders per customer produces ready preview with SQL and copy",
    plan: ordersPerCustomerPlan,
    assert: (_plan, preview) => [
      ...expectPreview(preview, "ready"),
      ...(preview.sql?.includes('JOIN "orders"') ? [] : ["Expected orders join SQL."]),
      ...(preview.actions.canCopySql ? [] : ["Expected canCopySql true."]),
      ...expectSafeActions(preview),
    ],
  },
  {
    name: "unresolved joins produce needs_review preview with null SQL",
    plan: unresolvedJoinPlan,
    assert: (_plan, preview) => [
      ...expectPreview(preview, "needs_review"),
      ...(preview.sql === null ? [] : ["Expected null SQL for needs_review preview."]),
      ...(!preview.actions.canCopySql ? [] : ["canCopySql must be false without SQL."]),
      ...expectSafeActions(preview),
    ],
  },
  {
    name: "blocked missing relationship produces blocked preview with null SQL",
    plan: blockedMissingRelationshipPlan,
    assert: (_plan, preview) => [
      ...expectPreview(preview, "blocked"),
      ...(preview.sql === null ? [] : ["Expected null SQL for blocked preview."]),
      ...(!preview.actions.canCopySql ? [] : ["canCopySql must be false for blocked preview."]),
      ...expectSafeActions(preview),
    ],
  },
  {
    name: "unsupported prompt produces needs_review preview with null SQL",
    plan: unsupportedPromptPlan,
    assert: (_plan, preview) => [
      ...expectPreview(preview, "needs_review"),
      ...(preview.sql === null ? [] : ["Expected null SQL for unsupported prompt."]),
      ...(!preview.actions.canCopySql ? [] : ["canCopySql must be false for unsupported prompt."]),
      ...expectSafeActions(preview),
    ],
  },
  {
    name: "Oracle guidance shows DuckDB target and Oracle guidance metadata",
    plan: oracleGuidancePlan,
    assert: (_plan, preview) => [
      ...expectPreview(preview, "ready"),
      ...(preview.rendererTarget === "duckdb" ? [] : ["Expected DuckDB renderer target."]),
      ...(preview.guidanceDialect === "oracle" ? [] : ["Expected Oracle guidance metadata."]),
      ...(preview.sql?.includes('FROM "leases"') ? [] : ["Expected DuckDB SQL preview."]),
      ...expectSafeActions(preview),
    ],
  },
  {
    name: "canInsertSql is always false",
    plan: leasesByStatusPlan,
    assert: (_plan, preview) =>
      preview.actions.canInsertSql ? ["canInsertSql must always be false."] : [],
  },
  {
    name: "canRunSql is always false",
    plan: leasesByStatusPlan,
    assert: (_plan, preview) =>
      preview.actions.canRunSql ? ["canRunSql must always be false."] : [],
  },
  {
    name: "preview does not mutate the original plan",
    plan: leasesByStatusPlan,
    assert: (plan) => {
      const before = JSON.stringify(plan);
      createBusinessSqlRenderPreview(plan);
      const after = JSON.stringify(plan);
      return before === after ? [] : ["Preview must not mutate the original plan."];
    },
  },
];

export function runBusinessSqlRenderPreviewFixtures(): RenderPreviewFixtureReport {
  const results = BUSINESS_SQL_RENDER_PREVIEW_FIXTURES.map((fixture) => {
    const preview = createBusinessSqlRenderPreview(fixture.plan);
    const failureReasons = fixture.assert(fixture.plan, preview);

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: summarizeBusinessSqlRenderPreview(preview),
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allBusinessSqlRenderPreviewFixturesPass(): boolean {
  return runBusinessSqlRenderPreviewFixtures().failed.length === 0;
}
