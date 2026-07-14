/**
 * T-13I - read-only Business SQL renderer preview UI adapter fixtures.
 *
 * Pure fixture runner only. No UI component changes, Monaco insertion,
 * Run Query calls, backend/API calls, provider calls, network calls,
 * persistence, or query execution.
 */

import {
  evaluateBusinessSqlRenderability,
  type BusinessSqlRenderabilityGate,
} from "../businessSqlRenderabilityGate";
import type { BusinessSqlRelationshipMetadata } from "../businessSqlJoinPathResolver";
import {
  planBusinessSqlQueryRequestWithJoinResolution,
  type BusinessSqlQueryPlanJoinResolution,
} from "../businessSqlQueryPlanJoinResolution";
import {
  renderBusinessSqlFromRenderability,
  type BusinessSqlRenderResult,
} from "../businessSqlRenderer";
import {
  createBusinessSqlRendererPreviewUiModel,
  type BusinessSqlRendererPreviewUiModel,
} from "../businessSqlRendererPreviewUiAdapter";

type RendererPreviewUiFixture = {
  name: string;
  result: BusinessSqlRenderResult;
  assert: (model: BusinessSqlRendererPreviewUiModel) => string[];
};

type RendererPreviewUiFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type RendererPreviewUiFixtureReport = {
  results: RendererPreviewUiFixtureResult[];
  passed: RendererPreviewUiFixtureResult[];
  failed: RendererPreviewUiFixtureResult[];
};

const relationship = (
  id: string,
  fromEntity: string,
  toEntity: string,
  status: BusinessSqlRelationshipMetadata["status"] = "accepted",
): BusinessSqlRelationshipMetadata => ({ id, fromEntity, toEntity, status });

const integratedFor = (
  prompt: string,
  relationships: readonly BusinessSqlRelationshipMetadata[] = [],
): BusinessSqlQueryPlanJoinResolution =>
  planBusinessSqlQueryRequestWithJoinResolution({ prompt, relationships });

const renderabilityFor = (
  integrated: BusinessSqlQueryPlanJoinResolution,
): BusinessSqlRenderabilityGate =>
  evaluateBusinessSqlRenderability({ integrated });

const renderResultFor = (
  integrated: BusinessSqlQueryPlanJoinResolution,
  renderability = renderabilityFor(integrated),
): BusinessSqlRenderResult =>
  renderBusinessSqlFromRenderability({ integrated, renderability });

const leasesByStatus = integratedFor("Count leases by status");
const ordersPerCustomer = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "ready"),
]);
const needsReview = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "unknown"),
]);
const blocked = integratedFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "missing"),
]);
const unsupported: BusinessSqlQueryPlanJoinResolution = {
  ...leasesByStatus,
  plan: {
    ...leasesByStatus.plan,
    id: "business-sql-plan:unsupported-render-shape",
    kind: "count_distinct_entity",
  },
};
const nonDuckDb: BusinessSqlQueryPlanJoinResolution = {
  ...leasesByStatus,
  plan: {
    ...leasesByStatus.plan,
    renderer: {
      ...leasesByStatus.plan.renderer,
      targetDialect: "oracle",
    },
  },
};
const deterministicFirst = createBusinessSqlRendererPreviewUiModel(renderResultFor(ordersPerCustomer));
const deterministicSecond = createBusinessSqlRendererPreviewUiModel(renderResultFor(ordersPerCustomer));

const expectReadOnlySafety = (model: BusinessSqlRendererPreviewUiModel): string[] => [
  ...(model.safetyLabels.previewOnly === "Preview only" ? [] : ["Expected Preview only label."]),
  ...(model.safetyLabels.notExecuted === "Not executed" ? [] : ["Expected Not executed label."]),
  ...(model.safetyLabels.notInsertedAutomatically === "Not inserted automatically"
    ? []
    : ["Expected Not inserted automatically label."]),
  ...(model.safetyLabels.runQueryManual === "Run Query remains manual"
    ? []
    : ["Expected Run Query remains manual label."]),
  ...(model.actions.canInsertSql ? ["Insert must be disabled."] : []),
  ...(model.actions.canRunSql ? ["Run Query must be disabled."] : []),
  ...(model.insertEligibility.eligible ? ["Insert eligibility must remain false."] : []),
  ...(model.insertEligibility.metadataOnly ? [] : ["Insert eligibility must be metadata-only."]),
  ...(model.noSqlExecution ? [] : ["Expected noSqlExecution safety flag."]),
  ...(model.noDuckDbExecution ? [] : ["Expected noDuckDbExecution safety flag."]),
  ...(model.noEditorMutation ? [] : ["Expected noEditorMutation safety flag."]),
  ...(model.noBackendCall && model.noProviderCall && model.noNetworkCall
    ? []
    : ["Expected no backend/provider/network safety flags."]),
  ...(model.noPersistence ? [] : ["Expected noPersistence safety flag."]),
];

