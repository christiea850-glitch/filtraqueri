/**
 * T-13N-2 - Adaptive proposal plan candidate to Business SQL Preview handoff fixtures.
 *
 * Pure fixture runner only. No provider calls, LLM calls, backend/API calls,
 * execution behavior, Run Query calls, Monaco insertion, or active draft mutation.
 */

import type { AdaptiveReportProposal, ProposedMetric } from "../adaptiveReportProposal";
import {
  createBusinessSqlPlanFromAdaptiveProposal,
  type AdaptiveProposalBusinessSqlBridgeResult,
  type AdaptiveProposalBusinessSqlBridgeState,
} from "../adaptiveProposalBusinessSqlBridge";
import {
  BUSINESS_SQL_PLAN_CANDIDATE_PREVIEW_ACTION_LABEL,
  createAdaptiveProposalBusinessSqlPreviewHandoff,
  getAdaptiveProposalBusinessSqlPreviewHandoffAction,
} from "../adaptiveProposalBusinessSqlPreviewHandoff";
import type { BusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import {
  getBusinessSqlRenderPreviewCopyState,
  getBusinessSqlRenderPreviewManualInsertState,
} from "../businessSqlRenderPreviewUiAdapter";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalBusinessSqlPreviewHandoffFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

const RAW_SQL = "select * from raw_handoff_orders";

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
  assumptions: [],
  missingRequirements: [],
  warnings: [],
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

const bridge = (proposal: AdaptiveReportProposal = baseProposal()) =>
  createBusinessSqlPlanFromAdaptiveProposal({
    proposal,
    selectedGuidanceDialect: "duckdb",
  });

const previewFor = (planId: string, status: BusinessSqlRenderPreview["status"]): BusinessSqlRenderPreview => ({
  status,
  title: status === "ready" ? "SQL preview ready" : "SQL preview blocked",
  body:
    status === "ready"
      ? "DuckDB SQL has been rendered for review. It has not been inserted or run."
      : "SQL cannot be previewed until blocking issues are resolved.",
  sql: status === "ready" ? RAW_SQL : null,
  planId,
  rendererTarget: "duckdb",
  guidanceDialect: "duckdb",
  reasons: [],
  warnings: [],
  actions: {
    canCopySql: status === "ready",
    canInsertSql: false,
    canRunSql: false,
  },
});

const handoffInput = (
  result: AdaptiveProposalBusinessSqlBridgeResult,
  overrides: {
    candidateState?: AdaptiveProposalBusinessSqlBridgeState;
    activeSqlDraft?: string;
    existingPreview?: BusinessSqlRenderPreview | null;
  } = {},
) => ({
  candidateState: overrides.candidateState || result.state,
  plan: result.plan,
  readiness: result.readiness,
  issues: result.issues,
  activeSqlDraft: overrides.activeSqlDraft || "",
  existingPreview: overrides.existingPreview ?? null,
});

const expectNoUnsafeBehavior = (
  result: ReturnType<typeof createAdaptiveProposalBusinessSqlPreviewHandoff>,
): string[] => [
  ...(result.noDirectRendererCallFromUi === true
    ? []
    : ["UI must not call renderBusinessSqlQueryPlan directly."]),
  ...(result.noInsertPerformed === true ? [] : ["Handoff must not insert SQL."]),
  ...(result.noRunPerformed === true ? [] : ["Handoff must not run SQL."]),
  ...(result.noProviderOrLlmUsed === true ? [] : ["Handoff must not use provider or LLM."]),
];

const fixtures: Fixture[] = [
  {
    name: "handoff action hidden for no_plan",
    assert: () => {
      const result = bridge(withProposal({ support: "unsupported" }));
      const action = getAdaptiveProposalBusinessSqlPreviewHandoffAction(handoffInput(result));
      return action.canPreview === false ? [] : ["Expected no_plan to block preview handoff."];
    },
  },
  {
    name: "handoff action hidden for blocked_plan",
    assert: () => {
      const result = bridge(withProposal({ metrics: [] }));
      const action = getAdaptiveProposalBusinessSqlPreviewHandoffAction(handoffInput(result));
      return action.canPreview === false ? [] : ["Expected blocked_plan to block preview handoff."];
    },
  },
  {
    name: "handoff action hidden for draft_plan",
    assert: () => {
      const result = bridge();
      const action = getAdaptiveProposalBusinessSqlPreviewHandoffAction(
        handoffInput(result, { candidateState: "draft_plan" }),
      );
      return action.canPreview === false ? [] : ["Expected draft_plan to block preview handoff."];
    },
  },
  {
    name: "handoff action hidden for review_required_plan",
    assert: () => {
      const result = bridge(withProposal({ confidence: "medium" }));
      const action = getAdaptiveProposalBusinessSqlPreviewHandoffAction(handoffInput(result));
      return action.canPreview === false ? [] : ["Expected review_required_plan to block preview handoff."];
    },
  },
  {
    name: "handoff action enabled only for render_ready_plan",
    assert: () => {
      const result = bridge();
      const action = getAdaptiveProposalBusinessSqlPreviewHandoffAction(handoffInput(result));
      return [
        ...(result.state === "render_ready_plan" ? [] : ["Expected render-ready bridge fixture."]),
        ...(action.canPreview === true ? [] : ["Expected render_ready_plan to enable preview handoff."]),
      ];
    },
  },
  {
    name: "action label is exact and avoids unsafe wording",
    assert: () => {
      const label = BUSINESS_SQL_PLAN_CANDIDATE_PREVIEW_ACTION_LABEL;
      const forbidden = ["Generate SQL", "Run SQL", "Create query", "Use this SQL", "Send to editor"];
      return [
        ...(label === "Preview SQL from plan candidate" ? [] : ["Unexpected handoff action label."]),
        ...(forbidden.some((word) => label.includes(word)) ? ["Action label used unsafe wording."] : []),
      ];
    },
  },
  {
    name: "handoff uses Business SQL render preview contract",
    assert: () => {
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff(handoffInput(bridge()));
      return [
        ...(result.preview?.status === "ready" ? [] : ["Expected ready Business SQL preview."]),
        ...(result.preview?.body === "DuckDB SQL has been rendered for review. It has not been inserted or run."
          ? []
          : ["Expected existing preview body copy."]),
        ...expectNoUnsafeBehavior(result),
      ];
    },
  },
  {
    name: "preview SQL appears only in Business SQL Preview model",
    assert: () => {
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff(handoffInput(bridge()));
      return [
        ...(result.preview?.sql ? [] : ["Expected SQL only in preview model."]),
        ...expectNoUnsafeBehavior(result),
      ];
    },
  },
  {
    name: "active non-empty editor draft blocks handoff",
    assert: () => {
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff(
        handoffInput(bridge(), { activeSqlDraft: RAW_SQL }),
      );
      return [
        ...(result.preview === null ? [] : ["Expected non-empty draft to block preview."]),
        ...(result.action.canPreview === false ? [] : ["Expected disabled handoff action."]),
        ...expectNoUnsafeBehavior(result),
      ];
    },
  },
  {
    name: "existing ready preview for same plan blocks duplicate handoff",
    assert: () => {
      const bridgeResult = bridge();
      const existingPreview = previewFor(bridgeResult.plan?.id || "missing", "ready");
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff(
        handoffInput(bridgeResult, { existingPreview }),
      );
      return result.preview === null ? [] : ["Expected duplicate ready preview to block handoff."];
    },
  },
  {
    name: "pre-existing plan SQL blocks handoff",
    assert: () => {
      const bridgeResult = bridge();
      const plan = bridgeResult.plan
        ? {
            ...bridgeResult.plan,
            renderer: {
              ...bridgeResult.plan.renderer,
              sql: RAW_SQL,
            },
          }
        : null;
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff({
        ...handoffInput(bridgeResult),
        plan,
      });
      return result.preview === null ? [] : ["Expected pre-existing plan SQL to block handoff."];
    },
  },
  {
    name: "renderer target must remain DuckDB",
    assert: () => {
      const bridgeResult = bridge();
      const plan = bridgeResult.plan
        ? {
            ...bridgeResult.plan,
            renderer: {
              ...bridgeResult.plan.renderer,
              targetDialect: "postgres" as typeof bridgeResult.plan.renderer.targetDialect,
            },
          }
        : null;
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff({
        ...handoffInput(bridgeResult),
        plan,
      });
      return result.preview === null ? [] : ["Expected non-DuckDB renderer target to block handoff."];
    },
  },
  {
    name: "copy remains governed by existing preview UI adapter",
    assert: () => {
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff(handoffInput(bridge()));
      if (!result.preview) return ["Expected ready preview."];
      const copyState = getBusinessSqlRenderPreviewCopyState(result.preview);
      return copyState.canCopySql && copyState.sql ? [] : ["Expected existing copy gate to allow ready preview."];
    },
  },
  {
    name: "insert remains governed by existing preview UI adapter",
    assert: () => {
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff(handoffInput(bridge()));
      if (!result.preview) return ["Expected ready preview."];
      const insertState = getBusinessSqlRenderPreviewManualInsertState(result.preview, "");
      const blockedInsertState = getBusinessSqlRenderPreviewManualInsertState(result.preview, RAW_SQL);
      return [
        ...(insertState.canManuallyInsertSqlPreview ? [] : ["Expected existing insert gate to allow empty editor."]),
        ...(blockedInsertState.canManuallyInsertSqlPreview === false
          ? []
          : ["Expected existing insert gate to block non-empty editor."]),
      ];
    },
  },
  {
    name: "Run remains manual separate and unchanged",
    assert: () => {
      const result = createAdaptiveProposalBusinessSqlPreviewHandoff(handoffInput(bridge()));
      return [
        ...(result.preview?.actions.canRunSql === false ? [] : ["Preview must not expose run capability."]),
        ...expectNoUnsafeBehavior(result),
      ];
    },
  },
  {
    name: "unsupported metric cannot preview",
    assert: () => {
      const result = bridge(
        withProposal({
          metrics: [
            {
              ...(baseProposal().metrics[0] as ProposedMetric),
              kind: "average",
              label: "average lease value",
              columnName: "lease_value",
            },
          ],
        }),
      );
      const handoff = createAdaptiveProposalBusinessSqlPreviewHandoff(handoffInput(result));
      return handoff.preview === null ? [] : ["Expected unsupported metric to block handoff."];
    },
  },
];

export function runAdaptiveProposalBusinessSqlPreviewHandoffFixtures(): AdaptiveProposalBusinessSqlPreviewHandoffFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
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

export const allAdaptiveProposalBusinessSqlPreviewHandoffFixturesPass = (): boolean =>
  runAdaptiveProposalBusinessSqlPreviewHandoffFixtures().failed.length === 0;
