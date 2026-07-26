/** T-13F — deterministic Business SQL plan-readiness fixtures. */

import type { BusinessSqlRelationshipMetadata } from "../businessSqlJoinPathResolver";
import { evaluateBusinessSqlPlanReadiness } from "../businessSqlPlanReadiness";
import {
  attachBusinessSqlJoinResolutionToPlan,
  planBusinessSqlQueryRequestWithJoinResolution,
} from "../businessSqlQueryPlanJoinResolution";
import {
  createBlockedBusinessSqlQueryPlan,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlMeasure,
} from "../businessSqlQueryPlan";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";

type Readiness = ReturnType<typeof evaluateBusinessSqlPlanReadiness>;
type Fixture = {
  name: string;
  readiness: Readiness;
  assert: (readiness: Readiness) => string[];
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
): Readiness =>
  evaluateBusinessSqlPlanReadiness(
    planBusinessSqlQueryRequestWithJoinResolution({ prompt, relationships }),
  );

const readyFailures = (readiness: Readiness): string[] => {
  const failures: string[] = [];
  if (readiness.status !== "ready") failures.push("Expected ready status.");
  if (!readiness.rendererEligibility.eligible) failures.push("Expected renderer eligibility.");
  if (readiness.rendererEligibility.targetDialect !== "duckdb") {
    failures.push("Expected DuckDB metadata target.");
  }
  return failures;
};

const ordersRelationships = [
  relationship("relationship:customers-orders", "customers", "orders", "ready"),
];
const deterministicFirst = evaluate("Count orders per customer", ordersRelationships);
const deterministicSecond = evaluate("Count orders per customer", ordersRelationships);

const structurallyValidMultiMeasurePlan = (() => {
  const firstMeasure: BusinessSqlMeasure = {
    measureId: "business-sql-measure:orders:amount:sum",
    kind: "sum",
    entity: "orders",
    table: "orders",
    field: "amount",
    fieldInferredType: "numeric",
    distinct: false,
    label: "Total amount",
    sqlAlias: "total_amount",
  };
  const secondMeasure: BusinessSqlMeasure = {
    ...firstMeasure,
    measureId: "business-sql-measure:orders:amount:average",
    kind: "average",
    label: "Average amount",
    sqlAlias: "average_amount",
  };

  return {
    ...createEmptyBusinessSqlQueryPlan(),
    id: "business-sql-plan:multi-measure-contract",
    status: "resolved" as const,
    support: "supported" as const,
    entities: [{ entity: "orders", table: "orders", required: true, role: "source" as const }],
    metric: null,
    measures: [firstMeasure, secondMeasure],
  };
})();

export const BUSINESS_SQL_PLAN_READINESS_FIXTURES: Fixture[] = [
  {
    name: "leased units per property is ready with accepted and ready relationships",
    readiness: evaluate("How many units in each property are leased to current tenants?", [
      relationship("relationship:properties-units", "properties", "units", "accepted"),
      relationship("relationship:units-leases", "units", "leases", "ready"),
    ]),
    assert: readyFailures,
  },
  {
    name: "orders per customer is ready with a ready relationship",
    readiness: deterministicFirst,
    assert: readyFailures,
  },
  {
    name: "tickets per account is ready with an accepted relationship",
    readiness: evaluate("Count tickets per account", [
      relationship("relationship:accounts-tickets", "accounts", "tickets"),
    ]),
    assert: readyFailures,
  },
  {
    name: "supported no-join plan is ready",
    readiness: evaluate("Count leases by status"),
    assert: readyFailures,
  },
  {
    name: "unknown relationship needs review",
    readiness: evaluate("Count orders per customer", [
      relationship("relationship:unknown", "customers", "orders", "unknown"),
    ]),
    assert: (readiness) =>
      readiness.status === "needs_review" &&
      readiness.reasonCodes.includes("join_resolution_needs_review") &&
      !readiness.rendererEligibility.eligible
        ? []
        : ["Expected review-only readiness."],
  },
  {
    name: "missing relationship blocks readiness",
    readiness: evaluate("Count orders per customer", [
      relationship("relationship:missing", "customers", "orders", "missing"),
    ]),
    assert: (readiness) =>
      readiness.status === "blocked" && readiness.blockingReasons.length > 0
        ? []
        : ["Expected blocked missing relationship."],
  },
  {
    name: "rejected relationship is not renderer eligible",
    readiness: evaluate("Count orders per customer", [
      relationship("relationship:rejected", "customers", "orders", "rejected"),
    ]),
    assert: (readiness) =>
      readiness.status !== "ready" && !readiness.rendererEligibility.eligible
        ? []
        : ["Rejected relationship must not be ready."],
  },
  {
    name: "already-blocked base plan remains blocked",
    readiness: evaluateBusinessSqlPlanReadiness(
      attachBusinessSqlJoinResolutionToPlan({
        plan: createBlockedBusinessSqlQueryPlan("Planner could not resolve the request."),
      }),
    ),
    assert: (readiness) =>
      readiness.status === "blocked" && readiness.reasonCodes.includes("base_plan_blocked")
        ? []
        : ["Expected blocked base-plan reason."],
  },
  {
    name: "unsupported prompt remains review-only with warning metadata",
    readiness: evaluate("Show me something interesting about the workbook"),
    assert: (readiness) =>
      readiness.status === "needs_review" &&
      readiness.warnings.length > 0 &&
      readiness.reasonCodes.includes("metric_missing")
        ? []
        : ["Expected unsupported prompt review metadata."],
  },
  {
    name: "same input produces the same readiness summary",
    readiness: deterministicFirst,
    assert: () =>
      deterministicFirst.summary === deterministicSecond.summary
        ? []
        : ["Expected deterministic readiness summary."],
  },
  {
    name: "multiple measures can be structurally valid while renderer is incapable",
    readiness: evaluateBusinessSqlPlanReadiness(
      attachBusinessSqlJoinResolutionToPlan({ plan: structurallyValidMultiMeasurePlan }),
    ),
    assert: (readiness) => {
      const capability = evaluateBusinessSqlRendererCapability(structurallyValidMultiMeasurePlan);
      return [
        ...(readiness.status === "ready" &&
        !readiness.reasonCodes.includes("measure_field_type_incompatible")
          ? []
          : ["Expected structurally valid multi-measure readiness."]),
        ...(capability.status === "incapable" &&
        capability.reasonCodes.includes("multiple_measures_not_supported")
          ? []
          : ["Expected renderer capability to reject multiple measures."]),
        ...((readiness.reasonCodes as string[]).includes("multiple_measures_not_supported")
          ? ["Structural readiness must not contain multiple_measures_not_supported."]
          : []),
      ];
    },
  },
];

export function runBusinessSqlPlanReadinessFixtures() {
  const results = BUSINESS_SQL_PLAN_READINESS_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert(fixture.readiness);
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: fixture.readiness.summary,
      failureReasons,
    };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
