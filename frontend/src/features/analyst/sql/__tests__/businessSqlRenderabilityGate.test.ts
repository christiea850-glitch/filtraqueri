/** T-13G - metadata-only Business SQL renderability gate fixtures. */

import type { BusinessSqlRelationshipMetadata } from "../businessSqlJoinPathResolver";
import {
  evaluateBusinessSqlRenderability,
  type BusinessSqlRenderabilityGate,
} from "../businessSqlRenderabilityGate";
import {
  attachBusinessSqlJoinResolutionToPlan,
  planBusinessSqlQueryRequestWithJoinResolution,
} from "../businessSqlQueryPlanJoinResolution";
import { createBlockedBusinessSqlQueryPlan } from "../businessSqlQueryPlan";

type Fixture = {
  name: string;
  gate: BusinessSqlRenderabilityGate;
  assert: (gate: BusinessSqlRenderabilityGate) => string[];
};

const relationship = (
  id: string,
  fromEntity: string,
  toEntity: string,
  status: BusinessSqlRelationshipMetadata["status"] = "accepted",
): BusinessSqlRelationshipMetadata => ({ id, fromEntity, toEntity, status });

const evaluate = (
  prompt: string,
  relationships: readonly BusinessSqlRelationshipMetadata[] = [],
): BusinessSqlRenderabilityGate =>
  evaluateBusinessSqlRenderability({
    integrated: planBusinessSqlQueryRequestWithJoinResolution({ prompt, relationships }),
  });

const readyFailures = (gate: BusinessSqlRenderabilityGate): string[] => {
  const failures: string[] = [];
  if (gate.status !== "renderable") failures.push("Expected renderable status.");
  if (!gate.renderable) failures.push("Expected renderable flag.");
  if (gate.readinessStatus !== "ready") failures.push("Expected ready readiness.");
  if (gate.support !== "supported") failures.push("Expected supported gate.");
  if (gate.rendererTarget.targetDialect !== "duckdb") {
    failures.push("Expected DuckDB renderer target metadata.");
  }
  if (!gate.rendererTarget.metadataOnly) failures.push("Expected metadata-only target.");
  if (gate.sqlGenerated !== false) failures.push("Expected no generated SQL marker.");
  return failures;
};

const allStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(allStrings);
};

const forbiddenSqlClausePattern =
  /\b(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i;
const forbiddenJoinClausePattern = /\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s+JOIN\s+\S+/i;

const containsSqlFragments = (gate: BusinessSqlRenderabilityGate): boolean =>
  allStrings(gate).some(
    (value) =>
      forbiddenSqlClausePattern.test(value) ||
      forbiddenJoinClausePattern.test(value),
  );

const ordersRelationships = [
  relationship("relationship:customers-orders", "customers", "orders", "ready"),
];
const deterministicFirst = evaluate("Count orders per customer", ordersRelationships);
const deterministicSecond = evaluate("Count orders per customer", ordersRelationships);

export const BUSINESS_SQL_RENDERABILITY_GATE_FIXTURES: Fixture[] = [
  {
    name: "leased units per property with accepted and ready relationships is renderable",
    gate: evaluate("How many units in each property are leased to current tenants?", [
      relationship("relationship:properties-units", "properties", "units", "accepted"),
      relationship("relationship:units-leases", "units", "leases", "ready"),
    ]),
    assert: readyFailures,
  },
  {
    name: "orders per customer with a ready relationship is renderable",
    gate: deterministicFirst,
    assert: readyFailures,
  },
  {
    name: "tickets per account with an accepted relationship is renderable",
    gate: evaluate("Count tickets per account", [
      relationship("relationship:accounts-tickets", "accounts", "tickets"),
    ]),
    assert: readyFailures,
  },
  {
    name: "supported no-join plan is renderable",
    gate: evaluate("Count leases by status"),
    assert: readyFailures,
  },
  {
    name: "unknown relationship returns needs review",
    gate: evaluate("Count orders per customer", [
      relationship("relationship:unknown", "customers", "orders", "unknown"),
    ]),
    assert: (gate) =>
      gate.status === "needs_review" &&
      !gate.renderable &&
      gate.reasonCodes.includes("join_resolution_needs_review")
        ? []
        : ["Expected needs-review renderability for unknown relationship."],
  },
  {
    name: "missing relationship returns blocked",
    gate: evaluate("Count orders per customer", [
      relationship("relationship:missing", "customers", "orders", "missing"),
    ]),
    assert: (gate) =>
      gate.status === "blocked" &&
      !gate.renderable &&
      gate.reasonCodes.includes("join_resolution_blocked")
        ? []
        : ["Expected blocked renderability for missing relationship."],
  },
  {
    name: "rejected relationship does not become renderable",
    gate: evaluate("Count orders per customer", [
      relationship("relationship:rejected", "customers", "orders", "rejected"),
    ]),
    assert: (gate) =>
      gate.status !== "renderable" && !gate.renderable
        ? []
        : ["Rejected relationship must not become renderable."],
  },
  {
    name: "already-blocked plan remains blocked and not renderable",
    gate: evaluateBusinessSqlRenderability({
      integrated: attachBusinessSqlJoinResolutionToPlan({
        plan: createBlockedBusinessSqlQueryPlan("Planner could not resolve the request."),
        relationships: [
          relationship("relationship:customers-orders", "customers", "orders", "accepted"),
        ],
      }),
    }),
    assert: (gate) =>
      gate.status === "blocked" &&
      !gate.renderable &&
      gate.reasonCodes.includes("base_plan_blocked")
        ? []
        : ["Expected blocked base plan to remain non-renderable."],
  },
  {
    name: "unsupported prompt is not renderable",
    gate: evaluate("Show me something interesting about the workbook"),
    assert: (gate) =>
      gate.status === "needs_review" &&
      !gate.renderable &&
      gate.reasonCodes.includes("metric_missing")
        ? []
        : ["Unsupported prompt must remain non-renderable."],
  },
  {
    name: "output contains no SQL text or SQL fragments",
    gate: deterministicFirst,
    assert: (gate) =>
      !containsSqlFragments(gate) && gate.sqlGenerated === false
        ? []
        : ["Renderability metadata must not contain SQL text or fragments."],
  },
  {
    name: "same input produces the same renderability summary",
    gate: deterministicFirst,
    assert: () =>
      deterministicFirst.summary === deterministicSecond.summary
        ? []
        : ["Expected deterministic renderability summary."],
  },
];

export function runBusinessSqlRenderabilityGateFixtures() {
  const results = BUSINESS_SQL_RENDERABILITY_GATE_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert(fixture.gate);
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: fixture.gate.summary,
      failureReasons,
    };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
