/**
 * T-13L-1 - pure manual insert gate fixtures.
 *
 * Pure fixture runner only. No UI component changes, Monaco/editor handler
 * calls, Run Query calls, backend/API calls, provider calls, network calls,
 * persistence, workbook mutation, or query execution.
 */

import {
  evaluateBusinessSqlRenderability,
} from "../businessSqlRenderabilityGate";
import type { BusinessSqlRelationshipMetadata } from "../businessSqlJoinPathResolver";
import {
  planBusinessSqlQueryRequestWithJoinResolution,
} from "../businessSqlQueryPlanJoinResolution";
import {
  renderBusinessSqlFromRenderability,
} from "../businessSqlRenderer";
import {
  createBusinessSqlRendererPreviewUiModel,
  type BusinessSqlRendererPreviewUiModel,
} from "../businessSqlRendererPreviewUiAdapter";
import {
  applyBusinessSqlRendererPreviewManualInsert,
  getBusinessSqlRendererPreviewManualInsertEligibility,
  type BusinessSqlRendererPreviewManualInsertReasonCode,
} from "../businessSqlRendererPreviewManualInsertGate";

type ManualInsertGateFixture = {
  name: string;
  assert: () => string[];
};

type ManualInsertGateFixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type ManualInsertGateFixtureReport = {
  results: ManualInsertGateFixtureResult[];
  passed: ManualInsertGateFixtureResult[];
  failed: ManualInsertGateFixtureResult[];
};

const relationship = (
  id: string,
  fromEntity: string,
  toEntity: string,
  status: BusinessSqlRelationshipMetadata["status"] = "ready",
): BusinessSqlRelationshipMetadata => ({ id, fromEntity, toEntity, status });

const modelFor = (
  prompt: string,
  relationships: readonly BusinessSqlRelationshipMetadata[] = [],
): BusinessSqlRendererPreviewUiModel => {
  const integrated = planBusinessSqlQueryRequestWithJoinResolution({
    prompt,
    relationships,
  });
  const renderability = evaluateBusinessSqlRenderability({ integrated });
  return createBusinessSqlRendererPreviewUiModel(
    renderBusinessSqlFromRenderability({ integrated, renderability }),
  );
};

const renderedModel = modelFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders"),
]);
const needsReviewModel = modelFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "unknown"),
]);
const blockedModel = modelFor("Count orders per customer", [
  relationship("relationship:customers-orders", "customers", "orders", "missing"),
]);
const unsupportedModel = (() => {
  const integrated = planBusinessSqlQueryRequestWithJoinResolution({
    prompt: "Count leases by status",
  });
  return createBusinessSqlRendererPreviewUiModel(
    renderBusinessSqlFromRenderability({
      integrated: {
        ...integrated,
        plan: {
          ...integrated.plan,
          kind: "count_distinct_entity",
        },
      },
    }),
  );
})();

const withOverrides = (
  model: BusinessSqlRendererPreviewUiModel,
  overrides: Partial<BusinessSqlRendererPreviewUiModel>,
): BusinessSqlRendererPreviewUiModel => ({ ...model, ...overrides });

const expectReason = (
  model: BusinessSqlRendererPreviewUiModel | null,
  activeSqlDraft: string,
  reasonCode: BusinessSqlRendererPreviewManualInsertReasonCode,
  priorInsertedFingerprint: string | null = null,
): string[] => {
  const eligibility = getBusinessSqlRendererPreviewManualInsertEligibility({
    rendererPreviewUiModel: model,
    activeSqlDraft,
    priorInsertedFingerprint,
  });
  return [
    ...(eligibility.reasonCode === reasonCode
      ? []
      : [`Expected reason ${reasonCode}, got ${eligibility.reasonCode}.`]),
    ...(reasonCode === "eligible" && eligibility.eligible
      ? []
      : reasonCode === "eligible"
        ? ["Expected eligibility to be true."]
        : []),
    ...(reasonCode !== "eligible" && !eligibility.eligible
      ? []
      : reasonCode !== "eligible"
        ? ["Expected eligibility to be false."]
        : []),
    ...(reasonCode === "eligible" || eligibility.disabledReason
      ? []
      : ["Ineligible result must include disabled reason."]),
  ];
};

const expectAdapterSafetyLiterals = (model: BusinessSqlRendererPreviewUiModel): string[] => [
  ...(model.actions.canInsertSql === false ? [] : ["Adapter canInsertSql must remain false."]),
  ...(model.actions.canRunSql === false ? [] : ["Adapter canRunSql must remain false."]),
  ...(model.insertEligibility.eligible === false
    ? []
    : ["Adapter insertEligibility.eligible must remain false."]),
  ...(model.noEditorMutation === true ? [] : ["Adapter noEditorMutation must remain true."]),
  ...(model.noSqlExecution === true ? [] : ["Adapter noSqlExecution must remain true."]),
  ...(model.noDuckDbExecution === true ? [] : ["Adapter noDuckDbExecution must remain true."]),
];

const expectManualInsertDoesNotEnableExecution = (
  model: BusinessSqlRendererPreviewUiModel,
): string[] => [
  ...(model.actions.canRunSql === false ? [] : ["Manual insert must not enable Run Query metadata."]),
  ...(model.noSqlExecution === true ? [] : ["Manual insert gate must preserve noSqlExecution metadata."]),
  ...(model.noDuckDbExecution === true ? [] : ["Manual insert gate must preserve noDuckDbExecution metadata."]),
  ...(model.noEditorMutation === true ? [] : ["Manual insert gate must preserve adapter noEditorMutation metadata."]),
];

