/**
 * T-13N-1 - Inspect SQL Business SQL plan candidate UI adapter fixtures.
 *
 * Pure fixture runner only. No SQL rendering, render preview creation, Monaco
 * insertion, Run Query calls, backend/API calls, provider calls, LLM calls, or
 * execution behavior.
 */

import type { DatasetMetadata } from "../../../dataset/datasetTypes";
import type {
  AdaptiveReportProposal,
  ProposedMetric,
} from "../adaptiveReportProposal";
import type { AdaptiveReportProposalFallbackState } from "../adaptiveReportProposalUiAdapter";
import {
  createBusinessSqlPlanCandidateViewModel,
  serializeBusinessSqlPlanCandidateViewModelForAudit,
  type BusinessSqlPlanCandidateViewModel,
} from "../adaptiveProposalBusinessSqlBridgeUiAdapter";
import type { BusinessSqlRenderPreview } from "../businessSqlRenderPreview";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalBusinessSqlBridgeUiAdapterFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  model: BusinessSqlPlanCandidateViewModel | null;
  beforeProposal?: string;
  proposal?: AdaptiveReportProposal;
  assert: (model: BusinessSqlPlanCandidateViewModel | null, fixture: Fixture) => string[];
};

const RAW_SQL = "select * from raw_candidate_orders";
const RAW_PREVIEW_SQL = "select customer_id, count(*) from raw_preview_orders";
const RAW_RESULT = "raw query result should not appear";
const RAW_ROW = "raw row should not appear";
const RAW_SAMPLE = "raw sample should not appear";
const RAW_TOP_VALUE = "raw top value should not appear";
const RAW_CLIPBOARD = "clipboard text should not appear";
const RAW_PROVIDER_RESPONSE = "provider response should not appear";

const dataset: DatasetMetadata = {
  dataset_id: "dataset:leases",
  filename: "leases.csv",
  original_filename: "leases.csv",
  table_name: "leases",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 20,
  column_count: 2,
  schema: [
    {
      name: "lease_id",
      type: "number",
      inferred_type: "numeric",
      null_count: 0,
      unique_count: 20,
      sample_values: [RAW_SAMPLE],
      top_values: [{ value: RAW_TOP_VALUE, count: 2 }],
    },
    {
      name: "lease_status",
      type: "string",
      inferred_type: "categorical",
      null_count: 0,
      unique_count: 3,
      sample_values: [RAW_SAMPLE],
      top_values: [{ value: RAW_TOP_VALUE, count: 10 }],
    },
  ],
};

const preview = (
  status: BusinessSqlRenderPreview["status"],
  sql: string | null = null,
): BusinessSqlRenderPreview => ({
  status,
  title: status === "ready" ? "Business SQL preview ready" : "Business SQL preview blocked",
  body: status === "ready" ? "Rendered SQL is available." : "No rendered SQL is available.",
  sql,
  planId: `preview:${status}:${sql ? "sql" : "none"}`,
  rendererTarget: "duckdb",
  guidanceDialect: "duckdb",
  reasons: status === "ready" ? ["Rendered safely."] : ["Needs more metadata."],
  warnings: [],
  actions: {
    canCopySql: status === "ready" && Boolean(sql),
    canInsertSql: false,
    canRunSql: false,
  },
});

const blockedPreview = preview("blocked");
const readyPreview = preview("ready", RAW_PREVIEW_SQL);

const baseProposal = (): AdaptiveReportProposal => ({
  proposalKind: "adaptive",
  id: "adaptive:leases-by-status",
  title: "Leases by status",
  question: "Count leases by status",
  support: "supported",
  confidence: "high",
  detectedIntent: {
    primaryIntent: "count_grouping",
    alternates: [],
    entities: ["leases"],
    metrics: ["count_leases"],
    grouping: ["status"],
    relationshipPredicate: null,
    explicitlyTemporal: false,
    detectorVersion: "v1",
  },
  entities: [
    {
      id: "entity:leases",
      requestedName: "leases",
      label: "leases",
      worksheetId: "worksheet:leases",
      tableName: "leases",
      confidence: "high",
      binding: "exact",
    },
  ],
  metrics: [
    {
      id: "metric:count-leases",
      label: "count leases",
      kind: "count_entities",
      tableName: "leases",
      columnName: null,
      synthesized: false,
      confidence: "high",
    },
  ],
  derivedMeasures: [],
  groupings: [
    {
      id: "grouping:lease-status",
      label: "status",
      tableName: "leases",
      columnName: "lease_status",
      confidence: "high",
    },
  ],
  aggregateResultConditions: [],
  filters: [],
  joinNeeds: [],
  assumptions: [
    {
      id: "assumption:scope",
      label: "Applied scope",
      detail: "Use applied worksheet scope.",
    },
  ],
  missingRequirements: [],
  warnings: [
    {
      id: "warning:review",
      severity: "info",
      message: "Review before later preview.",
    },
  ],
  semanticHints: [],
  renderer: {
    status: "not_rendered",
    canRender: false,
    targetDialect: "duckdb",
    notes: ["Planning only fixture."],
  },
  sql: null,
  canRenderSql: false,
  canInsertSql: false,
  canRunSql: false,
  llmReadiness: {
    safeToOfferFallback: false,
    payloadShape: "metadata_only",
    reason: "Metadata only fixture.",
  },
  payloadFingerprint: "adaptive:fingerprint:leases-by-status",
  proposalNarrative: "Count leases grouped by status.",
});

