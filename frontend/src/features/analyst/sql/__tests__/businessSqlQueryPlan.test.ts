/**
 * T-13B — Business SQL Query Plan contract acceptance fixtures.
 *
 * This file intentionally exercises only deterministic plan shapes. It does
 * not plan from prompts, render SQL, execute SQL, call providers, or mutate
 * application state. The project currently uses lightweight fixture runners
 * for SQL acceptance coverage, so this module exports data plus a pure runner.
 */

import {
  createBlockedBusinessSqlQueryPlan,
  createEmptyBusinessSqlQueryPlan,
  isBusinessSqlQueryPlanRenderable,
  isBusinessSqlQueryPlanSupported,
  summarizeBusinessSqlQueryPlan,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";

type BusinessSqlQueryPlanFixture = {
  name: string;
  plan: BusinessSqlQueryPlan;
  assert: (plan: BusinessSqlQueryPlan) => string[];
};

type BusinessSqlQueryPlanFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type BusinessSqlQueryPlanFixtureReport = {
  results: BusinessSqlQueryPlanFixtureResult[];
  passed: BusinessSqlQueryPlanFixtureResult[];
  failed: BusinessSqlQueryPlanFixtureResult[];
};

const leasedUnitsPerPropertyPlan: BusinessSqlQueryPlan = {
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:leased-units-per-property",
  kind: "multi_table_count_grouping",
  status: "resolved",
  support: "needs_review",
  prompt: "How many units in each property are leased to current tenants?",
  entities: [
    { entity: "properties", table: "properties", required: true, role: "grouping_subject" },
    { entity: "units", table: "units", field: "unit_id", required: true, role: "metric_subject" },
    { entity: "leases", table: "leases", required: true, role: "filter_subject" },
    { entity: "tenants", table: "tenants", required: false, role: "context" },
  ],
  metric: {
    kind: "count_distinct",
    entity: "units",
    table: "units",
    field: "unit_id",
    distinct: true,
    label: "count distinct units",
  },
  groupings: [
    {
      entity: "properties",
      table: "properties",
      field: "property_id",
      label: "property",
    },
  ],
  filters: [
    {
      kind: "relationship_predicate",
      entity: "leases",
      table: "leases",
      predicate: "active_current_lease or leased_to_tenants",
      label: "leased to current tenants",
    },
  ],
  joinPath: {
    required: true,
    status: "needs_review",
    entities: ["properties", "units", "leases"],
    requirements: [
      {
        fromEntity: "properties",
        toEntity: "units",
        required: true,
        relationship: "property has units",
        verified: false,
      },
      {
        fromEntity: "units",
        toEntity: "leases",
        required: true,
        relationship: "unit has leases",
        verified: false,
      },
    ],
    edges: [
      {
        fromEntity: "properties",
        fromTable: "properties",
        fromField: "property_id",
        toEntity: "units",
        toTable: "units",
        toField: "property_id",
        relationship: "property has units",
        verified: false,
      },
      {
        fromEntity: "units",
        fromTable: "units",
        fromField: "unit_id",
        toEntity: "leases",
        toTable: "leases",
        toField: "unit_id",
        relationship: "unit has leases",
        verified: false,
      },
    ],
  },
  assumptions: [
    {
      id: "current-lease-semantics",
      label: "Current lease semantics",
      detail: "A current tenant means an active lease or a lease date range containing today.",
    },
  ],
  warnings: [
    {
      id: "join-path-needs-review",
      severity: "warning",
      message: "Join path properties → units → leases must be verified before SQL rendering.",
    },
  ],
  renderer: {
    targetDialect: "duckdb",
    status: "not_rendered",
    notes: ["Contract fixture only; no SQL is rendered."],
  },
  preview: {
    title: "Leased units per property",
    metricSummary: "Count distinct units, not leases.",
    groupingSummary: "Grouped by property.",
    filterSummary: "Only active/current leased-to-tenant semantics qualify.",
    joinSummary: "Requires properties → units → leases.",
    rendererSummary: "SQL has not been rendered.",
  },
};

const countLeasesByStatusPlan: BusinessSqlQueryPlan = {
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:leases-by-status",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  prompt: "Count leases by status",
  entities: [
    { entity: "leases", table: "leases", required: true, role: "source" },
  ],
  metric: {
    kind: "count_entities",
    entity: "leases",
    table: "leases",
    distinct: false,
    label: "count leases",
  },
  groupings: [
    {
      entity: "leases",
      table: "leases",
      field: "lease_status",
      label: "lease_status",
    },
  ],
  renderer: {
    targetDialect: "duckdb",
    status: "not_rendered",
    notes: ["Contract fixture only; no SQL is rendered."],
  },
  preview: {
    title: "Leases by status",
    metricSummary: "Count lease records.",
    groupingSummary: "Grouped by lease_status.",
    filterSummary: "No active/current filter is implied.",
    joinSummary: "No join path required.",
    rendererSummary: "SQL has not been rendered.",
  },
};

const ordersPerCustomerPlan: BusinessSqlQueryPlan = {
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:orders-per-customer",
  kind: "multi_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [
    { entity: "customers", table: "customers", required: true, role: "grouping_subject" },
    { entity: "orders", table: "orders", required: true, role: "metric_subject" },
  ],
  metric: {
    kind: "count_entities",
    entity: "orders",
    table: "orders",
    distinct: false,
    label: "count orders",
  },
  groupings: [
    { entity: "customers", table: "customers", field: "customer_id", label: "customer" },
  ],
  joinPath: {
    required: true,
    status: "resolved",
    entities: ["customers", "orders"],
    requirements: [
      {
        fromEntity: "customers",
        toEntity: "orders",
        required: true,
        relationship: "customer has orders",
        verified: true,
      },
    ],
    edges: [
      {
        fromEntity: "customers",
        fromTable: "customers",
        fromField: "customer_id",
        toEntity: "orders",
        toTable: "orders",
        toField: "customer_id",
        relationship: "customer has orders",
        verified: true,
      },
    ],
  },
};

