/**
 * T-13F - deterministic DuckDB SQL renderer fixtures.
 *
 * Pure fixture runner only. No editor insertion, Run Query calls, backend/API
 * calls, provider calls, or query execution.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import {
  createBlockedBusinessSqlQueryPlan,
  summarizeBusinessSqlQueryPlan,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import { planBusinessSqlQueryRequest } from "../businessSqlQueryPlanner";
import {
  applyBusinessSqlRenderedSql,
  canRenderBusinessSqlQueryPlan,
  renderBusinessSqlQueryPlan,
  type BusinessSqlRenderResult,
} from "../businessSqlRenderer";

type RendererFixture = {
  name: string;
  plan: BusinessSqlQueryPlan;
  assert: (
    plan: BusinessSqlQueryPlan,
    result: BusinessSqlRenderResult,
    applied: BusinessSqlQueryPlan,
  ) => string[];
};

type RendererFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  renderResult: BusinessSqlRenderResult;
  failureReasons: string[];
};

export type RendererFixtureReport = {
  results: RendererFixtureResult[];
  passed: RendererFixtureResult[];
  failed: RendererFixtureResult[];
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

const ordersPerCustomerPlan = planBusinessSqlQueryRequest({
  prompt: "orders per customer",
  acceptedRelationshipContracts: [
    acceptedContract("customers", "customer_id", "orders", "customer_id"),
  ],
});

const ticketsPerAccountPlan = planBusinessSqlQueryRequest({
  prompt: "tickets per account",
  acceptedRelationshipContracts: [
    acceptedContract("accounts", "account_id", "tickets", "account_id"),
  ],
});

const unresolvedLeasedUnitsPlan = planBusinessSqlQueryRequest({
  prompt: "How many units in each property are leased to current tenants?",
});

const resolvedLeasedUnitsPlan = planBusinessSqlQueryRequest({
  prompt: "How many units in each property are leased to current tenants?",
  acceptedRelationshipContracts: [
    acceptedContract("properties", "property_id", "units", "property_id"),
    acceptedContract("units", "unit_id", "leases", "unit_id"),
  ],
});

const missingRelationshipPlan = planBusinessSqlQueryRequest({
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

const expectRendered = (result: BusinessSqlRenderResult): string[] => {
  if (result.status === "rendered" && result.sql) return [];
  return [`Expected rendered SQL but got ${result.status}.`];
};

const expectRefused = (
  result: BusinessSqlRenderResult,
  expectedStatus: "needs_review" | "blocked",
): string[] => {
  if (result.status === expectedStatus && result.sql === null) return [];
  return [`Expected ${expectedStatus} without SQL but got ${result.status}.`];
};

const containsAll = (value: string | null, fragments: readonly string[]): boolean =>
  Boolean(value && fragments.every((fragment) => value.includes(fragment)));

export const BUSINESS_SQL_RENDERER_FIXTURES: RendererFixture[] = [
  {
    name: "leases by status renders DuckDB SQL",
    plan: planBusinessSqlQueryRequest({ prompt: "Count leases by status" }),
    assert: (_plan, result, applied) => [
      ...expectRendered(result),
      ...(containsAll(result.sql, [
        'SELECT',
        '"leases"."lease_status"',
        'COUNT(*) AS "count_leases"',
        'FROM "leases"',
        'GROUP BY "leases"."lease_status"',
        'ORDER BY "count_leases" DESC;',
      ])
        ? []
        : ["Expected DuckDB grouped lease-status SQL."]),
      ...(applied.renderer.status !== "rendered" ? ["Expected applied renderer status rendered."] : []),
      ...(applied.renderer.sql !== result.sql ? ["Expected applied SQL to match render result."] : []),
    ],
  },
  {
    name: "resolved orders per customer renders join SQL",
    plan: ordersPerCustomerPlan,
    assert: (_plan, result) => [
      ...expectRendered(result),
      ...(containsAll(result.sql, [
        '"customers"."customer_id"',
        'COUNT(*) AS "count_orders"',
        'FROM "customers"',
        'JOIN "orders" ON "customers"."customer_id" = "orders"."customer_id"',
        'GROUP BY "customers"."customer_id"',
      ])
        ? []
        : ["Expected customers to orders join SQL."]),
    ],
  },
  {
    name: "resolved tickets per account renders join SQL",
    plan: ticketsPerAccountPlan,
    assert: (_plan, result) => [
      ...expectRendered(result),
      ...(containsAll(result.sql, [
        '"accounts"."account_id"',
        'COUNT(*) AS "count_tickets"',
        'FROM "accounts"',
        'JOIN "tickets" ON "accounts"."account_id" = "tickets"."account_id"',
      ])
        ? []
        : ["Expected accounts to tickets join SQL."]),
    ],
  },
  {
    name: "unresolved leased units per property refuses rendering",
    plan: unresolvedLeasedUnitsPlan,
    assert: (_plan, result, applied) => [
      ...expectRefused(result, "needs_review"),
      ...(canRenderBusinessSqlQueryPlan(unresolvedLeasedUnitsPlan)
        ? ["Unresolved leased units must not be renderable."]
        : []),
      ...(applied.renderer.sql ? ["Needs-review plan must not gain SQL text."] : []),
    ],
  },
  {
    name: "resolved leased units per property refuses unsafe current-lease filter",
    plan: resolvedLeasedUnitsPlan,
    assert: (_plan, result, applied) => [
      ...expectRefused(result, "needs_review"),
      ...(result.reasons.some((reason) => reason.includes("Active/current lease"))
        ? []
        : ["Expected active/current lease refusal reason."]),
      ...(applied.renderer.sql ? ["Unsafe current-lease filter plan must not gain SQL text."] : []),
    ],
  },
  {
    name: "missing relationship blocked plan refuses rendering",
    plan: missingRelationshipPlan,
    assert: (_plan, result, applied) => [
      ...expectRefused(result, "blocked"),
      ...(applied.renderer.status !== "blocked" ? ["Expected blocked applied renderer."] : []),
      ...(applied.renderer.sql ? ["Blocked plan must not gain SQL text."] : []),
    ],
  },
  {
    name: "unsupported prompt refuses rendering",
    plan: unsupportedPromptPlan,
    assert: (_plan, result, applied) => [
      ...expectRefused(result, "needs_review"),
      ...(applied.renderer.sql ? ["Unsupported prompt must not gain SQL text."] : []),
    ],
  },
  {
    name: "selected Oracle guidance still renders DuckDB-target SQL only",
    plan: oracleGuidancePlan,
    assert: (plan, result, applied) => [
      ...expectRendered(result),
      ...(plan.renderer.targetDialect !== "duckdb" ? ["Expected DuckDB renderer target."] : []),
      ...(plan.renderer.selectedGuidanceDialect !== "oracle"
        ? ["Expected Oracle guidance metadata."]
        : []),
      ...(containsAll(result.sql, ['FROM "leases"', 'ORDER BY "count_leases" DESC;'])
        ? []
        : ["Expected DuckDB SQL despite Oracle guidance metadata."]),
      ...(applied.renderer.selectedGuidanceDialect !== "oracle"
        ? ["Expected applied plan to preserve Oracle guidance metadata."]
        : []),
    ],
  },
  {
    name: "rendered SQL never appears for needs_review or blocked plans",
    plan: createBlockedBusinessSqlQueryPlan("Missing required join path between invoices and vendors."),
    assert: (_plan, result, applied) => {
      const needsReviewResult = renderBusinessSqlQueryPlan(unsupportedPromptPlan);
      const needsReviewApplied = applyBusinessSqlRenderedSql(unsupportedPromptPlan);
      const failures = [
        ...expectRefused(result, "blocked"),
        ...(applied.renderer.sql ? ["Blocked plan must not gain SQL text."] : []),
      ];
      if (needsReviewResult.sql || needsReviewApplied.renderer.sql) {
        failures.push("Needs-review plan must not gain SQL text.");
      }
      return failures;
    },
  },
];

export function runBusinessSqlRendererFixtures(): RendererFixtureReport {
  const results = BUSINESS_SQL_RENDERER_FIXTURES.map((fixture) => {
    const renderResult = renderBusinessSqlQueryPlan(fixture.plan);
    const applied = applyBusinessSqlRenderedSql(fixture.plan);
    const failureReasons = fixture.assert(fixture.plan, renderResult, applied);

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: summarizeBusinessSqlQueryPlan(applied),
      renderResult,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allBusinessSqlRendererFixturesPass(): boolean {
  return runBusinessSqlRendererFixtures().failed.length === 0;
}