const expectRendered = (
  model: BusinessSqlRendererPreviewUiModel,
  fragment: string,
): string[] => [
  ...(model.displayStatus === "rendered" ? [] : [`Expected rendered display, got ${model.displayStatus}.`]),
  ...(model.sqlText?.includes(fragment) ? [] : [`Expected SQL text to include ${fragment}.`]),
  ...(model.rendererTargetLabel === "DuckDB" ? [] : ["Expected DuckDB label."]),
  ...(model.actions.canPreviewSql && model.actions.canCopySql
    ? []
    : ["Rendered SQL should be previewable and copyable metadata."]),
  ...expectReadOnlySafety(model),
];

const expectNoSql = (
  model: BusinessSqlRendererPreviewUiModel,
  expectedStatus: BusinessSqlRendererPreviewUiModel["displayStatus"],
): string[] => [
  ...(model.displayStatus === expectedStatus
    ? []
    : [`Expected ${expectedStatus} display, got ${model.displayStatus}.`]),
  ...(model.sqlText === null ? [] : ["Refused UI model must not expose SQL text."]),
  ...(model.actions.canPreviewSql ? ["Preview SQL must be disabled without SQL."] : []),
  ...(model.actions.canCopySql ? ["Copy SQL must be disabled without SQL."] : []),
  ...expectReadOnlySafety(model),
];

export const BUSINESS_SQL_RENDERER_PREVIEW_UI_ADAPTER_FIXTURES: RendererPreviewUiFixture[] = [
  {
    name: "rendered leases-by-status result exposes preview SQL and safety copy",
    result: renderResultFor(leasesByStatus),
    assert: (model) => expectRendered(model, 'FROM "leases"'),
  },
  {
    name: "rendered join result exposes preview SQL and DuckDB label",
    result: renderResultFor(ordersPerCustomer),
    assert: (model) => expectRendered(model, 'JOIN "orders"'),
  },
  {
    name: "needs-review refusal exposes no SQL and disables insert",
    result: renderResultFor(needsReview),
    assert: (model) => expectNoSql(model, "needs_review"),
  },
  {
    name: "blocked refusal exposes no SQL and disables insert",
    result: renderResultFor(blocked),
    assert: (model) => expectNoSql(model, "blocked"),
  },
  {
    name: "unsupported refusal exposes no SQL and disables insert",
    result: renderResultFor(unsupported),
    assert: (model) => expectNoSql(model, "unsupported"),
  },
  {
    name: "non-DuckDB refusal shows target blocker without SQL",
    result: renderResultFor(nonDuckDb),
    assert: (model) => [
      ...expectNoSql(model, "blocked"),
      ...(model.reasonCode === "renderer_target_not_duckdb"
        ? []
        : [`Expected non-DuckDB reason code, got ${model.reasonCode}.`]),
      ...(model.blockers.some((blocker) => /oracle|not DuckDB/i.test(blocker))
        ? []
        : ["Expected target blocker to mention non-DuckDB target."]),
    ],
  },
  {
    name: "UI model includes not executed not inserted and Run Query manual safety labels",
    result: renderResultFor(leasesByStatus),
    assert: expectReadOnlySafety,
  },
  {
    name: "same input produces the same renderer preview UI model",
    result: renderResultFor(ordersPerCustomer),
    assert: () =>
      JSON.stringify(deterministicFirst) === JSON.stringify(deterministicSecond)
        ? []
        : ["Expected deterministic renderer preview UI model."],
  },
];

export function runBusinessSqlRendererPreviewUiAdapterFixtures(): RendererPreviewUiFixtureReport {
  const results = BUSINESS_SQL_RENDERER_PREVIEW_UI_ADAPTER_FIXTURES.map((fixture) => {
    const model = createBusinessSqlRendererPreviewUiModel(fixture.result);
    const failureReasons = fixture.assert(model);

    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: model.summary,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allBusinessSqlRendererPreviewUiAdapterFixturesPass(): boolean {
  return runBusinessSqlRendererPreviewUiAdapterFixtures().failed.length === 0;
}
