/**
 * T-11C-1 — Business Intent Detection acceptance fixtures.
 *
 * This file is the falsifier for T-11C-1 and the regression net for every
 * later T-11C slice. The project does not currently have a test runner
 * installed (no vitest / jest / mocha in `frontend/package.json`), so the
 * fixtures are exposed as data + a self-contained runner that can be invoked
 * from a future test runner or from a dev console without modification.
 *
 * Conventions
 * -----------
 * - `BUSINESS_INTENT_FIXTURES` is the authoritative acceptance list. Add
 *   prompts here when a new behavior is required.
 * - `runBusinessIntentFixtures()` runs the detector against every fixture
 *   and returns `{ passed, failed, results }`. Any later test runner can
 *   import this module and assert on the totals.
 * - `mustNotInclude` covers categories that must not appear as the primary
 *   OR as alternates. This is what blocks the failing prompt from matching
 *   "lease expiration / move-out watchlist".
 *
 * To run manually from a Node shell (e.g. via tsx):
 *   import { runBusinessIntentFixtures } from "./businessIntentGrounding.test";
 *   const report = runBusinessIntentFixtures();
 *   console.log(`Passed: ${report.passed.length}, Failed: ${report.failed.length}`);
 *   report.results.forEach((r) => console.log(r.ok ? "✓" : "✗", r.prompt));
 *
 * The runner returns structured data; no `process.exit` calls so it is safe
 * to import from any context.
 */

import {
  EMPTY_BUSINESS_INTENT,
  EMPTY_BUSINESS_INTENT_FINGERPRINT,
  describeBusinessIntentAmbiguity,
  detectBusinessIntent,
  fingerprintBusinessIntent,
  type BusinessIntent,
  type BusinessIntentCategory,
} from "../businessIntentGrounding";

export type BusinessIntentFixture = {
  prompt: string;
  expectedPrimary: BusinessIntentCategory | BusinessIntentCategory[];
  mustNotInclude: BusinessIntentCategory[];
  expectedEntitiesSubset?: string[];
  expectedMetricsExact?: string[];
  expectedAnalysisPath?: {
    aggregation: NonNullable<BusinessIntent["analysisPath"]>["aggregation"];
    measureField: string;
    groupingField: string;
    orderDirection: NonNullable<BusinessIntent["analysisPath"]>["orderDirection"];
    rowLimit: number | null;
  };
  expectedTemporal?: boolean;
  description?: string;
};

export type BusinessIntentFixtureResult = {
  prompt: string;
  ok: boolean;
  detected: BusinessIntent;
  failureReasons: string[];
};

export type BusinessIntentFixtureReport = {
  results: BusinessIntentFixtureResult[];
  passed: BusinessIntentFixtureResult[];
  failed: BusinessIntentFixtureResult[];
};

/**
 * Acceptance fixtures from the T-11C-1 spec. Every prompt below MUST keep
 * passing through every later T-11C slice. Adding a new prompt that breaks
 * one of the existing ones means the detector regressed.
 */
