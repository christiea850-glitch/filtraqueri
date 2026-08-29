/**
 * T-13D — Join Path Resolver acceptance fixtures.
 *
 * Pure fixture runner only. This does not render SQL, insert SQL into Monaco,
 * execute queries, call providers, or mutate app state.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import {
  resolveBusinessSqlJoinPath,
  resolveBusinessSqlJoinPaths,
  type BusinessSqlRelationshipMetadata,
} from "../businessSqlJoinPathResolver";
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

const alreadyBlockedOrdersPerCustomerPlan: BusinessSqlQueryPlan = {
  ...ordersPerCustomerBasePlan,
  status: "blocked",
  support: "blocked",
  renderer: {
    ...ordersPerCustomerBasePlan.renderer,
    status: "blocked",
  },
  warnings: [
    ...ordersPerCustomerBasePlan.warnings,
    {
      id: "base-plan-blocked",
      severity: "blocking",
      message: "Planner blocked this request before join resolution.",
    },
  ],
};

const resolutionFixture = (
  name: string,
  resolution: ReturnType<typeof resolveBusinessSqlJoinPaths>,
  assertResolution: (resolution: ReturnType<typeof resolveBusinessSqlJoinPaths>) => string[],
): JoinPathResolverFixture => ({
  name,
  plan: ordersPerCustomerBasePlan,
  assert: () => assertResolution(resolution),
});

const metadata = (
  id: string,
  fromEntity: string,
  toEntity: string,
  status: BusinessSqlRelationshipMetadata["status"],
): BusinessSqlRelationshipMetadata => ({ id, fromEntity, toEntity, status });

export const BUSINESS_SQL_JOIN_PATH_RESOLVER_FIXTURES: JoinPathResolverFixture[] = [
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
    name: "accepted relationship resolves orders per customer",
    plan: planBusinessSqlQueryRequest({
      prompt: "Count orders per customer",
      acceptedRelationshipContracts: [
        relationshipContract(
          "contract:customers-orders",
          "customers",
          "customer_id",
          "orders",
          "customer_id",
        ),
      ],
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.joinPath.status !== "resolved") failures.push("Expected resolved join path.");
      if (plan.joinPath.edges[0]?.relationship !== "customer has orders") {
        failures.push("Expected the planner relationship label to be retained.");
      }
      if (
        plan.joinPath.edges[0]?.relationshipAuthority?.relationshipId !==
        "candidate:contract:customers-orders"
      ) {
        failures.push("Expected authoritative relationship ID to come from acceptedFromCandidateId.");
      }
      if (
        plan.joinPath.edges[0]?.relationshipAuthority?.contractId !==
        "contract:customers-orders"
      ) {
        failures.push("Expected authoritative contract ID to be preserved.");
      }
      return failures;
    },
  },
  {
    name: "ready relationship resolves tickets per account",
    plan: planBusinessSqlQueryRequest({
      prompt: "Count tickets per account",
      readyRelationshipContracts: [
        relationshipContract(
          "contract:accounts-tickets",
          "accounts",
          "account_id",
          "tickets",
          "account_id",
        ),
      ],
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.support !== "supported") failures.push("Expected supported plan.");
      if (!plan.joinPath.edges[0]?.verified) failures.push("Expected verified join edge.");
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
    name: "already-blocked plan cannot be upgraded by accepted relationships",
    plan: resolveBusinessSqlJoinPath({
      plan: alreadyBlockedOrdersPerCustomerPlan,
      acceptedRelationshipContracts: [
        relationshipContract(
          "contract:customers-orders",
          "customers",
          "customer_id",
          "orders",
          "customer_id",
        ),
      ],
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.status !== "blocked") failures.push("Expected blocked plan status.");
      if (plan.support !== "blocked") failures.push("Expected blocked support.");
      if (plan.joinPath.status === "resolved") failures.push("Blocked plan must not resolve joins.");
      if (plan.joinPath.edges.some((edge) => edge.verified)) {
        failures.push("Blocked plan must not contain verified join evidence.");
      }
      if (plan.joinPath.requirements.some((requirement) => requirement.verified)) {
        failures.push("Blocked plan must not contain verified join requirements.");
      }
      if (!plan.warnings.some((warning) => warning.id === "base-plan-already-blocked")) {
        failures.push("Expected base-plan blocked warning.");
      }
      if (plan.renderer.status !== "blocked") failures.push("Expected blocked renderer.");
      if (plan.renderer.sql) failures.push("Blocked resolver must not attach SQL text.");
      return failures;
    },
  },
  {
    name: "rejected relationship blocks when no eligible alternative exists",
    plan: ordersPerCustomerBasePlan,
    assert: () => {
      const failures: string[] = [];
      const resolution = resolveBusinessSqlJoinPaths({
        requirements: ordersPerCustomerBasePlan.joinPath.requirements,
        relationships: [metadata("relationship:rejected", "customers", "orders", "rejected")],
      });
      if (resolution.status !== "blocked") failures.push("Expected blocked resolution.");
      if (resolution.blocked[0]?.reason !== "rejected_relationship") {
        failures.push("Expected rejected relationship reason.");
      }
      return failures;
    },
  },
  resolutionFixture(
    "multiple eligible candidates use stable relationship ID ordering",
    resolveBusinessSqlJoinPaths({
      requirements: ordersPerCustomerBasePlan.joinPath.requirements,
      relationships: [
        metadata("relationship:z", "customers", "orders", "accepted"),
        metadata("relationship:a", "customers", "orders", "ready"),
      ],
    }),
    (resolution) =>
      resolution.relationshipIds[0] === "relationship:a"
        ? []
        : ["Expected lexically first stable relationship ID."],
  ),
  resolutionFixture(
    "no join requirement returns ready no-op resolution",
    resolveBusinessSqlJoinPaths({ requirements: [] }),
    (resolution) => {
      const failures: string[] = [];
      if (resolution.status !== "ready") failures.push("Expected ready resolution.");
      if (resolution.resolved.length || resolution.unresolved.length || resolution.blocked.length) {
        failures.push("Expected empty no-op resolution metadata.");
      }
      return failures;
    },
  ),
];

export function runBusinessSqlJoinPathResolverFixtures(): JoinPathResolverFixtureReport {
  const results = BUSINESS_SQL_JOIN_PATH_RESOLVER_FIXTURES.map((fixture) => {
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
