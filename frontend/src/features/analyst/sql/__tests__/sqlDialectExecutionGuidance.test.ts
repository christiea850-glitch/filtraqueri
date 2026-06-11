/**
 * T-12B — Dialect selector execution-truthfulness acceptance fixtures.
 *
 * These pure fixtures cover the visible copy contract without mounting the
 * Analyst SQL workspace. They intentionally verify that non-DuckDB dialects
 * are described as drafting guidance only, while DuckDB does not emit an
 * alarming advisory.
 */

import { getDialectProfile, type SqlDialectId } from "../../../sqlIntelligence";
import {
  getSqlDialectExecutionAdvisory,
  SQL_DIALECT_EXECUTION_HELPER_TEXT,
  SQL_DIALECT_SELECTOR_LABEL,
} from "../sqlDialectExecutionGuidance";

type DialectExecutionGuidanceFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type DialectExecutionGuidanceFixtureReport = {
  results: DialectExecutionGuidanceFixtureResult[];
  passed: DialectExecutionGuidanceFixtureResult[];
  failed: DialectExecutionGuidanceFixtureResult[];
};

const expect = (
  condition: boolean,
  failureReason: string,
  failureReasons: string[],
) => {
  if (!condition) failureReasons.push(failureReason);
};

const runAdvisoryFixture = (dialect: SqlDialectId) => {
  const failureReasons: string[] = [];
  const profile = getDialectProfile(dialect);
  const advisory = getSqlDialectExecutionAdvisory(dialect, profile);

  if (dialect === "duckdb") {
    expect(advisory === null, "Expected DuckDB to omit the guidance-only advisory.", failureReasons);
  } else {
    expect(
      advisory === `Execution target is DuckDB; ${profile.displayName} is used for drafting guidance only.`,
      `Expected ${profile.displayName} to be described as drafting guidance only.`,
      failureReasons,
    );
  }

  return {
    name: `${profile.displayName} execution guidance copy`,
    ok: failureReasons.length === 0,
    failureReasons,
  };
};

export function runDialectExecutionGuidanceFixtures(): DialectExecutionGuidanceFixtureReport {
  const copyFailureReasons: string[] = [];
  expect(
    SQL_DIALECT_SELECTOR_LABEL === "SQL guidance dialect",
    "Expected selector label to avoid implying native execution.",
    copyFailureReasons,
  );
  expect(
    SQL_DIALECT_EXECUTION_HELPER_TEXT ===
      "Run Query executes with DuckDB. This setting guides templates and diagnostics.",
    "Expected helper text to state DuckDB execution and guidance scope.",
    copyFailureReasons,
  );

  const results: DialectExecutionGuidanceFixtureResult[] = [
    {
      name: "Selector helper copy is truthful",
      ok: copyFailureReasons.length === 0,
      failureReasons: copyFailureReasons,
    },
    runAdvisoryFixture("duckdb"),
    runAdvisoryFixture("oracle"),
    runAdvisoryFixture("mariadb"),
  ];

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
