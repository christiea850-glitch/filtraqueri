/** T-13E — deterministic plan + join-resolution integration fixtures. */

import {
  attachBusinessSqlJoinResolutionToPlan,
  planBusinessSqlQueryRequestWithJoinResolution,
  type BusinessSqlQueryPlanJoinResolution,
} from "../businessSqlQueryPlanJoinResolution";
import type { BusinessSqlRelationshipMetadata } from "../businessSqlJoinPathResolver";
import { planBusinessSqlQueryRequest } from "../businessSqlQueryPlanner";
import { createBlockedBusinessSqlQueryPlan } from "../businessSqlQueryPlan";

type Fixture = {
  name: string;
  result: BusinessSqlQueryPlanJoinResolution;
  assert: (result: BusinessSqlQueryPlanJoinResolution) => string[];
};

const relationship = (
  id: string,
  fromEntity: string,
  toEntity: string,
  status: BusinessSqlRelationshipMetadata["status"] = "accepted",
): BusinessSqlRelationshipMetadata => ({ id, fromEntity, toEntity, status });

const expectReady = (result: BusinessSqlQueryPlanJoinResolution): string[] => {
  const failures: string[] = [];
  if (result.readiness !== "ready") failures.push("Expected ready integration.");
  if (result.support !== "supported") failures.push("Expected supported integration.");
  return failures;
};

const ordersRelationships = [
  relationship("relationship:customers-orders", "customers", "orders", "ready"),
];

const originalPlan = planBusinessSqlQueryRequest({ prompt: "Count orders per customer" });
const originalPlanSnapshot = JSON.stringify(originalPlan);
const immutableResult = attachBusinessSqlJoinResolutionToPlan({
  plan: originalPlan,
  relationships: ordersRelationships,
});

const deterministicInput = {
  prompt: "Count orders per customer",
  relationships: ordersRelationships,
} as const;
const deterministicFirst = planBusinessSqlQueryRequestWithJoinResolution(deterministicInput);
const deterministicSecond = planBusinessSqlQueryRequestWithJoinResolution(deterministicInput);

export const BUSINESS_SQL_QUERY_PLAN_JOIN_RESOLUTION_FIXTURES: Fixture[] = [
  {
    name: "leased units per property is ready with accepted and ready relationships",
    result: planBusinessSqlQueryRequestWithJoinResolution({
      prompt: "How many units in each property are leased to current tenants?",
      relationships: [
        relationship("relationship:properties-units", "properties", "units", "accepted"),
        relationship("relationship:units-leases", "units", "leases", "ready"),
      ],
    }),
    assert: (result) => [
      ...expectReady(result),
      ...(result.resolvedJoinPaths.length === 2 ? [] : ["Expected two resolved joins."]),
    ],
  },
  {
    name: "orders per customer is ready with a ready relationship",
    result: planBusinessSqlQueryRequestWithJoinResolution(deterministicInput),
    assert: expectReady,
  },
  {
    name: "tickets per account is ready with an accepted relationship",
    result: planBusinessSqlQueryRequestWithJoinResolution({
      prompt: "Count tickets per account",
      relationships: [relationship("relationship:accounts-tickets", "accounts", "tickets")],
    }),
    assert: expectReady,
  },
  {
    name: "single-table plan has ready no-op join resolution",
    result: planBusinessSqlQueryRequestWithJoinResolution({ prompt: "Count leases by status" }),
    assert: (result) => [
      ...expectReady(result),
      ...(result.resolvedJoinPaths.length === 0 ? [] : ["Expected no resolved joins."]),
    ],
  },
  {
    name: "unknown relationship keeps integration in review",
    result: planBusinessSqlQueryRequestWithJoinResolution({
      prompt: "Count orders per customer",
      relationships: [relationship("relationship:unknown", "customers", "orders", "unknown")],
    }),
    assert: (result) =>
      result.readiness === "needs_review" && result.unresolvedJoinRequirements.length === 1
        ? []
        : ["Expected one review-only join requirement."],
  },
  {
    name: "missing relationship blocks integration",
    result: planBusinessSqlQueryRequestWithJoinResolution({
      prompt: "Count orders per customer",
      relationships: [relationship("relationship:missing", "customers", "orders", "missing")],
    }),
    assert: (result) =>
      result.readiness === "blocked" && result.blockedJoinRequirements.length === 1
        ? []
        : ["Expected blocked missing relationship."],
  },
  {
    name: "rejected relationship is ignored when an accepted alternative exists",
    result: planBusinessSqlQueryRequestWithJoinResolution({
      prompt: "Count orders per customer",
      relationships: [
        relationship("relationship:a-rejected", "customers", "orders", "rejected"),
        relationship("relationship:b-accepted", "customers", "orders", "accepted"),
      ],
    }),
    assert: (result) => [
      ...expectReady(result),
      ...(result.joinResolution.relationshipIds[0] === "relationship:b-accepted"
        ? []
        : ["Expected accepted alternative to be used."]),
    ],
  },
  {
    name: "already-blocked planner result remains blocked",
    result: attachBusinessSqlJoinResolutionToPlan({
      plan: createBlockedBusinessSqlQueryPlan("Planner could not resolve the request."),
      relationships: ordersRelationships,
    }),
    assert: (result) =>
      result.readiness === "blocked" && result.support === "blocked"
        ? []
        : ["Blocked planner result must not be upgraded."],
  },
  {
    name: "same input produces the same integration summary",
    result: deterministicFirst,
    assert: () =>
      deterministicFirst.summary === deterministicSecond.summary
        ? []
        : ["Expected deterministic integration summary."],
  },
  {
    name: "integration does not mutate the original plan",
    result: immutableResult,
    assert: () =>
      JSON.stringify(originalPlan) === originalPlanSnapshot
        ? []
        : ["Original plan was mutated."],
  },
];

export function runBusinessSqlQueryPlanJoinResolutionFixtures() {
  const results = BUSINESS_SQL_QUERY_PLAN_JOIN_RESOLUTION_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert(fixture.result);
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: fixture.result.summary,
      failureReasons,
    };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