const ticketsPerAccountPlan: BusinessSqlQueryPlan = {
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:tickets-per-account",
  kind: "multi_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [
    { entity: "accounts", table: "accounts", required: true, role: "grouping_subject" },
    { entity: "tickets", table: "tickets", required: true, role: "metric_subject" },
  ],
  metric: {
    kind: "count_entities",
    entity: "tickets",
    table: "tickets",
    distinct: false,
    label: "count tickets",
  },
  groupings: [
    { entity: "accounts", table: "accounts", field: "account_id", label: "account" },
  ],
  joinPath: {
    required: true,
    status: "resolved",
    entities: ["accounts", "tickets"],
    requirements: [
      {
        fromEntity: "accounts",
        toEntity: "tickets",
        required: true,
        relationship: "account has tickets",
        verified: true,
      },
    ],
    edges: [
      {
        fromEntity: "accounts",
        fromTable: "accounts",
        fromField: "account_id",
        toEntity: "tickets",
        toTable: "tickets",
        toField: "account_id",
        relationship: "account has tickets",
        verified: true,
      },
    ],
  },
};

const blockedMissingRelationshipPlan = createBlockedBusinessSqlQueryPlan(
  "Missing required join path between invoices and vendors.",
);

const dialectMetadataPlan: BusinessSqlQueryPlan = {
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:dialect-metadata",
  renderer: {
    targetDialect: "duckdb",
    selectedGuidanceDialect: "oracle",
    status: "not_rendered",
    notes: [
      "DuckDB remains the execution target for uploaded datasets.",
      "Oracle is recorded only as selected guidance dialect metadata.",
    ],
  },
};

const includesAll = (actual: string[], expected: string[]): boolean =>
  expected.every((value) => actual.includes(value));

