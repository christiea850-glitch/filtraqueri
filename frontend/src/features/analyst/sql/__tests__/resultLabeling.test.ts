/**
 * T-15-1 — SQL result column labeling fixtures.
 *
 * Pure render-label fixtures only. No SQL rewriting, backend/API calls,
 * execution behavior changes, row mutation, or DataTable key mutation.
 */

import { labelResultColumns } from "../resultLabeling";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type ResultLabelingFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const labelsFor = (columns: string[], taskPrompt?: string) =>
  labelResultColumns({ columns, taskPrompt }).map((column) => column.label);

const keysFor = (columns: string[], taskPrompt?: string) =>
  labelResultColumns({ columns, taskPrompt }).map((column) => column.key);

const assertEqual = (actual: unknown, expected: unknown, message: string) =>
  JSON.stringify(actual) === JSON.stringify(expected)
    ? []
    : [`${message} Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`];

const assertCondition = (condition: boolean, message: string) => (condition ? [] : [message]);

export function runResultLabelingFixtures(): ResultLabelingFixtureReport {
  const fixtures: FixtureResult[] = [
    {
      name: "basic humanization labels raw columns",
      failureReasons: assertEqual(
        labelsFor(["status", "record_count"]),
        ["Status", "Record count"],
        "Basic labels mismatch.",
      ),
      ok: false,
    },
    {
      name: "count with known entity and grouping dimension",
      failureReasons: assertEqual(
        labelsFor(["customer_id", "record_count"], "How many orders by customer"),
        ["Customer", "Order count"],
        "Order count labels mismatch.",
      ),
      ok: false,
    },
    {
      name: "tenant/unit prompt produces business-friendly labels",
      failureReasons: assertEqual(
        labelsFor(["unit_number", "record_count"], "How many tenants in every unit have access codes"),
        ["Unit", "Tenant count"],
        "Tenant/unit labels mismatch.",
      ),
      ok: false,
    },
    {
      name: "metric by dimension remains business-friendly",
      failureReasons: assertEqual(
        labelsFor(["product_category", "total_revenue"], "Total revenue by product category"),
        ["Product category", "Total revenue"],
        "Metric labels mismatch.",
      ),
      ok: false,
    },
    {
      name: "average metric labels aggregate prefix",
      failureReasons: assertEqual(
        labelsFor(["customer_segment", "average_order_value"], "Average order value by customer segment"),
        ["Customer segment", "Average order value"],
        "Average metric labels mismatch.",
      ),
      ok: false,
    },
    {
      name: "empty prompt uses conservative humanization",
      failureReasons: assertEqual(
        labelsFor(["manager_type", "manager_id"]),
        ["Manager type", "Manager ID"],
        "No-prompt labels mismatch.",
      ),
      ok: false,
    },
    {
      name: "odd raw names safely fall back to humanized labels",
      failureReasons: assertEqual(
        labelsFor(["__weird__metric_99"]),
        ["Weird metric 99"],
        "Odd column fallback mismatch.",
      ),
      ok: false,
    },
    {
      name: "original column keys are preserved exactly",
      failureReasons: assertEqual(
        keysFor(["customer_id", "record_count"], "How many orders by customer"),
        ["customer_id", "record_count"],
        "Column keys changed.",
      ),
      ok: false,
    },
    {
      name: "focused Result Preview can still render rows with raw keys",
      failureReasons: assertCondition(
        labelResultColumns({
          columns: ["customer_id", "record_count"],
          taskPrompt: "How many orders by customer",
        }).map((column) => ({
          key: column.key,
          value: { customer_id: "C-001", record_count: 3 }[column.key],
        }))
          .every((cell) => cell.value !== undefined),
        "A labeled focused preview column no longer maps to the raw row key.",
      ),
      ok: false,
    },
    {
      name: "inline preview grid can still render rows with raw keys",
      failureReasons: assertCondition(
        labelResultColumns({
          columns: ["unit_number", "record_count"],
          taskPrompt: "How many tenants in every unit have access codes",
        }).map((column) => ({
          key: column.key,
          value: { unit_number: "101", record_count: 2 }[column.key],
        }))
          .every((cell) => cell.value !== undefined),
        "A labeled inline preview column no longer maps to the raw row key.",
      ),
      ok: false,
    },
    {
      name: "labeling does not alter SQL/backend/API/execution data shape",
      failureReasons: assertEqual(
        Object.keys(labelResultColumns({ columns: ["status"] })[0]).sort(),
        ["key", "label", "origin"],
        "Label adapter returned execution/API fields.",
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

export const RESULT_LABELING_FIXTURES_PASS = runResultLabelingFixtures().failed.length === 0;
