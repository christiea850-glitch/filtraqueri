import type { SqlDialectId } from "../../sqlIntelligence";
import type { BusinessSqlQueryPlan } from "./businessSqlQueryPlan";
import type { BusinessSqlClarificationDecisionProvenance } from "./businessSqlPreviewProvenance";
import {
  createBusinessSqlPreviewRenderRequest,
  renderBusinessSqlQueryPlanArtifact,
  type BusinessSqlRenderResult,
  type BusinessSqlRendererDialectId,
  type SqlArtifact,
} from "./businessSqlRenderer";
import {
  createBusinessSqlRendererPreviewUiModel,
  type BusinessSqlRendererPreviewUiModel,
} from "./businessSqlRendererPreviewUiAdapter";

export type BusinessSqlRenderPreview = {
  status: "ready" | "needs_review" | "blocked";
  title: string;
  body: string;
  sql: string | null;
  planId: string;
  rendererTarget: "duckdb";
  renderRequestId?: string;
  sqlArtifact?: SqlArtifact;
  guidanceDialect?: SqlDialectId;
  reasons: string[];
  warnings: string[];
  clarificationDecision?: BusinessSqlClarificationDecisionProvenance;
  rendererPreviewUiModel?: BusinessSqlRendererPreviewUiModel;
  actions: {
    canCopySql: boolean;
    canInsertSql: boolean;
    canRunSql: boolean;
  };
};

const titleForStatus = (status: BusinessSqlRenderPreview["status"]): string => {
  if (status === "ready") return "SQL preview ready";
  if (status === "blocked") return "SQL preview blocked";
  return "SQL preview needs review";
};

const bodyForStatus = (status: BusinessSqlRenderPreview["status"]): string => {
  if (status === "ready") {
    return "DuckDB SQL has been rendered for review. It has not been inserted or run.";
  }
  if (status === "blocked") {
    return "SQL cannot be previewed until the blocking plan issues are resolved.";
  }
  return "SQL cannot be previewed until the plan is safe to render.";
};

export function createBusinessSqlRenderPreview(
  plan: BusinessSqlQueryPlan,
  options: {
    clarificationDecision?: BusinessSqlClarificationDecisionProvenance;
    previewDialect?: BusinessSqlRendererDialectId;
  } = {},
): BusinessSqlRenderPreview {
  const renderRequest = createBusinessSqlPreviewRenderRequest(
    plan,
    options.previewDialect || "duckdb",
  );
  const artifact = renderBusinessSqlQueryPlanArtifact(plan, renderRequest);
  const renderResult: BusinessSqlRenderResult = {
    status: artifact.status,
    rendered: artifact.rendered,
    sql: artifact.sql,
    reasonCode: artifact.reasonCode,
    reasons: [...artifact.reasons],
    blockers: [...artifact.blockers],
    warnings: [...artifact.warnings],
    planId: artifact.planId,
    rendererTarget: artifact.dialect,
    executionPayload: null,
    inserted: false,
    ranQuery: false,
    summary: artifact.summary,
  };
  const rendererPreviewUiModel = createBusinessSqlRendererPreviewUiModel(renderResult);
  const status: BusinessSqlRenderPreview["status"] =
    renderResult.status === "rendered"
      ? "ready"
      : renderResult.status === "blocked"
        ? "blocked"
        : "needs_review";
  const sql = status === "ready" ? renderResult.sql : null;

  return {
    status,
    title: titleForStatus(status),
    body: bodyForStatus(status),
    sql,
    planId: plan.id,
    rendererTarget: "duckdb",
    renderRequestId: renderRequest.requestId,
    sqlArtifact: artifact,
    guidanceDialect: plan.renderer.selectedGuidanceDialect,
    reasons: [...renderResult.reasons],
    warnings: [...renderResult.warnings],
    ...(options.clarificationDecision
      ? {
          clarificationDecision: {
            ...options.clarificationDecision,
            presentedOptionIds: [...options.clarificationDecision.presentedOptionIds],
          },
        }
      : {}),
    rendererPreviewUiModel,
    actions: {
      canCopySql: status === "ready" && Boolean(sql),
      canInsertSql: false,
      canRunSql: false,
    },
  };
}

export function summarizeBusinessSqlRenderPreview(
  preview: BusinessSqlRenderPreview,
): string {
  return [
    `status=${preview.status}`,
    `target=${preview.rendererTarget}`,
    preview.guidanceDialect ? `guidance=${preview.guidanceDialect}` : "guidance=none",
    `copy=${preview.actions.canCopySql}`,
    `insert=${preview.actions.canInsertSql}`,
    `run=${preview.actions.canRunSql}`,
    `sql=${preview.sql ? "present" : "none"}`,
    preview.rendererPreviewUiModel
      ? `rendererPreview=${preview.rendererPreviewUiModel.displayStatus}`
      : "rendererPreview=none",
  ].join("; ");
}
