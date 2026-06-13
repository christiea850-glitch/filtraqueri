/**
 * T-13C/T-13D — Deterministic Business SQL planner acceptance fixtures.
 *
 * Pure fixture runner only. No SQL generation, SQL rendering, editor insertion,
 * provider calls, backend calls, or query execution.
 */

import type { AcceptedRelationshipContract } from "../../../workbook";
import { planBusinessSqlQueryRequest } from "../businessSqlQueryPlanner";
import {
  summarizeBusinessSqlQueryPlan,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";

type BusinessSqlQueryPlannerFixture = {
  name: string;
  plan: BusinessSqlQueryPlan;
  assert: (plan: BusinessSqlQueryPlan) => string[];
};

type BusinessSqlQueryPlannerFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type BusinessSqlQueryPlannerFixtureReport = {
  results: BusinessSqlQueryPlannerFixtureResult[];
  passed: BusinessSqlQueryPlannerFixtureResult[];
  failed: BusinessSqlQueryPlannerFixtureResult[];
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

const fixtures: BusinessSqlQueryPlannerFixture[] = [
  {
    name: "leased units per property plans distinct units and required joins",
    plan: planBusinessSqlQueryRequest({
      prompt: "How many units in each property are leased to current tenants?",
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.kind !== "multi_table_count_grouping") failures.push("Expected multi-table grouping.");
      if (plan.metric?.kind !== "count_distinct" || plan.metric.entity !== "units") {
        failures.push("Expected distinct-unit metric.");
      }
      if (plan.groupings[0]?.entity !== "properties") failures.push("Expected property grouping.");
      if (plan.groupings.some((grouping) => grouping.field === "lease_status")) {
        failures.push("Must not degrade into leases by status.");
      }
      if (plan.joinPath.status !== "needs_review") failures.push("Expected review join path.");
      if (plan.renderer.sql) failures.push("Planner must not generate SQL.");
      return failures;
    },
  },
  {
    name: "leases by status remains a single-table status grouping",
    plan: planBusinessSqlQueryRequest({ prompt: "Count leases by status" }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.kind !== "single_table_count_grouping") failures.push("Expected single-table grouping.");
      if (plan.metric?.entity !== "leases") failures.push("Expected lease metric.");
      if (plan.groupings[0]?.field !== "lease_status") failures.push("Expected lease_status grouping.");
      if (plan.joinPath.required) failures.push("Expected no required join path.");
      return failures;
    },
  },
  {
    name: "orders per customer resolves from accepted relationship metadata",
    plan: planBusinessSqlQueryRequest({
      prompt: "How many orders per customer?",
      acceptedRelationshipContracts: [
        acceptedContract("customers", "customer_id", "orders", "customer_id"),
      ],
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.metric?.entity !== "orders") failures.push("Expected order metric.");
      if (plan.groupings[0]?.entity !== "customers") failures.push("Expected customer grouping.");
      if (plan.joinPath.status !== "resolved") failures.push("Expected resolved join path.");
      if (plan.support !== "supported") failures.push("Expected supported plan.");
      return failures;
    },
  },
  {
    name: "tickets per account remains review-only without relationship metadata",
    plan: planBusinessSqlQueryRequest({ prompt: "Count tickets per account" }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.metric?.entity !== "tickets") failures.push("Expected ticket metric.");
      if (plan.groupings[0]?.entity !== "accounts") failures.push("Expected account grouping.");
      if (plan.joinPath.status !== "needs_review") failures.push("Expected review join path.");
      return failures;
    },
  },
  {
    name: "explicit missing relationship blocks multi-table planning",
    plan: planBusinessSqlQueryRequest({
      prompt: "Count orders per customer",
      missingRelationships: [{ fromEntity: "customers", toEntity: "orders" }],
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.support !== "blocked") failures.push("Expected blocked support.");
      if (plan.joinPath.status !== "missing") failures.push("Expected missing join path.");
      if (plan.renderer.status !== "blocked") failures.push("Expected blocked renderer.");
      return failures;
    },
  },
  {
    name: "selected dialect remains guidance metadata only",
    plan: planBusinessSqlQueryRequest({
      prompt: "Count leases by status",
      selectedGuidanceDialect: "oracle",
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.renderer.targetDialect !== "duckdb") failures.push("Expected DuckDB renderer target.");
      if (plan.renderer.selectedGuidanceDialect !== "oracle") {
        failures.push("Expected selected dialect guidance metadata.");
      }
      if (plan.renderer.sql) failures.push("Planner must not generate SQL.");
      return failures;
    },
  },
  {
    name: "unsupported prompt returns needs-review without selecting a fake metric",
    plan: planBusinessSqlQueryRequest({
      prompt: "Show me something interesting about the workbook",
    }),
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.support !== "needs_review") failures.push("Expected needs_review support.");
      if (plan.metric !== null) failures.push("Expected no deterministic metric.");
      if (!plan.warnings.some((warning) => warning.id === "unsupported-business-request")) {
        failures.push("Expected unsupported request warning.");
      }
      return failures;
    },
  },
];

export function runBusinessSqlQueryPlannerFixtures(): BusinessSqlQueryPlannerFixtureReport {
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