export const BUSINESS_SQL_RENDERER_PREVIEW_MANUAL_INSERT_GATE_FIXTURES: ManualInsertGateFixture[] = [
  {
    name: "rendered DuckDB preview and empty editor is eligible",
    assert: () => [
      ...expectReason(renderedModel, "", "eligible"),
      ...expectAdapterSafetyLiterals(renderedModel),
    ],
  },
  {
    name: "rendered preview with blank SQL is not eligible",
    assert: () =>
      expectReason(withOverrides(renderedModel, { sqlText: "   " }), "", "no_sql_available"),
  },
  {
    name: "rendered preview with blockers is not eligible",
    assert: () =>
      expectReason(
        withOverrides(renderedModel, { blockers: ["Renderer blocker."] }),
        "",
        "resolve_renderer_blockers",
      ),
  },
  {
    name: "needs review preview is not eligible",
    assert: () =>
      expectReason(needsReviewModel, "", "insert_only_from_rendered_duckdb_preview"),
  },
  {
    name: "blocked preview is not eligible",
    assert: () =>
      expectReason(blockedModel, "", "insert_only_from_rendered_duckdb_preview"),
  },
  {
    name: "unsupported preview is not eligible",
    assert: () =>
      expectReason(unsupportedModel, "", "insert_only_from_rendered_duckdb_preview"),
  },
  {
    name: "non-allowed renderer reason is not eligible",
    assert: () =>
      expectReason(
        withOverrides(renderedModel, { reasonCode: "unsupported_plan_shape" }),
        "",
        "renderer_reason_not_eligible",
      ),
  },
  {
    name: "non-empty editor blocks insert",
    assert: () => expectReason(renderedModel, "SELECT 1", "editor_already_has_sql"),
  },
  {
    name: "whitespace-only editor is eligible",
    assert: () => expectReason(renderedModel, "   \n\t", "eligible"),
  },
  {
    name: "prior inserted sentinel blocks insert",
    assert: () =>
      expectReason(
        renderedModel,
        "",
        "one_suggestion_already_inserted",
        "business-sql-preview:inserted",
      ),
  },
  {
    name: "eligible apply returns inserted draft and review feedback",
    assert: () => {
      const result = applyBusinessSqlRendererPreviewManualInsert({
        rendererPreviewUiModel: renderedModel,
        activeSqlDraft: "",
      });
      return [
        ...(result.inserted ? [] : ["Expected insert result to be inserted."]),
        ...(result.nextSqlDraft === renderedModel.sqlText
          ? []
          : ["Expected next draft to equal rendered SQL text."]),
        ...(result.feedback === "Inserted into editor. Review the SQL before running it manually."
          ? []
          : ["Expected review-before-running feedback copy."]),
        ...(result.disabledReason === null ? [] : ["Eligible insert must not include disabled reason."]),
        ...(result.reasonCode === "eligible" ? [] : ["Eligible insert must keep eligible reason code."]),
        ...expectManualInsertDoesNotEnableExecution(renderedModel),
      ];
    },
  },
  {
    name: "manual apply returns SQL draft only through gate result",
    assert: () => {
      const originalDraft = "";
      const result = applyBusinessSqlRendererPreviewManualInsert({
        rendererPreviewUiModel: renderedModel,
        activeSqlDraft: originalDraft,
      });
      const secondEligibility = getBusinessSqlRendererPreviewManualInsertEligibility({
        rendererPreviewUiModel: renderedModel,
        activeSqlDraft: result.nextSqlDraft,
      });

      return [
        ...(result.inserted ? [] : ["Expected manual gate result to report inserted true."]),
        ...(result.nextSqlDraft === renderedModel.sqlText
          ? []
          : ["Manual gate must return preview SQL only as nextSqlDraft."]),
        ...(originalDraft === "" ? [] : ["Fixture draft should remain the empty input value."]),
        ...(secondEligibility.reasonCode === "editor_already_has_sql"
          ? []
          : ["Returned SQL draft must make the next eligibility check non-empty-editor blocked."]),
        ...expectAdapterSafetyLiterals(renderedModel),
      ];
    },
  },
  {
    name: "ineligible apply keeps draft unchanged",
    assert: () => {
      const draft = "SELECT 1";
      const result = applyBusinessSqlRendererPreviewManualInsert({
        rendererPreviewUiModel: renderedModel,
        activeSqlDraft: draft,
      });
      return [
        ...(result.inserted ? ["Expected insert result to stay false."] : []),
        ...(result.nextSqlDraft === draft ? [] : ["Expected draft to remain unchanged."]),
        ...(result.disabledReason ? [] : ["Expected disabled reason for refused insert."]),
      ];
    },
  },
  {
    name: "adapter safety literals remain unchanged",
    assert: () => [
      ...expectAdapterSafetyLiterals(renderedModel),
      ...(renderedModel.noBackendCall && renderedModel.noProviderCall && renderedModel.noNetworkCall
        ? []
        : ["Adapter backend/provider/network flags must remain true."]),
      ...(renderedModel.noPersistence ? [] : ["Adapter noPersistence must remain true."]),
    ],
  },
];

export function runBusinessSqlRendererPreviewManualInsertGateFixtures(): ManualInsertGateFixtureReport {
  const results = BUSINESS_SQL_RENDERER_PREVIEW_MANUAL_INSERT_GATE_FIXTURES.map((fixture) => {
    const failureReasons = fixture.assert();
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary: failureReasons.length === 0 ? "passed" : failureReasons.join("; "),
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