export const BUSINESS_INTENT_FIXTURES: BusinessIntentFixture[] = [
  {
    prompt: "Show the five departments with the highest total salary expenditure.",
    expectedPrimary: ["top_bottom", "grouping"],
    mustNotInclude: ["expiration"],
    expectedEntitiesSubset: ["departments", "employees"],
    expectedMetricsExact: ["sum_salary"],
    expectedAnalysisPath: {
      aggregation: "sum",
      measureField: "salary",
      groupingField: "department",
      orderDirection: "descending",
      rowLimit: 5,
    },
    expectedTemporal: false,
    description: "PS-1b approved explicit analysis path for salary expenditure by department.",
  },
  {
    prompt: "Show departments with the lowest total cost.",
    expectedPrimary: ["top_bottom", "grouping"],
    mustNotInclude: ["expiration"],
    expectedEntitiesSubset: ["departments"],
    expectedMetricsExact: ["sum_cost"],
    expectedAnalysisPath: {
      aggregation: "sum",
      measureField: "cost",
      groupingField: "department",
      orderDirection: "ascending",
      rowLimit: null,
    },
    expectedTemporal: false,
    description: "PS-1b generic aggregate path: lowest total cost is SUM(cost) ordered ascending.",
  },
  {
    prompt: "Show departments with the highest total salary.",
    expectedPrimary: ["top_bottom", "grouping"],
    mustNotInclude: ["expiration"],
    expectedEntitiesSubset: ["departments", "employees"],
    expectedMetricsExact: ["sum_salary"],
    expectedAnalysisPath: {
      aggregation: "sum",
      measureField: "salary",
      groupingField: "department",
      orderDirection: "descending",
      rowLimit: null,
    },
    expectedTemporal: false,
    description: "PS-1b aggregate/order split: highest total salary is SUM(salary), not MAX(salary).",
  },
  {
    prompt: "Show departments with the highest average salary.",
    expectedPrimary: ["top_bottom", "grouping"],
    mustNotInclude: ["expiration"],
    expectedEntitiesSubset: ["departments", "employees"],
    expectedMetricsExact: ["average_salary"],
    expectedAnalysisPath: {
      aggregation: "average",
      measureField: "salary",
      groupingField: "department",
      orderDirection: "descending",
      rowLimit: null,
    },
    expectedTemporal: false,
    description: "PS-1b generic aggregate path: highest average salary is AVG(salary) ordered descending.",
  },
  {
    prompt: "find the number of units in properties that are leased to tenants",
    expectedPrimary: "count_grouping",
    mustNotInclude: ["expiration", "renewal"],
    expectedEntitiesSubset: ["units", "properties", "leases", "tenants"],
    expectedTemporal: false,
    description:
      "The reported failing prompt. Must classify as count_grouping; must not match the lease expiration / move-out watchlist family.",
  },
  {
    prompt: "show leases expiring in the next 90 days",
    expectedPrimary: "expiration",
    mustNotInclude: ["count_grouping"],
    expectedEntitiesSubset: ["leases"],
    expectedTemporal: true,
    description: "Temporal expiration prompt — the lease expiration watchlist family should be eligible.",
  },
  {
    prompt: "which properties have vacant units",
    expectedPrimary: ["count_grouping", "filtering"],
    mustNotInclude: ["expiration"],
    expectedEntitiesSubset: ["properties", "units"],
    expectedTemporal: false,
    description: "Either count_grouping or filtering is acceptable; expiration must not fire.",
  },
  {
    prompt: "top 10 tenants by payment volume",
    expectedPrimary: ["top_bottom", "ranking"],
    mustNotInclude: ["expiration"],
    expectedEntitiesSubset: ["tenants"],
    expectedTemporal: false,
    description: "Either top_bottom or ranking is acceptable; expiration must not fire.",
  },
  {
    prompt: "show me missing emails in tenants",
    expectedPrimary: "missing_values",
    mustNotInclude: ["count_grouping", "expiration"],
    expectedEntitiesSubset: ["tenants"],
    expectedTemporal: false,
    description:
      "Missing-values intent. The `in tenants` phrase must not be misinterpreted as a grouping signal.",
  },
  {
    prompt: "preview the leases table",
    expectedPrimary: "preview",
    mustNotInclude: ["expiration", "count_grouping"],
    expectedEntitiesSubset: ["leases"],
    expectedTemporal: false,
    description: "Explicit preview intent. Must not match expiration or count_grouping.",
  },
  {
    prompt:
      "find how current tenants are using their access code and if expired tenants still have access in each unit in the properties to identify security gap",
    expectedPrimary: ["expiration", "risk", "filtering"],
    mustNotInclude: [],
    expectedEntitiesSubset: ["tenants", "access", "codes", "units", "properties"],
    expectedTemporal: true,
    description: "Property/security prompt keeps access vocabulary without dominating other domains.",
  },
  {
    prompt: "which customers have orders but no recent payments",
    expectedPrimary: "filtering",
    mustNotInclude: [],
    expectedEntitiesSubset: ["customers", "orders", "payments"],
    expectedTemporal: true,
    description: "Sales/payment prompt detects customer/order/payment entities and recent-date semantics.",
  },
  {
    prompt: "which products are low stock but still selling fast",
    expectedPrimary: ["risk", "filtering"],
    mustNotInclude: [],
    expectedEntitiesSubset: ["products", "stock"],
    expectedTemporal: false,
    description: "Inventory prompt detects product and stock vocabulary plus condition semantics.",
  },
  {
    prompt: "which accounts have many unresolved tickets",
    expectedPrimary: "filtering",
    mustNotInclude: [],
    expectedEntitiesSubset: ["accounts", "tickets"],
    expectedTemporal: false,
    description: "Support prompt detects account/ticket vocabulary and unresolved status semantics.",
  },
  {
    prompt: "which invoices are overdue by customer and payment status",
    expectedPrimary: ["risk", "filtering"],
    mustNotInclude: [],
    expectedEntitiesSubset: ["invoices", "customers", "payments"],
    expectedTemporal: true,
    description: "Finance prompt detects invoice/customer/payment vocabulary and overdue semantics.",
  },
  {
    prompt: "show employee headcount by department and identify departments with high turnover",
    expectedPrimary: ["risk", "grouping", "count_grouping"],
    mustNotInclude: [],
    expectedEntitiesSubset: ["employees", "headcount", "departments", "turnover"],
    expectedTemporal: false,
    description: "HR prompt detects employee, department, headcount, and turnover vocabulary.",
  },
  {
    prompt: "which patients had repeat visits within 30 days by provider",
    expectedPrimary: ["filtering", "grouping"],
    mustNotInclude: [],
    expectedEntitiesSubset: ["patients", "visits", "providers"],
    expectedTemporal: true,
    description: "Healthcare metadata prompt detects repeat visits within 30 days as temporal.",
  },
];

