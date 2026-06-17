/**
 * T-13M-6 - Semantic Hints Registry foundation fixtures.
 *
 * Pure fixture runner only. No SQL generation, SQL rendering, Monaco insertion,
 * Run Query calls, backend/API calls, provider calls, LLM calls, or ranking changes.
 */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { AcceptedRelationshipContract } from "../../../workbook";
import {
  inferSemanticTableHints,
  summarizeSemanticHints,
  type SemanticColumnRole,
  type SemanticHintRegistryInput,
  type SemanticHintRegistryResult,
} from "../semanticHintRegistry";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SemanticHintRegistryFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  input: SemanticHintRegistryInput;
  assert: (result: SemanticHintRegistryResult) => string[];
};

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"] = "text",
): Pick<SchemaColumn, "name" | "type" | "inferred_type" | "null_count" | "unique_count"> => ({
  name,
  type: inferred_type,
  inferred_type,
  null_count: 0,
  unique_count: 10,
});

const table = (
  tableName: string,
  columns: ReturnType<typeof column>[],
): SemanticHintRegistryInput["tables"][number] => ({
  worksheetId: `worksheet:${tableName}`,
  displayName: tableName,
  sheetName: tableName,
  tableName,
  schema: columns,
});

const contract = (
  sourceTableName: string,
  sourceColumnName: string,
  targetTableName: string,
  targetColumnName: string,
): AcceptedRelationshipContract => ({
  contractId: `contract:${sourceTableName}:${targetTableName}`,
  sourceWorksheetId: `worksheet:${sourceTableName}`,
  sourceTableName,
  sourceColumnName,
  targetWorksheetId: `worksheet:${targetTableName}`,
  targetTableName,
  targetColumnName,
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: `candidate:${sourceTableName}:${targetTableName}`,
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

const expectRole = (
  result: SemanticHintRegistryResult,
  tableName: string,
  columnName: string,
  role: SemanticColumnRole,
): string[] => {
  const hint = result.columns.find(
    (columnHint) =>
      columnHint.tableName === tableName && columnHint.columnName === columnName,
  );
  if (!hint) return [`Missing hint for ${tableName}.${columnName}.`];
  return hint.roles.includes(role)
    ? []
    : [`Expected ${tableName}.${columnName} to include role ${role}; got ${hint.roles.join(", ")}.`];
};

const expectPrimaryRole = (
  result: SemanticHintRegistryResult,
  tableName: string,
  columnName: string,
  role: SemanticColumnRole,
): string[] => {
  const hint = result.columns.find(
    (columnHint) =>
      columnHint.tableName === tableName && columnHint.columnName === columnName,
  );
  if (!hint) return [`Missing hint for ${tableName}.${columnName}.`];
  return hint.primaryRole === role
    ? []
    : [`Expected ${tableName}.${columnName} primary role ${role}; got ${hint.primaryRole}.`];
};

const expectNoRawValues = (result: SemanticHintRegistryResult): string[] => {
  const serialized = JSON.stringify(result);
  return /sample_values|sampleValues|rawRows|cellValues/i.test(serialized)
    ? ["Semantic hints must not emit raw rows, sample values, or cell values."]
    : [];
};

const salesInput: SemanticHintRegistryInput = {
  tables: [
    table("customers", [
      column("customer_id"),
      column("customer_name"),
      column("email"),
      column("region", "categorical"),
    ]),
    table("orders", [
      column("order_id"),
      column("customer_id"),
      column("order_date", "date"),
      column("order_total", "numeric"),
      column("status", "categorical"),
    ]),
    table("payments", [
      column("payment_id"),
      column("order_id"),
      column("payment_date", "date"),
      column("payment_amount", "numeric"),
    ]),
  ],
  acceptedRelationshipContracts: [
    contract("customers", "customer_id", "orders", "customer_id"),
    contract("orders", "order_id", "payments", "order_id"),
  ],
};

const fixtures: Fixture[] = [
  {
    name: "sales orders customers payments columns classify correctly",
    input: salesInput,
    assert: (result) => [
      ...expectRole(result, "customers", "customer_id", "identifier"),
      ...expectRole(result, "orders", "customer_id", "foreign_key"),
      ...expectRole(result, "orders", "order_date", "date"),
      ...expectRole(result, "orders", "order_total", "amount"),
      ...expectRole(result, "orders", "status", "status"),
      ...expectRole(result, "customers", "email", "email"),
      ...expectRole(result, "customers", "region", "location"),
      ...expectNoRawValues(result),
    ],
  },
  {
    name: "inventory products stock columns classify correctly",
    input: {
      tables: [
        table("products", [
          column("product_id"),
          column("product_name"),
          column("category", "categorical"),
          column("price", "numeric"),
        ]),
        table("stock", [
          column("product_id"),
          column("stock_quantity", "numeric"),
          column("inventory_status", "categorical"),
        ]),
      ],
      acceptedRelationshipContracts: [contract("products", "product_id", "stock", "product_id")],
    },
    assert: (result) => [
      ...expectRole(result, "products", "product_id", "identifier"),
      ...expectRole(result, "stock", "product_id", "foreign_key"),
      ...expectRole(result, "products", "product_name", "name"),
      ...expectRole(result, "products", "category", "category"),
      ...expectRole(result, "products", "price", "amount"),
      ...expectRole(result, "stock", "stock_quantity", "quantity"),
      ...expectRole(result, "stock", "inventory_status", "status"),
      ...expectNoRawValues(result),
    ],
  },
  {
    name: "support tickets accounts columns classify correctly",
    input: {
      tables: [
        table("accounts", [
          column("account_id"),
          column("account_name"),
          column("phone"),
        ]),
        table("tickets", [
          column("ticket_id"),
          column("account_id"),
          column("created_at", "date"),
          column("resolved_at", "date"),
          column("status", "categorical"),
          column("description"),
        ]),
      ],
      acceptedRelationshipContracts: [contract("accounts", "account_id", "tickets", "account_id")],
    },
    assert: (result) => [
      ...expectRole(result, "accounts", "account_id", "identifier"),
      ...expectRole(result, "tickets", "account_id", "foreign_key"),
      ...expectRole(result, "tickets", "created_at", "date"),
      ...expectRole(result, "tickets", "resolved_at", "date"),
      ...expectRole(result, "tickets", "status", "status"),
      ...expectRole(result, "tickets", "description", "description"),
      ...expectRole(result, "accounts", "phone", "phone"),
      ...expectNoRawValues(result),
    ],
  },
  {
    name: "finance invoices payments columns classify correctly",
    input: {
      tables: [
        table("invoices", [
          column("invoice_id"),
          column("customer_id"),
          column("invoice_date", "date"),
          column("due_date", "date"),
          column("balance", "numeric"),
          column("overdue_status", "categorical"),
        ]),
        table("payments", [
          column("payment_id"),
          column("invoice_id"),
          column("payment_amount", "numeric"),
          column("payment_date", "date"),
        ]),
      ],
      acceptedRelationshipContracts: [contract("invoices", "invoice_id", "payments", "invoice_id")],
    },
    assert: (result) => [
      ...expectRole(result, "invoices", "invoice_id", "identifier"),
      ...expectRole(result, "payments", "invoice_id", "foreign_key"),
      ...expectRole(result, "invoices", "invoice_date", "date"),
      ...expectRole(result, "invoices", "balance", "amount"),
      ...expectRole(result, "invoices", "overdue_status", "status"),
      ...expectRole(result, "payments", "payment_amount", "amount"),
      ...expectNoRawValues(result),
    ],
  },
  {
    name: "hr employees departments columns classify correctly",
    input: {
      tables: [
        table("employees", [
          column("employee_id"),
          column("full_name"),
          column("department_id"),
          column("email"),
          column("salary", "numeric"),
          column("is_active", "boolean"),
        ]),
        table("departments", [
          column("department_id"),
          column("department_name"),
          column("region", "categorical"),
        ]),
      ],
      acceptedRelationshipContracts: [contract("departments", "department_id", "employees", "department_id")],
    },
    assert: (result) => [
      ...expectRole(result, "employees", "employee_id", "identifier"),
      ...expectRole(result, "employees", "department_id", "foreign_key"),
      ...expectRole(result, "employees", "full_name", "name"),
      ...expectRole(result, "employees", "email", "email"),
      ...expectRole(result, "employees", "salary", "metric_candidate"),
      ...expectRole(result, "employees", "is_active", "boolean_flag"),
      ...expectRole(result, "departments", "department_name", "name"),
      ...expectNoRawValues(result),
    ],
  },
  {
    name: "healthcare patients visits providers columns classify correctly",
    input: {
      tables: [
        table("patients", [
          column("patient_id"),
          column("full_name"),
          column("phone"),
          column("address"),
        ]),
        table("visits", [
          column("visit_id"),
          column("patient_id"),
          column("provider_id"),
          column("visit_date", "date"),
          column("visit_type", "categorical"),
        ]),
        table("providers", [
          column("provider_id"),
          column("provider_name"),
          column("department", "categorical"),
        ]),
      ],
      acceptedRelationshipContracts: [
        contract("patients", "patient_id", "visits", "patient_id"),
        contract("providers", "provider_id", "visits", "provider_id"),
      ],
    },
    assert: (result) => [
      ...expectRole(result, "patients", "patient_id", "identifier"),
      ...expectRole(result, "visits", "patient_id", "foreign_key"),
      ...expectRole(result, "visits", "provider_id", "foreign_key"),
      ...expectRole(result, "visits", "visit_date", "date"),
      ...expectRole(result, "visits", "visit_type", "category"),
      ...expectRole(result, "providers", "department", "category"),
      ...expectRole(result, "patients", "address", "address"),
      ...expectNoRawValues(result),
    ],
  },
  {
    name: "property tenants leases units access codes columns classify correctly",
    input: {
      tables: [
        table("tenants", [
          column("tenant_id"),
          column("tenant_name"),
          column("email"),
        ]),
        table("leases", [
          column("lease_id"),
          column("tenant_id"),
          column("unit_id"),
          column("start_date", "date"),
          column("end_date", "date"),
          column("status", "categorical"),
        ]),
        table("units", [
          column("unit_id"),
          column("property_address"),
          column("units_total", "numeric"),
        ]),
        table("access_codes", [
          column("access_code_id"),
          column("tenant_id"),
          column("is_active", "boolean"),
          column("expires_at", "date"),
        ]),
      ],
      acceptedRelationshipContracts: [
        contract("tenants", "tenant_id", "leases", "tenant_id"),
        contract("units", "unit_id", "leases", "unit_id"),
        contract("tenants", "tenant_id", "access_codes", "tenant_id"),
      ],
    },
    assert: (result) => [
      ...expectRole(result, "tenants", "tenant_id", "identifier"),
      ...expectRole(result, "leases", "tenant_id", "foreign_key"),
      ...expectRole(result, "leases", "end_date", "date"),
      ...expectRole(result, "leases", "status", "status"),
      ...expectRole(result, "units", "property_address", "address"),
      ...expectRole(result, "units", "units_total", "quantity"),
      ...expectRole(result, "access_codes", "is_active", "boolean_flag"),
      ...expectRole(result, "access_codes", "expires_at", "date"),
      ...expectNoRawValues(result),
    ],
  },
  {
    name: "ambiguous columns remain unknown or low confidence",
    input: {
      tables: [
        table("misc", [
          column("misc"),
          column("value_blob"),
        ]),
      ],
    },
    assert: (result) => [
      ...expectPrimaryRole(result, "misc", "misc", "unknown"),
      ...expectPrimaryRole(result, "misc", "value_blob", "unknown"),
      ...(result.columns.every((hint) => hint.confidence === "low")
        ? []
        : ["Expected ambiguous columns to stay low confidence."]),
      ...expectNoRawValues(result),
    ],
  },
  {
    name: "output is stable across repeated invocations",
    input: salesInput,
    assert: (result) => {
      const repeated = inferSemanticTableHints(salesInput);
      return [
        ...(JSON.stringify(result) === JSON.stringify(repeated)
          ? []
          : ["Expected repeated semantic hint inference to be stable."]),
        ...(summarizeSemanticHints(result) === result.summary
          ? []
          : ["Expected summary helper to match result summary."]),
        ...expectNoRawValues(result),
      ];
    },
  },
];

export function runSemanticHintRegistryFixtures(): SemanticHintRegistryFixtureReport {
  const results = fixtures.map((fixture) => {
    const result = inferSemanticTableHints(fixture.input);
    const failureReasons = fixture.assert(result);
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const allSemanticHintRegistryFixturesPass = (): boolean =>
  runSemanticHintRegistryFixtures().failed.length === 0;