const withProposal = (overrides: Partial<AdaptiveReportProposal>): AdaptiveReportProposal => ({
  ...baseProposal(),
  ...overrides,
});

const fallback = (
  proposal: AdaptiveReportProposal | null,
  shouldShow = true,
): AdaptiveReportProposalFallbackState => ({
  shouldShow,
  reason: shouldShow ? "available" : "has_static_matches",
  proposal,
  measureAmbiguity: null,
  clarificationDecision: null,
  insertDisabled: true,
  runDisabled: true,
});

const createModel = ({
  proposal = baseProposal(),
  businessSqlRenderPreview = blockedPreview,
  activeSqlDraft = "",
  shouldShow = true,
}: {
  proposal?: AdaptiveReportProposal | null;
  businessSqlRenderPreview?: BusinessSqlRenderPreview | null;
  activeSqlDraft?: string;
  shouldShow?: boolean;
} = {}): BusinessSqlPlanCandidateViewModel | null =>
  createBusinessSqlPlanCandidateViewModel({
    fallback: fallback(proposal, shouldShow),
    dataset,
    businessSqlRenderPreview,
    activeSqlDraft,
    selectedGuidanceDialect: "duckdb",
  });

const serialize = (model: BusinessSqlPlanCandidateViewModel | null): string =>
  model ? serializeBusinessSqlPlanCandidateViewModelForAudit(model) : "";

const expectVisibleSafety = (model: BusinessSqlPlanCandidateViewModel | null): string[] => {
  if (!model) return ["Expected visible plan candidate model."];
  return [
    ...(model.noSqlRendered === true ? [] : ["Candidate UI must not render SQL."]),
    ...(model.noRenderPreviewCreated === true ? [] : ["Candidate UI must not create a render preview."]),
    ...(model.noInsertAvailable === true ? [] : ["Candidate UI must not expose insert capability."]),
    ...(model.noRunAvailable === true ? [] : ["Candidate UI must not expose run capability."]),
    ...(model.noProviderOrLlmUsed === true ? [] : ["Candidate UI must not use provider or LLM."]),
  ];
};

const expectNoRawContent = (model: BusinessSqlPlanCandidateViewModel | null): string[] => {
  const serialized = serialize(model);
  const forbidden = [
    RAW_SQL,
    RAW_PREVIEW_SQL,
    RAW_RESULT,
    RAW_ROW,
    RAW_SAMPLE,
    RAW_TOP_VALUE,
    RAW_CLIPBOARD,
    RAW_PROVIDER_RESPONSE,
  ];
  return forbidden.some((value) => serialized.includes(value))
    ? ["Plan candidate UI adapter leaked raw SQL/preview/results/rows/samples/clipboard/provider content."]
    : [];
};

const expectNoActionWords = (model: BusinessSqlPlanCandidateViewModel | null): string[] => {
  if (!model) return ["Expected visible plan candidate model."];
  const forbidden = ["generate SQL", "render SQL", "create SQL", "run"];
  const label = model.actionLabel.toLowerCase();
  return forbidden.some((word) => label.includes(word))
    ? ["Candidate action label must avoid generate/render/create SQL and run wording."]
    : [];
};

