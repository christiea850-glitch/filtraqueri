/**
 * T-13D — Join Path Resolver acceptance fixtures.
 *
 * Pure fixture runner only. This does not render SQL, insert SQL into Monaco,
 * execute queries, call providers, or mutate app state.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import { resolveBusinessSqlJoinPath } from "../businessSqlJoinPathResolver";
import { planBusinessSqlQueryRequest } from "../businessSqlQueryPlanner";
import {
  summarizeBusinessSqlQueryPlan,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";

type JoinPathResolverFixture = {
  name: string;
  plan: BusinessSqlQueryPlan;
  assert: (plan: BusinessSqlQueryPlan) => string[];
};

type JoinPathResolverFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type JoinPathResolverFixtureReport = {
  results: JoinPathResolverFixtureResult[];
  passed: JoinPathResolverFixtureResult[];
  failed: JoinPathResolverFixtureResult[];
};

const relationshipContract = (
  contractId: string,
  sourceTableName: string,
  sourceColumnName: string,
  targetTableName: string,
  targetColumnName: string,
  overrides: Partial<AcceptedRelationshipContract> = {},
): AcceptedRelationshipContract => ({
  contractId,
  sourceWorksheetId: `worksheet:${sourceTableName}`,
  sourceTableName,
  sourceColumnName,
  targetWorksheetId: `worksheet:${targetTableName}`,
  targetTableName,
  targetColumnName,
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: `candidate:${contractId}`,
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
  ...overrides,
});

const ordersPerCustomerBasePlan = planBusinessSqlQueryRequest({
  prompt: "Count orders per customer",
});

const fixtures: JoinPathResolverFixture[] = [
  {
    name: "accepted relationships resolve leased units per property",
    plan: planBusinessSqlQueryRequest({
      prompt: "How many units in each property are leased to current tenants?",
      acceptedRelationshipContracts: [
        relationshipContract(
          "contract:properties-units",
          "properties",
          "property_id",
          "units",
          "property_id",
        ),
        relationshipContract(
          "contract:units-leases",
          "units",
          "unit_id",
          "leases",
          "unit_id",
        ),
      ],
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.support !== "supported") failures.push("Expected supported plan.");
      if (plan.joinPath.status !== "resolved") failures.push("Expected resolved join path.");
      if (!plan.joinPath.edges.every((edge) => edge.verified)) {
        failures.push("Expected all join edges to be verified.");
      }
      if (plan.renderer.status !== "not_rendered") failures.push("Resolver must not render SQL.");
      if (plan.renderer.sql) failures.push("Resolver must not attach SQL text.");
      return failures;
    },
  },
  {
    name: "unknown relationship keeps required join in review",
    plan: resolveBusinessSqlJoinPath({ plan: ordersPerCustomerBasePlan }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.support !== "needs_review") failures.push("Expected needs_review support.");
      if (plan.joinPath.status !== "needs_review") failures.push("Expected needs_review join path.");
      if (!plan.warnings.some((warning) => warning.id === "join-path-needs-review")) {
        failures.push("Expected join review warning.");
      }
      return failures;
    },
  },
  {
    name: "explicit missing relationship blocks required join path",
    plan: resolveBusinessSqlJoinPath({
      plan: ordersPerCustomerBasePlan,
      missingRelationships: [{ fromEntity: "customers", toEntity: "orders" }],
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.support !== "blocked") failures.push("Expected blocked support.");
      if (plan.status !== "blocked") failures.push("Expected blocked plan status.");
      if (plan.joinPath.status !== "missing") failures.push("Expected missing join path.");
      if (plan.renderer.status !== "blocked") failures.push("Expected blocked renderer.");
      return failures;
    },
  },
  {
    name: "broken accepted contract does not verify a join",
    plan: resolveBusinessSqlJoinPath({
      plan: ordersPerCustomerBasePlan,
      acceptedRelationshipContracts: [
        relationshipContract(
          "contract:customers-orders-broken",
          "customers",
          "customer_id",
          "orders",
          "customer_id",
          { validationState: "broken" },
        ),
      ],
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.support !== "needs_review") failures.push("Expected needs_review support.");
      if (plan.joinPath.edges.some((edge) => edge.verified)) {
        failures.push("Broken contract must not verify join edges.");
      }
      return failures;
    },
  },
];

export function runBusinessSqlJoinPathResolverFixtures(): JoinPathResolverFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.plan);
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: summarizeBusinessSqlQueryPlan(fixture.plan),
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
