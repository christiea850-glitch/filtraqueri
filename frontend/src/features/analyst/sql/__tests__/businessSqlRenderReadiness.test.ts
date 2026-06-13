/**
 * T-13E - Business SQL render readiness gate acceptance fixtures.
 *
 * Pure fixture runner only. No SQL generation, SQL rendering, editor insertion,
 * provider calls, backend calls, or query execution.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import {
  createBlockedBusinessSqlQueryPlan,
  createEmptyBusinessSqlQueryPlan,
  summarizeBusinessSqlQueryPlan,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import { planBusinessSqlQueryRequest } from "../businessSqlQueryPlanner";
import {
  applyBusinessSqlRenderReadiness,
  evaluateBusinessSqlRenderReadiness,
  type BusinessSqlRenderReadinessResult,
} from "../businessSqlRenderReadiness";

type RenderReadinessFixture = {
  name: string;
  plan: BusinessSqlQueryPlan;
  assert: (
    plan: BusinessSqlQueryPlan,
    result: BusinessSqlRenderReadinessResult,
    applied: BusinessSqlQueryPlan,
  ) => string[];
};

type RenderReadinessFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  readiness: BusinessSqlRenderReadinessResult;
  failureReasons: string[];
};

export type RenderReadinessFixtureReport = {
  results: RenderReadinessFixtureResult[];
  passed: RenderReadinessFixtureResult[];
  failed: RenderReadinessFixtureResult[];
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

const ordersPerCustomerResolved = planBusinessSqlQueryRequest({
  prompt: "orders per customer",
  acceptedRelationshipContracts: [
    acceptedContract("customers", "customer_id", "orders", "customer_id"),
  ],
});

const leasedUnitsPerPropertyNeedsReview = planBusinessSqlQueryRequest({
  prompt: "How many units in each property are leased to current tenants?",
});

const missingRelationshipPlan = planBusinessSqlQueryRequest({
  prompt: "Count orders per customer",
  missingRelationships: [{ fromEntity: "customers", toEntity: "orders" }],
});

const unsupportedPromptPlan = planBusinessSqlQueryRequest({
  prompt: "Show me something interesting about the workbook",
});

const dialectMetadataPlan = planBusinessSqlQueryRequest({
  prompt: "Count leases by status",
  selectedGuidanceDialect: "oracle",
});

const resolvedMultiTablePlan = planBusinessSqlQueryRequest({
  prompt: "Count tickets by account",
  acceptedRelationshipContracts: [
    acceptedContract("accounts", "account_id", "tickets", "account_id"),
  ],
});

const expectStatus = (
  result: BusinessSqlRenderReadinessResult,
  expectedStatus: BusinessSqlRenderReadinessResult["status"],
): string[] => {
  if (result.status === expectedStatus) return [];
  return [`Expected readiness ${expectedStatus} but got ${result.status}.`];
};

const expectRendererStatus = (
  applied: BusinessSqlQueryPlan,
  expectedStatus: BusinessSqlQueryPlan["renderer"]["status"],
): string[] => {
  if (applied.renderer.status === expectedStatus) return [];
  return [`Expected applied renderer ${expectedStatus} but got ${applied.renderer.status}.`];
};

export const BUSINESS_SQL_RENDER_READINESS_FIXTURES: RenderReadinessFixture[] = [
  {
    name: "single-table leases by status becomes renderable",
    plan: planBusinessSqlQueryRequest({ prompt: "Count leases by status" }),
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "renderable"),
      ...expectRendererStatus(applied, "renderable"),
      ...(applied.renderer.sql ? ["Readiness apply must not add SQL text."] : []),
    ],
  },
  {
    name: "resolved orders per customer becomes renderable",
    plan: ordersPerCustomerResolved,
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "renderable"),
      ...expectRendererStatus(applied, "renderable"),
      ...(applied.joinPath.status !== "resolved" ? ["Expected resolved join path."] : []),
      ...(applied.renderer.sql ? ["Readiness apply must not add SQL text."] : []),
    ],
  },
  {
    name: "leased units per property with unresolved joins stays needs_review",
    plan: leasedUnitsPerPropertyNeedsReview,
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "needs_review"),
      ...expectRendererStatus(applied, "not_rendered"),
      ...(result.reasons.some((reason) => reason.includes("join"))
        ? []
        : ["Expected join readiness reason."]),
    ],
  },
  {
    name: "missing relationship stays blocked",
    plan: missingRelationshipPlan,
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "blocked"),
      ...expectRendererStatus(applied, "blocked"),
      ...(applied.joinPath.status !== "missing" ? ["Expected missing join path."] : []),
    ],
  },
  {
    name: "unsupported prompt stays needs_review",
    plan: unsupportedPromptPlan,
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "needs_review"),
      ...expectRendererStatus(applied, "not_rendered"),
      ...(applied.metric !== null ? ["Unsupported prompt should not select a metric."] : []),
    ],
  },
  {
    name: "empty plan stays needs_review",
    plan: createEmptyBusinessSqlQueryPlan(),
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "needs_review"),
      ...expectRendererStatus(applied, "not_rendered"),
      ...(result.reasons.includes("Plan must include a metric.")
        ? []
        : ["Expected missing metric reason."]),
    ],
  },
  {
    name: "blocked plan stays blocked",
    plan: createBlockedBusinessSqlQueryPlan("Missing required join path between invoices and vendors."),
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "blocked"),
      ...expectRendererStatus(applied, "blocked"),
      ...(applied.renderer.sql ? ["Blocked readiness must not add SQL text."] : []),
    ],
  },
  {
    name: "dialect metadata remains DuckDB target with selected dialect as guidance only",
    plan: dialectMetadataPlan,
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "renderable"),
      ...expectRendererStatus(applied, "renderable"),
      ...(applied.renderer.targetDialect !== "duckdb"
        ? ["Expected DuckDB renderer target."]
        : []),
      ...(applied.renderer.selectedGuidanceDialect !== "oracle"
        ? ["Expected Oracle selected guidance metadata."]
        : []),
      ...(applied.renderer.sql ? ["Readiness apply must not add SQL text."] : []),
    ],
  },
  {
    name: "resolved multi-table plan does not gain SQL text",
    plan: resolvedMultiTablePlan,
    assert: (_plan, result, applied) => [
      ...expectStatus(result, "renderable"),
      ...expectRendererStatus(applied, "renderable"),
      ...(applied.renderer.sql ? ["Resolved multi-table plan must not gain SQL text."] : []),
    ],
  },
];

export function runBusinessSqlRenderReadinessFixtures(): RenderReadinessFixtureReport {
  const results = BUSINESS_SQL_RENDER_READINESS_FIXTURES.map((fixture) => {
    const readiness = evaluateBusinessSqlRenderReadiness(fixture.plan);
    const applied = applyBusinessSqlRenderReadiness(fixture.plan);
    const failureReasons = fixture.assert(fixture.plan, readiness, applied);

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: summarizeBusinessSqlQueryPlan(applied),
      readiness,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allBusinessSqlRenderReadinessFixturesPass(): boolean {
  return runBusinessSqlRenderReadinessFixtures().failed.length === 0;
}