export const BUSINESS_SQL_QUERY_PLAN_FIXTURES: BusinessSqlQueryPlanFixture[] = [
  {
    name: "leased units per property is a distinct-unit multi-table grouped plan",
    plan: leasedUnitsPerPropertyPlan,
    assert: (plan) => {
      const failures: string[] = [];
      const requiredEntities = plan.entities
        .filter((entity) => entity.required)
        .map((entity) => entity.entity);
      const optionalEntities = plan.entities
        .filter((entity) => !entity.required)
        .map((entity) => entity.entity);

      if (plan.kind !== "multi_table_count_grouping") failures.push("Expected multi_table_count_grouping.");
      if (plan.metric?.kind !== "count_distinct" || plan.metric.entity !== "units") {
        failures.push("Expected metric to count distinct units.");
      }
      if (plan.groupings[0]?.entity !== "properties") failures.push("Expected grouping by property.");
      if (!includesAll(requiredEntities, ["properties", "units", "leases"])) {
        failures.push("Expected required entities properties, units, and leases.");
      }
      if (!optionalEntities.includes("tenants")) failures.push("Expected tenants to be optional context.");
      if (!plan.filters.some((filter) => filter.predicate?.includes("active_current_lease"))) {
        failures.push("Expected active/current lease predicate semantics.");
      }
      if (plan.joinPath.entities.join(" → ") !== "properties → units → leases") {
        failures.push("Expected join path properties → units → leases.");
      }
      if (plan.renderer.status !== "not_rendered") failures.push("Expected SQL to be not_rendered.");
      if (plan.groupings.some((grouping) => grouping.field === "lease_status")) {
        failures.push("Must not be represented as count leases by lease_status.");
      }
      return failures;
    },
  },
  {
    name: "count leases by status remains separate from property unit planning",
    plan: countLeasesByStatusPlan,
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.kind !== "single_table_count_grouping") failures.push("Expected single-table count grouping.");
      if (plan.metric?.entity !== "leases") failures.push("Expected lease-count metric.");
      if (plan.groupings[0]?.field !== "lease_status") failures.push("Expected grouping by lease_status.");
      if (plan.groupings.some((grouping) => grouping.entity === "properties")) {
        failures.push("Did not expect property grouping.");
      }
      if (plan.joinPath.required) failures.push("Did not expect a required property/unit join path.");
      return failures;
    },
  },
  {
    name: "orders per customer can represent customers to orders",
    plan: ordersPerCustomerPlan,
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.metric?.entity !== "orders") failures.push("Expected count orders metric.");
      if (plan.groupings[0]?.entity !== "customers") failures.push("Expected customer grouping.");
      if (plan.joinPath.entities.join(" → ") !== "customers → orders") {
        failures.push("Expected customers → orders join path.");
      }
      return failures;
    },
  },
  {
    name: "tickets per account can represent accounts to tickets",
    plan: ticketsPerAccountPlan,
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.metric?.entity !== "tickets") failures.push("Expected count tickets metric.");
      if (plan.groupings[0]?.entity !== "accounts") failures.push("Expected account grouping.");
      if (plan.joinPath.entities.join(" → ") !== "accounts → tickets") {
        failures.push("Expected accounts → tickets join path.");
      }
      return failures;
    },
  },
  {
    name: "blocked missing relationship is not renderable",
    plan: blockedMissingRelationshipPlan,
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.support !== "blocked") failures.push("Expected blocked support.");
      if (!plan.warnings.some((warning) => warning.message.includes("Missing required join path"))) {
        failures.push("Expected missing required join path warning.");
      }
      if (isBusinessSqlQueryPlanRenderable(plan)) failures.push("Blocked plan must not be renderable.");
      if (plan.renderer.status !== "blocked") failures.push("Expected blocked renderer status.");
      return failures;
    },
  },
  {
    name: "dialect metadata defaults execution target to DuckDB",
    plan: dialectMetadataPlan,
    assert: (plan) => {
      const failures: string[] = [];
      if (plan.renderer.targetDialect !== "duckdb") failures.push("Expected DuckDB renderer target.");
      if (plan.renderer.selectedGuidanceDialect !== "oracle") {
        failures.push("Expected selected guidance dialect metadata to be recorded.");
      }
      if (plan.renderer.status !== "not_rendered") failures.push("Expected no SQL rendering.");
      if (isBusinessSqlQueryPlanRenderable(plan)) failures.push("Not-rendered metadata plan must not imply execution.");
      return failures;
    },
  },
];

export function runBusinessSqlQueryPlanFixtures(): BusinessSqlQueryPlanFixtureReport {
  const results = BUSINESS_SQL_QUERY_PLAN_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert(fixture.plan);
    const summary = summarizeBusinessSqlQueryPlan(fixture.plan);

    if (fixture.plan.support === "supported" && !isBusinessSqlQueryPlanSupported(fixture.plan)) {
      failureReasons.push("Supported helper did not recognize supported plan.");
    }

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
