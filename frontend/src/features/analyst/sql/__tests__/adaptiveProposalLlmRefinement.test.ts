/**
 * T-13M-8 - Adaptive Proposal LLM refinement merge fixtures.
 *
 * Pure fixture runner only. No provider calls, SQL generation, SQL rendering,
 * Monaco insertion, Run Query calls, backend/API calls, or execution behavior.
 */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AcceptedRelationshipContract,
  AnalysisScopeSelection,
} from "../../../workbook";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
} from "../adaptiveReportProposal";
import {
  buildAdaptiveProposalLlmPayload,
  type AdaptiveProposalLlmPayloadWorksheet,
} from "../adaptiveProposalLlmPayloadBuilder";
import { applyAdaptiveProposalLlmRefinement } from "../adaptiveProposalLlmRefinement";
import type { AdaptiveProposalLlmRefinementResult } from "../adaptiveProposalLlmContract";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalLlmRefinementFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  response: unknown;
  assert: (
    result: AdaptiveProposalLlmRefinementResult,
    original: AdaptiveReportProposal,
  ) => string[];
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
  rowCount: 75,
  columnCount: schema.length,
});

const scope = (...tableNames: string[]): AnalysisScopeSelection[] =>
  tableNames.map((tableName) => ({
    worksheetId: `worksheet:${tableName}`,
    sourceType: "original",
    tableName,
    originalTableName: tableName,
  }));

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

const worksheets = [
  worksheet("orders", [
    column("order_id", "numeric"),
    column("customer_id", "numeric"),
    column("status", "categorical"),
    column("order_total", "numeric"),
    column("order_date", "date"),
  ]),
  worksheet("customers", [
    column("customer_id", "numeric"),
    column("region", "categorical"),
  ]),
];
const contracts = [contract("orders", "customer_id", "customers", "customer_id")];
const baseProposal = proposeAdaptiveReport({
  prompt: "show order totals by region",
  detectedIntent: detectBusinessIntent("show order totals by region"),
  appliedScopeSelections: scope("orders", "customers"),
  worksheets,
  acceptedRelationshipContracts: contracts,
});
const payload = buildAdaptiveProposalLlmPayload({
  proposal: baseProposal,
  worksheets,
  acceptedRelationshipContracts: contracts,
});

const expectPlanningOnly = (proposal: AdaptiveReportProposal): string[] => [
  ...(proposal.sql === null ? [] : ["Refined proposal must not expose SQL."]),
  ...(proposal.renderer.status === "not_rendered" ? [] : ["Renderer status must stay not_rendered."]),
  ...(proposal.renderer.canRender === false ? [] : ["Renderer canRender must stay false."]),
  ...(proposal.canRenderSql === false ? [] : ["canRenderSql must stay false."]),
  ...(proposal.canInsertSql === false ? [] : ["canInsertSql must stay false."]),
  ...(proposal.canRunSql === false ? [] : ["canRunSql must stay false."]),
];

const validTitleResponse = {
  schemaVersion: "adaptive-proposal-llm-response:v1",
  title: "Order totals by region",
  narrative: "Review order totals grouped by customer region before any SQL is generated.",
};

const validPlanningResponse = {
  schemaVersion: "adaptive-proposal-llm-response:v1",
  entities: [
    {
      id: "entity:orders",
      requestedName: "orders",
      label: "orders",
      worksheetId: "worksheet:orders",
      tableName: "orders",
      confidence: "high",
      binding: "exact",
    },
  ],
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
  filters: [
    {
      id: "filter:status",
      label: "Status/current semantics",
      tableName: "orders",
      columnName: "status",
      semantics: "needs_review",
      reason: "Status labels need review before rendering.",
    },
  ],
};

const fixtures: Fixture[] = [
  {
    name: "validated title and narrative refinement merges safely",
    response: validTitleResponse,
    assert: (result) => [
      ...(result.changed ? [] : ["Expected refinement to change proposal."]),
      ...(result.proposal.title === validTitleResponse.title ? [] : ["Expected refined title."]),
      ...(result.proposal.proposalNarrative === validTitleResponse.narrative
        ? []
        : ["Expected refined narrative."]),
      ...expectPlanningOnly(result.proposal),
    ],
  },
  {
    name: "validated entities metrics groupings filters merge safely",
    response: validPlanningResponse,
    assert: (result) => [
      ...(result.proposal.entities.length === 1 ? [] : ["Expected refined entities."]),
      ...(result.proposal.metrics[0]?.columnName === "order_total"
        ? []
        : ["Expected refined metric column."]),
      ...(result.proposal.groupings[0]?.columnName === "region"
        ? []
        : ["Expected refined grouping column."]),
      ...(result.proposal.filters[0]?.columnName === "status"
        ? []
        : ["Expected refined filter column."]),
      ...expectPlanningOnly(result.proposal),
    ],
  },
  {
    name: "invalid response does not change proposal",
    response: {
      schemaVersion: "adaptive-proposal-llm-response:v1",
      sql: "SELECT * FROM orders",
      title: "Unsafe",
    },
    assert: (result, original) => [
      ...(result.changed === false ? [] : ["Invalid refinement must not report changed."]),
      ...(result.proposal === original ? [] : ["Invalid refinement must return original proposal."]),
      ...(result.validation.ok === false ? [] : ["Invalid response should fail validation."]),
    ],
  },
  {
    name: "invalid array response does not merge into proposal",
    response: {
      schemaVersion: "adaptive-proposal-llm-response:v1",
      metrics: [null],
      title: "Unsafe array refinement",
    },
    assert: (result, original) => [
      ...(result.changed === false ? [] : ["Invalid array refinement must not report changed."]),
      ...(result.proposal === original ? [] : ["Invalid array refinement must return original proposal."]),
      ...(result.validation.ok === false ? [] : ["Invalid array response should fail validation."]),
      ...(result.validation.issues.some((issue) => issue.code === "invalid_shape")
        ? []
        : ["Invalid array response should report invalid_shape."]),
      ...(original.title === baseProposal.title ? [] : ["Original proposal title was mutated."]),
      ...expectPlanningOnly(result.proposal),
    ],
  },
  {
    name: "original proposal is not mutated",
    response: validTitleResponse,
    assert: (result, original) => [
      ...(result.proposal !== original ? [] : ["Valid refinement must return a new proposal."]),
      ...(original.title === baseProposal.title ? [] : ["Original proposal title was mutated."]),
      ...(original.proposalNarrative === baseProposal.proposalNarrative
        ? []
        : ["Original proposal narrative was mutated."]),
    ],
  },
  {
    name: "planning-only invariants remain enforced",
    response: validPlanningResponse,
    assert: (result) => expectPlanningOnly(result.proposal),
  },
  {
    name: "deterministic merge output is stable",
    response: validPlanningResponse,
    assert: (result, original) => {
      const repeated = applyAdaptiveProposalLlmRefinement({
        proposal: original,
        payload,
        response: validPlanningResponse,
      });
      return JSON.stringify(result.proposal) === JSON.stringify(repeated.proposal)
        ? []
        : ["Expected deterministic refinement output."];
    },
  },
];

export function runAdaptiveProposalLlmRefinementFixtures(): AdaptiveProposalLlmRefinementFixtureReport {
  const results = fixtures.map((fixture) => {
    const original = { ...baseProposal };
    const result = applyAdaptiveProposalLlmRefinement({
      proposal: original,
      payload,
      response: fixture.response,
    });
    const failureReasons = fixture.assert(result, original);
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

export const allAdaptiveProposalLlmRefinementFixturesPass = (): boolean =>
  runAdaptiveProposalLlmRefinementFixtures().failed.length === 0;
