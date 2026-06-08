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
