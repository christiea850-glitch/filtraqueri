/**
 * T-13H - guarded Business SQL renderer contract fixtures.
 *
 * Pure fixture runner only. No editor insertion, Run Query calls, backend/API
 * calls, provider calls, network calls, persistence, or query execution.
 */

import {
  evaluateBusinessSqlRenderability,
  type BusinessSqlRenderabilityGate,
} from "../businessSqlRenderabilityGate";
import type { BusinessSqlRelationshipMetadata } from "../businessSqlJoinPathResolver";
import {
  planBusinessSqlQueryRequestWithJoinResolution,
  type BusinessSqlQueryPlanJoinResolution,
} from "../businessSqlQueryPlanJoinResolution";
import {
  renderBusinessSqlFromRenderability,
  type BusinessSqlRenderResult,
} from "../businessSqlRenderer";

type RendererFixture = {
  name: string;
  integrated: BusinessSqlQueryPlanJoinResolution;
  renderability?: BusinessSqlRenderabilityGate;
  assert: (
    result: BusinessSqlRenderResult,
    integrated: BusinessSqlQueryPlanJoinResolution,
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

const relationship = (
  id: string,
  fromEntity: string,
  toEntity: string,
  status: BusinessSqlRelationshipMetadata["status"] = "accepted",
): BusinessSqlRelationshipMetadata => ({ id, fromEntity, toEntity, status });

const integratedFor = (
  prompt: string,
  relationships: readonly BusinessSqlRelationshipMetadata[] = [],
): BusinessSqlQueryPlanJoinResolution =>
  planBusinessSqlQueryRequestWithJoinResolution({ prompt, relationships });

const renderabilityFor = (
  integrated: BusinessSqlQueryPlanJoinResolution,
): BusinessSqlRenderabilityGate =>
  evaluateBusinessSqlRenderability({ integrated });

const renderInput = (
  integrated: BusinessSqlQueryPlanJoinResolution,
  renderability = renderabilityFor(integrated),
) => renderBusinessSqlFromRenderability({ integrated, renderability });

const leasesByStatus = integratedFor("Count leases by status");
const leasedUnitsPerProperty = integratedFor(
  "How many units in each property are leased to current tenants?",
  [
    relationship("relationship:properties-units", "properties", "units", "accepted"),
    relationship("relationship:units-leases", "units", "leases", "ready"),
  ],
);
const ordersPerCustomer = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "ready"),
]);
const ticketsPerAccount = integratedFor("Count tickets per account", [
  relationship("relationship:accounts-tickets", "accounts", "tickets", "verified"),
]);
const needsReviewPlan = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "unknown"),
]);
const blockedPlan = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "missing"),
]);
const unsupportedReadyPlan: BusinessSqlQueryPlanJoinResolution = {
  ...leasesByStatus,
  plan: {
    ...leasesByStatus.plan,
    id: "business-sql-plan:unsupported-render-shape",
    kind: "count_distinct_entity",
  },
};
const nonDuckDbPlan: BusinessSqlQueryPlanJoinResolution = {
  ...leasesByStatus,
  plan: {
    ...leasesByStatus.plan,
    renderer: {
      ...leasesByStatus.plan.renderer,
      targetDialect: "oracle",
    },
  },
};
const forgedUnresolvedJoinPlan: BusinessSqlQueryPlanJoinResolution = {
  ...needsReviewPlan,
  readiness: "ready",
  support: "supported",
};
const forgedRenderableGate: BusinessSqlRenderabilityGate = {
  ...renderabilityFor(needsReviewPlan),
  status: "renderable",
  renderable: true,
  readinessStatus: "ready",
  support: "supported",
  reasonCodes: [],
  blockingReasons: [],
  reviewReasons: [],
};
const deterministicFirst = renderInput(ordersPerCustomer);
const deterministicSecond = renderInput(ordersPerCustomer);

const expectRendered = (
  result: BusinessSqlRenderResult,
  fragments: readonly string[],
): string[] => [
  ...(result.rendered && result.status === "rendered" && result.sql
    ? []
    : [`Expected rendered SQL but got ${result.status}.`]),
  ...(result.reasonCode === "rendered" ? [] : [`Expected rendered reason code, got ${result.reasonCode}.`]),
  ...(result.executionPayload === null ? [] : ["Renderer must not expose an execution payload."]),
  ...(result.inserted === false ? [] : ["Renderer must not insert SQL."]),
  ...(result.ranQuery === false ? [] : ["Renderer must not run SQL."]),
  ...(fragments.every((fragment) => result.sql?.includes(fragment))
    ? []
    : [`Expected SQL fragments: ${fragments.join(" | ")}`]),
];

const expectRefused = (
  result: BusinessSqlRenderResult,
  reasonCode: BusinessSqlRenderResult["reasonCode"],
): string[] => [
  ...(!result.rendered && result.sql === null
    ? []
    : ["Refused render attempt must return rendered=false and sql=null."]),
  ...(result.reasonCode === reasonCode
    ? []
    : [`Expected reason ${reasonCode}, got ${result.reasonCode}.`]),
  ...(result.executionPayload === null ? [] : ["Refusal must not expose an execution payload."]),
  ...(result.inserted === false ? [] : ["Refusal must not insert SQL."]),
  ...(result.ranQuery === false ? [] : ["Refusal must not run SQL."]),
];

