/**
 * T-15-3 — deterministic SQL result narration fixtures.
 *
 * Pure narration fixtures only. No SQL rewriting, backend/API calls,
 * execution behavior changes, row mutation, or DataTable key mutation.
 */

import { createResultNarration } from "../resultNarration";
import { labelResultColumns } from "../resultLabeling";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type ResultNarrationFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const assertCondition = (condition: boolean, message: string) => (condition ? [] : [message]);
const narrationText = (args: Parameters<typeof createResultNarration>[0]) => createResultNarration(args)?.text ?? null;

export function runResultNarrationFixtures(): ResultNarrationFixtureReport {
  const eighteenUnitRows = Array.from({ length: 18 }, (_, index) => ({
    unit_number: `${100 + index}`,
    record_count: index + 1,
  }));

  const fixtures: FixtureResult[] = [
    {
      name: "status/count narration mentions active and inactive tenants",
      failureReasons: assertCondition(
        narrationText({
          columns: ["status", "record_count"],
          rows: [
            { status: "Active", record_count: 44 },
            { status: "Inactive", record_count: 3 },
          ],
          taskPrompt: "How many tenants are active?",
        }) === "This result shows 44 active tenants and 3 inactive tenants.",
        "Tenant status narration mismatch.",
      ),
      ok: false,
    },
    {
      name: "orders pending/completed narration uses returned values",
      failureReasons: assertCondition(
        narrationText({
          columns: ["status", "record_count"],
          rows: [
            { status: "Pending", record_count: 12 },
            { status: "Completed", record_count: 30 },
          ],
          taskPrompt: "How many orders are pending vs completed?",
        }) === "This result shows 12 pending orders and 30 completed orders.",
        "Order status narration mismatch.",
      ),
      ok: false,
    },
    {
      name: "grouped count small summarizes by customer",
      failureReasons: assertCondition(
        narrationText({
          columns: ["customer", "order_count"],
          rows: [
            { customer: "Acme", order_count: 12 },
            { customer: "Beta", order_count: 9 },
          ],
          taskPrompt: "How many orders by customer?",
        }) === "This result shows order counts by customer for 2 customers.",
        "Small grouped count narration mismatch.",
      ),
      ok: false,
    },
    {
      name: "grouped count larger summarizes across units instead of listing rows",
      failureReasons: assertCondition(
        narrationText({
          columns: ["unit_number", "record_count"],
          rows: eighteenUnitRows,
          taskPrompt: "How many tenants by unit?",
        }) === "This result shows tenant counts by unit for 18 units.",
        "Large grouped count narration mismatch.",
      ),
      ok: false,
    },
    {
      name: "single-row metric narration mentions total revenue",
      failureReasons: assertCondition(
        narrationText({
          columns: ["total_revenue"],
          rows: [{ total_revenue: 125000 }],
          taskPrompt: "Total revenue",
        }) === "This result shows total revenue of 125,000.",
        "Single-row metric narration mismatch.",
      ),
      ok: false,
    },
    {
      name: "empty rows return null",
      failureReasons: assertCondition(
        createResultNarration({ columns: ["status", "record_count"], rows: [], taskPrompt: "How many tenants are active?" }) === null,
        "Expected empty rows to return null.",
      ),
      ok: false,
    },
    {
      name: "too many columns return null",
      failureReasons: assertCondition(
        createResultNarration({ columns: ["status", "record_count", "region", "extra"], rows: [{ status: "Active", record_count: 44, region: "West", extra: 1 }] }) === null,
        "Expected too many columns to return null.",
      ),
      ok: false,
    },
    {
      name: "missing numeric metric returns null",
      failureReasons: assertCondition(
        createResultNarration({ columns: ["status", "description"], rows: [{ status: "Active", description: "Open" }] }) === null,
        "Expected missing numeric metric to return null.",
      ),
      ok: false,
    },
    {
      name: "long text values return null",
      failureReasons: assertCondition(
        createResultNarration({ columns: ["status", "record_count"], rows: [{ status: "This is a very long free text category value", record_count: 44 }], taskPrompt: "How many tenants are active?" }) === null,
        "Expected long text to return null.",
      ),
      ok: false,
    },
    {
      name: "narration only uses returned values and labels",
      failureReasons: assertCondition(
        (() => {
          const text = narrationText({
            columns: ["status", "record_count"],
            rows: [{ status: "Active", record_count: 44 }],
            taskPrompt: "How many tenants are active and inactive?",
          });
          return text === "This result shows 44 active tenants." && !text.includes("inactive") && !text.includes("3");
        })(),
        "Narration invented values not present in returned rows.",
      ),
      ok: false,
    },
    {
      name: "focused Result Preview renders narration when available and table still uses raw keys",
      failureReasons: assertCondition(
        (() => {
          const columns = labelResultColumns({ columns: ["status", "record_count"], taskPrompt: "How many tenants are active?" });
          const row: Record<string, unknown> = { status: "Active", record_count: 44 };
          const narration = createResultNarration({ columns: ["status", "record_count"], rows: [row], taskPrompt: "How many tenants are active?", labeledColumns: columns });
          return narration?.text === "This result shows 44 active tenants." && columns.every((column) => row[column.key] !== undefined);
        })(),
        "Focused preview narration or raw-key table mapping failed.",
      ),
      ok: false,
    },
    {
      name: "focused Result Preview hides narration when unavailable and table still uses raw keys",
      failureReasons: assertCondition(
        (() => {
          const columns = labelResultColumns({ columns: ["status", "description"] });
          const row: Record<string, unknown> = { status: "Active", description: "Open" };
          const narration = createResultNarration({ columns: ["status", "description"], rows: [row], labeledColumns: columns });
          return narration === null && columns.every((column) => row[column.key] !== undefined);
        })(),
        "Focused preview null narration should not block raw-key table mapping.",
      ),
      ok: false,
    },
    {
      name: "no backend/API/execution behavior fields are introduced",
      failureReasons: assertCondition(
        JSON.stringify(Object.keys(createResultNarration({ columns: ["total_revenue"], rows: [{ total_revenue: 125000 }] }) ?? {}).sort()) === JSON.stringify(["confidence", "reason", "text"]),
        "Narration adapter returned fields outside display-only narration metadata.",
      ),
      ok: false,
    },
  ];

  const results = fixtures.map((fixture) => ({
    ...fixture,
    ok: fixture.failureReasons.length === 0,
  }));

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const RESULT_NARRATION_FIXTURES_PASS = runResultNarrationFixtures().failed.length === 0;
