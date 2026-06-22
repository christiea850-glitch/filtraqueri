/**
 * T-15-1 — SQL result column labeling fixtures.
 *
 * Pure render-label fixtures only. No SQL rewriting, backend/API calls,
 * execution behavior changes, row mutation, or DataTable key mutation.
 */

import { frameResultValue, labelResultColumns } from "../resultLabeling";

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


const framedDisplayFor = (args: Parameters<typeof frameResultValue>[0]) => frameResultValue(args).display;
const framedOriginFor = (args: Parameters<typeof frameResultValue>[0]) => frameResultValue(args).origin;

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
      name: "status value with tenant entity is framed",
      failureReasons: assertEqual(
        framedDisplayFor({ value: "Active", columnKey: "status", taskPrompt: "How many tenants are active?" }),
        "Active tenants",
        "Tenant status value framing mismatch.",
      ),
      ok: false,
    },
    {
      name: "order status values are framed",
      failureReasons: assertEqual(
        ["Pending", "Completed"].map((value) =>
          framedDisplayFor({ value, columnKey: "status", taskPrompt: "How many orders are pending vs completed?" }),
        ),
        ["Pending orders", "Completed orders"],
        "Order status value framing mismatch.",
      ),
      ok: false,
    },
    {
      name: "invoice status value is framed",
      failureReasons: assertEqual(
        framedDisplayFor({ value: "Overdue", columnKey: "status", taskPrompt: "Overdue invoices by status" }),
        "Overdue invoices",
        "Invoice status value framing mismatch.",
      ),
      ok: false,
    },
    {
      name: "numeric result values stay raw",
      failureReasons: assertEqual(
        frameResultValue({ value: 44, columnKey: "record_count", taskPrompt: "How many tenants are active?" }),
        { raw: 44, display: "44", origin: "raw" },
        "Numeric values should not be framed.",
      ),
      ok: false,
    },
    {
      name: "date result values stay raw",
      failureReasons: assertEqual(
        framedDisplayFor({ value: "2025-06-21", columnKey: "hire_date", taskPrompt: "Employees by status" }),
        "2025-06-21",
        "Date values should not be framed.",
      ),
      ok: false,
    },
    {
      name: "IDs and codes stay raw",
      failureReasons: [
        ...assertEqual(
          framedDisplayFor({ value: "T001", columnKey: "tenant_id", taskPrompt: "How many tenants are active?" }),
          "T001",
          "ID values should not be framed.",
        ),
        ...assertEqual(
          framedDisplayFor({ value: "A123", columnKey: "code", taskPrompt: "How many tenants are active?" }),
          "A123",
          "Code values should not be framed.",
        ),
      ],
      ok: false,
    },
    {
      name: "no prompt and no entity falls back to raw value",
      failureReasons: assertEqual(
        framedDisplayFor({ value: "Senior", columnKey: "manager_type" }),
        "Senior",
        "Value framed without a clear entity.",
      ),
      ok: false,
    },
    {
      name: "already-framed values do not duplicate the entity",
      failureReasons: assertEqual(
        framedDisplayFor({ value: "Active tenants", columnKey: "status", taskPrompt: "How many tenants are active?" }),
        "Active tenants",
        "Already-framed values should not duplicate the entity.",
      ),
      ok: false,
    },
    {
      name: "original raw row values are preserved exactly",
      failureReasons: assertCondition(
        (() => {
          const row = { status: "Active", record_count: 44 };
          const before = JSON.stringify(row);
          frameResultValue({ value: row.status, columnKey: "status", taskPrompt: "How many tenants are active?" });
          return JSON.stringify(row) === before;
        })(),
        "Value framing mutated raw row data.",
      ),
      ok: false,
    },
    {
      name: "focused Result Preview renders framed display while using raw keys",
      failureReasons: assertCondition(
        (() => {
          const columns = labelResultColumns({ columns: ["status", "record_count"], taskPrompt: "How many tenants are active?" });
          const row: Record<string, unknown> = { status: "Active", record_count: 44 };
          const statusColumn = columns[0];
          return (
            statusColumn.key === "status" &&
            row[statusColumn.key] === "Active" &&
            frameResultValue({
              value: row[statusColumn.key],
              columnKey: statusColumn.key,
              columnLabel: statusColumn.label,
              taskPrompt: "How many tenants are active?",
            }).display === "Active tenants"
          );
        })(),
        "Focused Result Preview framing no longer maps through raw row keys.",
      ),
      ok: false,
    },
    {
      name: "inline SQL preview grid renders framed display while using raw keys",
      failureReasons: assertCondition(
        (() => {
          const columns = labelResultColumns({ columns: ["status", "record_count"], taskPrompt: "How many orders are pending vs completed?" });
          const row: Record<string, unknown> = { status: "Pending", record_count: 12 };
          const statusColumn = columns[0];
          return (
            statusColumn.key === "status" &&
            row[statusColumn.key] === "Pending" &&
            frameResultValue({
              value: row[statusColumn.key],
              columnKey: statusColumn.key,
              columnLabel: statusColumn.label,
              taskPrompt: "How many orders are pending vs completed?",
            }).display === "Pending orders"
          );
        })(),
        "Inline preview framing no longer maps through raw row keys.",
      ),
      ok: false,
    },
    {
      name: "value framing does not alter SQL/backend/API/execution data shape",
      failureReasons: assertEqual(
        Object.keys(frameResultValue({ value: "Active", columnKey: "status", taskPrompt: "How many tenants are active?" })).sort(),
        ["display", "origin", "raw"],
        "Value framing adapter returned execution/API fields.",
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