const fixtures: Fixture[] = [
  {
    name: "candidate UI hidden when no adaptive fallback exists",
    model: createModel({ proposal: null }),
    assert: (model) => (model === null ? [] : ["Expected no model without fallback proposal."]),
  },
  {
    name: "candidate UI hidden when fallback is suppressed",
    model: createModel({ shouldShow: false }),
    assert: (model) => (model === null ? [] : ["Expected no model when fallback is suppressed."]),
  },
  {
    name: "candidate UI hidden when Business SQL Preview is ready and renderable",
    model: createModel({ businessSqlRenderPreview: readyPreview }),
    assert: (model) => (model === null ? [] : ["Expected no model when preview is ready/renderable."]),
  },
  {
    name: "candidate UI hidden when active editor draft is non-empty",
    model: createModel({ activeSqlDraft: RAW_SQL }),
    assert: (model) => (model === null ? [] : ["Expected no model when editor draft is non-empty."]),
  },
  {
    name: "button label avoids SQL generation rendering creation and run wording",
    model: createModel(),
    assert: (model) => [...expectVisibleSafety(model), ...expectNoActionWords(model)],
  },
  {
    name: "blocked plan shows blocking issues only",
    model: createModel({
      proposal: withProposal({
        metrics: [],
        entities: [
          {
            ...baseProposal().entities[0],
            tableName: null,
            binding: "unresolved",
          },
        ],
      }),
    }),
    assert: (model) => [
      ...(model?.state === "blocked_plan" ? [] : ["Expected blocked_plan model."]),
      ...(model?.heading === "Plan candidate blocked." ? [] : ["Expected blocked heading."]),
      ...(model?.issues.every((message) => !message.toLowerCase().includes("needs review"))
        ? []
        : ["Expected blocking issue messages only, without review-only reasons."]),
      ...expectVisibleSafety(model),
    ],
  },
  {
    name: "review-required plan shows review reasons",
    model: createModel({
      proposal: withProposal({
        support: "needs_review",
        confidence: "medium",
        filters: [
          {
            id: "filter:status",
            label: "open status",
            tableName: "leases",
            columnName: "lease_status",
            semantics: "needs_review",
            reason: "Status value needs review.",
          },
        ],
      }),
    }),
    assert: (model) => [
      ...(model?.state === "review_required_plan" ? [] : ["Expected review_required_plan model."]),
      ...(serialize(model).includes("Review required before SQL preview.")
        ? []
        : ["Expected review-required copy."]),
      ...(serialize(model).includes("needs review") ? [] : ["Expected review reason."]),
      ...expectVisibleSafety(model),
    ],
  },
  {
    name: "render-ready plan explicitly says no SQL has been rendered",
    model: createModel(),
    assert: (model) => [
      ...(model?.state === "render_ready_plan" ? [] : ["Expected render_ready_plan model."]),
      ...(serialize(model).includes("No SQL has been rendered")
        ? []
        : ["Expected no-rendered-SQL copy."]),
      ...expectVisibleSafety(model),
    ],
  },
  {
    name: "plan detail summary shows mapped planning details",
    model: createModel(),
    assert: (model) => {
      const labels = model?.details.map((detail) => detail.label) || [];
      const required = [
        "Entities",
        "Metric",
        "Groupings",
        "Filters",
        "Join status",
        "Assumptions",
        "Warnings",
        "Bridge issues",
        "Readiness",
      ];
      return [
        ...required.flatMap((label) =>
          labels.includes(label) ? [] : [`Expected ${label} detail.`],
        ),
        ...expectVisibleSafety(model),
      ];
    },
  },
  {
    name: "no SQL text or SQL preview appears",
    model: createModel(),
    assert: (model) => [...expectNoRawContent(model), ...expectVisibleSafety(model)],
  },
  {
    name: "no copy insert run Monaco provider or preview actions are exposed",
    model: createModel(),
    assert: (model) => {
      const actionText = model?.actionLabel || "";
      const forbiddenActionText = ["Copy SQL", "Insert", "Run Query", "Monaco", "provider action", "preview action"];
      return [
        ...(forbiddenActionText.some((value) => actionText.includes(value))
          ? ["Candidate action exposed a forbidden execution/action surface."]
          : []),
        ...expectVisibleSafety(model),
      ];
    },
  },
  {
    name: "original adaptive proposal is not mutated",
    proposal: baseProposal(),
    beforeProposal: "",
    model: null,
    assert: (_model, fixture) => {
      const proposal = fixture.proposal;
      if (!proposal) return ["Expected proposal fixture."];
      const before = JSON.stringify(proposal);
      const model = createModel({ proposal });
      return [
        ...(JSON.stringify(proposal) === before ? [] : ["Proposal was mutated."]),
        ...expectVisibleSafety(model),
      ];
    },
  },
  {
    name: "existing provider disclosure and Business SQL core actions remain isolated",
    model: createModel(),
    assert: (model) => [
      ...(model?.noRenderPreviewCreated === true ? [] : ["Expected no render preview creation."]),
      ...(model?.noProviderOrLlmUsed === true ? [] : ["Expected no provider or LLM usage."]),
      ...expectVisibleSafety(model),
    ],
  },
  {
    name: "unsupported metric remains blocked or review-only",
    model: createModel({
      proposal: withProposal({
        metrics: [
          {
            ...(baseProposal().metrics[0] as ProposedMetric),
            kind: "average",
            label: "average lease value",
            columnName: "lease_value",
          },
        ],
      }),
    }),
    assert: (model) => [
      ...(model?.state === "blocked_plan" || model?.state === "review_required_plan"
        ? []
        : ["Expected unsupported metric to block or require review."]),
      ...expectVisibleSafety(model),
    ],
  },
];

export function runAdaptiveProposalBusinessSqlBridgeUiAdapterFixtures(): AdaptiveProposalBusinessSqlBridgeUiAdapterFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.model, fixture);
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

export const allAdaptiveProposalBusinessSqlBridgeUiAdapterFixturesPass = (): boolean =>
  runAdaptiveProposalBusinessSqlBridgeUiAdapterFixtures().failed.length === 0;