const matchesExpectedPrimary = (
  detected: BusinessIntentCategory,
  expected: BusinessIntentCategory | BusinessIntentCategory[],
): boolean => {
  if (Array.isArray(expected)) return expected.includes(detected);
  return detected === expected;
};

const formatExpected = (expected: BusinessIntentCategory | BusinessIntentCategory[]): string =>
  Array.isArray(expected) ? expected.join(" or ") : expected;

/**
 * Runs all fixtures through `detectBusinessIntent` and verifies each. Pure
 * function; no I/O. Future test runners (vitest etc.) can wrap each fixture
 * in a `test()` call by iterating `BUSINESS_INTENT_FIXTURES` directly.
 */
export function runBusinessIntentFixtures(): BusinessIntentFixtureReport {
  const fixtureResults: BusinessIntentFixtureResult[] = BUSINESS_INTENT_FIXTURES.map((fixture) => {
    const detected = detectBusinessIntent(fixture.prompt);
    const failureReasons: string[] = [];

    if (!matchesExpectedPrimary(detected.primaryIntent, fixture.expectedPrimary)) {
      failureReasons.push(
        `primaryIntent expected ${formatExpected(fixture.expectedPrimary)} but got ${detected.primaryIntent}`,
      );
    }

    for (const banned of fixture.mustNotInclude) {
      if (detected.primaryIntent === banned) {
        failureReasons.push(`banned category ${banned} appeared as primaryIntent`);
      }
      if (detected.alternates.includes(banned)) {
        failureReasons.push(`banned category ${banned} appeared in alternates`);
      }
    }

    if (fixture.expectedEntitiesSubset) {
      const missing = fixture.expectedEntitiesSubset.filter(
        (entity) => !detected.entities.includes(entity),
      );
      if (missing.length > 0) {
        failureReasons.push(`missing expected entities: ${missing.join(", ")}`);
      }
    }

    if (fixture.expectedMetricsExact) {
      const actualMetrics = [...detected.metrics].sort();
      const expectedMetrics = [...fixture.expectedMetricsExact].sort();
      if (actualMetrics.join(",") !== expectedMetrics.join(",")) {
        failureReasons.push(
          `metrics expected exactly ${expectedMetrics.join(",")} but got ${actualMetrics.join(",")}`,
        );
      }
    }

    if (fixture.expectedAnalysisPath) {
      const actual = detected.analysisPath;
      if (!actual) {
        failureReasons.push("missing expected explicit analysis path");
      } else {
        if (actual.aggregation !== fixture.expectedAnalysisPath.aggregation) {
          failureReasons.push(
            `analysis aggregation expected ${fixture.expectedAnalysisPath.aggregation} but got ${actual.aggregation}`,
          );
        }
        if (actual.measureField !== fixture.expectedAnalysisPath.measureField) {
          failureReasons.push(
            `analysis measureField expected ${fixture.expectedAnalysisPath.measureField} but got ${actual.measureField}`,
          );
        }
        if (actual.groupingField !== fixture.expectedAnalysisPath.groupingField) {
          failureReasons.push(
            `analysis groupingField expected ${fixture.expectedAnalysisPath.groupingField} but got ${actual.groupingField}`,
          );
        }
        if (actual.orderDirection !== fixture.expectedAnalysisPath.orderDirection) {
          failureReasons.push(
            `analysis orderDirection expected ${fixture.expectedAnalysisPath.orderDirection} but got ${actual.orderDirection}`,
          );
        }
        if (actual.rowLimit !== fixture.expectedAnalysisPath.rowLimit) {
          failureReasons.push(
            `analysis rowLimit expected ${fixture.expectedAnalysisPath.rowLimit} but got ${actual.rowLimit}`,
          );
        }
      }
    }

    if (typeof fixture.expectedTemporal === "boolean") {
      if (detected.explicitlyTemporal !== fixture.expectedTemporal) {
        failureReasons.push(
          `explicitlyTemporal expected ${fixture.expectedTemporal} but got ${detected.explicitlyTemporal}`,
        );
      }
    }

    return {
      prompt: fixture.prompt,
      ok: failureReasons.length === 0,
      detected,
      failureReasons,
    };
  });

  const emptyDetected = detectBusinessIntent("   ");
  const ambiguousDetected = detectBusinessIntent("count vacant units by property");
  const ambiguity = describeBusinessIntentAmbiguity(ambiguousDetected);
  const fingerprintA = fingerprintBusinessIntent({
    ...ambiguousDetected,
    entities: [...ambiguousDetected.entities].reverse(),
  });
  const fingerprintB = fingerprintBusinessIntent(ambiguousDetected);

  const results: BusinessIntentFixtureResult[] = [
    ...fixtureResults,
    {
      prompt: "empty prompt uses exported empty-state constant",
      ok:
        emptyDetected === EMPTY_BUSINESS_INTENT &&
        fingerprintBusinessIntent(emptyDetected) ===
          EMPTY_BUSINESS_INTENT_FINGERPRINT,
      detected: emptyDetected,
      failureReasons:
        emptyDetected === EMPTY_BUSINESS_INTENT
          ? []
          : ["Expected blank prompt detection to return EMPTY_BUSINESS_INTENT."],
    },
    {
      prompt: "ambiguous intent exposes review intents",
      ok: ambiguity.isAmbiguous && ambiguity.reviewIntents.length >= 2,
      detected: ambiguousDetected,
      failureReasons:
        ambiguity.isAmbiguous && ambiguity.reviewIntents.length >= 2
          ? []
          : ["Expected close alternates to be described as ambiguous."],
    },
    {
      prompt: "business intent fingerprint is stable for reordered arrays",
      ok: fingerprintA === fingerprintB,
      detected: ambiguousDetected,
      failureReasons:
        fingerprintA === fingerprintB
          ? []
          : ["Expected fingerprintBusinessIntent to sort set-like arrays."],
    },
  ];

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

/**
 * Convenience export — true when every acceptance fixture passes, false
 * otherwise. Useful for guard checks in higher-level tests.
 */
export function allBusinessIntentFixturesPass(): boolean {
  return runBusinessIntentFixtures().failed.length === 0;
}
