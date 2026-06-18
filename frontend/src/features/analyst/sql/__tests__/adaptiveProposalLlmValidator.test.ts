/**
 * T-13M-8 - Adaptive Proposal LLM response validator fixtures.
 *
 * Pure fixture runner only. No provider calls, SQL generation, SQL rendering,
 * Monaco insertion, Run Query calls, backend/API calls, or execution behavior.
 */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { AnalysisScopeSelection } from "../../../workbook";
import { detectBusinessIntent } from "../businessIntentGrounding";
import { proposeAdaptiveReport } from "../adaptiveReportProposal";
import {
  buildAdaptiveProposalLlmPayload,
  type AdaptiveProposalLlmPayloadWorksheet,
} from "../adaptiveProposalLlmPayloadBuilder";
import { validateAdaptiveProposalLlmResponse } from "../adaptiveProposalLlmValidator";
import type {
  AdaptiveProposalLlmPayload,
  AdaptiveProposalLlmValidationResult,
} from "../adaptiveProposalLlmContract";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalLlmValidatorFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  candidate: unknown;
  assert: (result: AdaptiveProposalLlmValidationResult, payload: AdaptiveProposalLlmPayload) => string[];
};

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferred_type,
  inferred_type,
  null_count: 0,
  unique_count: 10,
  sample_values: [],
});

const worksheet = (
  tableName: string,
  schema: SchemaColumn[],
): AdaptiveProposalLlmPayloadWorksheet => ({
  worksheetId: `worksheet:${tableName}`,
  displayName: tableName,
  sheetName: tableName,
  tableName,
  schema,
  rowCount: 50,
  columnCount: schema.length,
});

const scope = (...tableNames: string[]): AnalysisScopeSelection[] =>
  tableNames.map((tableName) => ({
    worksheetId: `worksheet:${tableName}`,
    sourceType: "original",
    tableName,
    originalTableName: tableName,
  }));

const worksheets = [
  worksheet("orders", [
    column("order_id", "numeric"),
    column("customer_id", "numeric"),
    column("status", "categorical"),
    column("order_total", "numeric"),
    column("order_date", "date"),
    column("customer_email"),
  ]),
  worksheet("customers", [
    column("customer_id", "numeric"),
    column("region", "categorical"),
    column("customer_name"),
  ]),
];
const proposal = proposeAdaptiveReport({
  prompt: "show order totals by region",
  detectedIntent: detectBusinessIntent("show order totals by region"),
  appliedScopeSelections: scope("orders", "customers"),
  worksheets,
  acceptedRelationshipContracts: [],
});
const payload = buildAdaptiveProposalLlmPayload({
  proposal,
  worksheets,
  acceptedRelationshipContracts: [],
});

const redactedColumnId =
  payload.tables.flatMap((table) => table.columns).find((column) => column.redactedColumnId)
    ?.redactedColumnId || "redacted_column_1";

const validResponse = {
  schemaVersion: "adaptive-proposal-llm-response:v1",
  title: "Order totals by region",
  narrative: "Review order totals grouped by customer region before any SQL is generated.",
  metrics: [
    {
      id: "metric:order-total",
      label: "order total",
      kind: "sum",
      tableName: "orders",
      columnName: "order_total",
      synthesized: false,
      confidence: "high",
    },
  ],
  groupings: [
    {
      id: "grouping:region",
      label: "region",
      tableName: "customers",
      columnName: "region",
      confidence: "high",
    },
  ],
};

const fixtures: Fixture[] = [
  {
    name: "valid refinement response passes",
    candidate: validResponse,
    assert: (result) => [
      ...(result.ok ? [] : [`Expected valid response; got ${result.issues.map((issue) => issue.code).join(", ")}.`]),
      ...(result.response?.title === "Order totals by region" ? [] : ["Expected sanitized title."]),
    ],
  },
  {
    name: "SQL-like response is rejected",
    candidate: {
      schemaVersion: "adaptive-proposal-llm-response:v1",
      narrative: "```sql\nSELECT * FROM orders\n```",
    },
    assert: (result) =>
      result.issues.some((issue) => issue.code === "sql_like_content")
        ? []
        : ["Expected SQL-like content rejection."],
  },
  {
    name: "response with unknown table or column is rejected",
    candidate: {
      schemaVersion: "adaptive-proposal-llm-response:v1",
      metrics: [
        {
          id: "metric:unknown",
          label: "unknown",
          kind: "sum",
          tableName: "missing_table",
          columnName: "missing_column",
          synthesized: false,
          confidence: "high",
        },
      ],
    },
    assert: (result) =>
      result.issues.some((issue) => issue.code === "unknown_table")
        ? []
        : ["Expected unknown table rejection."],
  },
  {
    name: "response referencing redacted field is rejected",
    candidate: {
      schemaVersion: "adaptive-proposal-llm-response:v1",
      filters: [
        {
          id: "filter:redacted",
          label: "redacted",
          tableName: "orders",
          columnName: redactedColumnId,
          semantics: "needs_review",
          reason: "Should not reference redacted metadata.",
        },
      ],
    },
    assert: (result) =>
      result.issues.some((issue) => issue.code === "redacted_reference")
        ? []
        : ["Expected redacted reference rejection."],
  },
  {
    name: "join verification overclaim is rejected",
    candidate: {
      schemaVersion: "adaptive-proposal-llm-response:v1",
      joinNeeds: [
        {
          id: "join:orders:customers",
          leftEntity: "orders",
          rightEntity: "customers",
          leftTable: "orders",
          rightTable: "customers",
          status: "verified",
          contractId: null,
          reason: "LLM guessed a join.",
        },
      ],
    },
    assert: (result) =>
      result.issues.some((issue) => issue.code === "join_verification_overclaim")
        ? []
        : ["Expected join verification overclaim rejection."],
  },
  {
    name: "render insert run capability attempt is rejected",
    candidate: {
      schemaVersion: "adaptive-proposal-llm-response:v1",
      canRunSql: true,
      renderer: { canRender: true },
    },
    assert: (result) =>
      result.issues.some((issue) => issue.code === "forbidden_field")
        ? []
        : ["Expected forbidden capability field rejection."],
  },
  {
    name: "overlong or malformed response is rejected",
    candidate: {
      schemaVersion: "adaptive-proposal-llm-response:v1",
      title: "x".repeat(220),
      entities: [{ id: "entity:oops", binding: "invented", confidence: "certain" }],
    },
    assert: (result) => [
      ...(result.issues.some((issue) => issue.code === "overlong_text")
        ? []
        : ["Expected overlong text rejection."]),
      ...(result.issues.some((issue) => issue.code === "invalid_enum")
        ? []
        : ["Expected invalid enum rejection."]),
    ],
  },
];

export function runAdaptiveProposalLlmValidatorFixtures(): AdaptiveProposalLlmValidatorFixtureReport {
  const results = fixtures.map((fixture) => {
    const result = validateAdaptiveProposalLlmResponse(fixture.candidate, payload);
    const failureReasons = fixture.assert(result, payload);
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

export const allAdaptiveProposalLlmValidatorFixturesPass = (): boolean =>
  runAdaptiveProposalLlmValidatorFixtures().failed.length === 0;