const assertSelectOnly = (sql: string | null): string[] => {
  if (!sql) return ["Expected SQL text."];
  const normalized = sql.trim();
  return [
    ...(/^SELECT\b/.test(normalized) ? [] : ["Rendered SQL must start with SELECT."]),
    ...(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|MERGE|CALL|COPY|PRAGMA|ATTACH|DETACH)\b/i.test(normalized)
      ? ["Rendered SQL must not contain mutating or runtime-control statements."]
      : []),
    ...(/--|\/\*/.test(normalized) ? ["Rendered SQL must not contain comments."] : []),
    ...(normalized.slice(0, -1).includes(";")
      ? ["Rendered SQL must not contain multiple statements."]
      : []),
  ];
};

const assertNoPromptText = (
  result: BusinessSqlRenderResult,
  prompt: string,
): string[] => {
  const sql = result.sql || "";
  return sql.toLowerCase().includes(prompt.toLowerCase())
    ? ["Rendered SQL must not contain raw prompt text."]
    : [];
};

export const BUSINESS_SQL_RENDERER_FIXTURES: RendererFixture[] = [
  {
    name: "leases by status renderable plan produces deterministic DuckDB SELECT",
    integrated: leasesByStatus,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        'SELECT',
        '"leases"."lease_status" AS "lease_status"',
        'COUNT(*) AS "count_leases"',
        'FROM "leases"',
        'GROUP BY "leases"."lease_status"',
        'ORDER BY "count_leases" DESC;',
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "leased units per property with resolved joins renders deterministic DuckDB SELECT",
    integrated: leasedUnitsPerProperty,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        '"properties"."property_id" AS "property"',
        'COUNT(DISTINCT "units"."unit_id") AS "count_distinct_units"',
        'FROM "properties"',
        'JOIN "units" ON "properties"."property_id" = "units"."property_id"',
        'JOIN "leases" ON "units"."unit_id" = "leases"."unit_id"',
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "orders per customer with resolved joins renders deterministic DuckDB SELECT",
    integrated: ordersPerCustomer,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        '"customers"."customer_id" AS "customer"',
        'COUNT(*) AS "count_orders"',
        'FROM "customers"',
        'JOIN "orders" ON "customers"."customer_id" = "orders"."customer_id"',
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "tickets per account with resolved joins renders deterministic DuckDB SELECT",
    integrated: ticketsPerAccount,
    assert: (result, integrated) => [
      ...expectRendered(result, [
        '"accounts"."account_id" AS "account"',
        'COUNT(*) AS "count_tickets"',
        'FROM "accounts"',
        'JOIN "tickets" ON "accounts"."account_id" = "tickets"."account_id"',
      ]),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "needs-review renderability refuses to render",
    integrated: needsReviewPlan,
    assert: (result) => expectRefused(result, "renderability_not_renderable"),
  },
  {
    name: "blocked renderability refuses to render",
    integrated: blockedPlan,
    assert: (result) => expectRefused(result, "renderability_not_renderable"),
  },
  {
    name: "unsupported ready shape refuses to render",
    integrated: unsupportedReadyPlan,
    assert: (result) => expectRefused(result, "unsupported_plan_shape"),
  },
  {
    name: "non-DuckDB renderer target refuses to render",
    integrated: nonDuckDbPlan,
    assert: (result) => expectRefused(result, "renderer_target_not_duckdb"),
  },
  {
    name: "unresolved join refuses even with forged renderable gate",
    integrated: forgedUnresolvedJoinPlan,
    renderability: forgedRenderableGate,
    assert: (result) => expectRefused(result, "relationship_review_required"),
  },
  {
    name: "rendered SQL is SELECT-only and contains no prompt text",
    integrated: ordersPerCustomer,
    assert: (result, integrated) => [
      ...expectRendered(result, ["SELECT", 'FROM "customers"', 'JOIN "orders"']),
      ...assertSelectOnly(result.sql),
      ...assertNoPromptText(result, integrated.plan.prompt || ""),
    ],
  },
  {
    name: "same input produces the same SQL output",
    integrated: ordersPerCustomer,
    assert: () =>
      deterministicFirst.sql === deterministicSecond.sql &&
      deterministicFirst.summary === deterministicSecond.summary
        ? []
        : ["Expected deterministic rendered SQL and summary."],
  },
];

export function runBusinessSqlRendererFixtures(): RendererFixtureReport {
  const results = BUSINESS_SQL_RENDERER_FIXTURES.map((fixture) => {
    const renderResult = renderBusinessSqlFromRenderability({
      integrated: fixture.integrated,
      renderability: fixture.renderability || renderabilityFor(fixture.integrated),
    });
    const failureReasons = fixture.assert(renderResult, fixture.integrated);

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: renderResult.summary,
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
